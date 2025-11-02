// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const convertButton = document.getElementById('convertButton');

let currentFile = null;

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
convertButton.addEventListener('click', convertToWord, false);

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
        updateConvertButton();
    } else {
        alert(`"${file.name}" is not a PDF file. Please select a PDF file.`);
    }
}

function updateConvertButton() {
    convertButton.disabled = !currentFile;
}

async function convertToWord() {
    if (!currentFile) {
        alert('Please select a PDF file first.');
        return;
    }

    // Get selected format
    const format = document.querySelector('input[name="format"]:checked').value;

    // Update UI
    const originalText = convertButton.textContent;
    convertButton.textContent = 'Converting... Please wait';
    convertButton.disabled = true;

    try {
        const formData = new FormData();
        formData.append('pdf', currentFile);
        formData.append('format', format);

        // Send to backend
        const response = await fetch('/api/convert-to-word', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Conversion failed');
        }

        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Set filename based on format
        const originalName = currentFile.name.replace('.pdf', '');
        const extension = format === 'docx' ? '.docx' : '.doc';
        a.download = `${originalName}-converted${extension}`;
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Success message
        setTimeout(() => {
            alert(`✅ Success! PDF has been converted to Word format.\nYour download should start automatically.`);
        }, 100);

    } catch (error) {
        console.error('Error:', error);
        alert(`❌ Conversion failed: ${error.message}`);
    } finally {
        // Reset UI
        convertButton.textContent = originalText;
        convertButton.disabled = false;
    }
}