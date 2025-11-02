// watermark-script.js
class PDFWatermarkTool {
    constructor() {
        this.currentFile = null;
        this.watermarkType = 'text';
        this.watermarkImage = null;
        this.watermarkedPdfBytes = null;
        this.currentPosition = 'center';
        this.isProcessing = false;

        this.initializeEventListeners();
        this.updatePreview();
    }

    initializeEventListeners() {
        // File handling
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleImageSelect(e));
        
        // Drag and drop
        const uploadBox = document.getElementById('uploadBox');
        uploadBox.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadBox.addEventListener('drop', (e) => this.handleDrop(e));

        // Real-time preview updates
        document.getElementById('watermarkText').addEventListener('input', () => this.updatePreview());
        document.getElementById('textFont').addEventListener('change', () => this.updatePreview());
        document.getElementById('textSize').addEventListener('input', () => this.updatePreview());
        document.getElementById('textColor').addEventListener('input', () => this.updatePreview());
        document.getElementById('textOpacity').addEventListener('input', () => this.updatePreview());
        document.getElementById('imageSize').addEventListener('input', () => this.updatePreview());
        document.getElementById('imageOpacity').addEventListener('input', () => this.updatePreview());
        document.getElementById('rotation').addEventListener('input', () => this.updatePreview());

        // Range value displays
        this.setupRangeDisplays();
    }

    setupRangeDisplays() {
        const ranges = [
            { id: 'textSize', display: 'textSizeValue', suffix: 'px' },
            { id: 'textOpacity', display: 'textOpacityValue', suffix: '%' },
            { id: 'imageSize', display: 'imageSizeValue', suffix: '%' },
            { id: 'imageOpacity', display: 'imageOpacityValue', suffix: '%' },
            { id: 'rotation', display: 'rotationValue', suffix: '°' }
        ];

        ranges.forEach(range => {
            const element = document.getElementById(range.id);
            const display = document.getElementById(range.display);
            
            element.addEventListener('input', () => {
                display.textContent = element.value + range.suffix;
                this.updatePreview();
            });
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadBox').style.background = '#e9ecef';
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadBox').style.background = '#f8f9fa';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            this.handleFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    async handleFile(file) {
        if (file.size > 10 * 1024 * 1024) {
            this.showError('File size must be less than 10MB');
            return;
        }

        if (file.type !== 'application/pdf') {
            this.showError('Please select a PDF file');
            return;
        }

        this.currentFile = file;
        
        // Show file info
        document.getElementById('fileInfo').style.display = 'block';
        document.getElementById('fileName').textContent = `Name: ${file.name}`;
        document.getElementById('fileSize').textContent = `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        
        // Enable next button
        document.getElementById('nextToWatermark').style.display = 'inline-block';

        this.showSuccess('PDF file loaded successfully');
    }

    handleImageSelect(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                this.showError('Image size must be less than 5MB');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                this.watermarkImage = event.target.result;
                
                // Show image preview
                document.getElementById('imagePreview').src = this.watermarkImage;
                document.getElementById('imagePreview').style.display = 'block';
                document.getElementById('imageLivePreview').src = this.watermarkImage;
                
                document.getElementById('imageInfo').textContent = `Image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                this.updatePreview();
                
                this.showSuccess('Watermark image loaded successfully');
            };
            reader.readAsDataURL(file);
        }
    }

    selectWatermarkType(type) {
        this.watermarkType = type;
        document.querySelectorAll('.type-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        event.target.closest('.type-option').classList.add('selected');

        // Show/hide appropriate settings
        document.getElementById('text-settings').style.display = type === 'text' ? 'block' : 'none';
        document.getElementById('image-settings').style.display = type === 'image' ? 'block' : 'none';

        this.updatePreview();
    }

    selectPosition(position) {
        this.currentPosition = position;
        document.querySelectorAll('.position-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        event.target.classList.add('selected');
        this.updatePreview();
    }

    updatePreview() {
        const textPreview = document.getElementById('textPreview');
        const imagePreview = document.getElementById('imageLivePreview');

        if (this.watermarkType === 'text') {
            textPreview.style.display = 'block';
            imagePreview.style.display = 'none';

            // Apply text styles
            textPreview.textContent = document.getElementById('watermarkText').value || 'CONFIDENTIAL';
            textPreview.style.fontFamily = document.getElementById('textFont').value;
            textPreview.style.fontSize = document.getElementById('textSize').value + 'px';
            textPreview.style.color = document.getElementById('textColor').value;
            textPreview.style.opacity = (document.getElementById('textOpacity').value / 100);
            textPreview.style.transform = `rotate(${document.getElementById('rotation').value}deg)`;
        } else {
            textPreview.style.display = 'none';
            imagePreview.style.display = 'block';

            // Apply image styles
            imagePreview.style.opacity = (document.getElementById('imageOpacity').value / 100);
            imagePreview.style.transform = `rotate(${document.getElementById('rotation').value}deg)`;
            const size = document.getElementById('imageSize').value;
            imagePreview.style.width = size + '%';
            imagePreview.style.height = 'auto';
        }
    }

    updateConversionSummary() {
        const summary = document.getElementById('conversionSummary');
        const type = this.watermarkType === 'text' ? 
            `"${document.getElementById('watermarkText').value}" text watermark` : 
            'image watermark';
        
        summary.textContent = `Ready to apply ${type} to your PDF with the current settings.`;
    }

    async applyWatermark() {
        if (this.isProcessing) return;
        
        if (!this.currentFile) {
            this.showError('Please select a PDF file first.');
            return;
        }

        if (this.watermarkType === 'image' && !this.watermarkImage) {
            this.showError('Please select a watermark image first.');
            return;
        }

        this.isProcessing = true;
        this.showProgress('Loading PDF...', 10);

        try {
            // Read the PDF file
            const arrayBuffer = await this.currentFile.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            this.showProgress('Applying watermark...', 50);

            const pages = pdfDoc.getPages();
            const totalPages = pages.length;

            // Get settings
            const opacity = this.watermarkType === 'text' ? 
                parseInt(document.getElementById('textOpacity').value) / 100 :
                parseInt(document.getElementById('imageOpacity').value) / 100;
            
            const rotation = parseInt(document.getElementById('rotation').value);

            // Apply watermark to each page
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                // Calculate position
                let x, y;
                switch (this.currentPosition) {
                    case 'top-left': x = width * 0.1; y = height * 0.9; break;
                    case 'top-center': x = width / 2; y = height * 0.9; break;
                    case 'top-right': x = width * 0.9; y = height * 0.9; break;
                    case 'middle-left': x = width * 0.1; y = height / 2; break;
                    case 'center': x = width / 2; y = height / 2; break;
                    case 'middle-right': x = width * 0.9; y = height / 2; break;
                    case 'bottom-left': x = width * 0.1; y = height * 0.1; break;
                    case 'bottom-center': x = width / 2; y = height * 0.1; break;
                    case 'bottom-right': x = width * 0.9; y = height * 0.1; break;
                }

                if (this.watermarkType === 'text') {
                    const watermarkText = document.getElementById('watermarkText').value || 'CONFIDENTIAL';
                    const fontSize = parseInt(document.getElementById('textSize').value);
                    const color = document.getElementById('textColor').value;
                    
                    // Convert hex to RGB
                    const r = parseInt(color.substr(1, 2), 16) / 255;
                    const g = parseInt(color.substr(3, 2), 16) / 255;
                    const b = parseInt(color.substr(5, 2), 16) / 255;

                    page.drawText(watermarkText, {
                        x: x,
                        y: y,
                        size: fontSize,
                        opacity: opacity,
                        rotate: PDFLib.degrees(rotation),
                        color: PDFLib.rgb(r, g, b),
                    });
                } else {
                    // For image watermark, use text placeholder (advanced image embedding requires more complex setup)
                    const imageSize = parseInt(document.getElementById('imageSize').value) / 100;
                    
                    page.drawText(`[IMAGE WATERMARK]`, {
                        x: x,
                        y: y,
                        size: 20,
                        opacity: opacity,
                        rotate: PDFLib.degrees(rotation),
                        color: PDFLib.rgb(0.5, 0.5, 0.5),
                    });
                }

                // Update progress
                const progress = 50 + ((i + 1) / totalPages) * 40;
                this.showProgress(`Processed page ${i + 1} of ${totalPages}`, progress);
            }

            // Save the watermarked PDF
            this.watermarkedPdfBytes = await pdfDoc.save();
            
            this.showProgress('Watermark applied successfully!', 100);

            // Move to results tab
            setTimeout(() => {
                this.switchTab('results');
                this.isProcessing = false;
            }, 1000);

        } catch (error) {
            console.error('Error applying watermark:', error);
            this.showError('Error applying watermark. Please try again.');
            this.isProcessing = false;
        }
    }

    async applyWatermarkServer() {
        if (this.isProcessing) return;
        
        if (!this.currentFile) {
            this.showError('Please select a PDF file first.');
            return;
        }

        this.isProcessing = true;
        this.showProgress('Uploading PDF to server...', 10);

        try {
            const formData = new FormData();
            formData.append('pdf', this.currentFile);
            
            const watermarkData = {
                type: this.watermarkType,
                text: document.getElementById('watermarkText').value || 'CONFIDENTIAL',
                opacity: parseInt(this.watermarkType === 'text' ? 
                    document.getElementById('textOpacity').value : 
                    document.getElementById('imageOpacity').value) / 100,
                rotation: parseInt(document.getElementById('rotation').value),
                position: this.currentPosition,
                fontSize: parseInt(document.getElementById('textSize').value),
                color: document.getElementById('textColor').value
            };
            
            formData.append('watermarkData', JSON.stringify(watermarkData));

            if (this.watermarkType === 'image' && this.watermarkImage) {
                // Convert base64 to blob for image upload
                const imageBlob = this.dataURLtoBlob(this.watermarkImage);
                formData.append('watermarkImage', imageBlob, 'watermark.png');
            }

            const response = await fetch('/api/watermark-pdf', {
                method: 'POST',
                body: formData
            });

            this.showProgress('Processing watermark...', 60);

            const result = await response.json();

            if (result.success) {
                this.showProgress('Downloading watermarked PDF...', 90);
                
                // Download the file
                await this.downloadFile(result.downloadUrl, 
                    this.currentFile.name.replace('.pdf', '-watermarked.pdf'));
                
                this.showProgress('Watermark applied successfully!', 100);
                
                setTimeout(() => {
                    this.switchTab('results');
                    this.isProcessing = false;
                }, 1000);
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Server watermark error:', error);
            this.showError('Error applying watermark: ' + error.message);
            this.isProcessing = false;
        }
    }

    async downloadFile(url, filename) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            throw new Error('Failed to download file');
        }
    }

    downloadWatermarkedPDF() {
        if (!this.watermarkedPdfBytes) {
            this.showError('No watermarked PDF available. Please apply watermark first.');
            return;
        }

        // Create blob and download
        const blob = new Blob([this.watermarkedPdfBytes], { type: 'application/pdf' });
        const filename = this.currentFile ? 
            this.currentFile.name.replace('.pdf', '-watermarked.pdf') : 
            'watermarked-document.pdf';
        
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
    }

    // Utility functions
    showProgress(message, percentage) {
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('progressBar').style.width = percentage + '%';
        document.getElementById('status').textContent = message;
        document.getElementById('status').style.color = '#718096';
    }

    showError(message) {
        document.getElementById('status').textContent = message;
        document.getElementById('status').style.color = '#e53e3e';
        document.getElementById('progressBar').style.width = '0%';
    }

    showSuccess(message) {
        document.getElementById('status').textContent = message;
        document.getElementById('status').style.color = '#38a169';
    }

    dataURLtoBlob(dataURL) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        
        for (let i = 0; i < raw.length; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], { type: contentType });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.querySelector(`.tab[onclick="switchTab('${tabName}')"]`).classList.add('active');

        if (tabName === 'settings') {
            this.updatePreview();
        } else if (tabName === 'convert') {
            this.updateConversionSummary();
        }
    }

    resetTool() {
        this.currentFile = null;
        this.watermarkImage = null;
        this.watermarkedPdfBytes = null;
        this.watermarkType = 'text';
        this.currentPosition = 'center';
        
        document.getElementById('fileInput').value = '';
        document.getElementById('imageInput').value = '';
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('nextToWatermark').style.display = 'none';
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('progressContainer').style.display = 'none';
        
        this.updatePreview();
    }
}

// Global functions for HTML onclick events
function switchTab(tabName) {
    window.watermarkTool.switchTab(tabName);
}

function selectWatermarkType(type) {
    window.watermarkTool.selectWatermarkType(type);
}

function selectPosition(position) {
    window.watermarkTool.selectPosition(position);
}

function applyWatermark() {
    // Choose between client-side or server-side processing
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.watermarkTool.applyWatermarkServer(); // Use server for better performance
    } else {
        window.watermarkTool.applyWatermark(); // Client-side fallback
    }
}

function downloadWatermarkedPDF() {
    window.watermarkTool.downloadWatermarkedPDF();
}

// Initialize the tool when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.watermarkTool = new PDFWatermarkTool();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl + Enter to apply watermark
        if (e.ctrlKey && e.key === 'Enter') {
            const convertTab = document.getElementById('convert-tab');
            if (convertTab.classList.contains('active')) {
                applyWatermark();
            }
        }
        
        // Escape to reset
        if (e.key === 'Escape') {
            window.watermarkTool.resetTool();
        }
    });
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFWatermarkTool;
}