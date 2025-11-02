// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const mergeButton = document.getElementById('mergeButton');

let files = [];

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

// Highlight drop zone when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

// Handle dropped files
dropZone.addEventListener('drop', handleDrop, false);

// Handle file input change
fileInput.addEventListener('change', handleFileSelect, false);

// Merge button click handler
mergeButton.addEventListener('click', mergePdfs, false);

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
    const droppedFiles = dt.files;
    handleFiles(droppedFiles);
}

function handleFileSelect() {
    handleFiles(this.files);
}

function handleFiles(newFiles) {
    if (files.length + newFiles.length > 10) {
        alert('Maximum 10 files allowed. Please select fewer files.');
        return;
    }

    for (let file of newFiles) {
        if (file.type === 'application/pdf') {
            if (file.size > 10 * 1024 * 1024) {
                alert(`"${file.name}" is too large. Maximum file size is 10MB.`);
                continue;
            }
            files.push(file);
        } else {
            alert(`"${file.name}" is not a PDF file. Please select only PDF files.`);
        }
    }
    updateFileList();
    updateMergeButton();
}

function updateFileList() {
    fileList.innerHTML = '';
    
    if (files.length === 0) {
        const li = document.createElement('li');
        li.innerHTML = '<em>No files selected. Add PDF files to merge.</em>';
        li.style.color = '#7f8c8d';
        li.style.textAlign = 'center';
        fileList.appendChild(li);
        return;
    }
    
    files.forEach((file, index) => {
        const li = document.createElement('li');
        li.draggable = true;
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        li.innerHTML = `
            <div>
                <div class="file-name">${file.name}</div>
                <div class="file-info">Size: ${fileSize} MB • Pages: Calculating...</div>
            </div>
            <div class="file-actions">
                <button class="move-btn" onclick="moveUp(${index})" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="move-btn" onclick="moveDown(${index})" ${index === files.length - 1 ? 'disabled' : ''}>↓</button>
                <button onclick="removeFile(${index})">Remove</button>
            </div>
        `;
        
        // Drag and drop functionality for reordering
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
        });
        li.addEventListener('dragover', (e) => e.preventDefault());
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;
            moveItem(fromIndex, toIndex);
        });
        
        fileList.appendChild(li);
    });
}

function updateMergeButton() {
    mergeButton.disabled = files.length < 2;
    if (files.length >= 2) {
        mergeButton.textContent = `Merge ${files.length} PDFs`;
    } else {
        mergeButton.textContent = 'Merge PDFs';
    }
}

function removeFile(index) {
    files.splice(index, 1);
    updateFileList();
    updateMergeButton();
}

function moveUp(index) {
    if (index > 0) {
        moveItem(index, index - 1);
    }
}

function moveDown(index) {
    if (index < files.length - 1) {
        moveItem(index, index + 1);
    }
}

function moveItem(fromIndex, toIndex) {
    const [movedFile] = files.splice(fromIndex, 1);
    files.splice(toIndex, 0, movedFile);
    updateFileList();
}

async function mergePdfs() {
    if (files.length < 2) {
        alert('Please add at least 2 PDF files to merge.');
        return;
    }

    // Update UI
    const originalText = mergeButton.textContent;
    mergeButton.textContent = 'Merging... Please wait';
    mergeButton.disabled = true;

    try {
        const formData = new FormData();
        
        // Append files in their current order
        files.forEach(file => {
            formData.append('pdfs', file);
        });

        // Send to backend
        const response = await fetch('/api/merge', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Merge failed');
        }

        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'merged-document.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Success message
        setTimeout(() => {
            alert(`✅ Success! ${files.length} files have been merged successfully.\nYour download should start automatically.`);
        }, 100);

    } catch (error) {
        console.error('Error:', error);
        alert(`❌ Merge failed: ${error.message}`);
    } finally {
        // Reset UI
        mergeButton.textContent = originalText;
        mergeButton.disabled = false;
    }
}