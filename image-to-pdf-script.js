// Image to PDF Converter - Frontend JavaScript
// image-to-pdf-script.js

let selectedImages = [];
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const imagePreview = document.getElementById('imagePreview');
const conversionOptions = document.getElementById('conversionOptions');
const convertBtn = document.getElementById('convertBtn');
const resetBtn = document.getElementById('resetBtn');
const statusArea = document.getElementById('statusArea');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    showStatus('Select images to convert to PDF. You can select multiple images.', 'info');
    
    // File input change event
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Button events
    convertBtn.addEventListener('click', convertToPDF);
    resetBtn.addEventListener('click', resetConverter);
});

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
        handleFiles(files);
    }
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files));
    }
}

function handleFiles(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showStatus('Please select valid image files (JPG, PNG, GIF, WebP).', 'error');
        return;
    }
    
    if (selectedImages.length + imageFiles.length > 20) {
        showStatus('Maximum 20 images allowed. Please remove some images first.', 'error');
        return;
    }
    
    imageFiles.forEach(file => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            selectedImages.push({
                file: file,
                dataUrl: e.target.result,
                name: file.name,
                size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
            });
            
            updatePreview();
            updateUI();
        };
        
        reader.readAsDataURL(file);
    });
    
    showStatus(`Added ${imageFiles.length} image(s). Total: ${selectedImages.length} images.`, 'success');
}

function updatePreview() {
    imagePreview.innerHTML = '';
    
    selectedImages.forEach((image, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <button class="remove-btn" onclick="removeImage(${index})">×</button>
            <img src="${image.dataUrl}" alt="${image.name}">
            <div class="preview-info">
                <div>${image.name}</div>
                <div>${image.size}</div>
            </div>
        `;
        imagePreview.appendChild(previewItem);
    });
}

function updateUI() {
    if (selectedImages.length > 0) {
        conversionOptions.style.display = 'block';
        convertBtn.style.display = 'block';
        resetBtn.style.display = 'block';
        showStatus(`Ready to convert ${selectedImages.length} image(s) to PDF. Configure settings below.`, 'info');
    } else {
        conversionOptions.style.display = 'none';
        convertBtn.style.display = 'none';
        resetBtn.style.display = 'none';
        showStatus('Select images to convert to PDF.', 'info');
    }
}

function removeImage(index) {
    selectedImages.splice(index, 1);
    updatePreview();
    updateUI();
}

async function convertToPDF() {
    if (selectedImages.length === 0) {
        showStatus('Please select at least one image to convert.', 'error');
        return;
    }
    
    try {
        showStatus('Converting images to PDF...', 'info');
        convertBtn.disabled = true;
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        const pageSize = document.getElementById('pageSize').value;
        const orientation = document.getElementById('pageOrientation').value;
        const pdfTitle = document.getElementById('pdfTitle').value || 'My Images PDF';
        const imageLayout = document.getElementById('imageLayout').value;
        
        // Set PDF properties
        pdf.setProperties({
            title: pdfTitle,
            subject: 'Images to PDF Conversion',
            creator: 'PDF Tools Suite'
        });
        
        for (let i = 0; i < selectedImages.length; i++) {
            const image = selectedImages[i];
            
            if (i > 0) {
                pdf.addPage();
            }
            
            const img = new Image();
            img.src = image.dataUrl;
            
            await new Promise((resolve) => {
                img.onload = function() {
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    
                    let imgWidth = img.width;
                    let imgHeight = img.height;
                    
                    // Calculate dimensions to fit page
                    if (imageLayout === 'fit-to-page' || imageLayout === 'auto-arrange') {
                        const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
                        imgWidth *= ratio;
                        imgHeight *= ratio;
                    }
                    
                    // Center image on page
                    const x = (pageWidth - imgWidth) / 2;
                    const y = (pageHeight - imgHeight) / 2;
                    
                    pdf.addImage(image.dataUrl, 'JPEG', x, y, imgWidth, imgHeight);
                    resolve();
                };
            });
            
            // Update progress
            showStatus(`Processed ${i + 1} of ${selectedImages.length} images...`, 'info');
        }
        
        // Download PDF
        const fileName = `${pdfTitle.replace(/\s+/g, '_')}.pdf`;
        pdf.save(fileName);
        
        showStatus('✅ PDF created successfully! File has been downloaded.', 'success');
        
    } catch (error) {
        console.error('Conversion error:', error);
        showStatus('Error converting images to PDF: ' + error.message, 'error');
    } finally {
        convertBtn.disabled = false;
    }
}

function resetConverter() {
    selectedImages = [];
    fileInput.value = '';
    imagePreview.innerHTML = '';
    updateUI();
    showStatus('Converter reset. Select new images to convert.', 'info');
}

function showStatus(message, type) {
    statusArea.innerHTML = `<div class="status status-${type}">${message}</div>`;
}