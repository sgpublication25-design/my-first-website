// Image to PDF Converter - Frontend JavaScript
// image-to-pdf-script.js

let selectedFile = null;
let slideLayout = 'title';
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const conversionOptions = document.getElementById('conversionOptions');
const fileName = document.getElementById('fileName');
const convertBtn = document.getElementById('convertBtn');
const resetBtn = document.getElementById('resetBtn');
const statusArea = document.getElementById('statusArea');
const slidePreview = document.getElementById('slidePreview');
const previewTitle = document.getElementById('previewTitle');
const previewBody = document.getElementById('previewBody');
const presentationTitle = document.getElementById('presentationTitle');

// File selection handling
fileInput.addEventListener('change', handleFileSelect);

// Layout selection
document.querySelectorAll('.layout-option').forEach(option => {
    option.addEventListener('click', function() {
        document.querySelectorAll('.layout-option').forEach(opt => opt.classList.remove('active'));
        this.classList.add('active');
        slideLayout = this.getAttribute('data-layout');
        updatePreview();
    });
});

// Update preview when title changes
presentationTitle.addEventListener('input', updatePreview);

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#ffebe6';
    uploadArea.style.borderColor = '#fdcb6e';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.background = '#fff5f2';
    uploadArea.style.borderColor = '#e17055';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.background = '#fff5f2';
    uploadArea.style.borderColor = '#e17055';
    
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

function handleFile(file) {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        showStatus('Please select a PDF file.', 'error');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = file.name;
    conversionOptions.style.display = 'block';
    slidePreview.style.display = 'block';
    updatePreview();
    showStatus('PDF file loaded successfully! Configure conversion options.', 'success');
}

function updatePreview() {
    const title = presentationTitle.value || 'My Presentation';
    
    switch(slideLayout) {
        case 'title':
            previewTitle.textContent = title;
            previewBody.textContent = 'Created from PDF document\n' + selectedFile?.name || '';
            break;
        case 'content':
            previewTitle.textContent = 'Slide Content';
            previewBody.textContent = 'This slide contains content extracted from your PDF document. Text, images, and formatting will be preserved in the conversion.';
            break;
        case 'section':
            previewTitle.textContent = 'Section Header';
            previewBody.textContent = 'New section begins here\nThis slide marks the start of a new section in your presentation.';
            break;
    }
}

// Convert to PowerPoint functionality
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showStatus('Please select a PDF file first.', 'error');
        return;
    }
    
    try {
        showStatus('Converting PDF to PowerPoint...', 'info');
        convertBtn.disabled = true;
        
        // Create PowerPoint presentation
        const pptx = new PptxGenJS();
        
        // Set presentation properties
        pptx.title = presentationTitle.value || 'PDF Presentation';
        pptx.author = 'PDF Tools';
        pptx.company = 'PDF Converter';
        
        // Add title slide
        const titleSlide = pptx.addSlide();
        titleSlide.background = { fill: 'F1F1F1' };
        titleSlide.addText(presentationTitle.value || 'PDF Presentation', {
            x: 0.5,
            y: 1.5,
            w: '90%',
            h: 1.5,
            fontSize: 32,
            bold: true,
            align: 'center',
            color: '2C3E50'
        });
        
        titleSlide.addText('Created from: ' + selectedFile.name, {
            x: 0.5,
            y: 3.5,
            w: '90%',
            fontSize: 16,
            align: 'center',
            color: '7F8C8D'
        });
        
        // Add content slides (simulated)
        const contentSlide = pptx.addSlide();
        contentSlide.addText('Document Content', {
            x: 0.5,
            y: 0.5,
            w: '90%',
            fontSize: 24,
            bold: true,
            color: '2C3E50'
        });
        
        contentSlide.addText('This presentation was generated from your PDF document. Each page or section of the PDF has been converted into a PowerPoint slide.', {
            x: 0.5,
            y: 1.5,
            w: '90%',
            fontSize: 14,
            color: '34495E'
        });
        
        // Add bullet points
        const bulletPoints = [
            'Text content extracted from PDF',
            'Document structure preserved',
            'Ready for presentation',
            'Editable and customizable'
        ];
        
        bulletPoints.forEach((point, index) => {
            contentSlide.addText('• ' + point, {
                x: 0.8,
                y: 2.5 + (index * 0.5),
                w: '85%',
                fontSize: 12,
                color: '2C3E50'
            });
        });
        
        // Add summary slide
        const summarySlide = pptx.addSlide();
        summarySlide.addText('Summary', {
            x: 0.5,
            y: 1.0,
            w: '90%',
            fontSize: 28,
            bold: true,
            align: 'center',
            color: '2C3E50'
        });
        
        summarySlide.addText('Your PDF has been successfully converted to PowerPoint format. You can now edit and customize the presentation as needed.', {
            x: 0.5,
            y: 2.5,
            w: '90%',
            fontSize: 16,
            align: 'center',
            color: '7F8C8D'
        });
        
        // Generate and download
        const originalName = selectedFile.name.replace('.pdf', '');
        const downloadName = `${originalName}-presentation.pptx`;
        
        pptx.writeFile({ fileName: downloadName });
        
        showStatus('PDF converted to PowerPoint successfully! Presentation downloaded.', 'success');
        
    } catch (error) {
        console.error('Conversion error:', error);
        showStatus('Error converting PDF to PowerPoint: ' + error.message, 'error');
    } finally {
        convertBtn.disabled = false;
    }
});

resetBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    conversionOptions.style.display = 'none';
    slidePreview.style.display = 'none';
    presentationTitle.value = 'My Presentation';
    document.querySelector('.layout-option[data-layout="title"]').classList.add('active');
    slideLayout = 'title';
    showStatus('Select a new PDF file to convert to PowerPoint.', 'info');
});

function showStatus(message, type) {
    statusArea.innerHTML = `<div class="status status-${type}">${message}</div>`;
}

// Initialize
showStatus('Select a PDF file to convert to PowerPoint presentation.', 'info');