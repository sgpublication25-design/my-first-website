class PDFPasswordProtector {
    constructor() {
        this.pdfFile = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // File input change
        const fileInput = document.getElementById('pdfFile');
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // Drag and drop functionality
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                fileInput.files = files;
                this.handleFileSelect({ target: fileInput });
            } else {
                this.showStatus('Please drop a valid PDF file', 'error');
            }
        });

        // Operation type change
        document.querySelectorAll('input[name="operation"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleOperationChange(e.target.value);
            });
        });

        // Process button
        document.getElementById('processBtn').addEventListener('click', () => {
            this.processPDF();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetTool();
        });

        // Real-time password validation
        document.getElementById('password')?.addEventListener('input', () => {
            this.validatePasswords();
        });

        document.getElementById('confirmPassword')?.addEventListener('input', () => {
            this.validatePasswords();
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            this.pdfFile = file;
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('processBtn').disabled = false;
            this.showStatus(`✅ File selected: ${file.name} (${this.formatFileSize(file.size)})`, 'success');
        } else {
            this.showStatus('❌ Please select a valid PDF file', 'error');
            document.getElementById('processBtn').disabled = true;
        }
    }

    handleOperationChange(operation) {
        const passwordFields = document.getElementById('passwordFields');
        const removePasswordFields = document.getElementById('removePasswordFields');
        const permissionsSection = document.getElementById('permissionsSection');

        if (operation === 'protect') {
            passwordFields.style.display = 'block';
            removePasswordFields.style.display = 'none';
            permissionsSection.style.display = 'block';
        } else {
            passwordFields.style.display = 'none';
            removePasswordFields.style.display = 'block';
            permissionsSection.style.display = 'none';
        }
    }

    validatePasswords() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password && confirmPassword) {
            if (password !== confirmPassword) {
                document.getElementById('confirmPassword').style.borderColor = '#e74c3c';
                return false;
            } else {
                document.getElementById('confirmPassword').style.borderColor = '#27ae60';
                return true;
            }
        }
        return true;
    }

    async processPDF() {
        if (!this.pdfFile) {
            this.showStatus('❌ Please select a PDF file first', 'error');
            return;
        }

        const operation = document.querySelector('input[name="operation"]:checked').value;
        const processBtn = document.getElementById('processBtn');
        
        // Validate inputs
        if (operation === 'protect') {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!password || !confirmPassword) {
                this.showStatus('❌ Please enter and confirm your password', 'error');
                return;
            }

            if (password !== confirmPassword) {
                this.showStatus('❌ Passwords do not match', 'error');
                return;
            }

            if (password.length < 4) {
                this.showStatus('❌ Password must be at least 4 characters long', 'error');
                return;
            }
        } else {
            const existingPassword = document.getElementById('existingPassword').value;
            if (!existingPassword) {
                this.showStatus('❌ Please enter the current PDF password', 'error');
                return;
            }
        }

        // Show loading state
        processBtn.disabled = true;
        processBtn.classList.add('loading');
        processBtn.innerHTML = 'Processing...';
        
        this.showStatus('🔄 Processing your PDF...', 'info');

        try {
            const formData = new FormData();
            formData.append('pdfFile', this.pdfFile);

            if (operation === 'protect') {
                const password = document.getElementById('password').value;
                const permissions = {
                    allowPrinting: document.getElementById('allowPrinting').checked,
                    allowCopying: document.getElementById('allowCopying').checked,
                    allowModification: document.getElementById('allowModification').checked
                };
                
                formData.append('password', password);
                formData.append('confirmPassword', password);
                formData.append('permissions', JSON.stringify(permissions));

                const response = await fetch('/api/pdf-password/protect', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    this.showDownloadSection(result.filename, result.downloadUrl, 'protected');
                    this.showStatus('✅ PDF protected successfully!', 'success');
                } else {
                    throw new Error(result.error);
                }

            } else {
                const existingPassword = document.getElementById('existingPassword').value;
                formData.append('currentPassword', existingPassword);

                const response = await fetch('/api/pdf-password/unprotect', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    this.showDownloadSection(result.filename, result.downloadUrl, 'unlocked');
                    this.showStatus('✅ PDF unlocked successfully!', 'success');
                } else {
                    throw new Error(result.error);
                }
            }

        } catch (error) {
            console.error('Processing error:', error);
            this.showStatus(`❌ Error: ${error.message}`, 'error');
        } finally {
            // Reset button state
            processBtn.disabled = false;
            processBtn.classList.remove('loading');
            processBtn.innerHTML = '🚀 Process PDF';
        }
    }

    showDownloadSection(filename, downloadUrl, type) {
        const downloadLink = document.getElementById('downloadLink');
        const downloadSection = document.getElementById('downloadSection');
        
        downloadLink.href = downloadUrl;
        downloadLink.download = filename;
        downloadLink.textContent = type === 'protected' 
            ? `📥 Download Protected PDF` 
            : `📥 Download Unlocked PDF`;
        
        downloadSection.style.display = 'block';
        
        // Scroll to download section
        downloadSection.scrollIntoView({ behavior: 'smooth' });
    }

    resetTool() {
        // Reset form
        document.getElementById('pdfFile').value = '';
        document.getElementById('fileName').textContent = '';
        document.getElementById('password').value = '';
        document.getElementById('confirmPassword').value = '';
        document.getElementById('existingPassword').value = '';
        document.querySelector('input[name="operation"][value="protect"]').checked = true;
        document.getElementById('allowPrinting').checked = true;
        document.getElementById('allowCopying').checked = true;
        document.getElementById('allowModification').checked = true;
        
        // Reset UI
        document.getElementById('processBtn').disabled = true;
        document.getElementById('downloadSection').style.display = 'none';
        document.getElementById('status').textContent = '';
        document.getElementById('status').className = 'status';
        
        this.handleOperationChange('protect');
        this.pdfFile = null;
        
        this.showStatus('🔄 Tool reset. Ready for next file!', 'info');
        setTimeout(() => {
            document.getElementById('status').textContent = '';
        }, 3000);
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
        statusElement.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status';
                statusElement.style.display = 'none';
            }, 5000);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PDFPasswordProtector();
});