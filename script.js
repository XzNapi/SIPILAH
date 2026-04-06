// ==========================================
// SIPILAH - Frontend Script (Fixed)
// ==========================================

// Configuration - GANTI DENGAN URL WEB APP ANDA
const CONFIG = {
    GAS_URL: 'https://script.google.com/macros/s/AKfycbwm6VAlXYzDfTQExNEzImvgIpQ02gFoDJHbT7JsDLrdLggbKQQg-zB3MNiKrZaFv-Mlug/exec', // GANTI INI!
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

// ==========================================
// Initialize
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if GAS_URL is set
    if (CONFIG.GAS_URL.includes('XXXXXXXX')) {
        showNotification('⚠️ Konfigurasi belum lengkap! Silakan update GAS_URL di script.js', 'warning');
        console.error('ERROR: Please update CONFIG.GAS_URL with your Google Apps Script Web App URL');
    }
    
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
        const input = card.querySelector('input');
        input.addEventListener('change', () => {
            state.selectedCategory = input.value;
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

// ==========================================
// Drag & Drop Handlers
// ==========================================

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

// ==========================================
// File Processing
// ==========================================

function processFile(file) {
    // Validation
    if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
        showNotification('❌ Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.', 'error');
        return;
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showNotification('❌ Ukuran file terlalu besar. Maksimal 5MB.', 'error');
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
    reader.onerror = () => {
        showNotification('❌ Gagal membaca file', 'error');
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

// ==========================================
// Form Validation
// ==========================================

function validateForm() {
    const isValid = state.selectedFile && 
                    state.selectedCategory && 
                    elements.itemName.value.trim().length > 0;
    
    elements.submitBtn.disabled = !isValid;
}

// ==========================================
// Submit Handler (FIXED)
// ==========================================

async function handleSubmit(e) {
    e.preventDefault();
    
    if (state.isUploading) return;
    
    // Validate GAS_URL
    if (CONFIG.GAS_URL.includes('XXXXXXXX') || !CONFIG.GAS_URL.includes('google.com')) {
        showNotification('⚠️ URL Google Apps Script belum dikonfigurasi dengan benar!', 'error');
        return;
    }
    
    state.isUploading = true;
    setLoading(true);
    updateProgress(10, 'Mempersiapkan data...');

    try {
        // Convert image to base64
        updateProgress(20, 'Memproses gambar...');
        const base64Image = await fileToBase64(state.selectedFile);
        
        // Prepare payload
        const payload = {
            action: 'upload',
            itemName: elements.itemName.value.trim(),
            category: state.selectedCategory,
            imageData: base64Image,
            imageType: state.selectedFile.type,
            imageName: state.selectedFile.name,
            timestamp: new Date().toISOString()
        };

        updateProgress(40, 'Mengunggah ke server...');

        // Method 1: Using fetch with no-cors mode as fallback
        let response;
        try {
            response = await fetch(CONFIG.GAS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
        } catch (fetchError) {
            console.log('Fetch failed, trying alternative method...');
            // If fetch fails, try with form data approach
            response = await fetchWithFormData(payload);
        }

        updateProgress(80, 'Memproses respons...');

        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            // If response is not JSON, check if it's actually successful
            const text = await response.text();
            try {
                result = JSON.parse(text);
            } catch {
                throw new Error('Respons server tidak valid: ' + text.substring(0, 100));
            }
        }

        if (result.success) {
            updateProgress(100, 'Selesai!');
            setTimeout(() => showSuccess(result.data), 500);
        } else {
            throw new Error(result.message || 'Upload gagal dari server');
        }

    } catch (error) {
        console.error('Upload error:', error);
        showNotification('❌ ' + error.message, 'error');
        setLoading(false);
        state.isUploading = false;
    }
}

// Alternative fetch method using URL-encoded form data
async function fetchWithFormData(payload) {
    const formData = new URLSearchParams();
    formData.append('data', JSON.stringify(payload));
    
    return await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    });
}

// ==========================================
// Utility Functions
// ==========================================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
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

function showSuccess(data) {
    elements.form.hidden = true;
    elements.statusContainer.hidden = true;
    
    // Add details to success message
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'success-details';
    detailsDiv.innerHTML = `
        <p><strong>File:</strong> ${data?.fileName || 'Berhasil disimpan'}</p>
        <p><strong>Kategori:</strong> ${data?.category || state.selectedCategory}</p>
    `;
    detailsDiv.style.cssText = 'margin: 1rem 0; padding: 1rem; background: #f0fdf4; border-radius: 8px; color: #166534;';
    
    const existingDetails = elements.successMessage.querySelector('.success-details');
    if (existingDetails) existingDetails.remove();
    
    elements.successMessage.insertBefore(detailsDiv, elements.successMessage.querySelector('button'));
    
    elements.successMessage.hidden = false;
    loadStats();
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
    
    // Remove success details
    const details = elements.successMessage.querySelector('.success-details');
    if (details) details.remove();
    
    // Reset category selection visual
    document.querySelectorAll('.category-card input').forEach(input => {
        input.checked = false;
    });
    
    validateForm();
}

// ==========================================
// Notification System
// ==========================================

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.sipilah-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `sipilah-notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${getIconForType(type)}"></i>
        <span>${message}</span>
        <button class="close-btn">&times;</button>
    `;
    
    const colors = {
        error: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        font-weight: 500;
    `;
    
    const closeBtn = notification.querySelector('.close-btn');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        margin-left: 0.5rem;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    closeBtn.onclick = () => notification.remove();
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function getIconForType(type) {
    const icons = {
        error: 'fa-exclamation-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

// ==========================================
// Statistics
// ==========================================

async function loadStats() {
    try {
        // Add cache-busting parameter
        const url = `${CONFIG.GAS_URL}?action=getStats&_=${Date.now()}`;
        const response = await fetch(url);
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
    if (!element) return;
    
    const duration = 1000;
    const start = parseInt(element.textContent.replace(/\D/g, '')) || 0;
    const increment = (target - start) / (duration / 16);
    let current = start;
    
    if (start === target) return;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString('id-ID');
    }, 16);
}

// ==========================================
// CSS Animations
// ==========================================

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
