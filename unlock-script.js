// unlock-script.js - Frontend JavaScript for PDF Unlock Tool
let selectedFile = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const unlockOptions = document.getElementById('unlockOptions');
const fileName = document.getElementById('fileName');
const unlockBtn = document.getElementById('unlockBtn');
const resetBtn = document.getElementById('resetBtn');
const statusArea = document.getElementById('statusArea');
const passwordInput = document.getElementById('password');

// File selection handling
fileInput.addEventListener('change', handleFileSelect);

// Toggle password visibility
function togglePasswordVisibility() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
}

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#ffe4ec';
    uploadArea.style.borderColor = '#fdcb6e';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.background = '#fff0f5';
    uploadArea.style.borderColor = '#fd79a8';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#fff0f5';
    uploadArea.style.borderColor = '#fd79a8';
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

async function handleFile(file) {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        showStatus('Please select a PDF file.', 'error');
        return;
    }
    
    try {
        showStatus('Checking PDF protection status...', 'info');
        
        // Check if PDF is protected
        const protectionStatus = await checkPdfProtection(file);
        
        selectedFile = file;
        fileName.textContent = file.name;
        unlockOptions.style.display = 'block';
        
        if (protectionStatus.isProtected) {
            if (protectionStatus.canBeUnlocked) {
                showStatus('PDF is protected. You can attempt to unlock it.', 'warning');
            } else {
                showStatus('This PDF is strongly encrypted and requires specialized decryption software.', 'error');
                unlockBtn.disabled = true;
            }
        } else {
            showStatus('PDF is not password protected. You can still remove any existing restrictions.', 'success');
        }
        
    } catch (error) {
        console.error('Error checking PDF:', error);
        showStatus('Error analyzing PDF: ' + error.message, 'error');
    }
}

// Check PDF protection status
async function checkPdfProtection(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/check-pdf-protection', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check PDF protection');
    }
    
    return await response.json();
}

// Unlock PDF functionality
unlockBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showStatus('Please select a PDF file first.', 'error');
        return;
    }
    
    try {
        showStatus('Processing PDF unlock...', 'info');
        unlockBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('password', passwordInput.value);
        formData.append('unlockMethod', document.querySelector('input[name="unlockMethod"]:checked').value);
        
        const response = await fetch('/api/unlock-pdf', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to unlock PDF');
        }
        
        if (result.success) {
            // Download the unlocked PDF
            const downloadLink = document.createElement('a');
            downloadLink.href = result.downloadUrl;
            
            const originalName = selectedFile.name.replace('.pdf', '');
            const downloadName = `${originalName}-unlocked.pdf`;
            downloadLink.download = downloadName;
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            showStatus(result.message, 'success');
            
            // Reset form after successful unlock
            setTimeout(() => {
                resetForm();
            }, 3000);
        } else {
            throw new Error(result.error || 'Unlock operation failed');
        }
        
    } catch (error) {
        console.error('Unlock error:', error);
        
        if (error.message.includes('strongly encrypted')) {
            showStatus('This PDF uses strong encryption that cannot be removed with this tool. Please use specialized PDF decryption software.', 'error');
        } else {
            showStatus('Error unlocking PDF: ' + error.message, 'error');
        }
    } finally {
        unlockBtn.disabled = false;
    }
});

// Reset functionality
resetBtn.addEventListener('click', resetForm);

function resetForm() {
    selectedFile = null;
    fileInput.value = '';
    unlockOptions.style.display = 'none';
    passwordInput.value = '';
    passwordInput.setAttribute('type', 'password');
    document.querySelector('input[name="unlockMethod"][value="remove"]').checked = true;
    unlockBtn.disabled = false;
    showStatus('Select a PDF file to remove password protection or restrictions.', 'info');
}

// Status display function
function showStatus(message, type) {
    statusArea.innerHTML = `<div class="status status-${type}">${message}</div>`;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (statusArea.innerHTML.includes(message)) {
                statusArea.innerHTML = '';
            }
        }, 5000);
    }
}

// Keyboard shortcut for password visibility
passwordInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        togglePasswordVisibility();
    }
});

// Input validation
passwordInput.addEventListener('input', function() {
    if (this.value.length > 50) {
        this.value = this.value.slice(0, 50);
        showStatus('Password too long. Maximum 50 characters.', 'warning');
    }
});

// Initialize tool
function initUnlockTool() {
    showStatus('Select a password-protected PDF file to remove restrictions.', 'info');
    unlockOptions.style.display = 'none';
}

// Export functions for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initUnlockTool,
        handleFile,
        resetForm,
        showStatus
    };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initUnlockTool();
    
    // Add tooltips
    passwordInput.title = 'Enter the PDF password if known (Ctrl+E to toggle visibility)';
    
    const unlockMethods = document.querySelectorAll('input[name="unlockMethod"]');
    unlockMethods.forEach(method => {
        method.title = method.value === 'remove' 
            ? 'Remove all password protection and restrictions' 
            : 'Allow copying text and printing while keeping other restrictions';
    });
});