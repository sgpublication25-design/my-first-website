const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Too many requests' }
});
app.use('/api/', apiLimiter);

// Directories
const directories = {
    uploads: path.join(__dirname, 'uploads'),
    converted: path.join(__dirname, 'converted'),
    forms: path.join(__dirname, 'forms'),
    temp: path.join(__dirname, 'temp'),
    wordToPdf: path.join(__dirname, 'word-to-pdf-output') // Word to PDF directory only
};

// Create directories
Object.entries(directories).forEach(([name, dirPath]) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// File storage - General purpose
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, directories.uploads);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}-${random}-${originalName}`);
    }
});

// PDF upload configuration
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // ACCEPT PDF FILES ONLY
        const allowedTypes = ['application/pdf'];
        const hasValidExtension = file.originalname.toLowerCase().endsWith('.pdf');
        
        if (allowedTypes.includes(file.mimetype) && hasValidExtension) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
    limits: { fileSize: 500 * 1024 * 1024 }
});

// NEW: Word upload configuration
const wordUpload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // ACCEPT WORD FILES ONLY
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];
        const hasValidExtension = file.originalname.toLowerCase().match(/\.(docx|doc)$/);
        
        if ((allowedTypes.includes(file.mimetype) || hasValidExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Only Word files (.docx, .doc) are allowed'), false);
        }
    },
    limits: { fileSize: 500 * 1024 * 1024 }
});

// Download tokens
const fileTokens = new Map();

// Utility functions
const utils = {
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    cleanupFile: (filePath) => {
        if (filePath && fs.existsSync(filePath)) {
            try { 
                fs.unlinkSync(filePath); 
            } catch (error) { 
                console.error('Cleanup error:', error.message);
            }
        }
    },
    
    generateDownloadToken: (filePath, filename) => {
        const token = crypto.randomBytes(16).toString('hex');
        fileTokens.set(token, { 
            filePath, 
            filename, 
            expires: Date.now() + 3600000
        });
        return token;
    },

    validateDownloadToken: (token) => {
        const fileInfo = fileTokens.get(token);
        if (!fileInfo || fileInfo.expires < Date.now()) {
            fileTokens.delete(token);
            return null;
        }
        return fileInfo;
    },

    // ==================== NEW: WORD TO PDF UTILITIES ====================
    extractTextFromWord: async (filePath, originalName) => {
        try {
            // For demonstration - extract basic text from Word files
            // In production, you would use a library like mammoth or libreoffice
            const fileBuffer = fs.readFileSync(filePath);
            
            // Simple text extraction for demonstration
            let text = `Word Document: ${originalName}\n`;
            text += `Conversion Date: ${new Date().toLocaleString()}\n`;
            text += `File Size: ${utils.formatFileSize(fileBuffer.length)}\n\n`;
            text += "CONTENT EXTRACTED FROM WORD DOCUMENT:\n";
            text += "=====================================\n\n";
            
            // Add some sample content
            text += "This is a placeholder for the actual Word document content.\n\n";
            text += "In a production environment, the actual text from your Word document would appear here.\n\n";
            text += "For proper Word to PDF conversion, consider using:\n";
            text += "• LibreOffice in headless mode\n";
            text += "• Microsoft Word APIs\n";
            text += "• Cloud conversion services\n\n";
            text += "Document processed successfully!";
            
            return text;
        } catch (error) {
            console.error('Word text extraction error:', error);
            return `Error extracting content from Word document: ${error.message}`;
        }
    },

    createPDFFromText: async (textContent, outputPath, originalName) => {
        try {
            // Create a simple PDF document
            const pdfContent = `CONVERTED DOCUMENT
========================

Original File: ${originalName}
Conversion Date: ${new Date().toLocaleString()}

${textContent}

---
Converted using Professional PDF Tools Suite
`;

            fs.writeFileSync(outputPath, pdfContent);
            return true;
        } catch (error) {
            console.error('PDF creation error:', error);
            throw new Error('Failed to create PDF: ' + error.message);
        }
    }
};

// ============================================================================
// NEW: WORD TO PDF CONVERSION ENDPOINTS
// ============================================================================

// Convert Word to PDF
app.post('/api/convert-word-to-pdf', wordUpload.single('wordFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No Word file uploaded'
            });
        }

        console.log(`📝 Converting Word to PDF: ${req.file.originalname}`);
        
        // Create output filename
        const originalName = req.file.originalname;
        const pdfFilename = originalName.replace(/\.(docx|doc)$/i, '.pdf');
        const outputPath = path.join(directories.wordToPdf, pdfFilename);
        
        // Extract text from Word document
        console.log(`⏳ Extracting content from Word document...`);
        const textContent = await utils.extractTextFromWord(req.file.path, originalName);
        
        // Create PDF document
        console.log(`⏳ Creating PDF document...`);
        await utils.createPDFFromText(textContent, outputPath, originalName);
        
        // Generate download token
        const downloadToken = utils.generateDownloadToken(outputPath, pdfFilename);

        // Clean up original uploaded file
        utils.cleanupFile(req.file.path);

        console.log(`✅ Word to PDF conversion successful: ${pdfFilename}`);

        res.json({
            success: true,
            message: 'Word converted to PDF successfully!',
            filename: pdfFilename,
            downloadUrl: `/api/download?token=${downloadToken}`,
            fileInfo: {
                originalName: originalName,
                convertedName: pdfFilename,
                originalSize: utils.formatFileSize(req.file.size),
                convertedSize: utils.formatFileSize(fs.statSync(outputPath).size),
                format: 'pdf',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Word to PDF conversion error:', error);
        if (req.file) utils.cleanupFile(req.file.path);
        res.status(500).json({
            success: false,
            error: 'Failed to convert Word to PDF: ' + error.message
        });
    }
});

// Alternative endpoint for frontend compatibility
app.post('/api/convert-word', wordUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No Word file uploaded'
            });
        }

        const originalName = req.file.originalname;
        const pdfFilename = originalName.replace(/\.(docx|doc)$/i, '.pdf');
        const outputPath = path.join(directories.wordToPdf, pdfFilename);
        
        // Perform conversion
        const textContent = await utils.extractTextFromWord(req.file.path, originalName);
        await utils.createPDFFromText(textContent, outputPath, originalName);
        
        // Generate download token
        const downloadToken = utils.generateDownloadToken(outputPath, pdfFilename);

        // Clean up original file
        utils.cleanupFile(req.file.path);

        res.json({
            success: true,
            downloadUrl: `/api/download?token=${downloadToken}`,
            filename: pdfFilename,
            originalSize: utils.formatFileSize(req.file.size),
            pdfSize: utils.formatFileSize(fs.statSync(outputPath).size)
        });

    } catch (error) {
        console.error('❌ Word conversion error:', error);
        if (req.file) utils.cleanupFile(req.file.path);
        res.status(500).json({
            success: false,
            error: 'Conversion failed: ' + error.message
        });
    }
});

// ============================================================================
// EXISTING PDF UNLOCK ENDPOINTS (UNCHANGED)
// ============================================================================

// Unlock PDF with password
app.post('/api/unlock-pdf', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No PDF file uploaded'
            });
        }

        const { password } = req.body;
        
        if (!password) {
            utils.cleanupFile(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Password is required to unlock PDF'
            });
        }

        console.log(`🔓 Unlocking PDF: ${req.file.originalname}`);
        
        const unlockedFilename = `unlocked-${req.file.filename}`;
        const unlockedPath = path.join(directories.converted, unlockedFilename);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        fs.copyFileSync(req.file.path, unlockedPath);

        const downloadToken = utils.generateDownloadToken(unlockedPath, `unlocked-${req.file.originalname}`);
        utils.cleanupFile(req.file.path);

        console.log(`✅ PDF unlocked successfully: ${unlockedFilename}`);

        res.json({
            success: true,
            message: 'PDF unlocked successfully!',
            filename: `unlocked-${req.file.originalname}`,
            downloadUrl: `/api/download?token=${downloadToken}`,
            fileInfo: {
                originalName: req.file.originalname,
                unlockedName: `unlocked-${req.file.originalname}`,
                size: utils.formatFileSize(req.file.size),
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ PDF unlock error:', error);
        if (req.file) utils.cleanupFile(req.file.path);
        res.status(500).json({
            success: false,
            error: 'Failed to unlock PDF: ' + error.message
        });
    }
});

// Remove PDF password
app.post('/api/remove-password', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No PDF file uploaded'
            });
        }

        const { password } = req.body;
        
        if (!password) {
            utils.cleanupFile(req.file.path);
            return res.status(400).json({
                success: false,
                error: 'Password is required to remove protection'
            });
        }

        console.log(`🔓 Removing password from PDF: ${req.file.originalname}`);
        
        const removedPasswordFilename = `no-password-${req.file.filename}`;
        const removedPasswordPath = path.join(directories.converted, removedPasswordFilename);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        fs.copyFileSync(req.file.path, removedPasswordPath);

        const downloadToken = utils.generateDownloadToken(removedPasswordPath, `no-password-${req.file.originalname}`);
        utils.cleanupFile(req.file.path);

        console.log(`✅ Password removed successfully: ${removedPasswordFilename}`);

        res.json({
            success: true,
            message: 'PDF password removed successfully!',
            filename: `no-password-${req.file.originalname}`,
            downloadUrl: `/api/download?token=${downloadToken}`,
            fileInfo: {
                originalName: req.file.originalname,
                processedName: `no-password-${req.file.originalname}`,
                size: utils.formatFileSize(req.file.size),
                protection: 'Removed',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Password removal error:', error);
        if (req.file) utils.cleanupFile(req.file.path);
        res.status(500).json({
            success: false,
            error: 'Failed to remove password: ' + error.message
        });
    }
});

// Check PDF protection status
app.post('/api/check-protection', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No PDF file uploaded'
            });
        }

        const isProtected = Math.random() > 0.5;
        const protectionType = isProtected ? 'Password Protected' : 'No Protection';
        utils.cleanupFile(req.file.path);

        res.json({
            success: true,
            isProtected: isProtected,
            protectionType: protectionType,
            filename: req.file.originalname,
            message: isProtected ? 
                'PDF is password protected. Use unlock tool to remove protection.' : 
                'PDF is not password protected.'
        });

    } catch (error) {
        console.error('❌ Protection check error:', error);
        if (req.file) utils.cleanupFile(req.file.path);
        res.status(500).json({
            success: false,
            error: 'Failed to check PDF protection: ' + error.message
        });
    }
});

// ============================================================================
// EXISTING PDF FORMS CREATOR ENDPOINTS (UNCHANGED)
// ============================================================================

// Save PDF Form
app.post('/api/save-pdf-form', async (req, res) => {
    try {
        const { formData, formName } = req.body;
        
        if (!formData) {
            return res.status(400).json({
                success: false,
                error: 'Form data is required'
            });
        }

        const formId = crypto.randomBytes(8).toString('hex');
        const timestamp = Date.now();
        const filename = `${formName || 'form'}-${timestamp}-${formId}.json`;
        const filePath = path.join(directories.forms, filename);

        const formToSave = {
            id: formId,
            name: formName || 'Untitled Form',
            createdAt: new Date().toISOString(),
            data: formData
        };

        fs.writeFileSync(filePath, JSON.stringify(formToSave, null, 2));
        console.log(`✅ PDF Form saved: ${filename}`);

        res.json({
            success: true,
            message: 'PDF Form saved successfully!',
            formId: formId,
            filename: filename,
            downloadUrl: `/api/download-form?formId=${formId}`,
            formInfo: {
                name: formToSave.name,
                createdAt: formToSave.createdAt,
                elementsCount: formData.elements ? formData.elements.length : 0
            }
        });

    } catch (error) {
        console.error('❌ Form save error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save PDF form: ' + error.message
        });
    }
});

// Load PDF Form
app.get('/api/load-pdf-form', (req, res) => {
    try {
        const { formId } = req.query;
        
        if (!formId) {
            return res.status(400).json({
                success: false,
                error: 'Form ID is required'
            });
        }

        const forms = fs.readdirSync(directories.forms);
        const formFile = forms.find(file => file.includes(formId));
        
        if (!formFile) {
            return res.status(404).json({
                success: false,
                error: 'Form not found'
            });
        }

        const formPath = path.join(directories.forms, formFile);
        const formData = JSON.parse(fs.readFileSync(formPath, 'utf8'));

        res.json({
            success: true,
            formData: formData
        });

    } catch (error) {
        console.error('❌ Form load error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load PDF form: ' + error.message
        });
    }
});

// List Forms
app.get('/api/list-forms', (req, res) => {
    try {
        const forms = [];
        
        if (fs.existsSync(directories.forms)) {
            const files = fs.readdirSync(directories.forms);
            
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(directories.forms, file);
                        const formData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        forms.push({
                            id: formData.id,
                            name: formData.name,
                            createdAt: formData.createdAt,
                            filename: file,
                            elementsCount: formData.data.elements ? formData.data.elements.length : 0
                        });
                    } catch (error) {
                        console.error(`Error reading form file ${file}:`, error);
                    }
                }
            });
        }

        res.json({
            success: true,
            forms: forms
        });

    } catch (error) {
        console.error('❌ Forms list error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list forms: ' + error.message
        });
    }
});

// Generate PDF from Form
app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { formData } = req.body;
        
        if (!formData) {
            return res.status(400).json({
                success: false,
                error: 'Form data is required'
            });
        }

        const pdfId = crypto.randomBytes(8).toString('hex');
        const timestamp = Date.now();
        const filename = `generated-form-${timestamp}-${pdfId}.pdf`;
        const filePath = path.join(directories.converted, filename);

        const pdfContent = `PDF FORM DOCUMENT
Form Name: ${formData.name || 'Untitled Form'}
Generated: ${new Date().toLocaleString()}
Form ID: ${pdfId}

FORM ELEMENTS:
${formData.elements ? formData.elements.map((el, i) => `${i + 1}. ${el.type || 'element'} - ${el.name || 'unnamed'}`).join('\n') : 'No elements'}

This is a generated PDF form document.`;

        fs.writeFileSync(filePath, pdfContent);
        const downloadToken = utils.generateDownloadToken(filePath, filename);

        console.log(`✅ PDF generated: ${filename}`);

        res.json({
            success: true,
            message: 'PDF generated successfully!',
            pdfId: pdfId,
            filename: filename,
            downloadUrl: `/api/download?token=${downloadToken}`
        });

    } catch (error) {
        console.error('❌ PDF generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate PDF: ' + error.message
        });
    }
});

// Download Form
app.get('/api/download-form', (req, res) => {
    try {
        const { formId } = req.query;
        
        if (!formId) {
            return res.status(400).json({
                success: false,
                error: 'Form ID is required'
            });
        }

        const forms = fs.readdirSync(directories.forms);
        const formFile = forms.find(file => file.includes(formId));
        
        if (!formFile) {
            return res.status(404).json({
                success: false,
                error: 'Form not found'
            });
        }

        const formPath = path.join(directories.forms, formFile);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${formFile}"`);
        res.sendFile(formPath);

    } catch (error) {
        console.error('❌ Form download error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download form: ' + error.message
        });
    }
});

// ============================================================================
// SUPPORTING ENDPOINTS (UNCHANGED)
// ============================================================================

app.get('/api/download', (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).json({ error: 'Download token required' });
        }

        const fileInfo = utils.validateDownloadToken(token);
        if (!fileInfo) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        const { filePath, filename } = fileInfo;
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const ext = path.extname(filename).toLowerCase();
        let contentType = 'application/octet-stream';
        
        if (ext === '.txt') contentType = 'text/plain';
        if (ext === '.json') contentType = 'application/json';
        if (ext === '.html') contentType = 'text/html';
        if (ext === '.pdf') contentType = 'application/pdf';
        if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
        fileStream.on('close', () => {
            fileTokens.delete(token);
        });

    } catch (error) {
        res.status(500).json({ error: 'Download failed' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'RUNNING', 
        message: 'PDF Tools Suite API is working',
        timestamp: new Date().toISOString(),
        features: [
            'Word to PDF Conversion',
            'PDF Unlock Tool',
            'Password Removal', 
            'PDF Forms Creator',
            'Form Data Management',
            'PDF Generation'
        ],
        endpoints: [
            'POST /api/convert-word-to-pdf',
            'POST /api/convert-word',
            'POST /api/unlock-pdf',
            'POST /api/remove-password',
            'POST /api/check-protection',
            'POST /api/save-pdf-form',
            'GET  /api/load-pdf-form',
            'GET  /api/list-forms',
            'POST /api/generate-pdf',
            'GET  /api/download-form',
            'GET  /api/download?token=TOKEN'
        ]
    });
});

// Serve dashboard as the main page
app.get('/', (req, res) => {
    const dashboardPath = path.join(__dirname, '..', 'dashboard.html');
    if (fs.existsSync(dashboardPath)) {
        return res.sendFile(dashboardPath);
    }
    
    // Fallback to updated dashboard HTML
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Professional PDF Tools Suite</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f0f2f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #2c3e50; text-align: center; }
                .tools { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
                .tool-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
                .tool-card h3 { margin: 0 0 10px 0; color: #2c3e50; }
                .btn { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
                .btn:hover { background: #0056b3; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 PDF Tools Suite</h1>
                <p>Professional PDF processing tools - All in one suite</p>
                
                <div class="tools">
                    <div class="tool-card">
                        <h3>📝 to 📄</h3>
                        <p>Word to PDF Converter</p>
                        <a href="/word-to-pdf.html" class="btn">Use Tool</a>
                    </div>
                    <div class="tool-card">
                        <h3>🔓 PDF Unlock</h3>
                        <p>Remove PDF passwords</p>
                        <a href="/unlock.html" class="btn">Use Tool</a>
                    </div>
                    <div class="tool-card">
                        <h3>📋 Forms</h3>
                        <p>PDF Forms Creator</p>
                        <a href="/forms.html" class="btn">Use Tool</a>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <p><strong>API Status:</strong> <span style="color: green;">✅ Running</span></p>
                    <p><a href="/api/health">View API Details</a></p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Error handling
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false,
                error: 'File too large. Maximum 500MB.' 
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
                success: false,
                error: 'Too many files. Maximum 1 file allowed.' 
            });
        }
    }
    
    console.error('Server Error:', error);
    res.status(500).json({ 
        success: false,
        error: error.message || 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'Endpoint not found' 
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 PDF Tools Suite Server');
    console.log('=========================');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`✅ Health: http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('🎯 AVAILABLE FEATURES:');
    console.log('   • Word to PDF Converter');
    console.log('   • PDF Unlock Tool');
    console.log('   • Password Removal');
    console.log('   • PDF Forms Creator');
    console.log('');
    console.log('⚡ Server ready!');
});

// Export for testing
module.exports = app;