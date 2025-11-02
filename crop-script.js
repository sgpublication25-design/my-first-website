// crop-script.js - Frontend JavaScript for PDF Crop Tool
let selectedFile = null;
let currentPage = 1;
let totalPages = 1;
let pdfInfo = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const previewArea = document.getElementById('previewArea');
const statusArea = document.getElementById('statusArea');
const cropBtn = document.getElementById('cropBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const cropArea = document.getElementById('cropArea');

// File selection handling
fileInput.addEventListener('change', handleFileSelect);

// Preset size selection
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const size = this.getAttribute('data-size');
        const margins = getPresetMargins(size);
        
        document.getElementById('topMargin').value = margins.top;
        document.getElementById('bottomMargin').value = margins.bottom;
        document.getElementById('leftMargin').value = margins.left;
        document.getElementById('rightMargin').value = margins.right;
        
        updateCropPreview();
    });
});

// Margin input changes
['topMargin', 'bottomMargin', 'leftMargin', 'rightMargin'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCropPreview);
});

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#fff4e6';
    uploadArea.style.borderColor = '#19547b';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.background = '#fff9f0';
    uploadArea.style.borderColor = '#ffd89b';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#fff9f0';
    uploadArea.style.borderColor = '#ffd89b';
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// File handling functions
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
        showStatus('Loading PDF...', 'info');
        selectedFile = file;
        
        // Get PDF info from backend
        pdfInfo = await getPdfInfo(file);
        totalPages = pdfInfo.totalPages;
        totalPagesSpan.textContent = totalPages;
        currentPage = 1;
        currentPageSpan.textContent = currentPage;
        
        uploadArea.style.display = 'none';
        previewArea.style.display = 'block';
        
        showStatus(`PDF loaded successfully! ${totalPages} page(s) found. Adjust margins using controls.`, 'success');
        updateCropPreview();
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        showStatus('Error loading PDF: ' + error.message, 'error');
    }
}

// Get PDF info from backend
async function getPdfInfo(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/get-pdf-info', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get PDF info');
    }
    
    return await response.json();
}

function getPresetMargins(size) {
    const presets = {
        'a4': { top: 25, bottom: 25, left: 20, right: 20 },
        'letter': { top: 25, bottom: 25, left: 25, right: 25 },
        'legal': { top: 25, bottom: 25, left: 25, right: 25 },
        'a5': { top: 20, bottom: 20, left: 15, right: 15 }
    };
    return presets[size] || presets.a4;
}

function updateCropPreview() {
    const top = parseInt(document.getElementById('topMargin').value) || 0;
    const bottom = parseInt(document.getElementById('bottomMargin').value) || 0;
    const left = parseInt(document.getElementById('leftMargin').value) || 0;
    const right = parseInt(document.getElementById('rightMargin').value) || 0;
    
    // Update visual crop area
    cropArea.style.top = top + 'px';
    cropArea.style.bottom = bottom + 'px';
    cropArea.style.left = left + 'px';
    cropArea.style.right = right + 'px';
}

// Page navigation
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        currentPageSpan.textContent = currentPage;
        showStatus(`Now editing page ${currentPage}`, 'info');
        updateCropPreview();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        currentPageSpan.textContent = currentPage;
        showStatus(`Now editing page ${currentPage}`, 'info');
        updateCropPreview();
    }
});

// Crop functionality
cropBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showStatus('Please select a PDF file first.', 'error');
        return;
    }
    
    try {
        showStatus('Applying crop to PDF...', 'info');
        cropBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('topMargin', document.getElementById('topMargin').value);
        formData.append('bottomMargin', document.getElementById('bottomMargin').value);
        formData.append('leftMargin', document.getElementById('leftMargin').value);
        formData.append('rightMargin', document.getElementById('rightMargin').value);
        
        const cropScope = document.querySelector('input[name="cropScope"]:checked').value;
        formData.append('cropAllPages', cropScope === 'all');
        
        if (cropScope === 'current') {
            formData.append('pageIndex', currentPage - 1);
        }
        
        const response = await fetch('/api/crop-pdf', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to crop PDF');
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Store the download URL for the cropped PDF
            window.croppedPdfUrl = result.downloadUrl;
            window.croppedFileName = result.filename;
            
            showStatus(`PDF cropped successfully! ${result.cropScope}. You can download the cropped version.`, 'success');
            downloadBtn.style.display = 'inline-block';
        } else {
            throw new Error(result.error || 'Crop operation failed');
        }
        
    } catch (error) {
        console.error('Crop error:', error);
        showStatus('Error cropping PDF: ' + error.message, 'error');
    } finally {
        cropBtn.disabled = false;
    }
});

// Download functionality
downloadBtn.addEventListener('click', async () => {
    if (!window.croppedPdfUrl) {
        showStatus('Please apply crop first before downloading.', 'error');
        return;
    }
    
    try {
        showStatus('Downloading cropped PDF...', 'info');
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = window.croppedPdfUrl;
        
        // Generate filename
        const originalName = selectedFile.name.replace('.pdf', '');
        const downloadName = `${originalName}-cropped.pdf`;
        downloadLink.download = downloadName;
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        showStatus('Cropped PDF downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        showStatus('Error downloading PDF: ' + error.message, 'error');
    }
});

// Reset functionality
resetBtn.addEventListener('click', () => {
    document.getElementById('topMargin').value = 20;
    document.getElementById('bottomMargin').value = 20;
    document.getElementById('leftMargin').value = 20;
    document.getElementById('rightMargin').value = 20;
    
    // Reset preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    
    // Reset crop scope to current page
    document.querySelector('input[value="current"]').checked = true;
    
    updateCropPreview();
    showStatus('Margins reset to default values.', 'info');
});

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

// Enhanced drag functionality for crop handles
makeDraggable(cropArea);

function makeDraggable(element) {
    let isDragging = false;
    let currentHandle = null;
    let startX, startY;
    let startTop, startLeft, startRight, startBottom;
    
    const handles = element.querySelectorAll('.crop-handle');
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', startDrag);
    });
    
    function startDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        
        isDragging = true;
        currentHandle = e.target;
        startX = e.clientX;
        startY = e.clientY;
        
        const style = window.getComputedStyle(element);
        startTop = parseInt(style.top);
        startLeft = parseInt(style.left);
        startRight = parseInt(style.right);
        startBottom = parseInt(style.bottom);
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // Update margins based on drag direction and handle position
        if (currentHandle.classList.contains('top-left')) {
            const newTop = Math.max(0, startTop + deltaY);
            const newLeft = Math.max(0, startLeft + deltaX);
            document.getElementById('topMargin').value = Math.round(newTop);
            document.getElementById('leftMargin').value = Math.round(newLeft);
        }
        else if (currentHandle.classList.contains('top-right')) {
            const newTop = Math.max(0, startTop + deltaY);
            const newRight = Math.max(0, startRight - deltaX);
            document.getElementById('topMargin').value = Math.round(newTop);
            document.getElementById('rightMargin').value = Math.round(newRight);
        }
        else if (currentHandle.classList.contains('bottom-left')) {
            const newBottom = Math.max(0, startBottom - deltaY);
            const newLeft = Math.max(0, startLeft + deltaX);
            document.getElementById('bottomMargin').value = Math.round(newBottom);
            document.getElementById('leftMargin').value = Math.round(newLeft);
        }
        else if (currentHandle.classList.contains('bottom-right')) {
            const newBottom = Math.max(0, startBottom - deltaY);
            const newRight = Math.max(0, startRight - deltaX);
            document.getElementById('bottomMargin').value = Math.round(newBottom);
            document.getElementById('rightMargin').value = Math.round(newRight);
        }
        
        updateCropPreview();
    }
    
    function stopDrag() {
        isDragging = false;
        currentHandle = null;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

// Keyboard shortcuts for better UX
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (currentPage > 1) {
                    currentPage--;
                    currentPageSpan.textContent = currentPage;
                    updateCropPreview();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (currentPage < totalPages) {
                    currentPage++;
                    currentPageSpan.textContent = currentPage;
                    updateCropPreview();
                }
                break;
        }
    }
});

// Input validation for margin values
document.querySelectorAll('.form-control').forEach(input => {
    input.addEventListener('blur', function() {
        const value = parseInt(this.value);
        if (isNaN(value) || value < 0) {
            this.value = 0;
        } else if (value > 100) {
            this.value = 100;
        }
        updateCropPreview();
    });
});

// Auto-apply same margins to all pages checkbox
document.getElementById('sameAllPages').addEventListener('change', function() {
    if (this.checked) {
        document.querySelector('input[value="all"]').checked = true;
        showStatus('Same margins will be applied to all pages.', 'info');
    }
});

// Initialize tool
function initCropTool() {
    showStatus('Select a PDF file to crop and adjust page margins.', 'info');
    downloadBtn.style.display = 'none';
    
    // Set default values
    document.getElementById('topMargin').value = 20;
    document.getElementById('bottomMargin').value = 20;
    document.getElementById('leftMargin').value = 20;
    document.getElementById('rightMargin').value = 20;
    
    updateCropPreview();
}

// Utility functions
function mmToPixels(mm) {
    return mm * 3.78; // Approximation for display purposes
}

function pixelsToMm(pixels) {
    return pixels / 3.78;
}

// Export functions for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initCropTool,
        handleFile,
        updateCropPreview,
        showStatus
    };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initCropTool();
    
    // Add some sample tooltips or hints
    const marginInputs = document.querySelectorAll('.margin-control input');
    marginInputs.forEach(input => {
        input.title = 'Enter margin value in millimeters (0-100)';
    });
    
    // Add responsive behavior
    window.addEventListener('resize', () => {
        if (selectedFile) {
            updateCropPreview();
        }
    });
});

// Performance optimization: Debounce resize events
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (selectedFile) {
            updateCropPreview();
        }
    }, 250);
});