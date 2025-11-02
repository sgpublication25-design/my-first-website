// script.js - PDF Redaction Tool Frontend JavaScript

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// Global variables
let pdfDoc = null, pageNum = 1, scale = 1.5, canvas, ctx;
let whiteouts = [], texts = [], selected = null, isDragging = false, startX, startY, currentX, currentY;
let dragOffsetX = 0, dragOffsetY = 0, isAddingWhiteout = false, isAddingText = false;
let history = [], historyIndex = -1;
let canvasWidth = 0, canvasHeight = 0;

// DOM Elements
const elements = {
    pdfInput: document.getElementById('pdf-input'),
    loadPdf: document.getElementById('load-pdf'),
    downloadPdf: document.getElementById('download-pdf'),
    addWhiteout: document.getElementById('add-whiteout'),
    addText: document.getElementById('add-text'),
    undo: document.getElementById('undo'),
    redo: document.getElementById('redo'),
    clear: document.getElementById('clear'),
    pdfContainer: document.getElementById('pdf-container'),
    loading: document.getElementById('loading'),
    pageNum: document.getElementById('page-num'),
    pageCount: document.getElementById('page-count'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    statusBar: document.getElementById('statusBar'),
    modeIndicator: document.getElementById('modeIndicator')
};

// Event Listeners
function initializeEventListeners() {
    elements.loadPdf.addEventListener('click', () => elements.pdfInput.click());
    elements.pdfInput.addEventListener('change', loadPdf);
    elements.downloadPdf.addEventListener('click', downloadPdf);
    elements.addWhiteout.addEventListener('click', toggleWhiteoutMode);
    elements.addText.addEventListener('click', toggleTextMode);
    elements.undo.addEventListener('click', undo);
    elements.redo.addEventListener('click', redo);
    elements.clear.addEventListener('click', clearAll);
    elements.prevPage.addEventListener('click', () => changePage(-1));
    elements.nextPage.addEventListener('click', () => changePage(1));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                break;
            case 'y':
                e.preventDefault();
                redo();
                break;
            case 'd':
                e.preventDefault();
                toggleWhiteoutMode();
                break;
            case 't':
                e.preventDefault();
                toggleTextMode();
                break;
        }
    }
    
    // Escape key to cancel current mode
    if (e.key === 'Escape') {
        if (isAddingWhiteout || isAddingText) {
            isAddingWhiteout = false;
            isAddingText = false;
            updateModeIndicator();
            updateStatus('Current mode cancelled', 'info');
        }
        if (selected) {
            selected.classList.remove('selected');
            selected = null;
        }
    }
    
    // Delete key to remove selected element
    if (e.key === 'Delete' && selected) {
        deleteSelectedElement();
    }
}

// Status Management
function updateStatus(message, type = 'info') {
    const icons = { info: '📝', success: '✅', warning: '⚠️', error: '❌' };
    elements.statusBar.innerHTML = `${icons[type]} <strong>${message}</strong>`;
}

// PDF Loading
async function loadPdf(event) {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        updateStatus('Please select a valid PDF file', 'error');
        return;
    }
    
    updateStatus('Loading PDF document...', 'info');
    elements.loading.style.display = 'block';
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        elements.pageCount.textContent = pdfDoc.numPages;
        pageNum = 1;
        
        // Enable toolbar buttons
        elements.downloadPdf.disabled = false;
        elements.addWhiteout.disabled = false;
        elements.addText.disabled = false;
        elements.clear.disabled = false;
        elements.undo.disabled = false;
        elements.redo.disabled = false;
        
        await renderPage();
        elements.prevPage.disabled = pageNum === 1;
        elements.nextPage.disabled = pageNum === pdfDoc.numPages;
        
        updateStatus(`PDF loaded successfully! ${pdfDoc.numPages} page(s) ready for redaction.`, 'success');
    } catch (error) {
        console.error('PDF loading error:', error);
        updateStatus('Error loading PDF. Please try another file.', 'error');
    } finally {
        elements.loading.style.display = 'none';
    }
}

// Mouse Position Helper
function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

// Page Rendering
async function renderPage() {
    if (!pdfDoc) return;
    
    elements.loading.style.display = 'block';
    elements.pdfContainer.innerHTML = '';
    
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        
        // Store canvas dimensions for coordinate conversion
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        
        const container = document.createElement('div');
        container.className = 'canvas-container';
        container.style.width = viewport.width + 'px';
        container.style.height = viewport.height + 'px';
        container.appendChild(canvas);
        elements.pdfContainer.appendChild(container);

        await page.render({ canvasContext: ctx, viewport }).promise;
        setupCanvasEvents(container);
        renderElements();
        
        elements.pageNum.textContent = pageNum;
    } catch (error) {
        console.error('Page rendering error:', error);
        updateStatus('Error rendering page', 'error');
    } finally {
        elements.loading.style.display = 'none';
    }
}

// Canvas Event Setup
function setupCanvasEvents(container) {
    const handleMouseDown = (e) => {
        const pos = getMousePos(e);
        startX = pos.x; startY = pos.y;
        const el = getElementAtPos(startX, startY);
        
        if (el) {
            selected = el;
            selected.classList.add('selected');
            const rect = el.getBoundingClientRect();
            dragOffsetX = startX - rect.left;
            dragOffsetY = startY - rect.top;
            isDragging = true;
            addToHistory({ type: 'select', id: el.id });
        } else if (isAddingWhiteout) {
            createWhiteout(startX, startY, 0, 0);
            isDragging = true;
        } else if (isAddingText) {
            addText(startX, startY);
        } else if (selected) {
            selected.classList.remove('selected');
            selected = null;
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !canvas) return;
        const pos = getMousePos(e);
        currentX = pos.x; currentY = pos.y;
        
        if (selected) {
            selected.style.left = (currentX - dragOffsetX) + 'px';
            selected.style.top = (currentY - dragOffsetY) + 'px';
            updateElementData(selected);
        } else if (isAddingWhiteout) {
            const whiteout = container.querySelector('.whiteout-area:last-child');
            if (whiteout) {
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                whiteout.style.width = width + 'px';
                whiteout.style.height = height + 'px';
                whiteout.style.left = Math.min(startX, currentX) + 'px';
                whiteout.style.top = Math.min(startY, currentY) + 'px';
            }
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            if (selected) {
                addToHistory({ type: 'move', id: selected.id, data: getElementData(selected) });
            } else if (isAddingWhiteout) {
                const whiteout = container.querySelector('.whiteout-area:last-child');
                if (whiteout) {
                    const id = 'whiteout-' + Date.now();
                    whiteout.id = id;
                    whiteouts.push({ 
                        id, 
                        page: pageNum, 
                        x: parseFloat(whiteout.style.left), 
                        y: parseFloat(whiteout.style.top), 
                        width: parseFloat(whiteout.style.width), 
                        height: parseFloat(whiteout.style.height) 
                    });
                    addToHistory({ type: 'add', id, data: whiteouts[whiteouts.length - 1] });
                }
                isAddingWhiteout = false;
                updateModeIndicator();
            }
            isDragging = false;
        }
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);
}

// Element Management
function getElementAtPos(x, y) {
    const allElements = [...elements.pdfContainer.querySelectorAll('.whiteout-area, .text-element')];
    return allElements.find(el => {
        const rect = el.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
}

function createWhiteout(x, y, width, height) {
    const whiteout = document.createElement('div');
    whiteout.className = 'whiteout-area';
    whiteout.style.left = x + 'px';
    whiteout.style.top = y + 'px';
    whiteout.style.width = width + 'px';
    whiteout.style.height = height + 'px';
    whiteout.title = 'Redaction box - drag to move, click to select (Press DEL to delete)';
    elements.pdfContainer.querySelector('.canvas-container').appendChild(whiteout);
}

function addText(x, y) {
    const text = prompt('Enter redaction text (e.g., "REDACTED", "CONFIDENTIAL"):', 'REDACTED');
    if (!text || !text.trim()) {
        updateStatus('Text input cancelled', 'warning');
        return;
    }
    
    const textEl = document.createElement('div');
    textEl.className = 'text-element';
    textEl.style.left = x + 'px';
    textEl.style.top = y + 'px';
    textEl.innerHTML = `<div>${text}</div>`;
    textEl.title = 'Redaction text - drag to move, click to select (Press DEL to delete)';
    
    const id = 'text-' + Date.now();
    textEl.id = id;
    elements.pdfContainer.querySelector('.canvas-container').appendChild(textEl);
    texts.push({ id, page: pageNum, x: x, y: y, text });
    addToHistory({ type: 'add', id, data: texts[texts.length - 1] });
    
    isAddingText = false;
    updateModeIndicator();
    updateStatus(`Added redaction text: "${text}"`, 'success');
}

function deleteSelectedElement() {
    if (!selected) return;
    
    const id = selected.id;
    const isWhiteout = selected.classList.contains('whiteout-area');
    
    if (isWhiteout) {
        whiteouts = whiteouts.filter(w => w.id !== id);
        addToHistory({ type: 'delete', id, data: whiteouts.find(w => w.id === id) });
    } else {
        texts = texts.filter(t => t.id !== id);
        addToHistory({ type: 'delete', id, data: texts.find(t => t.id === id) });
    }
    
    selected.remove();
    selected = null;
    updateStatus('Element deleted', 'success');
}

function updateElementData(el) {
    if (el.classList.contains('whiteout-area')) {
        const index = whiteouts.findIndex(w => w.id === el.id);
        if (index > -1) whiteouts[index] = getElementData(el);
    } else if (el.classList.contains('text-element')) {
        const index = texts.findIndex(t => t.id === el.id);
        if (index > -1) texts[index] = getElementData(el);
    }
}

function getElementData(el) {
    if (el.classList.contains('whiteout-area')) {
        return { 
            id: el.id, 
            page: pageNum, 
            x: parseFloat(el.style.left), 
            y: parseFloat(el.style.top), 
            width: parseFloat(el.style.width), 
            height: parseFloat(el.style.height) 
        };
    } else {
        return { 
            id: el.id, 
            page: pageNum, 
            x: parseFloat(el.style.left), 
            y: parseFloat(el.style.top), 
            text: el.querySelector('div').textContent 
        };
    }
}

function renderElements() {
    // Clear existing elements first
    elements.pdfContainer.querySelectorAll('.whiteout-area, .text-element').forEach(el => el.remove());
    
    // Render whiteouts for current page
    whiteouts.filter(w => w.page === pageNum).forEach(w => {
        createWhiteout(w.x, w.y, w.width, w.height);
    });
    
    // Render texts for current page
    texts.filter(t => t.page === pageNum).forEach(t => {
        const textEl = document.createElement('div');
        textEl.className = 'text-element';
        textEl.id = t.id;
        textEl.style.left = t.x + 'px';
        textEl.style.top = t.y + 'px';
        textEl.innerHTML = `<div>${t.text}</div>`;
        textEl.title = 'Redaction text - drag to move, click to select (Press DEL to delete)';
        elements.pdfContainer.querySelector('.canvas-container').appendChild(textEl);
    });
}

// Mode Management
function toggleWhiteoutMode() {
    isAddingWhiteout = !isAddingWhiteout;
    isAddingText = false;
    elements.addWhiteout.style.background = isAddingWhiteout ? '#e67e22' : '';
    elements.addText.style.background = '';
    updateModeIndicator();
    
    if (isAddingWhiteout) {
        updateStatus('Redaction Box Mode: Click and drag to create redaction boxes (Press ESC to cancel)', 'warning');
    } else {
        updateStatus('Redaction Box Mode deactivated', 'info');
    }
}

function toggleTextMode() {
    isAddingText = !isAddingText;
    isAddingWhiteout = false;
    elements.addText.style.background = isAddingText ? '#27ae60' : '';
    elements.addWhiteout.style.background = '';
    updateModeIndicator();
    
    if (isAddingText) {
        updateStatus('Text Mode: Click to add custom redaction text (Press ESC to cancel)', 'warning');
    } else {
        updateStatus('Text Mode deactivated', 'info');
    }
}

function updateModeIndicator() {
    if (isAddingWhiteout) {
        elements.modeIndicator.textContent = 'Redaction Box Mode';
        elements.modeIndicator.style.display = 'inline-block';
        elements.modeIndicator.style.background = '#e67e22';
    } else if (isAddingText) {
        elements.modeIndicator.textContent = 'Text Mode';
        elements.modeIndicator.style.display = 'inline-block';
        elements.modeIndicator.style.background = '#27ae60';
    } else {
        elements.modeIndicator.style.display = 'none';
    }
}

// History Management (Undo/Redo)
function addToHistory(action) {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    history.push({ ...action, timestamp: Date.now() });
    historyIndex = history.length - 1;
    updateHistoryButtons();
}

function updateHistoryButtons() {
    elements.undo.disabled = historyIndex < 0;
    elements.redo.disabled = historyIndex >= history.length - 1;
}

function undo() {
    if (historyIndex < 0) return;
    const action = history[historyIndex--];
    
    if (action.type === 'add') {
        if (whiteouts.find(w => w.id === action.id)) {
            whiteouts = whiteouts.filter(w => w.id !== action.id);
        } else {
            texts = texts.filter(t => t.id !== action.id);
        }
        document.getElementById(action.id)?.remove();
    } else if (action.type === 'delete') {
        if (action.data.width !== undefined) { // It's a whiteout
            whiteouts.push(action.data);
            createWhiteout(action.data.x, action.data.y, action.data.width, action.data.height);
        } else { // It's a text
            texts.push(action.data);
            const textEl = document.createElement('div');
            textEl.className = 'text-element';
            textEl.id = action.id;
            textEl.style.left = action.data.x + 'px';
            textEl.style.top = action.data.y + 'px';
            textEl.innerHTML = `<div>${action.data.text}</div>`;
            elements.pdfContainer.querySelector('.canvas-container').appendChild(textEl);
        }
    } else if (action.type === 'move') {
        const el = document.getElementById(action.id);
        if (el) {
            el.style.left = action.data.x + 'px';
            el.style.top = action.data.y + 'px';
            updateElementData(el);
        }
    } else if (action.type === 'clear') {
        whiteouts = action.data.whiteouts;
        texts = action.data.texts;
        renderElements();
    }
    updateHistoryButtons();
    updateStatus('Undo completed', 'info');
}

function redo() {
    if (historyIndex >= history.length - 1) return;
    const action = history[++historyIndex];
    
    if (action.type === 'add') {
        if (action.data.width !== undefined) { // It's a whiteout
            whiteouts.push(action.data);
            createWhiteout(action.data.x, action.data.y, action.data.width, action.data.height);
        } else { // It's a text
            texts.push(action.data);
            const textEl = document.createElement('div');
            textEl.className = 'text-element';
            textEl.id = action.id;
            textEl.style.left = action.data.x + 'px';
            textEl.style.top = action.data.y + 'px';
            textEl.innerHTML = `<div>${action.data.text}</div>`;
            elements.pdfContainer.querySelector('.canvas-container').appendChild(textEl);
        }
    } else if (action.type === 'delete') {
        if (whiteouts.find(w => w.id === action.id)) {
            whiteouts = whiteouts.filter(w => w.id !== action.id);
        } else {
            texts = texts.filter(t => t.id !== action.id);
        }
        document.getElementById(action.id)?.remove();
    } else if (action.type === 'move') {
        const el = document.getElementById(action.id);
        if (el) {
            el.style.left = action.data.x + 'px';
            el.style.top = action.data.y + 'px';
            updateElementData(el);
        }
    } else if (action.type === 'clear') {
        whiteouts = [];
        texts = [];
        elements.pdfContainer.querySelectorAll('.whiteout-area, .text-element').forEach(el => el.remove());
    }
    updateHistoryButtons();
    updateStatus('Redo completed', 'info');
}

// Clear All Function
function clearAll() {
    if (whiteouts.length + texts.length === 0) {
        updateStatus('No redaction elements to clear', 'warning');
        return;
    }
    
    if (!confirm('Are you sure you want to clear all redaction boxes and text?')) {
        return;
    }
    
    addToHistory({ type: 'clear', data: { whiteouts: [...whiteouts], texts: [...texts] } });
    whiteouts = [];
    texts = [];
    elements.pdfContainer.querySelectorAll('.whiteout-area, .text-element').forEach(el => el.remove());
    updateStatus('All redaction elements cleared', 'success');
}

// Page Navigation
function changePage(delta) {
    pageNum += delta;
    elements.prevPage.disabled = pageNum === 1;
    elements.nextPage.disabled = pageNum === pdfDoc.numPages;
    renderPage();
    updateStatus(`Now viewing page ${pageNum} of ${pdfDoc.numPages}`, 'info');
}

// PDF Download
async function downloadPdf() {
    if (!pdfDoc) {
        updateStatus('Please load a PDF first', 'error');
        return;
    }
    
    if (whiteouts.length + texts.length === 0) {
        if (!confirm('No redaction elements added. Download original PDF?')) {
            return;
        }
    }
    
    updateStatus('Generating redacted PDF...', 'info');
    elements.loading.style.display = 'block';
    
    try {
        const pdfDocLib = await PDFLib.PDFDocument.load(await pdfDoc.getData());
        const helveticaFont = await pdfDocLib.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const pages = pdfDocLib.getPages();

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            
            // Get the original PDF page to match coordinates
            const originalPage = await pdfDoc.getPage(i + 1);
            const originalViewport = originalPage.getViewport({ scale: 1 });
            
            // Calculate scaling factors
            const scaleX = width / originalViewport.width;
            const scaleY = height / originalViewport.height;
            
            // Apply whiteouts (redaction boxes) - COMPLETELY BORDERLESS
            whiteouts.filter(w => w.page === i + 1).forEach(w => {
                // Convert canvas coordinates to PDF coordinates
                const pdfX = w.x * (scaleX / scale);
                const pdfY = height - (w.y * (scaleY / scale) + w.height * (scaleY / scale));
                const pdfWidth = w.width * (scaleX / scale);
                const pdfHeight = w.height * (scaleY / scale);
                
                // Draw pure white rectangle with NO BORDER
                page.drawRectangle({
                    x: pdfX,
                    y: pdfY,
                    width: pdfWidth,
                    height: pdfHeight,
                    color: PDFLib.rgb(1, 1, 1), // Pure white
                    borderWidth: 0 // NO BORDER
                });
            });
            
            // Apply redaction text
            texts.filter(t => t.page === i + 1).forEach(t => {
                const pdfX = t.x * (scaleX / scale);
                const pdfY = height - (t.y * (scaleY / scale) + 16 * (scaleY / scale));
                
                page.drawText(t.text, {
                    x: pdfX,
                    y: pdfY,
                    size: 12,
                    font: helveticaFont,
                    color: PDFLib.rgb(0.7, 0.7, 0.7)
                });
            });
        }

        const pdfBytes = await pdfDocLib.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `redacted-document-${new Date().getTime()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        updateStatus('Redacted PDF downloaded successfully!', 'success');
    } catch (error) {
        console.error('PDF download error:', error);
        updateStatus('Error generating redacted PDF', 'error');
    } finally {
        elements.loading.style.display = 'none';
    }
}

// Utility Functions
function exportRedactionData() {
    const data = {
        whiteouts: whiteouts,
        texts: texts,
        timestamp: new Date().toISOString(),
        pageCount: pdfDoc ? pdfDoc.numPages : 0
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `redaction-data-${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    updateStatus('Redaction data exported', 'success');
}

function importRedactionData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            whiteouts = data.whiteouts || [];
            texts = data.texts || [];
            renderElements();
            updateStatus('Redaction data imported successfully', 'success');
        } catch (error) {
            updateStatus('Error importing redaction data', 'error');
        }
    };
    reader.readAsText(file);
}

// Initialize Application
function initializeApp() {
    initializeEventListeners();
    updateStatus('Ready to redact PDF documents', 'info');
    
    // Add keyboard shortcuts info
    console.log(`
PDF Redaction Tool Keyboard Shortcuts:
Ctrl+Z / Cmd+Z - Undo
Ctrl+Shift+Z / Cmd+Shift+Z - Redo
Ctrl+Y / Cmd+Y - Redo
Ctrl+D / Cmd+D - Toggle Redaction Box Mode
Ctrl+T / Cmd+T - Toggle Text Mode
ESC - Cancel current mode / Deselect
DEL - Delete selected element
    `);
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export functions for global access (if needed)
window.pdfRedactionTool = {
    exportRedactionData,
    importRedactionData,
    clearAll,
    getStats: () => ({
        whiteouts: whiteouts.length,
        texts: texts.length,
        currentPage: pageNum,
        totalPages: pdfDoc ? pdfDoc.numPages : 0
    })
};