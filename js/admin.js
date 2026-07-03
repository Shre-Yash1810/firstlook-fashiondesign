/**
 * First Look Fashion Designer - Admin Dashboard Controller
 * Handles Auth Guard, File Compression, Uploads, List Management, and Deletion
 */

import {
  db,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  getDoc,
  setDoc
} from "./firebase.js";

// Cloudinary Configuration settings
// TODO: Replace these with your actual Cloudinary details
const cloudinaryCloudName = "bbclcljg";
const cloudinaryUploadPreset = "firstlook_preset";

// Global uploader blobs cache
const selectedBlobs = {
  blouses: null,
  dresses: null,
  gonde: null,
  fallpico: null
};

// Global filenames cache
const selectedFilenames = {
  blouses: '',
  dresses: '',
  gonde: '',
  fallpico: ''
};

// Global Deletion Target Cache
let deletionTarget = {
  id: '',
  filename: '',
  category: ''
};

// Detect Active Page
const isLoginPage = document.getElementById('login-form') !== null;
const isAdminPage = document.getElementById('btn-logout') !== null;

// Modal Elements (declared safely at the top to prevent temporal dead zone ReferenceErrors)
const confirmModalOverlay = isAdminPage ? document.getElementById('confirm-modal-overlay') : null;
const btnConfirmCancel = isAdminPage ? document.getElementById('btn-confirm-cancel') : null;
const btnConfirmDelete = isAdminPage ? document.getElementById('btn-confirm-delete') : null;


/* ==========================================================================
   1. Auth Guard and Sign-In Flow (Local Secure Session Management)
   ========================================================================== */
// Helper function to calculate SHA-256 hash client-side
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 hash for password: "Lavanya@1234"
const ADMIN_PASSWORD_HASH = "2af2bbaaf6a01e2b378c0630ba1a73b43b01d68691bd4e4148053fe0dcbddbaf";
const ADMIN_EMAIL = "lavanyasagar90@gmail.com";

// Check Login State
if (isLoginPage) {
  if (localStorage.getItem('admin_logged_in') === 'true') {
    window.location.href = 'admin.html';
  }
}

if (isAdminPage) {
  if (localStorage.getItem('admin_logged_in') !== 'true') {
    window.location.href = 'login.html';
  } else {
    document.getElementById('admin-user-email').textContent = ADMIN_EMAIL;
    initializeDashboard();
  }
}

// Login Form Submit Event
if (isLoginPage) {
  const loginForm = document.getElementById('login-form');
  const errorAlert = document.getElementById('login-error-alert');
  const btnText = document.getElementById('login-btn-text');
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';
    btnText.textContent = 'Verifying...';
    btnText.disabled = true;
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    try {
      const enteredHash = await hashPassword(password);
      if (email.toLowerCase() === ADMIN_EMAIL && enteredHash === ADMIN_PASSWORD_HASH) {
        localStorage.setItem('admin_logged_in', 'true');
        window.location.href = 'admin.html';
      } else {
        throw new Error('invalid-credentials');
      }
    } catch (error) {
      btnText.textContent = 'Sign In';
      btnText.disabled = false;
      errorAlert.textContent = 'Incorrect administrator credentials.';
      errorAlert.style.display = 'block';
    }
  });
}

// Logout Action
if (isAdminPage) {
  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('admin_logged_in');
    window.location.href = 'login.html';
  });
}

/* ==========================================================================
   2. Tab Navigation & Dashboard Stats
   ========================================================================== */
function initializeDashboard() {
  if (!isAdminPage) return;
  
  setupTabMenu();
  refreshStats();
  setupUploaders();
  setupDeletionModal();
  setupContactEditor();
}

function setupTabMenu() {
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const panels = document.querySelectorAll('.manager-panel');
  const pageTitle = document.getElementById('page-title');
  
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetPanelId = item.dataset.target;
      
      // Update menu active highlights
      sidebarItems.forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      
      // Show appropriate content panel
      panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `${targetPanelId}-panel`) {
          panel.classList.add('active');
        }
      });
      
      // Update heading text
      if (targetPanelId === 'dashboard') {
        pageTitle.textContent = 'Dashboard Overview';
        refreshStats();
      } else if (targetPanelId === 'contact') {
        pageTitle.textContent = 'Manage Boutique Details';
        loadContactForm();
      } else {
        const titleMap = {
          blouses: 'Manage Blouses Collection',
          dresses: 'Manage Dresses Collection',
          gonde: 'Manage Gonde Collection',
          fallpico: 'Manage Fall Pico Cover'
        };
        pageTitle.textContent = titleMap[targetPanelId] || 'Management';
        loadItemsList(targetPanelId);
      }
    });
  });
}

async function refreshStats() {
  const categories = ['blouses', 'dresses', 'gonde'];
  
  // Refresh individual count metrics
  for (const cat of categories) {
    try {
      const q = query(collection(db, cat));
      const snapshot = await getDocs(q);
      document.getElementById(`count-${cat}`).textContent = snapshot.size;
    } catch (error) {
      console.error(`Error loading stat for ${cat}:`, error);
    }
  }
  
  // Check Fall Pico cover status
  try {
    const q = query(collection(db, 'fallpico'));
    const snapshot = await getDocs(q);
    const fallPicoStatusEl = document.getElementById('status-fallpico');
    if (snapshot.size > 0) {
      fallPicoStatusEl.textContent = 'Configured';
      fallPicoStatusEl.style.color = 'var(--accent-gold)';
    } else {
      fallPicoStatusEl.textContent = 'Empty';
      fallPicoStatusEl.style.color = 'var(--text-muted)';
    }
  } catch (error) {
    console.error("Error loading Fall Pico stat: ", error);
  }
}

/* ==========================================================================
   3. Drag-and-Drop + Image Compression Logic
   ========================================================================== */
function setupUploaders() {
  const categories = ['blouses', 'dresses', 'gonde', 'fallpico'];
  
  categories.forEach(cat => {
    const dropzone = document.getElementById(`dropzone-${cat}`);
    const fileInput = document.getElementById(`file-${cat}`);
    const btnUpload = document.getElementById(`btn-upload-${cat}`);
    
    if (!dropzone || !fileInput) return;
    
    // Drag Over highlights
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      }, false);
    });
    
    // Handle Dropped Files
    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length) {
        handleFileSelect(files[0], cat);
      }
    });
    
    // Handle Click Selection
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length) {
        handleFileSelect(files[0], cat);
      }
    });
    
    // Upload Button Handler
    btnUpload.addEventListener('click', () => {
      uploadSelectedFile(cat);
    });
  });
}

function handleFileSelect(file, category) {
  if (!file.type.startsWith('image/')) {
    showToast('Invalid file format. Please select an image file.', 'error');
    return;
  }
  
  const previewPlaceholder = document.querySelector(`#preview-box-${category} .preview-placeholder`);
  const previewImg = document.getElementById(`preview-img-${category}`);
  const btnUpload = document.getElementById(`btn-upload-${category}`);
  
  if (previewPlaceholder) previewPlaceholder.style.display = 'none';
  if (previewImg) {
    previewImg.src = URL.createObjectURL(file);
    previewImg.style.display = 'block';
  }
  
  // Trigger Client-side Resizing and Compression
  compressImage(file, category).then(compressedBlob => {
    selectedBlobs[category] = compressedBlob;
    // Keep reference of extension, rename safely later
    selectedFilenames[category] = file.name;
    
    // Show Upload Trigger
    btnUpload.classList.add('visible');
  }).catch(error => {
    console.error("Compression Error: ", error);
    showToast('Failed to compress image. Try another file.', 'error');
  });
}

/**
 * Canvas Client-Side Resizing and Compression
 * Resizes max boundaries to 1200px width/height and sets JPEG quality to 80%.
 */
function compressImage(file, category) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200; // Optimal width/height for luxury responsive galleries
        
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export to high-quality JPEG Blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas blob conversion failed"));
          }
        }, 'image/jpeg', 0.8);
      };
      
      img.onerror = (err) => reject(err);
    };
    
    reader.onerror = (err) => reject(err);
  });
}

/* ==========================================================================
   4. Firebase Storage & Firestore Deletion and Upload Handles
   ========================================================================== */
async function uploadSelectedFile(category) {
  const blob = selectedBlobs[category];
  const originalName = selectedFilenames[category];
  
  if (!blob) return;
  
  const progressContainer = document.getElementById(`progress-container-${category}`);
  const progressBar = document.getElementById(`progress-bar-${category}`);
  const progressText = document.getElementById(`progress-text-${category}`);
  const btnUpload = document.getElementById(`btn-upload-${category}`);
  
  btnUpload.disabled = true;
  progressContainer.style.display = 'flex';
  
  // 1. If Fall Pico cover upload, delete existing cover document in Firestore
  if (category === 'fallpico') {
    try {
      const q = query(collection(db, 'fallpico'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        for (const docSnapshot of snapshot.docs) {
          // Delete old doc from Firestore
          await deleteDoc(docSnapshot.ref);
        }
      }
    } catch (e) {
      console.warn("Error cleaning up old Fall Pico cover document: ", e);
    }
  }
  
  // 2. Prepare Cloudinary direct upload payload
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', cloudinaryUploadPreset);
  formData.append('folder', `firstlook/${category}`); // Organize photos in folders
  
  // 3. Initiate XMLHttpRequest for real-time progress updates
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, true);
  
  // Track upload progress
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const progress = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;
    }
  });
  
  xhr.onload = async () => {
    if (xhr.status === 200) {
      try {
        const response = JSON.parse(xhr.responseText);
        const downloadURL = response.secure_url;
        const publicId = response.public_id;
        
        // 4. Save metadata record to Firestore database
        await addDoc(collection(db, category), {
          imageURL: downloadURL,
          filename: publicId,
          createdAt: Date.now()
        });
        
        showToast('Design piece uploaded successfully!', 'success');
        resetUploader(category);
        loadItemsList(category);
      } catch (err) {
        console.error("Firestore update failed: ", err);
        showToast('Saving design details failed.', 'error');
        btnUpload.disabled = false;
        progressContainer.style.display = 'none';
      }
    } else {
      console.error("Cloudinary upload failed: ", xhr.responseText);
      showToast('Cloudinary upload failed. Check your config settings.', 'error');
      btnUpload.disabled = false;
      progressContainer.style.display = 'none';
    }
  };
  
  xhr.onerror = () => {
    console.error("XHR network error during upload");
    showToast('Network error during upload sequence.', 'error');
    btnUpload.disabled = false;
    progressContainer.style.display = 'none';
  };
  
  xhr.send(formData);
}

function resetUploader(category) {
  selectedBlobs[category] = null;
  selectedFilenames[category] = '';
  
  const previewPlaceholder = document.querySelector(`#preview-box-${category} .preview-placeholder`);
  const previewImg = document.getElementById(`preview-img-${category}`);
  const btnUpload = document.getElementById(`btn-upload-${category}`);
  const progressContainer = document.getElementById(`progress-container-${category}`);
  const fileInput = document.getElementById(`file-${category}`);
  
  if (previewPlaceholder) previewPlaceholder.style.display = 'block';
  if (previewImg) {
    previewImg.src = '';
    previewImg.style.display = 'none';
  }
  if (btnUpload) {
    btnUpload.classList.remove('visible');
    btnUpload.disabled = false;
  }
  if (progressContainer) {
    progressContainer.style.display = 'none';
  }
  if (fileInput) {
    fileInput.value = '';
  }
}

/* ==========================================================================
   5. Item Grids Rendering inside Admin
   ========================================================================== */
async function loadItemsList(category) {
  const container = document.getElementById(`list-${category}`);
  if (!container) return;
  
  container.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">Querying collection items...</div>';
  
  try {
    const q = query(collection(db, category), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    container.innerHTML = '';
    
    if (querySnapshot.empty) {
      container.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">This gallery collection is empty.</div>';
      return;
    }
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const dateStr = new Date(data.createdAt).toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      
      const card = document.createElement('div');
      card.className = 'admin-item-card';
      card.innerHTML = `
        <img src="${data.imageURL}" alt="Piece Preview" class="admin-item-img">
        <div class="admin-item-details">
          <span class="admin-item-date">${dateStr}</span>
          <button class="btn-delete-item" title="Delete Image">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `;
      
      // Bind Modal Confirmation deletion trigger
      card.querySelector('.btn-delete-item').addEventListener('click', () => {
        openDeletionConfirm(docSnap.id, data.filename, category);
      });
      
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Listing collection failed: ", error);
    container.innerHTML = '<div style="color:var(--danger-color)">Failed to fetch collection items.</div>';
  }
}

/* ==========================================================================
   6. Custom Modal Deletion Dialog Handles
   ========================================================================== */

function setupDeletionModal() {
  btnConfirmCancel.addEventListener('click', closeDeletionConfirm);
  
  btnConfirmDelete.addEventListener('click', async () => {
    const { id, category } = deletionTarget;
    if (!id || !category) return;
    
    btnConfirmDelete.textContent = 'Removing...';
    btnConfirmDelete.disabled = true;
    btnConfirmCancel.disabled = true;
    
    try {
      // Delete Firestore Document only (Cloudinary unsigned deletion is not supported client-side)
      await deleteDoc(doc(db, category, id));
      
      showToast('Item deleted successfully from boutique.', 'success');
      closeDeletionConfirm();
      loadItemsList(category);
    } catch (error) {
      console.error("Deletion sequence failed: ", error);
      showToast('Delete sequence encountered an error.', 'error');
      btnConfirmDelete.textContent = 'Confirm Delete';
      btnConfirmDelete.disabled = false;
      btnConfirmCancel.disabled = false;
    }
  });
}

function openDeletionConfirm(id, filename, category) {
  deletionTarget = { id, filename, category };
  confirmModalOverlay.classList.add('active');
}

function closeDeletionConfirm() {
  confirmModalOverlay.classList.remove('active');
  btnConfirmDelete.textContent = 'Confirm Delete';
  btnConfirmDelete.disabled = false;
  btnConfirmCancel.disabled = false;
  deletionTarget = { id: '', filename: '', category: '' };
}

/* ==========================================================================
   7. Toast Alert Manager
   ========================================================================== */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconMarkup = type === 'success' 
    ? `<svg xmlns="http://www.w3.org/2000/svg" class="toast-icon toast-icon-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
       </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" class="toast-icon toast-icon-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
       </svg>`;
       
  toast.innerHTML = `
    ${iconMarkup}
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Transition Enter
  setTimeout(() => {
    toast.classList.add('visible');
  }, 50);
  
  // Transition Dismiss
  setTimeout(() => {
    toast.classList.remove('visible');
    // Remove from DOM after transition finishes
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 4000);
}

/* ==========================================================================
   7. Boutique Info Contact Manager Logic
   ========================================================================== */
async function loadContactForm() {
  try {
    const docRef = doc(db, 'settings', 'contact');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.ownerName) document.getElementById('contact-input-owner').value = data.ownerName;
      if (data.address) document.getElementById('contact-input-address').value = data.address;
      if (data.phone) document.getElementById('contact-input-phone').value = data.phone;
      if (data.whatsapp) document.getElementById('contact-input-whatsapp').value = data.whatsapp;
      if (data.hoursMonSat) document.getElementById('contact-input-hours-monsat').value = data.hoursMonSat;
      if (data.hoursSun) document.getElementById('contact-input-hours-sun').value = data.hoursSun;
    }
  } catch (error) {
    console.error("Error fetching boutique contact details:", error);
    showToast("Could not load current contact details.", "error");
  }
}

function setupContactEditor() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnSave = document.getElementById('btn-save-contact');
    btnSave.textContent = 'Saving Details...';
    btnSave.disabled = true;
    
    const ownerName = document.getElementById('contact-input-owner').value.trim();
    const address = document.getElementById('contact-input-address').value.trim();
    const phone = document.getElementById('contact-input-phone').value.trim();
    const whatsapp = document.getElementById('contact-input-whatsapp').value.trim();
    const hoursMonSat = document.getElementById('contact-input-hours-monsat').value.trim();
    const hoursSun = document.getElementById('contact-input-hours-sun').value.trim();
    
    try {
      const docRef = doc(db, 'settings', 'contact');
      await setDoc(docRef, {
        ownerName,
        address,
        phone,
        whatsapp,
        hoursMonSat,
        hoursSun,
        updatedAt: new Date().toISOString()
      });
      
      showToast('Boutique details updated successfully!', 'success');
    } catch (error) {
      console.error("Saving contact details failed: ", error);
      showToast('Encountered an error saving details.', 'error');
    } finally {
      btnSave.textContent = 'Save Contact Details';
      btnSave.disabled = false;
    }
  });
}
