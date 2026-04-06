// Configuration
const CONFIG = {
    // Ganti dengan URL Web App Google Apps Script Anda setelah deployment
    GAS_URL: 'https://script.google.com/macros/s/AKfycbwm6VAlXYzDfTQExNEzImvgIpQ02gFoDJHbT7JsDLrdLggbKQQg-zB3MNiKrZaFv-Mlug/exec',
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
};

// State Management
const state = {
    selectedFile: null,
    selectedCategory: null,
    isUploading: false
};

// DOM Elements
const elements = {
    form: document.getElementById('uploadForm'),
    dropZone: document.getElementById('dropZone'),
    imageInput: document.getElementById('imageInput'),
    previewContainer: document.getElementById('previewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    removeImage: document.getElementById('removeImage'),
    submitBtn: document.getElementById('submitBtn'),
    statusContainer: document.getElementById('statusContainer'),
    progressFill: document.getElementById('progressFill'),
    statusText: document.getElementById('statusText'),
    successMessage: document.getElementById('successMessage'),
    uploadAnother: document.getElementById('uploadAnother'),
    categoryCards: document.querySelectorAll('.category-card'),
    itemName: document.getElementById('itemName')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadStats();
});

function initializeEventListeners() {
    // Drop Zone Events
    elements.dropZone.addEventListener('click', () => elements.imageInput.click());
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    elements.imageInput.addEventListener('change', handleFileSelect);

    // Remove Image
    elements.removeImage.addEventListener('click', (e) => {
        e.stopPropagation();
        resetImage();
    });

    // Category Selection
    elements.categoryCards.forEach(card => {
        card.addEventListener('change', () => {
            state.selectedCategory = card.querySelector('input').value;
            validateForm();
        });
    });

    // Form Submission
    elements.form.addEventListener('submit', handleSubmit);

    // Upload Another
    elements.uploadAnother.addEventListener('click', resetForm);

    // Input validation
    elements.itemName.addEventListener('input', validateForm);
}

// Drag & Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

// File Processing
function processFile(file) {
    // Validation
    if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
        showNotification('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.', 'error');
        return;
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showNotification('Ukuran file terlalu besar. Maksimal 5MB.', 'error');
        return;
    }

    state.selectedFile = file;

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        elements.imagePreview.src = e.target.result;
        elements.dropZone.querySelector('.drop-zone-content').hidden = true;
        elements.previewContainer.hidden = false;
    };
    reader.readAsDataURL(file);

    validateForm();
}

function resetImage() {
    state.selectedFile = null;
    elements.imageInput.value = '';
    elements.imagePreview.src = '';
    elements.dropZone.querySelector('.drop-zone-content').hidden = false;
    elements.previewContainer.hidden = true;
    validateForm();
}

// Form Validation
function validateForm() {
    const isValid = state.selectedFile && 
                    state.selectedCategory && 
                    elements.itemName.value.trim().length > 0;
    
    elements.submitBtn.disabled = !isValid;
}

// Submit Handler
async function handleSubmit(e) {
    e.preventDefault();
    
    if (state.isUploading) return;
    
    state.isUploading = true;
    setLoading(true);

    try {
        // Convert image to base64
        const base64Image = await fileToBase64(state.selectedFile);
        
        // Prepare data
        const data = {
            action: 'upload',
            itemName: elements.itemName.value.trim(),
            category: state.selectedCategory,
            imageData: base64Image.split(',')[1], // Remove data:image prefix
            imageType: state.selectedFile.type,
            imageName: state.selectedFile.name,
            timestamp: new Date().toISOString()
        };

        // Update progress
        updateProgress(30, 'Mengunggah gambar...');

        // Send to Google Apps Script
        const response = await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        updateProgress(70, 'Menyimpan metadata...');

        const result = await response.json();

        if (result.success) {
            updateProgress(100, 'Selesai!');
            setTimeout(showSuccess, 500);
        } else {
            throw new Error(result.message || 'Upload gagal');
        }

    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Terjadi kesalahan: ' + error.message, 'error');
        setLoading(false);
        state.isUploading = false;
    }
}

// Utility Functions
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function setLoading(loading) {
    elements.submitBtn.disabled = loading;
    elements.submitBtn.querySelector('.btn-text').hidden = loading;
    elements.submitBtn.querySelector('.btn-loader').hidden = !loading;
    elements.statusContainer.hidden = !loading;
}

function updateProgress(percent, text) {
    elements.progressFill.style.width = percent + '%';
    elements.statusText.textContent = text;
}

function showSuccess() {
    elements.form.hidden = true;
    elements.statusContainer.hidden = true;
    elements.successMessage.hidden = false;
    loadStats(); // Refresh stats
}

function resetForm() {
    state.selectedFile = null;
    state.selectedCategory = null;
    state.isUploading = false;
    
    elements.form.reset();
    resetImage();
    
    elements.form.hidden = false;
    elements.successMessage.hidden = true;
    elements.statusContainer.hidden = true;
    elements.progressFill.style.width = '0%';
    
    // Reset category selection visual
    document.querySelectorAll('.category-card input').forEach(input => {
        input.checked = false;
    });
    
    validateForm();
}

// Notification System
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Styles
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Load Statistics (from Google Sheets)
async function loadStats() {
    try {
        const response = await fetch(`${CONFIG.GAS_URL}?action=getStats`);
        const data = await response.json();
        
        if (data.success) {
            animateNumber('totalImages', data.totalImages || 0);
            animateNumber('totalContributors', data.totalContributors || 0);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

function animateNumber(elementId, target) {
    const element = document.getElementById(elementId);
    const duration = 1000;
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString('id-ID');
    }, 16);
}

// Add CSS animations dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
