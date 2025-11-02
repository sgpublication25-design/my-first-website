// script.js
// Advanced PDF Forms Creator - Frontend JavaScript

// Global variables
let formElements = [];
let selectedElement = null;
let elementCounter = 0;
let isDragging = false;
let currentTheme = 'light';

// DOM elements
const dropZone = document.getElementById('drop-zone');
const formCanvas = document.getElementById('form-canvas');
const propertiesContent = document.getElementById('properties-content');
const previewModal = document.getElementById('preview-modal');
const previewContent = document.getElementById('preview-content');
const closeModal = document.querySelector('.close');
const previewBtn = document.getElementById('preview-btn');
const saveBtn = document.getElementById('save-btn');
const exportBtn = document.getElementById('export-btn');
const formTitle = document.getElementById('form-title');
const formDescription = document.getElementById('form-description');
const canvasTitle = document.getElementById('canvas-title');
const canvasDescription = document.getElementById('canvas-description');
const formTheme = document.getElementById('form-theme');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    updateCanvasHeader();
    loadSavedForm();
    applyTheme(currentTheme);
});

// Set up all event listeners
function initializeEventListeners() {
    // Element dragging
    document.querySelectorAll('.element-item').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('click', () => addFormElement(item.dataset.type));
    });

    // Drop zone events
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Form properties
    formTitle.addEventListener('input', updateCanvasHeader);
    formDescription.addEventListener('input', updateCanvasHeader);
    formTheme.addEventListener('change', updateFormTheme);

    // Button events
    previewBtn.addEventListener('click', showPreview);
    saveBtn.addEventListener('click', saveForm);
    exportBtn.addEventListener('click', exportToPDF);
    closeModal.addEventListener('click', () => previewModal.style.display = 'none');

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === previewModal) {
            previewModal.style.display = 'none';
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Click outside to deselect
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.form-element') && !e.target.closest('.properties-panel')) {
            deselectElement();
        }
    });
}

// Drag and drop functions
function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.type);
    e.target.classList.add('dragging');
    isDragging = true;
    
    // Add drag image for better UX
    const dragImage = document.createElement('div');
    dragImage.textContent = e.target.textContent;
    dragImage.style.background = '#3498db';
    dragImage.style.color = 'white';
    dragImage.style.padding = '5px 10px';
    dragImage.style.borderRadius = '4px';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => {
        document.body.removeChild(dragImage);
    }, 0);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    isDragging = false;
}

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('active');
}

function handleDragLeave(e) {
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('active');
    }
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('active');
    
    const elementType = e.dataTransfer.getData('text/plain');
    addFormElement(elementType);
    
    // Remove dragging class from all elements
    document.querySelectorAll('.element-item').forEach(item => {
        item.classList.remove('dragging');
    });
}

// Add a new form element to the canvas
function addFormElement(type) {
    elementCounter++;
    const elementId = `element-${elementCounter}`;
    
    // Create element data with default properties
    const elementData = {
        id: elementId,
        type: type,
        label: getDefaultLabel(type),
        required: false,
        placeholder: getDefaultPlaceholder(type),
        options: getDefaultOptions(type),
        value: '',
        className: '',
        width: '100%'
    };
    
    // Special properties for specific element types
    if (type === 'button') {
        elementData.buttonType = 'button';
        elementData.buttonStyle = 'primary';
    }
    
    formElements.push(elementData);
    
    // Create HTML for the element
    const elementHTML = createFormElementHTML(elementData);
    
    // Insert before the drop zone
    dropZone.insertAdjacentHTML('beforebegin', elementHTML);
    
    // Add event listeners to the new element
    const newElement = document.getElementById(elementId);
    setupElementEventListeners(newElement, elementData);
    
    // Hide drop zone if it's the first element
    if (formElements.length === 1) {
        dropZone.style.display = 'none';
    }
    
    // Select the new element
    selectElement(elementData);
    
    // Show success message
    showNotification(`Added ${type} element to form`, 'success');
}

// Get default label based on element type
function getDefaultLabel(type) {
    const labels = {
        text: 'Text Field',
        textarea: 'Text Area',
        checkbox: 'Checkbox Group',
        radio: 'Radio Group',
        select: 'Dropdown',
        date: 'Date Picker',
        file: 'File Upload',
        button: 'Button',
        label: 'Label Text'
    };
    return labels[type] || 'Form Field';
}

// Get default placeholder based on element type
function getDefaultPlaceholder(type) {
    const placeholders = {
        text: 'Enter your text here',
        textarea: 'Enter your message here'
    };
    return placeholders[type] || '';
}

// Get default options based on element type
function getDefaultOptions(type) {
    if (type === 'checkbox' || type === 'radio' || type === 'select') {
        return ['Option 1', 'Option 2', 'Option 3'];
    }
    return [];
}

// Create HTML for a form element based on its type
function createFormElementHTML(element) {
    let fieldHTML = '';
    let additionalClasses = element.className ? ` ${element.className}` : '';
    
    switch(element.type) {
        case 'text':
            fieldHTML = `
                <input type="text" 
                       class="form-input${additionalClasses}" 
                       placeholder="${element.placeholder}" 
                       value="${element.value}"
                       style="width: ${element.width}"
                       ${element.required ? 'required' : ''}>
            `;
            break;
            
        case 'textarea':
            fieldHTML = `
                <textarea class="form-input form-textarea${additionalClasses}" 
                          placeholder="${element.placeholder}"
                          style="width: ${element.width}"
                          ${element.required ? 'required' : ''}>${element.value}</textarea>
            `;
            break;
            
        case 'checkbox':
            fieldHTML = `<div class="checkbox-group">`;
            element.options.forEach((option, index) => {
                const optionId = `${element.id}-option-${index}`;
                fieldHTML += `
                    <div class="checkbox-item">
                        <input type="checkbox" 
                               id="${optionId}" 
                               name="${element.id}" 
                               value="${option}"
                               ${element.required ? 'required' : ''}>
                        <label for="${optionId}">${option}</label>
                    </div>
                `;
            });
            fieldHTML += `</div>`;
            break;
            
        case 'radio':
            fieldHTML = `<div class="radio-group">`;
            element.options.forEach((option, index) => {
                const optionId = `${element.id}-option-${index}`;
                fieldHTML += `
                    <div class="radio-item">
                        <input type="radio" 
                               id="${optionId}" 
                               name="${element.id}" 
                               value="${option}"
                               ${element.required ? 'required' : ''}>
                        <label for="${optionId}">${option}</label>
                    </div>
                `;
            });
            fieldHTML += `</div>`;
            break;
            
        case 'select':
            fieldHTML = `
                <select class="form-input${additionalClasses}" 
                        style="width: ${element.width}"
                        ${element.required ? 'required' : ''}>
            `;
            element.options.forEach(option => {
                fieldHTML += `<option value="${option}">${option}</option>`;
            });
            fieldHTML += `</select>`;
            break;
            
        case 'date':
            fieldHTML = `
                <input type="date" 
                       class="form-input${additionalClasses}" 
                       value="${element.value}"
                       style="width: ${element.width}"
                       ${element.required ? 'required' : ''}>
            `;
            break;
            
        case 'file':
            fieldHTML = `
                <input type="file" 
                       class="form-input${additionalClasses}" 
                       style="width: ${element.width}"
                       ${element.required ? 'required' : ''}>
            `;
            break;
            
        case 'button':
            const buttonClass = `btn btn-${element.buttonStyle || 'primary'}`;
            fieldHTML = `
                <button type="${element.buttonType || 'button'}" 
                        class="${buttonClass}${additionalClasses}"
                        style="width: ${element.width}">
                    ${element.label}
                </button>
            `;
            break;
            
        case 'label':
            fieldHTML = `<p class="form-label-text${additionalClasses}">${element.label}</p>`;
            break;
    }
    
    // Don't show label for button and label elements
    const labelHTML = (element.type === 'button' || element.type === 'label') ? '' : 
        `<label class="form-label">${element.label} ${element.required ? '<span class="required-asterisk">*</span>' : ''}</label>`;
    
    return `
        <div class="form-element" id="${element.id}">
            <div class="element-controls">
                <div class="control-btn edit-btn" title="Edit Element">
                    <i class="fas fa-edit"></i>
                </div>
                <div class="control-btn delete-btn" title="Delete Element">
                    <i class="fas fa-trash"></i>
                </div>
                <div class="control-btn duplicate-btn" title="Duplicate Element">
                    <i class="fas fa-copy"></i>
                </div>
            </div>
            ${labelHTML}
            ${fieldHTML}
        </div>
    `;
}

// Set up event listeners for a form element
function setupElementEventListeners(element, elementData) {
    element.addEventListener('click', (e) => {
        if (!e.target.closest('.element-controls')) {
            selectElement(elementData);
        }
    });
    
    // Add event listeners to control buttons
    const editBtn = element.querySelector('.edit-btn');
    const deleteBtn = element.querySelector('.delete-btn');
    const duplicateBtn = element.querySelector('.duplicate-btn');
    
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editElement(elementData);
    });
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteElement(elementData.id);
    });
    
    duplicateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateElement(elementData);
    });
    
    // Add input event listeners for live updates
    if (elementData.type !== 'button' && elementData.type !== 'label') {
        const input = element.querySelector('input, textarea, select');
        if (input) {
            input.addEventListener('input', (e) => {
                elementData.value = e.target.value;
            });
        }
    }
}

// Select a form element and show its properties
function selectElement(element) {
    // Deselect previously selected element
    if (selectedElement) {
        const prevElement = document.getElementById(selectedElement.id);
        if (prevElement) prevElement.classList.remove('selected');
    }
    
    // Select new element
    selectedElement = element;
    const currentElement = document.getElementById(element.id);
    if (currentElement) currentElement.classList.add('selected');
    
    // Show properties in properties panel
    showElementProperties(element);
}

// Deselect current element
function deselectElement() {
    if (selectedElement) {
        const element = document.getElementById(selectedElement.id);
        if (element) element.classList.remove('selected');
        selectedElement = null;
        
        propertiesContent.innerHTML = `
            <div class="no-selection">
                <i class="fas fa-mouse-pointer"></i>
                <p>Select an element to edit its properties</p>
            </div>
        `;
    }
}

// Edit element (advanced editing)
function editElement(element) {
    // In a real application, this could open a modal with advanced options
    const newLabel = prompt('Enter new label:', element.label);
    if (newLabel !== null) {
        element.label = newLabel;
        refreshElement(element);
        showNotification('Element updated successfully', 'success');
    }
}

// Duplicate an element
function duplicateElement(element) {
    const clonedElement = JSON.parse(JSON.stringify(element));
    clonedElement.id = `element-${++elementCounter}`;
    clonedElement.label = `${element.label} (Copy)`;
    
    formElements.push(clonedElement);
    
    const elementHTML = createFormElementHTML(clonedElement);
    dropZone.insertAdjacentHTML('beforebegin', elementHTML);
    
    const newElement = document.getElementById(clonedElement.id);
    setupElementEventListeners(newElement, clonedElement);
    
    selectElement(clonedElement);
    showNotification('Element duplicated successfully', 'success');
}

// Show element properties in the properties panel
function showElementProperties(element) {
    let propertiesHTML = `
        <div class="property-control">
            <label for="element-label">Label</label>
            <input type="text" id="element-label" value="${element.label}">
        </div>
        <div class="property-control">
            <label for="element-required">
                <input type="checkbox" id="element-required" ${element.required ? 'checked' : ''}>
                Required Field
            </label>
        </div>
    `;
    
    // Type-specific properties
    if (element.type === 'text' || element.type === 'textarea') {
        propertiesHTML += `
            <div class="property-control">
                <label for="element-placeholder">Placeholder</label>
                <input type="text" id="element-placeholder" value="${element.placeholder || ''}">
            </div>
            <div class="property-control">
                <label for="element-value">Default Value</label>
                <input type="text" id="element-value" value="${element.value || ''}">
            </div>
        `;
    }
    
    if (element.type === 'button') {
        propertiesHTML += `
            <div class="property-control">
                <label for="element-button-type">Button Type</label>
                <select id="element-button-type">
                    <option value="button" ${element.buttonType === 'button' ? 'selected' : ''}>Button</option>
                    <option value="submit" ${element.buttonType === 'submit' ? 'selected' : ''}>Submit</option>
                    <option value="reset" ${element.buttonType === 'reset' ? 'selected' : ''}>Reset</option>
                </select>
            </div>
            <div class="property-control">
                <label for="element-button-style">Button Style</label>
                <select id="element-button-style">
                    <option value="primary" ${element.buttonStyle === 'primary' ? 'selected' : ''}>Primary</option>
                    <option value="secondary" ${element.buttonStyle === 'secondary' ? 'selected' : ''}>Secondary</option>
                    <option value="success" ${element.buttonStyle === 'success' ? 'selected' : ''}>Success</option>
                </select>
            </div>
        `;
    }
    
    if (element.type === 'checkbox' || element.type === 'radio' || element.type === 'select') {
        propertiesHTML += `
            <div class="property-control">
                <label>Options</label>
                <div id="element-options">
        `;
        
        element.options.forEach((option, index) => {
            propertiesHTML += `
                <div class="option-item" style="display: flex; margin-bottom: 5px;">
                    <input type="text" value="${option}" class="option-input" data-index="${index}" style="flex: 1; margin-right: 5px;">
                    <button class="btn delete-option" data-index="${index}" style="padding: 5px;">×</button>
                </div>
            `;
        });
        
        propertiesHTML += `
                </div>
                <button id="add-option" class="btn" style="margin-top: 10px; width: 100%;">
                    <i class="fas fa-plus"></i> Add Option
                </button>
            </div>
        `;
    }
    
    // Common properties
    propertiesHTML += `
        <div class="property-control">
            <label for="element-width">Width</label>
            <select id="element-width">
                <option value="100%" ${element.width === '100%' ? 'selected' : ''}>Full Width</option>
                <option value="75%" ${element.width === '75%' ? 'selected' : ''}>75% Width</option>
                <option value="50%" ${element.width === '50%' ? 'selected' : ''}>Half Width</option>
                <option value="25%" ${element.width === '25%' ? 'selected' : ''}>25% Width</option>
            </select>
        </div>
        <div class="property-control">
            <label for="element-class">CSS Class</label>
            <input type="text" id="element-class" value="${element.className || ''}" placeholder="custom-class">
        </div>
        <div class="property-control">
            <button id="delete-element" class="btn" style="background-color: #e74c3c; color: white; width: 100%;">
                <i class="fas fa-trash"></i> Delete Element
            </button>
        </div>
    `;
    
    propertiesContent.innerHTML = propertiesHTML;
    
    // Add event listeners to property controls
    setupPropertyEventListeners(element);
}

// Set up event listeners for property controls
function setupPropertyEventListeners(element) {
    // Basic properties
    document.getElementById('element-label').addEventListener('input', (e) => {
        updateElementProperty('label', e.target.value);
    });
    
    document.getElementById('element-required').addEventListener('change', (e) => {
        updateElementProperty('required', e.target.checked);
    });
    
    // Type-specific properties
    if (document.getElementById('element-placeholder')) {
        document.getElementById('element-placeholder').addEventListener('input', (e) => {
            updateElementProperty('placeholder', e.target.value);
        });
    }
    
    if (document.getElementById('element-value')) {
        document.getElementById('element-value').addEventListener('input', (e) => {
            updateElementProperty('value', e.target.value);
        });
    }
    
    if (document.getElementById('element-button-type')) {
        document.getElementById('element-button-type').addEventListener('change', (e) => {
            updateElementProperty('buttonType', e.target.value);
        });
    }
    
    if (document.getElementById('element-button-style')) {
        document.getElementById('element-button-style').addEventListener('change', (e) => {
            updateElementProperty('buttonStyle', e.target.value);
        });
    }
    
    // Options management
    if (document.getElementById('add-option')) {
        document.getElementById('add-option').addEventListener('click', addOption);
        
        document.querySelectorAll('.option-input').forEach(input => {
            input.addEventListener('input', (e) => {
                updateOption(parseInt(e.target.dataset.index), e.target.value);
            });
        });
        
        document.querySelectorAll('.delete-option').forEach(button => {
            button.addEventListener('click', (e) => {
                deleteOption(parseInt(e.target.dataset.index));
            });
        });
    }
    
    // Common properties
    document.getElementById('element-width').addEventListener('change', (e) => {
        updateElementProperty('width', e.target.value);
    });
    
    document.getElementById('element-class').addEventListener('input', (e) => {
        updateElementProperty('className', e.target.value);
    });
    
    document.getElementById('delete-element').addEventListener('click', () => {
        deleteElement(element.id);
    });
}

// Update an element property
function updateElementProperty(property, value) {
    if (!selectedElement) return;
    
    selectedElement[property] = value;
    refreshElement(selectedElement);
}

// Add a new option to checkbox/radio/select elements
function addOption() {
    if (!selectedElement) return;
    
    selectedElement.options.push(`Option ${selectedElement.options.length + 1}`);
    showElementProperties(selectedElement);
    refreshElement(selectedElement);
}

// Update an option
function updateOption(index, value) {
    if (!selectedElement) return;
    
    selectedElement.options[index] = value;
    refreshElement(selectedElement);
}

// Delete an option
function deleteOption(index) {
    if (!selectedElement || selectedElement.options.length <= 1) return;
    
    selectedElement.options.splice(index, 1);
    showElementProperties(selectedElement);
    refreshElement(selectedElement);
}

// Refresh an element in the form
function refreshElement(element) {
    const elementDiv = document.getElementById(element.id);
    if (elementDiv) {
        const newHTML = createFormElementHTML(element);
        elementDiv.outerHTML = newHTML;
        
        // Reattach event listeners
        const newElement = document.getElementById(element.id);
        setupElementEventListeners(newElement, element);
        
        // Reselect the element
        selectElement(element);
    }
}

// Delete an element from the form
function deleteElement(elementId) {
    if (!confirm('Are you sure you want to delete this element?')) {
        return;
    }
    
    // Remove from DOM
    const element = document.getElementById(elementId);
    if (element) element.remove();
    
    // Remove from data
    formElements = formElements.filter(el => el.id !== elementId);
    
    // Clear properties panel if this was the selected element
    if (selectedElement && selectedElement.id === elementId) {
        deselectElement();
    }
    
    // Show drop zone if no elements left
    if (formElements.length === 0) {
        dropZone.style.display = 'flex';
    }
    
    showNotification('Element deleted successfully', 'info');
}

// Update the canvas header with form title and description
function updateCanvasHeader() {
    canvasTitle.textContent = formTitle.value || 'Untitled Form';
    canvasDescription.textContent = formDescription.value || 'Add a description for your form';
}

// Update form theme
function updateFormTheme() {
    const theme = formTheme.value;
    applyTheme(theme);
    showNotification(`Theme changed to ${theme}`, 'success');
}

// Apply theme to the form
function applyTheme(theme) {
    // Remove existing theme classes
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-blue', 'theme-green');
    
    // Add new theme class
    document.body.classList.add(`theme-${theme}`);
    currentTheme = theme;
    
    // Update CSS variables based on theme
    updateThemeVariables(theme);
}

// Update CSS variables for themes
function updateThemeVariables(theme) {
    const root = document.documentElement;
    
    const themes = {
        light: {
            '--primary-color': '#3498db',
            '--secondary-color': '#95a5a6',
            '--success-color': '#2ecc71',
            '--background-color': '#f5f7fa',
            '--surface-color': '#ffffff',
            '--text-color': '#333333',
            '--border-color': '#e9ecef'
        },
        dark: {
            '--primary-color': '#2980b9',
            '--secondary-color': '#7f8c8d',
            '--success-color': '#27ae60',
            '--background-color': '#2c3e50',
            '--surface-color': '#34495e',
            '--text-color': '#ecf0f1',
            '--border-color': '#4a6278'
        },
        blue: {
            '--primary-color': '#3498db',
            '--secondary-color': '#5dade2',
            '--success-color': '#2ecc71',
            '--background-color': '#ebf5fb',
            '--surface-color': '#ffffff',
            '--text-color': '#2c3e50',
            '--border-color': '#aed6f1'
        },
        green: {
            '--primary-color': '#27ae60',
            '--secondary-color': '#58d68d',
            '--success-color': '#229954',
            '--background-color': '#eafaf1',
            '--surface-color': '#ffffff',
            '--text-color': '#1d8348',
            '--border-color': '#a9dfbf'
        }
    };
    
    const themeVars = themes[theme] || themes.light;
    
    Object.entries(themeVars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

// Show form preview
function showPreview() {
    if (formElements.length === 0) {
        showNotification('Please add some form elements before previewing', 'warning');
        return;
    }
    
    let previewHTML = `
        <div class="form-canvas preview-mode">
            <div class="canvas-header">
                <h2>${formTitle.value || 'Untitled Form'}</h2>
                <p>${formDescription.value || 'Add a description for your form'}</p>
            </div>
    `;
    
    formElements.forEach(element => {
        previewHTML += createFormElementHTML(element);
    });
    
    previewHTML += `
            <div class="preview-actions" style="margin-top: 20px; text-align: center;">
                <button class="btn btn-primary" onclick="submitPreviewForm()">Submit Form</button>
                <button class="btn btn-secondary" onclick="resetPreviewForm()">Reset Form</button>
            </div>
        </div>
    `;
    
    previewContent.innerHTML = previewHTML;
    previewModal.style.display = 'flex';
    
    showNotification('Preview mode activated', 'info');
}

// Submit preview form (demo functionality)
function submitPreviewForm() {
    // Collect form data
    const formData = {};
    formElements.forEach(element => {
        if (element.type !== 'button' && element.type !== 'label') {
            const input = document.querySelector(`#${element.id} input, #${element.id} textarea, #${element.id} select`);
            if (input) {
                formData[element.id] = input.value;
            }
        }
    });
    
    console.log('Form data submitted:', formData);
    showNotification('Form submitted successfully (check console for data)', 'success');
}

// Reset preview form
function resetPreviewForm() {
    formElements.forEach(element => {
        const input = document.querySelector(`#${element.id} input, #${element.id} textarea, #${element.id} select`);
        if (input) {
            input.value = '';
        }
    });
    showNotification('Form reset', 'info');
}

// Save form to localStorage
function saveForm() {
    const formData = {
        title: formTitle.value,
        description: formDescription.value,
        theme: formTheme.value,
        elements: formElements,
        lastSaved: new Date().toISOString()
    };
    
    try {
        localStorage.setItem('pdfFormData', JSON.stringify(formData));
        showNotification('Form saved successfully!', 'success');
        
        // Update last saved indicator
        updateLastSavedIndicator();
    } catch (error) {
        showNotification('Error saving form: ' + error.message, 'error');
    }
}

// Load saved form from localStorage
function loadSavedForm() {
    try {
        const savedData = localStorage.getItem('pdfFormData');
        if (savedData) {
            const formData = JSON.parse(savedData);
            
            formTitle.value = formData.title || '';
            formDescription.value = formData.description || '';
            formTheme.value = formData.theme || 'light';
            formElements = formData.elements || [];
            
            // Recreate form elements
            formElements.forEach(element => {
                const elementHTML = createFormElementHTML(element);
                dropZone.insertAdjacentHTML('beforebegin', elementHTML);
                
                const newElement = document.getElementById(element.id);
                setupElementEventListeners(newElement, element);
            });
            
            // Update element counter
            if (formElements.length > 0) {
                const lastId = formElements[formElements.length - 1].id;
                elementCounter = parseInt(lastId.split('-')[1]) || 0;
                dropZone.style.display = 'none';
            }
            
            updateCanvasHeader();
            applyTheme(formData.theme || 'light');
            updateLastSavedIndicator();
            
            showNotification('Form loaded successfully', 'success');
        }
    } catch (error) {
        console.error('Error loading saved form:', error);
        showNotification('Error loading saved form', 'error');
    }
}

// Update last saved indicator
function updateLastSavedIndicator() {
    const savedData = localStorage.getItem('pdfFormData');
    if (savedData) {
        const formData = JSON.parse(savedData);
        const lastSaved = new Date(formData.lastSaved).toLocaleString();
        
        // Add or update last saved indicator
        let indicator = document.getElementById('last-saved-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'last-saved-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
            `;
            document.body.appendChild(indicator);
        }
        indicator.textContent = `Last saved: ${lastSaved}`;
    }
}

// Export to PDF (simulated)
function exportToPDF() {
    if (formElements.length === 0) {
        showNotification('Please add some form elements before exporting', 'warning');
        return;
    }
    
    // Show loading state
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
    exportBtn.disabled = true;
    
    // Simulate PDF generation (in a real app, this would use a PDF library)
    setTimeout(() => {
        // Create a simple PDF representation
        const pdfData = {
            title: formTitle.value,
            description: formDescription.value,
            elements: formElements,
            generatedAt: new Date().toISOString()
        };
        
        console.log('PDF Data:', pdfData);
        
        // Create a download link for the "PDF"
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pdfData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `form-${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        // Reset button state
        exportBtn.innerHTML = '<i class="fas fa-file-export"></i> Export PDF';
        exportBtn.disabled = false;
        
        showNotification('PDF exported successfully (JSON simulation)', 'success');
    }, 2000);
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    // Add close button styles
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Add keyframes for animation
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Add event listeners
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Get notification color based on type
function getNotificationColor(type) {
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    };
    return colors[type] || colors.info;
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveForm();
    }
    
    // Ctrl+P to preview
    if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        showPreview();
    }
    
    // Delete key to delete selected element
    if (e.key === 'Delete' && selectedElement) {
        e.preventDefault();
        deleteElement(selectedElement.id);
    }
    
    // Escape to deselect
    if (e.key === 'Escape' && selectedElement) {
        e.preventDefault();
        deselectElement();
    }
}

// Initialize the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    console.log('Advanced PDF Forms Creator initialized');
}