// script.js

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Global variables
let selectedFile = null;
let extractedData = [];
let isProcessing = false;

// DOM elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const conversionOptions = document.getElementById('conversionOptions');
const fileName = document.getElementById('fileName');
const convertBtn = document.getElementById('convertBtn');
const resetBtn = document.getElementById('resetBtn');
const statusArea = document.getElementById('statusArea');
const previewArea = document.getElementById('previewArea');
const previewTable = document.getElementById('previewTable');
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const extractHeaders = document.getElementById('extractHeaders');
const preserveFormatting = document.getElementById('preserveFormatting');
const multipleSheets = document.getElementById('multipleSheets');
const pageRange = document.getElementById('pageRange');

// Initialize the application
function init() {
    setupEventListeners();
    showStatus('Select a PDF file containing tables to convert to Excel format.', 'info');
}

// Set up all event listeners
function setupEventListeners() {
    // File selection handling
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop functionality
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // Conversion options
    convertBtn.addEventListener('click', handleConvert);
    resetBtn.addEventListener('click', handleReset);

    // Option changes
    extractHeaders.addEventListener('change', updatePreviewFromExtractedData);
    multipleSheets.addEventListener('change', updateConversionOptions);
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.style.background = '#e0ffe8';
    uploadArea.style.borderColor = '#00a085';
}

function handleDragLeave() {
    uploadArea.style.background = '#f0fff4';
    uploadArea.style.borderColor = '#00b894';
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.style.background = '#f0fff4';
    uploadArea.style.borderColor = '#00b894';
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// File selection handler
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

// Main file handling function
async function handleFile(file) {
    if (!validateFile(file)) {
        showStatus('Please select a valid PDF file.', 'error');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = file.name;
    conversionOptions.style.display = 'block';
    previewArea.style.display = 'block';
    
    showStatus('Loading PDF file...', 'info');
    showProgress(10);
    
    try {
        // Extract data from PDF
        extractedData = await extractDataFromPDF(file);
        showProgress(100);
        
        if (extractedData.length > 0) {
            showStatus('PDF file loaded successfully! Data extracted. Configure conversion options.', 'success');
            updatePreviewFromExtractedData();
        } else {
            showStatus('No table data found in the PDF. Try a different file.', 'warning');
        }
    } catch (error) {
        console.error('Error extracting PDF data:', error);
        showStatus('Error extracting data from PDF: ' + error.message, 'error');
    } finally {
        hideProgress();
    }
}

// Validate uploaded file
function validateFile(file) {
    if (!file) return false;
    
    const isValidType = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit
    
    if (!isValidType) {
        showStatus('Please select a PDF file.', 'error');
        return false;
    }
    
    if (!isValidSize) {
        showStatus('File size must be less than 50MB.', 'error');
        return false;
    }
    
    return true;
}

// Extract data from PDF using PDF.js
async function extractDataFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            try {
                const typedArray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                
                const tables = [];
                const numPages = pdf.numPages;
                const pagesToProcess = getPagesToProcess(numPages);
                
                for (let i = 0; i < pagesToProcess.length; i++) {
                    const pageNum = pagesToProcess[i];
                    const progressPercent = 10 + (i / pagesToProcess.length) * 80;
                    showProgress(progressPercent);
                    
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    
                    // Extract and process text content
                    const textItems = textContent.items.map(item => ({
                        text: item.str,
                        x: item.transform[4],
                        y: item.transform[5],
                        width: item.width,
                        height: item.height
                    }));
                    
                    // Detect tables in the page
                    const detectedTables = detectTables(textItems);
                    if (detectedTables.length > 0) {
                        tables.push(...detectedTables);
                    }
                }
                
                resolve(tables);
            } catch (error) {
                reject(error);
            }
        };
        
        fileReader.onerror = function() {
            reject(new Error('Failed to read the PDF file'));
        };
        
        fileReader.readAsArrayBuffer(file);
    });
}

// Get pages to process based on user input
function getPagesToProcess(totalPages) {
    const rangeInput = pageRange.value.trim();
    
    if (!rangeInput) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const pages = [];
    const ranges = rangeInput.split(',');
    
    for (const range of ranges) {
        if (range.includes('-')) {
            const [start, end] = range.split('-').map(num => parseInt(num.trim()));
            const validStart = Math.max(1, start);
            const validEnd = Math.min(totalPages, end || start);
            
            for (let i = validStart; i <= validEnd; i++) {
                pages.push(i);
            }
        } else {
            const pageNum = parseInt(range.trim());
            if (pageNum >= 1 && pageNum <= totalPages) {
                pages.push(pageNum);
            }
        }
    }
    
    return pages.length > 0 ? pages : Array.from({ length: totalPages }, (_, i) => i + 1);
}

// Detect tables in text items
function detectTables(textItems) {
    if (textItems.length === 0) return [];
    
    // Group text items by approximate y-coordinate (rows)
    const rowTolerance = 5; // pixels
    const rows = {};
    
    textItems.forEach(item => {
        const yKey = Math.round(item.y / rowTolerance) * rowTolerance;
        if (!rows[yKey]) rows[yKey] = [];
        rows[yKey].push(item);
    });
    
    // Sort rows by y-coordinate (top to bottom)
    const sortedRowKeys = Object.keys(rows).sort((a, b) => b - a);
    const sortedRows = sortedRowKeys.map(key => rows[key]);
    
    // Sort items in each row by x-coordinate (left to right)
    sortedRows.forEach(row => {
        row.sort((a, b) => a.x - b.x);
    });
    
    // Filter out rows with very few items (likely not tables)
    const tableRows = sortedRows.filter(row => row.length >= 2);
    
    if (tableRows.length > 0) {
        const table = tableRows.map(row => row.map(item => item.text));
        return [table];
    }
    
    return [];
}

// Update preview based on extracted data
function updatePreviewFromExtractedData() {
    if (!extractedData || extractedData.length === 0) {
        previewTable.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">No data available for preview</td></tr>';
        return;
    }
    
    const tableData = extractedData[0]; // Show first table in preview
    updatePreview(tableData);
}

// Update the preview table
function updatePreview(tableData) {
    // Clear existing table
    previewTable.innerHTML = '';
    
    if (!tableData || tableData.length === 0) {
        const emptyMsg = document.createElement('tr');
        emptyMsg.innerHTML = '<td colspan="3" style="text-align: center; color: #666;">No data available for preview</td>';
        previewTable.appendChild(emptyMsg);
        return;
    }
    
    // Create table structure
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    
    // Create header row
    const headerRow = document.createElement('tr');
    const useHeaders = extractHeaders.checked && tableData[0];
    
    if (useHeaders && tableData[0]) {
        // Use first row as headers
        tableData[0].forEach(header => {
            const th = document.createElement('th');
            th.textContent = header || 'Column';
            headerRow.appendChild(th);
        });
    } else {
        // Create generic headers
        const maxCols = Math.max(...tableData.map(row => row.length));
        for (let i = 0; i < maxCols; i++) {
            const th = document.createElement('th');
            th.textContent = `Column ${i + 1}`;
            headerRow.appendChild(th);
        }
    }
    
    thead.appendChild(headerRow);
    previewTable.appendChild(thead);
    
    // Create data rows
    const startRow = useHeaders ? 1 : 0;
    
    for (let i = startRow; i < Math.min(tableData.length, 10); i++) { // Limit to 10 rows for preview
        const row = document.createElement('tr');
        tableData[i].forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell || '';
            row.appendChild(td);
        });
        
        // Fill empty cells if needed
        const maxCols = headerRow.children.length;
        while (row.children.length < maxCols) {
            const td = document.createElement('td');
            row.appendChild(td);
        }
        
        tbody.appendChild(row);
    }
    
    previewTable.appendChild(tbody);
    
    // Add preview limit notice if needed
    if (tableData.length > 10) {
        const noticeRow = document.createElement('tr');
        const noticeCell = document.createElement('td');
        noticeCell.colSpan = headerRow.children.length;
        noticeCell.style.textAlign = 'center';
        noticeCell.style.color = '#666';
        noticeCell.style.fontStyle = 'italic';
        noticeCell.textContent = `... and ${tableData.length - 10} more rows`;
        noticeRow.appendChild(noticeCell);
        tbody.appendChild(noticeRow);
    }
}

// Handle conversion to Excel
async function handleConvert() {
    if (isProcessing) return;
    
    if (!selectedFile || extractedData.length === 0) {
        showStatus('Please select a PDF file with table data first.', 'error');
        return;
    }
    
    isProcessing = true;
    
    try {
        showStatus('Converting PDF to Excel...', 'info');
        convertBtn.disabled = true;
        showProgress(10);
        
        // Create Excel workbook
        const wb = XLSX.utils.book_new();
        const useMultipleSheets = multipleSheets.checked;
        const useHeaders = extractHeaders.checked;
        
        // Process tables
        if (useMultipleSheets && extractedData.length > 1) {
            // Create separate sheet for each table
            await processMultipleSheets(wb, extractedData, useHeaders);
        } else {
            // Combine all tables into one sheet
            await processSingleSheet(wb, extractedData, useHeaders);
        }
        
        // Generate and download Excel file
        await generateAndDownloadExcel(wb);
        
        showProgress(100);
        showStatus(`PDF converted to Excel successfully! ${extractedData.length} table(s) extracted. File downloaded.`, 'success');
        
    } catch (error) {
        console.error('Conversion error:', error);
        showStatus('Error converting PDF to Excel: ' + error.message, 'error');
    } finally {
        isProcessing = false;
        convertBtn.disabled = false;
        hideProgress();
    }
}

// Process multiple sheets
async function processMultipleSheets(wb, tables, useHeaders) {
    tables.forEach((table, index) => {
        const progressPercent = 10 + ((index + 1) / tables.length) * 80;
        showProgress(progressPercent);
        
        if (table.length > 0) {
            const sheetName = `Table ${index + 1}`.substring(0, 31); // Excel sheet name limit
            const dataToExport = useHeaders ? table : table;
            
            const ws = XLSX.utils.aoa_to_sheet(dataToExport);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
    });
}

// Process single sheet
async function processSingleSheet(wb, tables, useHeaders) {
    let allData = [];
    
    tables.forEach((table, index) => {
        const progressPercent = 10 + ((index + 1) / tables.length) * 80;
        showProgress(progressPercent);
        
        if (table.length > 0) {
            // Add separator between tables if multiple tables
            if (index > 0 && allData.length > 0) {
                allData.push(['']); // Empty row as separator
            }
            
            // Add table data
            const dataToAdd = useHeaders ? table : table;
            allData.push(...dataToAdd);
        }
    });
    
    if (allData.length > 0) {
        const ws = XLSX.utils.aoa_to_sheet(allData);
        XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
    }
}

// Generate and download Excel file
async function generateAndDownloadExcel(wb) {
    return new Promise((resolve) => {
        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { 
            bookType: 'xlsx', 
            type: 'array',
            cellStyles: preserveFormatting.checked
        });
        
        // Create download filename
        const originalName = selectedFile.name.replace(/\.pdf$/i, '');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const downloadName = `${originalName}-converted-${timestamp}.xlsx`;
        
        // Download file
        download(excelBuffer, downloadName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        resolve();
    });
}

// Handle reset
function handleReset() {
    selectedFile = null;
    extractedData = [];
    fileInput.value = '';
    conversionOptions.style.display = 'none';
    previewArea.style.display = 'none';
    progressBar.style.display = 'none';
    showStatus('Select a new PDF file to convert to Excel.', 'info');
}

// Update conversion options UI
function updateConversionOptions() {
    // You can add dynamic UI updates based on option changes here
    if (multipleSheets.checked) {
        showStatus('Each table will be created as a separate sheet in the Excel file.', 'info');
    }
}

// Progress bar functions
function showProgress(percent) {
    progressBar.style.display = 'block';
    progress.style.width = `${percent}%`;
}

function hideProgress() {
    setTimeout(() => {
        progressBar.style.display = 'none';
    }, 1000);
}

// Status display function
function showStatus(message, type) {
    statusArea.innerHTML = `<div class="status status-${type}">${message}</div>`;
}

// Utility function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export functions for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        init,
        handleFile,
        handleConvert,
        handleReset,
        validateFile,
        formatFileSize
    };
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);