let currentFile = null;
let compressionData = null;

document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        currentFile = file;
        showCompressionOptions();
    } else {
        alert('Please select a valid PDF file.');
    }
});

function showCompressionOptions() {
    document.getElementById('uploadArea').style.display = 'none';
    document.getElementById('compressionOptions').style.display = 'block';
}

async function compressPDF() {
    if (!currentFile) return;

    const compressionLevel = document.querySelector('input[name="compression"]:checked').value;
    
    showProgress();
    simulateProgress();

    try {
        const formData = new FormData();
        formData.append('pdf', currentFile);
        formData.append('compressionLevel', compressionLevel);

        const response = await fetch('/api/compress', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            compressionData = result;
            showResult(result);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('Compression failed: ' + error.message);
        hideProgress();
    }
}

function simulateProgress() {
    let width = 0;
    const progressBar = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
            progressText.textContent = 'Processing complete!';
        } else {
            width++;
            progressBar.style.width = width + '%';
            progressText.textContent = `Compressing... ${width}%`;
        }
    }, 50);
}

function showProgress() {
    document.getElementById('compressionOptions').style.display = 'none';
    document.getElementById('progress').style.display = 'block';
}

function hideProgress() {
    document.getElementById('progress').style.display = 'none';
}

function showResult(result) {
    document.getElementById('progress').style.display = 'none';
    document.getElementById('result').style.display = 'block';
    
    document.getElementById('originalSize').textContent = result.originalSize;
    document.getElementById('compressedSize').textContent = result.compressedSize;
    document.getElementById('reduction').textContent = result.reduction;
}

function downloadCompressedPDF() {
    if (compressionData && compressionData.downloadUrl) {
        window.location.href = compressionData.downloadUrl;
    }
}

// Drag and drop functionality
const uploadArea = document.getElementById('uploadArea');
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = '#e9ecef';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.backgroundColor = '';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        document.getElementById('fileInput').files = e.dataTransfer.files;
        currentFile = file;
        showCompressionOptions();
    } else {
        alert('Please drop a valid PDF file.');
    }
});