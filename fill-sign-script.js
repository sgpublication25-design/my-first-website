// fill-sign-script.js - Frontend JavaScript for PDF Fill & Sign Tool
let selectedFile = null;
let currentTool = 'text-field';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let formFields = [];
let currentField = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const pdfPreview = document.getElementById('pdfPreview');
const statusArea = document.getElementById('statusArea');
const saveBtn = document.getElementById('saveBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const resetBtn = document.getElementById('resetBtn');
const signaturePad = document.getElementById('signaturePad');
const fieldProperties = document.getElementById('fieldProperties');
const fieldNameInput = document.getElementById('fieldName');
const fieldValueInput = document.getElementById('fieldValue');
const ctx = signaturePad.getContext('2d');

// Initialize signature pad
function initializeSignaturePad() {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Clear canvas
    ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, signaturePad.width, signaturePad.height);
}

// Tool selection
document.querySelectorAll('.tool-btn').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        currentTool = this.getAttribute('data-tool');
        
        // Handle tool-specific behaviors
        switch(currentTool) {
            case 'draw-signature':
                signaturePad.style.display = 'block';
                initializeSignaturePad();
                break;
            case 'type-signature':
                signaturePad.style.display = 'none';
                createSignatureField();
                break;
            case 'upload-signature':
                signaturePad.style.display = 'none';
                uploadSignatureImage();
                break;
            default:
                signaturePad.style.display = 'none';
        }
        
        showStatus(`Selected tool: ${getToolDisplayName(currentTool)}`, 'info');
    });
});

// Field type selection
document.querySelectorAll('.type-option').forEach(option => {
    option.addEventListener('click', function() {
        document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
        this.classList.add('active');
        
        if (currentField) {
            updateFieldType(currentField, this.getAttribute('data-type'));
        }
    });
});

// File selection handling
fileInput.addEventListener('change', handleFileSelect);

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#e0fffd';
    uploadArea.style.borderColor = '#fed6e3';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.background = '#f0fffe';
    uploadArea.style.borderColor = '#a8edea';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#f0fffe';
    uploadArea.style.borderColor = '#a8edea';
    
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
        showStatus('Loading PDF form...', 'info');
        selectedFile = file;
        
        // In a real implementation, you would load and display the actual PDF
        // For this demo, we'll simulate PDF loading
        
        uploadArea.style.display = 'none';
        pdfPreview.style.display = 'block';
        
        // Clear existing fields
        clearFormFields();
        
        showStatus('PDF form loaded successfully! Use tools to add form fields and signatures.', 'success');
        
    } catch (error) {
        console.error('Error loading PDF:', error);
        showStatus('Error loading PDF: ' + error.message, 'error');
    }
}

// Signature pad functionality
signaturePad.addEventListener('mousedown', startDrawing);
signaturePad.addEventListener('mousemove', drawSignature);
signaturePad.addEventListener('mouseup', stopDrawing);
signaturePad.addEventListener('mouseout', stopDrawing);

signaturePad.addEventListener('touchstart', handleTouchStart);
signaturePad.addEventListener('touchmove', handleTouchMove);
signaturePad.addEventListener('touchend', stopDrawing);

function getCanvasCoordinates(e) {
    const rect = signaturePad.getBoundingClientRect();
    const scaleX = signaturePad.width / rect.width;
    const scaleY = signaturePad.height / rect.height;
    
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signaturePad.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signaturePad.dispatchEvent(mouseEvent);
}

function startDrawing(e) {
    isDrawing = true;
    const coords = getCanvasCoordinates(e);
    [lastX, lastY] = [coords.x, coords.y];
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
}

function drawSignature(e) {
    if (!isDrawing) return;
    
    const coords = getCanvasCoordinates(e);
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    [lastX, lastY] = [coords.x, coords.y];
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

// Form field creation and management
pdfPreview.addEventListener('click', (e) => {
    if (currentTool && e.target === pdfPreview) {
        createFormField(e.offsetX, e.offsetY);
    }
});

function createFormField(x, y) {
    const fieldId = 'field_' + Date.now();
    const fieldType = getCurrentFieldType();
    
    const field = document.createElement('div');
    field.className = 'form-field';
    field.id = fieldId;
    field.style.left = x + 'px';
    field.style.top = y + 'px';
    field.style.width = '200px';
    
    let fieldHTML = '';
    switch(currentTool) {
        case 'text-field':
        case 'type-signature':
            fieldHTML = `<input type="text" placeholder="${getFieldPlaceholder(fieldType)}" data-type="${fieldType}">`;
            break;
        case 'checkbox':
            fieldHTML = `<input type="checkbox" style="width: auto; margin-right: 5px;"><label>Checkbox</label>`;
            break;
        case 'radio':
            fieldHTML = `<input type="radio" style="width: auto; margin-right: 5px;"><label>Option</label>`;
            break;
        case 'dropdown':
            fieldHTML = `
                <select style="width: 100%;">
                    <option value="">Select option</option>
                    <option value="option1">Option 1</option>
                    <option value="option2">Option 2</option>
                </select>
            `;
            break;
        case 'date':
            fieldHTML = `<input type="date" style="width: 100%;">`;
            break;
    }
    
    field.innerHTML = fieldHTML;
    
    // Add field controls
    const controls = document.createElement('div');
    controls.className = 'field-controls';
    controls.style.cssText = `
        position: absolute;
        top: -25px;
        right: 0;
        background: #007bff;
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 12px;
        display: none;
    `;
    controls.innerHTML = '✏️ ❌';
    
    field.appendChild(controls);
    
    // Add event listeners
    field.addEventListener('mouseenter', () => {
        controls.style.display = 'block';
    });
    
    field.addEventListener('mouseleave', () => {
        if (!field.classList.contains('editing')) {
            controls.style.display = 'none';
        }
    });
    
    // Edit button
    controls.children[0].addEventListener('click', (e) => {
        e.stopPropagation();
        editField(field);
    });
    
    // Delete button
    controls.children[1].addEventListener('click', (e) => {
        e.stopPropagation();
        deleteField(field);
    });
    
    // Field click for editing
    field.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            editField(field);
        }
    });
    
    pdfPreview.appendChild(field);
    formFields.push({
        id: fieldId,
        element: field,
        type: currentTool,
        properties: {
            name: `field_${formFields.length + 1}`,
            value: '',
            required: false,
            fieldType: fieldType
        }
    });
    
    makeFieldDraggable(field);
    showStatus(`Created ${getToolDisplayName(currentTool)} field`, 'success');
}

function createSignatureField() {
    const x = 50;
    const y = 300;
    createFormField(x, y);
    
    const field = formFields[formFields.length - 1];
    field.properties.fieldType = 'signature';
    field.element.querySelector('input').placeholder = 'Type your signature here';
    field.element.style.width = '250px';
}

function uploadSignatureImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = function(e) {
                createSignatureImageField(e.target.result);
            };
            
            reader.readAsDataURL(file);
        }
        
        document.body.removeChild(input);
    });
    
    document.body.appendChild(input);
    input.click();
}

function createSignatureImageField(imageData) {
    const x = 50;
    const y = 300;
    const fieldId = 'signature_' + Date.now();
    
    const field = document.createElement('div');
    field.className = 'form-field';
    field.id = fieldId;
    field.style.left = x + 'px';
    field.style.top = y + 'px';
    field.style.width = '200px';
    field.style.height = '80px';
    field.style.background = `url(${imageData}) center/contain no-repeat`;
    field.style.border = '2px dashed #28a745';
    
    pdfPreview.appendChild(field);
    
    formFields.push({
        id: fieldId,
        element: field,
        type: 'upload-signature',
        properties: {
            name: 'signature',
            value: imageData,
            fieldType: 'signature'
        }
    });
    
    makeFieldDraggable(field);
    showStatus('Signature image uploaded successfully', 'success');
}

function makeFieldDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    element.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
        e.preventDefault();
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        element.style.cursor = 'grabbing';
    }
    
    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        element.style.cursor = 'move';
    }
}

function editField(field) {
    // Remove editing class from all fields
    document.querySelectorAll('.form-field').forEach(f => {
        f.classList.remove('editing');
        f.style.borderColor = '#007bff';
    });
    
    // Add editing class to current field
    field.classList.add('editing');
    field.style.borderColor = '#28a745';
    
    // Find field data
    currentField = formFields.find(f => f.id === field.id);
    
    if (currentField) {
        // Populate properties panel
        fieldNameInput.value = currentField.properties.name;
        fieldValueInput.value = currentField.properties.value;
        
        // Show properties panel
        fieldProperties.style.display = 'block';
        
        // Set active field type
        document.querySelectorAll('.type-option').forEach(opt => {
            opt.classList.remove('active');
            if (opt.getAttribute('data-type') === currentField.properties.fieldType) {
                opt.classList.add('active');
            }
        });
        
        showStatus(`Editing field: ${currentField.properties.name}`, 'info');
    }
}

function deleteField(field) {
    const fieldIndex = formFields.findIndex(f => f.id === field.id);
    if (fieldIndex > -1) {
        formFields.splice(fieldIndex, 1);
    }
    field.remove();
    
    if (currentField && currentField.id === field.id) {
        currentField = null;
        fieldProperties.style.display = 'none';
    }
    
    showStatus('Field deleted', 'info');
}

function updateFieldType(field, type) {
    field.properties.fieldType = type;
    const input = field.element.querySelector('input');
    if (input) {
        input.placeholder = getFieldPlaceholder(type);
        input.type = getInputType(type);
    }
}

// Property input handlers
fieldNameInput.addEventListener('input', function() {
    if (currentField) {
        currentField.properties.name = this.value;
    }
});

fieldValueInput.addEventListener('input', function() {
    if (currentField) {
        currentField.properties.value = this.value;
        const input = currentField.element.querySelector('input');
        if (input && input.type !== 'checkbox' && input.type !== 'radio') {
            input.value = this.value;
        }
    }
});

// Save form functionality
saveBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showStatus('Please select a PDF file first.', 'error');
        return;
    }
    
    try {
        showStatus('Processing form data...', 'info');
        saveBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        // Collect all form field data
        const fieldsData = formFields.map(field => ({
            id: field.id,
            type: field.type,
            properties: field.properties,
            position: {
                x: parseInt(field.element.style.left),
                y: parseInt(field.element.style.top),
                width: parseInt(field.element.style.width),
                height: parseInt(field.element.style.height) || 30
            }
        }));
        
        formData.append('fieldsData', JSON.stringify(fieldsData));
        
        // Add signature data if available
        if (signaturePad.style.display === 'block') {
            const signatureData = signaturePad.toDataURL();
            formData.append('signature', signatureData);
        }
        
        const response = await fetch('/api/fill-pdf-form', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save form');
        }
        
        const result = await response.json();
        
        if (result.success) {
            window.filledPdfUrl = result.downloadUrl;
            window.filledFileName = result.filename;
            
            showStatus('Form saved successfully! You can download the filled PDF.', 'success');
            downloadBtn.style.display = 'inline-block';
        } else {
            throw new Error(result.error || 'Save operation failed');
        }
        
    } catch (error) {
        console.error('Save error:', error);
        showStatus('Error saving form: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
    }
});

// Download functionality
downloadBtn.addEventListener('click', async () => {
    if (!window.filledPdfUrl) {
        showStatus('Please save the form first before downloading.', 'error');
        return;
    }
    
    try {
        showStatus('Downloading filled PDF...', 'info');
        
        const downloadLink = document.createElement('a');
        downloadLink.href = window.filledPdfUrl;
        
        const originalName = selectedFile.name.replace('.pdf', '');
        const downloadName = `${originalName}-filled.pdf`;
        downloadLink.download = downloadName;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        showStatus('Filled PDF downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        showStatus('Error downloading PDF: ' + error.message, 'error');
    }
});

// Clear functionality
clearBtn.addEventListener('click', () => {
    // Clear signature pad
    initializeSignaturePad();
    
    // Clear all form field values
    document.querySelectorAll('.form-field input, .form-field select').forEach(field => {
        if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = false;
        } else if (field.type === 'date') {
            field.value = '';
        } else {
            field.value = '';
        }
    });
    
    showStatus('All field values cleared. Form structure remains intact.', 'info');
});

// Reset functionality
resetBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    uploadArea.style.display = 'block';
    pdfPreview.style.display = 'none';
    fieldProperties.style.display = 'none';
    window.filledPdfUrl = null;
    
    // Clear all form fields
    clearFormFields();
    
    // Reset signature pad
    initializeSignaturePad();
    
    // Reset tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-tool="text-field"]').classList.add('active');
    currentTool = 'text-field';
    
    showStatus('Form reset. Select a new PDF file to fill and sign.', 'info');
});

function clearFormFields() {
    document.querySelectorAll('.form-field').forEach(field => field.remove());
    formFields = [];
    currentField = null;
}

// Utility functions
function getToolDisplayName(tool) {
    const names = {
        'text-field': 'Text Field',
        'checkbox': 'Checkbox',
        'radio': 'Radio Button',
        'dropdown': 'Dropdown',
        'date': 'Date Field',
        'draw-signature': 'Draw Signature',
        'type-signature': 'Type Signature',
        'upload-signature': 'Upload Signature'
    };
    return names[tool] || tool;
}

function getCurrentFieldType() {
    const activeType = document.querySelector('.type-option.active');
    return activeType ? activeType.getAttribute('data-type') : 'text';
}

function getFieldPlaceholder(type) {
    const placeholders = {
        'text': 'Enter text',
        'date': 'Select date',
        'email': 'Enter email',
        'signature': 'Type signature'
    };
    return placeholders[type] || 'Enter value';
}

function getInputType(type) {
    const inputTypes = {
        'text': 'text',
        'date': 'date',
        'email': 'email',
        'signature': 'text'
    };
    return inputTypes[type] || 'text';
}

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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 's':
                e.preventDefault();
                saveBtn.click();
                break;
            case 'd':
                e.preventDefault();
                if (window.filledPdfUrl) {
                    downloadBtn.click();
                }
                break;
            case 'Delete':
                e.preventDefault();
                if (currentField) {
                    deleteField(currentField.element);
                }
                break;
        }
    }
});

// Initialize tool
function initFillSignTool() {
    showStatus('Select a PDF form to fill out and sign digitally.', 'info');
    downloadBtn.style.display = 'none';
    fieldProperties.style.display = 'none';
    signaturePad.style.display = 'none';
    initializeSignaturePad();
    
    // Set default values
    fieldNameInput.value = '';
    fieldValueInput.value = '';
}

// Export functions for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initFillSignTool,
        handleFile,
        clearFormFields,
        showStatus
    };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initFillSignTool();
    
    // Add tooltips
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
        button.title = `Create ${getToolDisplayName(button.getAttribute('data-tool'))} (Click on PDF to place)`;
    });
    
    // Add responsive behavior
    window.addEventListener('resize', () => {
        // Adjust signature pad size if needed
        if (selectedFile && signaturePad.style.display === 'block') {
            const rect = pdfPreview.getBoundingClientRect();
            signaturePad.width = Math.min(400, rect.width - 40);
        }
    });
});