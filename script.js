// ==========================================
// SIPILAH - Frontend Script
// Menggunakan FormData untuk menghindari CORS
// ==========================================

// ⚠️ GANTI DENGAN URL WEB APP ANDA!
const CONFIG = {
    GAS_URL: 'https://script.google.com/macros/s/AKfycbwm6VAlXYzDfTQExNEzImvgIpQ02gFoDJHbT7JsDLrdLggbKQQg-zB3MNiKrZaFv-Mlug/exec',
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
};

// State
const state = {
    selectedFile: null,
    selectedCategory: null,
    isUploading: false
};

// Elements
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
    if (CONFIG.GAS_URL.includes('........')) {
        showNotification('⚠️ Konfigurasi belum lengkap! Update GAS_URL di script.js', 'warning');
        console.error('ERROR: Update CONFIG.GAS_URL dengan URL deployment Anda');
    }
    
    initializeEventListeners();
    loadStats();
    
    // Test connection
    testConnection();
});

function initializeEventListeners() {
    elements.dropZone.addEventListener('click', () => elements.imageInput.click());
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    elements.imageInput.addEventListener('change', handleFileSelect);

    elements.removeImage.addEventListener('click', (e) => {
        e.stopPropagation();
        resetImage();
    });

    elements.categoryCards.forEach(card => {
        const input = card.querySelector('input');
        input.addEventListener('change', () => {
            state.selectedCategory = input.value;
            validateForm();
        });
    });

    elements.form.addEventListener('submit', handleSubmit);
    elements.uploadAnother.addEventListener('click', resetForm);
    elements.itemName.addEventListener('input', validateForm);
}

// ==========================================
// Drag & Drop
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
    if (files.length > 0) processFile(files[0]);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

// ==========================================
// File Processing
// ==========================================

function processFile(file) {
    if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
        showNotification('❌ Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.', 'error');
        return;
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showNotification('❌ Ukuran file terlalu besar. Maksimal 5MB.', 'error');
        return;
    }

    state.selectedFile = file;

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

function validateForm() {
    const isValid = state.selectedFile && 
                    state.selectedCategory && 
                    elements.itemName.value.trim().length > 0;
    elements.submitBtn.disabled = !isValid;
}

// ==========================================
// SUBMIT - METODE BARU MENGGUNAKAN FORMDATA
// ==========================================

async function handleSubmit(e) {
    e.preventDefault();
    if (state.isUploading) return;
    
    if (CONFIG.GAS_URL.includes('........')) {
        showNotification('⚠️ URL Google Apps Script belum dikonfigurasi!', 'error');
        return;
    }
    
    state.isUploading = true;
    setLoading(true);
    updateProgress(10, 'Membaca gambar...');

    try {
        // Convert image to base64
        const base64Image = await fileToBase64(state.selectedFile);
        updateProgress(30, 'Mempersiapkan data...');

        // METHOD 1: Menggunakan FormData (RECOMMENDED - Hindari CORS)
        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('itemName', elements.itemName.value.trim());
        formData.append('category', state.selectedCategory);
        formData.append('imageData', base64Image);
        formData.append('imageType', state.selectedFile.type);
        formData.append('imageName', state.selectedFile.name);
        formData.append('timestamp', new Date().toISOString());

        updateProgress(50, 'Mengunggah ke server...');

        const response = await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            // JANGAN set Content-Type header! Browser akan otomatis set dengan boundary
            body: formData
        });

        updateProgress(80, 'Memproses respons...');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            updateProgress(100, 'Selesai!');
            setTimeout(() => showSuccess(result.data), 500);
        } else {
            throw new Error(result.message || 'Upload gagal dari server');
        }

    } catch (error) {
        console.error('Upload error:', error);
        showNotification('❌ Error: ' + error.message, 'error');
        
        // Fallback: Coba method alternatif dengan URL encoded
        if (error.message.includes('Failed to fetch')) {
            showNotification('🔄 Mencoba method alternatif...', 'info');
            tryAlternativeSubmit();
        } else {
            setLoading(false);
            state.isUploading = false;
        }
    }
}

// Alternative method menggunakan URLSearchParams
async function tryAlternativeSubmit() {
    try {
        const base64Image = await fileToBase64(state.selectedFile);
        
        const params = new URLSearchParams();
        params.append('action', 'upload');
        params.append('itemName', elements.itemName.value.trim());
        params.append('category', state.selectedCategory);
        params.append('imageData', base64Image);
        params.append('imageType', state.selectedFile.type);
        params.append('imageName', state.selectedFile.name);

        const response = await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        const result = await response.json();
        
        if (result.success) {
            updateProgress(100, 'Selesai!');
            showSuccess(result.data);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showNotification('❌ Method alternatif juga gagal: ' + error.message, 'error');
        setLoading(false);
        state.isUploading = false;
    }
}

// ==========================================
// Utilities
// ==========================================

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

function showSuccess(data) {
    elements.form.hidden = true;
    elements.statusContainer.hidden = true;
    
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'success-details';
    detailsDiv.innerHTML = `
        <p><strong>✓ File:</strong> ${data?.fileName || 'Berhasil disimpan'}</p>
        <p><strong>✓ Kategori:</strong> ${data?.category || state.selectedCategory}</p>
    `;
    detailsDiv.style.cssText = 'margin: 1rem 0; padding: 1rem; background: #f0fdf4; border-radius: 8px; color: #166534; border-left: 4px solid #10b981;';
    
    const existing = elements.successMessage.querySelector('.success-details');
    if (existing) existing.remove();
    
    elements.successMessage.insertBefore(detailsDiv, elements.successMessage.querySelector('button'));
    elements.successMessage.hidden = false;
    
    loadStats();
    setLoading(false);
    state.isUploading = false;
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
    
    const details = elements.successMessage.querySelector('.success-details');
    if (details) details.remove();
    
    document.querySelectorAll('.category-card input').forEach(input => {
        input.checked = false;
    });
    
    validateForm();
}

// ==========================================
// Test Connection
// ==========================================

async function testConnection() {
    try {
        const response = await fetch(`${CONFIG.GAS_URL}?action=test&_=${Date.now()}`);
        const data = await response.json();
        if (data.success) {
            console.log('✓ API Connection OK:', data.message);
        }
    } catch (error) {
        console.error('✗ API Connection Failed:', error);
        showNotification('⚠️ Tidak dapat terhubung ke server. Periksa URL deployment.', 'warning');
    }
}

// ==========================================
// Stats & Notifications
// ==========================================

async function loadStats() {
    try {
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
    
    const start = parseInt(element.textContent.replace(/\D/g, '')) || 0;
    if (start === target) return;
    
    const duration = 1000;
    const increment = (target - start) / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString('id-ID');
    }, 16);
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.sipilah-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `sipilah-notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
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
        background: ${colors[type]};
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
    `;
    closeBtn.onclick = () => notification.remove();
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// CSS Animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(style);
