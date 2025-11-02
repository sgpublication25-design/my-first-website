// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const splitButton = document.getElementById('splitButton');
const pageRangeSection = document.getElementById('pageRangeSection');
const totalPagesSpan = document.getElementById('totalPages');
const startPageInput = document.getElementById('startPage');
const endPageInput = document.getElementById('endPage');

let currentFile = null;
let totalPages = 0;

// Event listeners
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFileSelect, false);
splitButton.addEventListener('click', splitPdf, false);
startPageInput.addEventListener('input', updatePageRange);
endPageInput.addEventListener('input', updatePageRange);

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    dropZone.classList.add('highlight');
}

function unhighlight() {
    dropZone.classList.remove('highlight');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect() {
    handleFiles(this.files);
}

function handleFiles(files) {
    if (files.length === 0) return;
    
    const file = files[0];
    
    if (file.type === 'application/pdf') {
        if (file.size > 10 * 1024 * 1024) {
            alert(`"${file.name}" is too large. Maximum file size is 10MB.`);
            return;
        }
        
        currentFile = file;
        analyzePdf(file);
    } else {
        alert(`"${file.name}" is not a PDF file. Please select a PDF file.`);
    }
}

async function analyzePdf(file) {
    try {
        // Send file to backend to get actual page count
        const formData = new FormData();
        formData.append('pdf', file);

        const response = await fetch('/api/get-page-count', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            totalPages = data.pageCount;
        } else {
            // Fallback: use simulated page count
            totalPages = Math.max(1, Math.floor(file.size / 50000));
        }
    } catch (error) {
        console.error('Error analyzing PDF:', error);
        // Fallback: use simulated page count
        totalPages = Math.max(1, Math.floor(file.size / 50000));
    }
    
    totalPagesSpan.textContent = totalPages;
    startPageInput.value = 1;
    startPageInput.max = totalPages;
    endPageInput.value = totalPages;
    endPageInput.max = totalPages;
    
    pageRangeSection.style.display = 'block';
    updateSplitButton();
}

function updatePageRange() {
    let start = parseInt(startPageInput.value) || 1;
    let end = parseInt(endPageInput.value) || 1;
    
    // Validate range
    start = Math.max(1, Math.min(start, totalPages));
    end = Math.max(1, Math.min(end, totalPages));
    
    if (start > end) {
        // Swap if start is greater than end
        [start, end] = [end, start];
    }
    
    startPageInput.value = start;
    endPageInput.value = end;
    
    updateSplitButton();
}

function updateSplitButton() {
    const start = parseInt(startPageInput.value) || 0;
    const end = parseInt(endPageInput.value) || 0;
    
    splitButton.disabled = !currentFile || start < 1 || end < 1 || start > end || start > totalPages || end > totalPages;
}

async function splitPdf() {
    if (!currentFile) {
        alert('Please select a PDF file first.');
        return;
    }

    const startPage = parseInt(startPageInput.value);
    const endPage = parseInt(endPageInput.value);

    if (startPage < 1 || endPage < 1 || startPage > endPage || endPage > totalPages) {
        alert('Please select a valid page range.');
        return;
    }

    // Update UI
    const originalText = splitButton.textContent;
    splitButton.textContent = 'Splitting... Please wait';
    splitButton.disabled = true;

    try {
        const formData = new FormData();
        formData.append('pdf', currentFile);
        formData.append('startPage', startPage);
        formData.append('endPage', endPage);

        // Send to backend
        const response = await fetch('/api/split', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Split failed');
        }

        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `pages-${startPage}-to-${endPage}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Success message
        setTimeout(() => {
            alert(`✅ Success! Pages ${startPage} to ${endPage} have been extracted successfully.\nYour download should start automatically.`);
        }, 100);

    } catch (error) {
        console.error('Error:', error);
        alert(`❌ Split failed: ${error.message}`);
    } finally {
        // Reset UI
        splitButton.textContent = originalText;
        splitButton.disabled = false;
    }
}