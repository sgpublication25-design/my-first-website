// Word to PDF Converter - Main JavaScript
let currentDownloadUrl = ''; // Moved to global scope

document.addEventListener('DOMContentLoaded', function() {
    const convertBtn = document.getElementById('convertBtn');
    const wordFileInput = document.getElementById('wordFile');
    const progressSection = document.getElementById('progress');
    const resultSection = document.getElementById('result');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    const fileSizeInfo = document.getElementById('fileSizeInfo');
    const timeEstimate = document.getElementById('timeEstimate');
    const originalFileDisplay = document.getElementById('originalFileDisplay');
    const pdfFileName = document.getElementById('pdfFileName');
    const fileInfo = document.getElementById('fileInfo');

    // Convert button click handler
    convertBtn.addEventListener('click', function() {
        if (!wordFileInput.files.length) {
            alert('Please select a Word file first!');
            return;
        }

        const file = wordFileInput.files[0];
        convertWordToPdf(file);
    });

    function convertWordToPdf(file) {
        // Show progress section
        progressSection.style.display = 'block';
        resultSection.style.display = 'none';
        convertBtn.disabled = true;

        const formData = new FormData();
        formData.append('wordFile', file);

        // Reset progress
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = 'Initializing conversion...';
        fileSizeInfo.textContent = formatFileSize(file.size);
        timeEstimate.textContent = 'Calculating...';

        // Simulate progress updates
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            updateProgress(progress);
        }, 300);

        // Make the actual API call
        fetch('/api/convert-word-to-pdf', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            clearInterval(progressInterval);
            updateProgress(100);
            
            setTimeout(() => {
                if (data.success) {
                    showSuccessResult(data, file);
                } else {
                    throw new Error(data.error || 'Conversion failed');
                }
            }, 500);
        })
        .catch(error => {
            clearInterval(progressInterval);
            console.error('Conversion error:', error);
            showErrorResult(error.message);
        });
    }

    function updateProgress(percent) {
        progressFill.style.width = percent + '%';
        progressPercent.textContent = Math.round(percent) + '%';
        
        if (percent < 30) {
            progressText.textContent = 'Reading document...';
            timeEstimate.textContent = 'Few seconds';
        } else if (percent < 60) {
            progressText.textContent = 'Processing content...';
            timeEstimate.textContent = 'Almost done';
        } else if (percent < 90) {
            progressText.textContent = 'Generating PDF...';
            timeEstimate.textContent = 'Finishing up';
        } else {
            progressText.textContent = 'Finalizing conversion...';
            timeEstimate.textContent = 'Complete';
        }
    }

    function showSuccessResult(data, originalFile) {
        progressSection.style.display = 'none';
        resultSection.style.display = 'block';
        convertBtn.disabled = false;

        // Store download URL for later use
        currentDownloadUrl = data.downloadUrl;

        // Update result display
        originalFileDisplay.textContent = originalFile.name;
        pdfFileName.textContent = data.filename;

        // Show file information
        fileInfo.innerHTML = `
            <div class="conversion-stats">
                <div class="stat-card">
                    <div class="stat-value">${data.originalSize}</div>
                    <div class="stat-label">Original Size</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.pdfSize}</div>
                    <div class="stat-label">PDF Size</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${calculateReduction(data.originalSize, data.pdfSize)}</div>
                    <div class="stat-label">Size Reduction</div>
                </div>
            </div>
        `;
    }

    function showErrorResult(errorMessage) {
        progressSection.style.display = 'none';
        convertBtn.disabled = false;

        // Show error in result section
        resultSection.innerHTML = `
            <div class="success-animation">
                <div class="success-icon" style="color: #dc3545;">❌</div>
            </div>
            <h3>Conversion Failed</h3>
            <div class="file-info">
                <p style="color: #dc3545;"><strong>Error:</strong> ${errorMessage}</p>
            </div>
            <div class="result-actions">
                <button class="btn-secondary" onclick="convertAnotherFile()">
                    <span class="btn-icon">🔄</span>
                    Try Again
                </button>
            </div>
        `;
        resultSection.style.display = 'block';
    }

    function calculateReduction(original, pdf) {
        const origSize = parseFloat(original);
        const pdfSize = parseFloat(pdf);
        if (origSize > pdfSize) {
            const reduction = ((origSize - pdfSize) / origSize * 100).toFixed(1);
            return `${reduction}% smaller`;
        } else {
            return 'Size increased';
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});

// Global functions - FIXED VERSION
function downloadPDF() {
    console.log('Download button clicked, URL:', currentDownloadUrl);
    
    if (currentDownloadUrl) {
        // Create a proper download link
        const downloadLink = document.createElement('a');
        downloadLink.href = currentDownloadUrl;
        downloadLink.target = '_blank';
        downloadLink.download = 'converted-document.pdf';
        
        // Trigger the download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        console.log('Download initiated for:', currentDownloadUrl);
    } else {
        alert('No PDF available for download. Please convert a file first.');
        console.error('No download URL available');
    }
}

function convertAnotherFile() {
    console.log('Convert another file clicked');
    
    // Reset everything
    document.getElementById('wordFile').value = '';
    document.getElementById('selectedFileInfo').style.display = 'none';
    document.getElementById('convertBtn').disabled = true;
    document.getElementById('result').style.display = 'none';
    document.getElementById('progress').style.display = 'none';
    currentDownloadUrl = '';
    
    console.log('Form reset complete');
}