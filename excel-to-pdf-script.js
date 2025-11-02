// excel-to-pdf-script.js - Enhanced Excel to PDF Converter
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadArea = document.getElementById('uploadArea');
    const convertBtn = document.getElementById('convertBtn');
    const previewContainer = document.getElementById('previewContainer');
    const fileInfo = document.getElementById('fileInfo');
    const statusMessage = document.getElementById('statusMessage');
    const outputCustom = document.getElementById('outputCustom');
    const customRange = document.getElementById('customRange');
    
    let currentFile = null;
    let excelData = null;

    // Initialize event listeners
    initEventListeners();

    function initEventListeners() {
        // Browse button click event
        browseBtn.addEventListener('click', function() {
            fileInput.click();
        });
        
        // File input change event
        fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });
        
        // Drag and drop functionality
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.style.backgroundColor = '#e8f4fc';
            uploadArea.style.borderColor = '#3498db';
        });
        
        uploadArea.addEventListener('dragleave', function() {
            uploadArea.style.backgroundColor = '#f8fafc';
            uploadArea.style.borderColor = '#3498db';
        });
        
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.style.backgroundColor = '#f8fafc';
            uploadArea.style.borderColor = '#3498db';
            
            if (e.dataTransfer.files.length > 0) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });
        
        // Custom range input visibility
        outputCustom.addEventListener('change', function() {
            customRange.style.display = this.checked ? 'block' : 'none';
        });
        
        // Convert button click event
        convertBtn.addEventListener('click', function() {
            convertToPDF();
        });
    }

    // Handle file selection and processing
    async function handleFileSelection(file) {
        if (!file.name.match(/\.(xlsx|xls)$/)) {
            showStatus('Please select a valid Excel file (.xlsx or .xls)', 'error');
            return;
        }
        
        currentFile = file;
        
        try {
            showStatus('Processing Excel file...', 'info');
            
            // Get Excel file info from backend
            const fileInfo = await getExcelInfo(file);
            excelData = fileInfo;
            
            // Update UI
            updateFileInfo(file, fileInfo);
            updatePreview(fileInfo);
            
            // Enable convert button
            convertBtn.disabled = false;
            
            showStatus('Excel file processed successfully. Ready for conversion.', 'success');
        } catch (error) {
            console.error('Error processing Excel file:', error);
            showStatus('Error processing Excel file: ' + error.message, 'error');
        }
    }

    // Get Excel file information from backend
    async function getExcelInfo(file) {
        const formData = new FormData();
        formData.append('excelFile', file);
        
        const response = await fetch('/api/get-excel-info', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to read Excel file');
        }
        
        const result = await response.json();
        return result.fileInfo;
    }

    // Update file information display
    function updateFileInfo(file, data) {
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = data.fileSize;
        document.getElementById('lastModified').textContent = new Date(file.lastModified).toLocaleString();
        document.getElementById('sheetCount').textContent = data.sheetCount;
        document.getElementById('rowCount').textContent = data.firstSheet.rows;
        document.getElementById('columnCount').textContent = data.firstSheet.columns;
        
        fileInfo.style.display = 'block';
    }

    // Update preview table
    function updatePreview(data) {
        const sheetData = data.firstSheet;
        
        if (!sheetData.data || sheetData.data.length === 0) {
            previewContainer.innerHTML = '<p style="text-align: center; padding: 50px; color: #777;">No data found in Excel file</p>';
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'preview-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Use headers from backend or create generic headers
        const headers = sheetData.columnAnalysis.map(col => col.header);
        headers.forEach((header, index) => {
            const th = document.createElement('th');
            th.textContent = header;
            th.title = `Type: ${sheetData.columnAnalysis[index].dataType}`;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body (show first 10 rows for preview)
        const tbody = document.createElement('tbody');
        const rowsToShow = Math.min(sheetData.data.length, 11); // Header + 10 rows
        
        for (let i = 0; i < rowsToShow; i++) {
            const row = document.createElement('tr');
            const rowData = sheetData.data[i] || [];
            
            // Ensure we have the same number of cells as headers
            for (let j = 0; j < headers.length; j++) {
                const cell = document.createElement('td');
                cell.textContent = rowData[j] !== undefined ? rowData[j] : '';
                
                // Add data type styling
                const dataType = sheetData.columnAnalysis[j]?.dataType;
                if (dataType === 'number') {
                    cell.style.textAlign = 'right';
                    cell.style.fontFamily = 'monospace';
                } else if (dataType === 'date') {
                    cell.style.fontStyle = 'italic';
                }
                
                row.appendChild(cell);
            }
            
            tbody.appendChild(row);
        }
        
        table.appendChild(tbody);
        
        // Clear and update preview container
        previewContainer.innerHTML = '';
        previewContainer.appendChild(table);
        
        // Add preview info
        const info = document.createElement('div');
        info.style.textAlign = 'center';
        info.style.marginTop = '15px';
        info.style.padding = '10px';
        info.style.backgroundColor = '#f8f9fa';
        info.style.borderRadius = '5px';
        
        info.innerHTML = `
            <p style="margin: 5px 0; font-style: italic; color: #555;">
                Preview of first ${rowsToShow} rows. Total rows: ${sheetData.rows}
            </p>
            <p style="margin: 5px 0; font-size: 0.9em; color: #777;">
                Data types detected: ${sheetData.columnAnalysis.filter(col => col.dataType !== 'text').length} columns
            </p>
        `;
        
        previewContainer.appendChild(info);
    }

    // Convert Excel to PDF
    async function convertToPDF() {
        if (!currentFile || !excelData) {
            showStatus('Please select an Excel file first', 'error');
            return;
        }
        
        try {
            showStatus('Converting to PDF...', 'info');
            convertBtn.disabled = true;
            convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Converting...';
            
            // Get conversion settings
            const settings = getConversionSettings();
            
            // Prepare form data
            const formData = new FormData();
            formData.append('excelFile', currentFile);
            formData.append('settings', JSON.stringify(settings));
            
            // Send conversion request
            const response = await fetch('/api/convert-excel-to-pdf', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Download the PDF
                await downloadPDF(result.filename);
                showStatus('PDF converted and downloaded successfully!', 'success');
                
                // Show conversion details
                showConversionDetails(result);
            } else {
                throw new Error(result.error || 'Conversion failed');
            }
            
        } catch (error) {
            console.error('Conversion error:', error);
            showStatus('Conversion failed: ' + error.message, 'error');
        } finally {
            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Convert to PDF';
        }
    }

    // Download converted PDF
    async function downloadPDF(filename) {
        try {
            const response = await fetch(`/api/download/${filename}`);
            
            if (!response.ok) {
                throw new Error('Failed to download PDF');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = currentFile.name.replace(/\.(xlsx|xls)$/, '.pdf');
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
        } catch (error) {
            throw new Error('Download failed: ' + error.message);
        }
    }

    // Show conversion details
    function showConversionDetails(result) {
        const details = `
            <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin-top: 15px;">
                <h4 style="margin-top: 0;">Conversion Details:</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><strong>Original Size:</strong> ${result.conversionDetails.originalSize}</div>
                    <div><strong>PDF Size:</strong> ${result.conversionDetails.pdfSize}</div>
                    <div><strong>Rows Processed:</strong> ${result.conversionDetails.rowsProcessed}</div>
                    <div><strong>Columns:</strong> ${result.conversionDetails.columns}</div>
                    <div><strong>Pages:</strong> ${result.conversionDetails.pages}</div>
                    <div><strong>Data Types Detected:</strong> ${result.conversionDetails.dataTypesDetected}</div>
                </div>
            </div>
        `;
        
        statusMessage.insertAdjacentHTML('afterend', details);
    }

    // Get conversion settings from UI
    function getConversionSettings() {
        const outputOption = document.querySelector('input[name="outputOption"]:checked').value;
        
        return {
            pageSize: document.getElementById('pageSize').value,
            orientation: document.getElementById('orientation').value,
            margin: parseFloat(document.getElementById('margin').value) || 0.5,
            fontSize: 8, // Default font size
            includeHeaders: document.getElementById('includeHeaders').checked,
            repeatHeaders: document.getElementById('repeatHeaders').checked,
            gridLines: document.getElementById('gridLines').checked,
            alternateRows: document.getElementById('alternateRows').checked,
            boldHeaders: document.getElementById('boldHeaders').checked,
            outputOption: outputOption,
            customRange: outputOption === 'custom' ? document.getElementById('customRange').value : '',
            title: `Converted from ${currentFile.name}`,
            footer: true,
            dataTypes: true // Enable data type detection
        };
    }

    // Show status messages
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message';
        
        switch(type) {
            case 'success':
                statusMessage.classList.add('status-success');
                break;
            case 'error':
                statusMessage.classList.add('status-error');
                break;
            case 'info':
                statusMessage.classList.add('status-info');
                break;
        }
        
        statusMessage.style.display = 'block';
        
        // Auto-hide success messages after 8 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 8000);
        }
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});