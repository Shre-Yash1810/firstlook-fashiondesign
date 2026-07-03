/**
 * First Look Fashion Designer - Public JavaScript Controller
 * Handles animations, dynamic loading, and interactive image lightbox
 */

import { 
  db, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  doc,
  getDoc
} from "./firebase.js";

// Global cache for lightbox items
const galleryCache = {
  blouses: [],
  dresses: [],
  gonde: []
};

let currentCategory = '';
let currentImageIndex = 0;

// Elements
const preloader = document.getElementById('preloader');
const header = document.getElementById('header');
const hamburgerBtn = document.getElementById('hamburger-btn');
const navMenu = document.getElementById('nav-menu');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
const lightboxPrevBtn = document.getElementById('lightbox-prev-btn');
const lightboxNextBtn = document.getElementById('lightbox-next-btn');

/* ==========================================================================
   1. Preloader and Global Event Listeners
   ========================================================================== */
window.addEventListener('load', () => {
  // Hide preloader with a slight delay for premium feel
  setTimeout(() => {
    preloader.classList.add('fade-out');
    document.body.classList.add('loaded'); // Add loaded class to body for entrance animations
    // Initialize reveal animations for elements visible in the initial viewport
    initScrollAnimations();
  }, 1000);
});

// Navigation Menu Toggle (Hamburger)
hamburgerBtn.addEventListener('click', () => {
  hamburgerBtn.classList.toggle('active');
  navMenu.classList.toggle('active');
});

// Close mobile menu when a nav link is clicked
document.querySelectorAll('.nav-item a').forEach(link => {
  link.addEventListener('click', () => {
    hamburgerBtn.classList.remove('active');
    navMenu.classList.remove('active');
  });
});

// Sticky Header Styling on Scroll
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// Smooth Scroll Offset for Anchor Links and category intercepts
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;
    
    // Check if the target is one of our categories
    const categories = ['blouses', 'dresses', 'gonde'];
    const possibleCategory = targetId.substring(1);
    
    if (categories.includes(possibleCategory)) {
      // Switch active tab on homepage
      switchTab(possibleCategory);
      
      // Scroll to the collections section instead
      const collectionsSection = document.getElementById('collections');
      if (collectionsSection) {
        const headerOffset = 80;
        const elementPosition = collectionsSection.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    } else {
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  });
});

/* ==========================================================================
   2. Scroll Reveal Animations (Intersection Observer)
   ========================================================================== */
function initScrollAnimations() {
  const reveals = document.querySelectorAll('.reveal');
  
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15 // Triggers when 15% of the element is visible
  };
  
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // Trigger only once
      }
    });
  }, observerOptions);
  
  reveals.forEach(reveal => {
    observer.observe(reveal);
  });
}

/* ==========================================================================
   3. Firebase Dynamic Loaders and Tab Management
   ========================================================================== */
// Switch Active Gallery Tab
async function switchTab(tabName) {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  
  // Set tab buttons active
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Transition out
  grid.classList.remove('active');
  
  setTimeout(async () => {
    await fetchCategoryItems(tabName, 'gallery-grid');
    grid.classList.add('active');
    // Re-trigger scroll observer for new items
    initScrollAnimations();
  }, 200);
}

// Bind Tab Click events
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const tabName = e.currentTarget.dataset.tab;
    switchTab(tabName);
  });
});

/**
 * Fetch list items for grid categories (blouses, dresses, gonde)
 */
async function fetchCategoryItems(category, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const q = query(collection(db, category), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    container.innerHTML = '';
    galleryCache[category] = [];
    
    if (querySnapshot.empty) {
      container.innerHTML = `<div class="gallery-empty">Our collection is being curated. Check back soon!</div>`;
      return;
    }
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      galleryCache[category].push(data.imageURL);
      
      const itemElement = document.createElement('div');
      itemElement.className = 'gallery-item reveal';
      itemElement.dataset.url = data.imageURL;
      itemElement.dataset.category = category;
      
      itemElement.innerHTML = `
        <div class="gallery-img-wrapper">
          <img src="${data.imageURL}" alt="${category.slice(0, -1)} design by First Look" class="gallery-img" loading="lazy">
          <div class="gallery-overlay">
            <div class="gallery-overlay-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>
      `;
      
      // Bind Lightbox Event
      itemElement.addEventListener('click', () => {
        openLightbox(category, data.imageURL);
      });
      
      container.appendChild(itemElement);
    });
  } catch (error) {
    console.error(`Error loading category: ${category}`, error);
    container.innerHTML = `<div class="gallery-empty" style="color:var(--danger-color)">Unable to retrieve collection at this time.</div>`;
  }
}

/**
 * Fetch single cover image for Fall Pico
 */
async function fetchFallPicoCover() {
  const fallPicoImg = document.getElementById('fallpico-img');
  if (!fallPicoImg) return;
  
  try {
    const q = query(collection(db, 'fallpico'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      fallPicoImg.src = docData.imageURL;
    }
  } catch (error) {
    console.error("Error loading Fall Pico cover image: ", error);
  }
}

/**
 * Load Boutique Contact Details from Firestore Settings Collection
 */
async function loadContactDetails() {
  try {
    const docRef = doc(db, 'settings', 'contact');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.ownerName) document.getElementById('contact-owner').textContent = data.ownerName;
      if (data.address) {
        document.getElementById('contact-address').textContent = data.address;
        const footerAddr = document.getElementById('footer-address');
        if (footerAddr) footerAddr.textContent = data.address;
      }
      
      if (data.phone) {
        document.getElementById('contact-phone').textContent = data.phone;
        document.getElementById('contact-phone-btn').href = `tel:${data.phone.replace(/\s+/g, '')}`;
        const footerPhone = document.getElementById('footer-phone');
        if (footerPhone) footerPhone.textContent = `Phone: ${data.phone}`;
      }
      
      if (data.whatsapp) {
        document.getElementById('contact-whatsapp').textContent = data.whatsapp;
        // Clean special characters for wa.me link API
        const cleanWhatsApp = data.whatsapp.replace(/[^0-9]/g, '');
        document.getElementById('contact-whatsapp-btn').href = `https://wa.me/${cleanWhatsApp}`;
        const footerWhatsApp = document.getElementById('footer-whatsapp');
        if (footerWhatsApp) footerWhatsApp.textContent = `WhatsApp: ${data.whatsapp}`;
      }
      
      if (data.hoursMonSat) document.getElementById('hours-monsat').textContent = data.hoursMonSat;
      if (data.hoursSun) document.getElementById('hours-sun').textContent = data.hoursSun;
    }
  } catch (err) {
    console.warn("Could not load dynamic contact details, using defaults: ", err);
  }
}

// Initialise Homepage Data on load
switchTab('blouses');
loadContactDetails();
fetchFallPicoCover();

/* ==========================================================================
   4. Lightbox Image Viewer Logic
   ========================================================================== */
function openLightbox(category, imageURL) {
  currentCategory = category;
  currentImageIndex = galleryCache[category].indexOf(imageURL);
  
  if (currentImageIndex === -1) return;
  
  updateLightboxImage();
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden'; // Lock scrolling
}

function updateLightboxImage() {
  const imageUrl = galleryCache[currentCategory][currentImageIndex];
  lightboxImg.style.opacity = '0';
  
  // Create transition effect
  setTimeout(() => {
    lightboxImg.src = imageUrl;
    lightboxImg.style.opacity = '1';
  }, 150);
}

function showNextImage() {
  if (galleryCache[currentCategory].length <= 1) return;
  currentImageIndex = (currentImageIndex + 1) % galleryCache[currentCategory].length;
  updateLightboxImage();
}

function showPrevImage() {
  if (galleryCache[currentCategory].length <= 1) return;
  currentImageIndex = (currentImageIndex - 1 + galleryCache[currentCategory].length) % galleryCache[currentCategory].length;
  updateLightboxImage();
}

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = ''; // Unlock scrolling
  setTimeout(() => {
    lightboxImg.src = '';
  }, 300);
}

// Lightbox Listeners
lightboxCloseBtn.addEventListener('click', closeLightbox);
lightboxNextBtn.addEventListener('click', showNextImage);
lightboxPrevBtn.addEventListener('click', showPrevImage);

// Close on outside click
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox || e.target === lightbox.querySelector('.lightbox-content')) {
    closeLightbox();
  }
});

// Keyboard Navigation
window.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  
  if (e.key === 'Escape') {
    closeLightbox();
  } else if (e.key === 'ArrowRight') {
    showNextImage();
  } else if (e.key === 'ArrowLeft') {
    showPrevImage();
  }
});

// Touch Swipe Gestures for Mobile devices
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

lightbox.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

lightbox.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipeGesture();
}, { passive: true });

function handleSwipeGesture() {
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  
  // Require swipe distance to be substantial, and horizontal
  if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 50) {
    if (deltaX < 0) {
      showNextImage(); // Swipe left to view next
    } else {
      showPrevImage(); // Swipe right to view prev
    }
  }
}
