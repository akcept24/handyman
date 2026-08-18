/**
 * California Handyman Pro - Premium Landing Page
 * Interactive JavaScript Functionality
 */

// ==========================================
// Smooth Scroll & Navigation
// ==========================================

// Navbar scroll effect
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Mobile menu toggle
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');

hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
});

// Close mobile menu when clicking on links
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ==========================================
// Back to Top Button
// ==========================================

const backToTop = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
    if (window.pageYOffset > 500) {
        backToTop.classList.add('visible');
    } else {
        backToTop.classList.remove('visible');
    }
});

backToTop.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ==========================================
// Modal Functionality
// ==========================================

const modal = document.getElementById('booking-modal');
const modalService = document.getElementById('modal-service');

function openBookingModal(service = '') {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Pre-select service if provided
    if (service && modalService) {
        const serviceMap = {
            'Electrical Work': 'electrical',
            'Plumbing Services': 'plumbing',
            'Painting & Drywall': 'painting',
            'Furniture Assembly': 'furniture',
            'Carpentry': 'carpentry',
            'General Repairs': 'general'
        };
        
        const serviceValue = serviceMap[service] || '';
        if (serviceValue) {
            modalService.value = serviceValue;
        }
    }
    
    // Track modal open event
    trackEvent('modal_open', { service: service || 'none' });
}

function closeBookingModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeBookingModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeBookingModal();
    }
});

// ==========================================
// Form Handling
// ==========================================

// Hero form submission
const heroForm = document.getElementById('hero-form');
if (heroForm) {
    heroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFormSubmission(heroForm, 'hero_form');
    });
}

// Contact form submission
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFormSubmission(contactForm, 'contact_form');
    });
}

// Modal form submission
const modalForm = document.getElementById('modal-form');
if (modalForm) {
    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFormSubmission(modalForm, 'modal_form');
    });
}

/**
 * Handle form submission
 * @param {HTMLFormElement} form - The form element
 * @param {string} formType - Type of form for tracking
 */
async function handleFormSubmission(form, formType) {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    // Collect form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    try {
        // Track form submission attempt
        trackEvent('form_submit_attempt', {
            form_type: formType,
            service: data.service || 'not_selected'
        });
        
        // Simulate API call (replace with actual endpoint)
        await submitToAPI(data);
        
        // Success handling
        showNotification('Success! We\'ll contact you within 1 hour.', 'success');
        form.reset();
        
        // Track successful conversion
        trackConversion(formType, data);
        
        // Close modal if it's the modal form
        if (formType === 'modal_form') {
            setTimeout(() => {
                closeBookingModal();
            }, 2000);
        }
        
        // Show thank you message
        showThankYouMessage();
        
    } catch (error) {
        console.error('Form submission error:', error);
        showNotification('Oops! Something went wrong. Please call us instead.', 'error');
        
        // Track error
        trackEvent('form_submit_error', {
            form_type: formType,
            error: error.message
        });
    } finally {
        // Reset button
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

/**
 * Submit form data to API
 * @param {Object} data - Form data
 * @returns {Promise}
 */
async function submitToAPI(data) {
    // Replace with your actual API endpoint
    const API_ENDPOINT = '/api/submit-quote';
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Uncomment and configure for production:
    /*
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    
    return await response.json();
    */
    
    // For demo purposes, just resolve
    return Promise.resolve({ success: true });
}

/**
 * Show notification message
 * @param {string} message - Notification message
 * @param {string} type - Type of notification (success, error, info)
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 100px;
            right: 20px;
            background: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            z-index: 9999;
            animation: slideInRight 0.3s ease, fadeOut 0.3s ease 4.7s;
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .notification-success {
            border-left: 4px solid #28A745;
        }
        
        .notification-error {
            border-left: 4px solid #DC3545;
        }
        
        .notification-info {
            border-left: 4px solid #17A2B8;
        }
        
        .notification-success i {
            color: #28A745;
            font-size: 1.5rem;
        }
        
        .notification-error i {
            color: #DC3545;
            font-size: 1.5rem;
        }
        
        .notification-info i {
            color: #17A2B8;
            font-size: 1.5rem;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes fadeOut {
            to {
                opacity: 0;
                transform: translateX(400px);
            }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

/**
 * Show thank you message
 */
function showThankYouMessage() {
    const thankYouHTML = `
        <div class="thank-you-overlay" id="thank-you-overlay">
            <div class="thank-you-content">
                <div class="thank-you-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h2>Thank You!</h2>
                <p>Your request has been received. We'll contact you within 1 hour during business hours.</p>
                <p class="thank-you-note">Check your email for confirmation.</p>
                <button class="btn btn-primary" onclick="closeThankYou()">Close</button>
            </div>
        </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        .thank-you-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }
        
        .thank-you-content {
            background: white;
            padding: 3rem;
            border-radius: 16px;
            text-align: center;
            max-width: 500px;
            animation: scaleIn 0.3s ease;
        }
        
        .thank-you-icon {
            width: 100px;
            height: 100px;
            background: linear-gradient(135deg, #28A745, #20C997);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
        }
        
        .thank-you-icon i {
            font-size: 3rem;
            color: white;
        }
        
        .thank-you-content h2 {
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        
        .thank-you-content p {
            color: #666;
            margin-bottom: 1rem;
        }
        
        .thank-you-note {
            font-weight: 600;
            color: #FF6B35;
        }
        
        @keyframes scaleIn {
            from {
                transform: scale(0.8);
                opacity: 0;
            }
            to {
                transform: scale(1);
                opacity: 1;
            }
        }
    `;
    
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', thankYouHTML);
}

/**
 * Close thank you message
 */
function closeThankYou() {
    const overlay = document.getElementById('thank-you-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

// ==========================================
// Phone Number Formatting
// ==========================================

document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length > 0) {
            if (value.length <= 3) {
                value = `(${value}`;
            } else if (value.length <= 6) {
                value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
            } else {
                value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
            }
        }
        
        e.target.value = value;
    });
});

// ==========================================
// Analytics & Tracking
// ==========================================

/**
 * Track custom events
 * @param {string} eventName - Name of the event
 * @param {Object} eventData - Additional event data
 */
function trackEvent(eventName, eventData = {}) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, eventData);
    }
    
    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('trackCustom', eventName, eventData);
    }
    
    // Console log for development
    console.log('Event tracked:', eventName, eventData);
}

/**
 * Track conversions
 * @param {string} conversionType - Type of conversion
 * @param {Object} conversionData - Conversion data
 */
function trackConversion(conversionType, conversionData) {
    // Google Ads Conversion
    if (typeof gtag !== 'undefined') {
        gtag('event', 'conversion', {
            'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL',
            'value': 1.0,
            'currency': 'USD',
            'transaction_id': generateTransactionId()
        });
    }
    
    // Facebook Pixel Lead Event
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Lead', {
            content_name: conversionType,
            content_category: conversionData.service || 'general'
        });
    }
    
    // Console log for development
    console.log('Conversion tracked:', conversionType, conversionData);
}

/**
 * Generate unique transaction ID
 * @returns {string}
 */
function generateTransactionId() {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Track page view on load
window.addEventListener('load', () => {
    trackEvent('page_view', {
        page_title: document.title,
        page_location: window.location.href
    });
});

// Track outbound phone clicks
document.querySelectorAll('a[href^="tel:"]').forEach(link => {
    link.addEventListener('click', (e) => {
        trackEvent('phone_click', {
            phone_number: e.target.href.replace('tel:', '')
        });
    });
});

// Track scroll depth
let scrollDepths = [25, 50, 75, 100];
let trackedDepths = [];

window.addEventListener('scroll', () => {
    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    
    scrollDepths.forEach(depth => {
        if (scrollPercent >= depth && !trackedDepths.includes(depth)) {
            trackedDepths.push(depth);
            trackEvent('scroll_depth', { depth: depth });
        }
    });
});

// ==========================================
// Intersection Observer for Animations
// ==========================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe all service cards and other animated elements
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll(
        '.service-card, .why-card, .testimonial-card, .pricing-card, .step'
    );
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// ==========================================
// Dynamic Year in Footer
// ==========================================

const currentYear = new Date().getFullYear();
const footerYear = document.querySelector('.footer-bottom p');
if (footerYear) {
    footerYear.textContent = footerYear.textContent.replace('2026', currentYear);
}

// ==========================================
// Click to Call Tracking
// ==========================================

// Add click tracking to all phone links
document.querySelectorAll('a[href^="tel:"]').forEach(phoneLink => {
    phoneLink.addEventListener('click', function(e) {
        const phoneNumber = this.getAttribute('href').replace('tel:', '');
        trackEvent('call_initiated', {
            phone_number: phoneNumber,
            location: this.closest('section')?.id || 'unknown'
        });
    });
});

// ==========================================
// Service Request Tracking
// ==========================================

document.querySelectorAll('.btn-text').forEach(button => {
    button.addEventListener('click', function() {
        const service = this.closest('.service-card')?.querySelector('h3')?.textContent || 'Unknown';
        trackEvent('service_interest', {
            service_name: service
        });
    });
});

// ==========================================
// Email Link Tracking
// ==========================================

document.querySelectorAll('a[href^="mailto:"]').forEach(emailLink => {
    emailLink.addEventListener('click', function() {
        trackEvent('email_click', {
            email: this.getAttribute('href').replace('mailto:', '')
        });
    });
});

// ==========================================
// Lazy Loading Images (if needed)
// ==========================================

if ('loading' in HTMLImageElement.prototype) {
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
        img.src = img.dataset.src;
    });
} else {
    // Fallback for browsers that don't support lazy loading
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
    document.body.appendChild(script);
}

// ==========================================
// Initialize Everything on DOM Load
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('California Handyman Pro - Landing Page Loaded');
    
    // Add smooth reveal animations to sections
    const sections = document.querySelectorAll('section');
    sections.forEach((section, index) => {
        section.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Initialize testimonials slider (if implementing carousel)
    initTestimonialsSlider();
});

// ==========================================
// Testimonials Slider (Simple Version)
// ==========================================

function initTestimonialsSlider() {
    const slider = document.querySelector('.testimonials-slider');
    if (!slider) return;
    
    // Add navigation dots or arrows if needed
    // This is a placeholder for more advanced slider functionality
    
    // For touch devices
    let startX = 0;
    let scrollLeft = 0;
    
    slider.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    
    slider.addEventListener('touchmove', (e) => {
        const x = e.touches[0].pageX - slider.offsetLeft;
        const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
    });
}

// ==========================================
// Performance Optimization
// ==========================================

// Debounce function for scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Use debounce for scroll events
const debouncedScrollHandler = debounce(() => {
    // Your scroll handling code here
}, 100);

window.addEventListener('scroll', debouncedScrollHandler);

// ==========================================
// Service Worker Registration (Progressive Web App)
// ==========================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        /*
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
        */
    });
}

console.log('California Handyman Pro - All scripts initialized successfully!');
