'use strict';

const API_ENDPOINT = '/api/submit-quote';
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');
const modal = document.getElementById('booking-modal');
const modalService = document.getElementById('modal-service');
const backToTop = document.getElementById('back-to-top');
let lastFocusedElement = null;

function trackEvent(eventName, eventData = {}) {
  window.dataLayer?.push({ event: eventName, ...eventData });
  window.dispatchEvent(new CustomEvent(`handyman:${eventName}`, { detail: eventData }));
  if (typeof gtag !== 'undefined') gtag('event', eventName, eventData);
  if (typeof fbq !== 'undefined') fbq('trackCustom', eventName, eventData);
}

function trackConversion(conversionType, conversionData = {}) {
  const cfg = window.SITE_TRACKING || {};
  const sendTo = cfg.googleAdsConversion;
  const isPlaceholder = !sendTo || /X{3,}|CONVERSION_LABEL/i.test(sendTo);
  const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (typeof gtag !== 'undefined' && !isPlaceholder) {
    gtag('event', 'conversion', {
      send_to: sendTo,
      value: 1.0,
      currency: 'USD',
      transaction_id: txnId,
    });
  }
  if (typeof gtag !== 'undefined' && cfg.ga4Id && !/X{3,}/.test(cfg.ga4Id)) {
    gtag('event', 'generate_lead', {
      event_category: conversionType,
      service: conversionData.service || 'general',
    });
  }
  if (typeof fbq !== 'undefined') {
    fbq('track', 'Lead', {
      content_name: conversionType,
      content_category: conversionData.service || 'general',
    });
  }
  trackEvent('conversion', { conversion_type: conversionType, ...conversionData });
}

function setMenu(open) {
  navMenu.classList.toggle('active', open);
  hamburger.classList.toggle('active', open);
  hamburger.setAttribute('aria-expanded', String(open));
  hamburger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
}

hamburger.addEventListener('click', () => setMenu(!navMenu.classList.contains('active')));
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('click', event => {
  if (!navMenu.contains(event.target) && !hamburger.contains(event.target)) setMenu(false);
});

function openBookingModal(service = '') {
  lastFocusedElement = document.activeElement;
  if (service && modalService) modalService.value = service;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  modal.querySelector('input, select, textarea, button')?.focus();
  trackEvent('estimate_modal_open', { service: service || 'not_selected' });
}

function closeBookingModal() {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  lastFocusedElement?.focus();
}

document.querySelectorAll('[data-open-modal]').forEach(button => button.addEventListener('click', () => openBookingModal()));
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeBookingModal));
document.querySelectorAll('[data-service]').forEach(button => button.addEventListener('click', () => openBookingModal(button.dataset.service)));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal.classList.contains('active')) closeBookingModal();
  if (event.key === 'Tab' && modal.classList.contains('active')) {
    const focusable = [...modal.querySelectorAll('button, input, select, textarea, a[href]')].filter(element => !element.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

function normalizePhone(input) {
  let digits = input.value.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) input.value = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  else if (digits.length > 3) input.value = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  else if (digits.length) input.value = `(${digits}`;
}

document.querySelectorAll('input[type="tel"]').forEach(input => input.addEventListener('input', () => normalizePhone(input)));
document.querySelectorAll('input[name="zip"]').forEach(input => input.addEventListener('input', () => {
  input.value = input.value.replace(/[^\d-]/g, '').slice(0, 10);
}));

function setFormStatus(form, message, type) {
  const status = form.querySelector('.form-status');
  if (!status) return;
  status.textContent = message;
  status.className = `form-status visible ${type}`;
}

function clearFieldErrors(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
}

function validateForm(form) {
  clearFieldErrors(form);
  const requiredFields = [...form.querySelectorAll('[required]')];
  let firstInvalid = null;
  for (const field of requiredFields) {
    if (!field.checkValidity()) {
      field.setAttribute('aria-invalid', 'true');
      firstInvalid ||= field;
    }
  }
  const phone = form.querySelector('[name="phone"]');
  if (phone && phone.value.replace(/\D/g, '').length < 10) {
    phone.setAttribute('aria-invalid', 'true');
    firstInvalid ||= phone;
  }
  if (firstInvalid) {
    firstInvalid.focus();
    setFormStatus(form, 'Please complete the highlighted fields before sending.', 'error');
    return false;
  }
  return true;
}

async function submitToAPI(data) {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'We could not send your request. Please try again.');
  }
  if (payload.success !== true) throw new Error('The request was not confirmed. Please try again.');
  return payload;
}

async function handleFormSubmission(form, formType) {
  if (!validateForm(form)) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.innerHTML;
  const data = Object.fromEntries(new FormData(form).entries());
  data.form_type = formType;

  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Sending…';
  setFormStatus(form, 'Sending your request securely…', '');
  trackEvent('form_submit_attempt', { form_type: formType, service: data.service });

  try {
    const result = await submitToAPI({ ...data, form_type: formType });
    form.reset();
    clearFieldErrors(form);
    setFormStatus(form, result.message || 'Your request was sent. We’ll review the details and follow up.', 'success');
    trackEvent('lead_submitted', { form_type: formType, service: data.service });
    trackConversion(formType, data);
    window.setTimeout(() => window.location.assign('/thank-you.html'), 500);
    return;
  } catch (error) {
    setFormStatus(form, error.message, 'error');
    trackEvent('form_submit_error', { form_type: formType, service: data.service });
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
  }
}

[
  ['hero-form', 'hero_form'],
  ['contact-form', 'contact_form'],
  ['modal-form', 'modal_form'],
].forEach(([id, formType]) => {
  const form = document.getElementById(id);
  form?.addEventListener('submit', event => {
    event.preventDefault();
    handleFormSubmission(form, formType);
  });
});

document.querySelectorAll('a[href^="tel:"]').forEach(link => {
  link.addEventListener('click', () => {
    trackEvent('phone_click', { phone_number: link.getAttribute('href')?.replace('tel:', '') || '' });
    trackConversion('phone_click', { service: 'call' });
  });
});

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  backToTop.classList.toggle('visible', window.scrollY > 700);
}, { passive: true });

backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.getElementById('current-year').textContent = new Date().getFullYear();

window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
