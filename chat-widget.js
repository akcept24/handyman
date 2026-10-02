(() => {
  'use strict';

  const root = document.createElement('div');
  root.id = 'ch-widget-root';
  root.innerHTML = `
    <button class="ch-launcher" type="button" aria-label="Open project assistant" aria-expanded="false" aria-controls="ch-panel">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>
    </button>
    <section class="ch-panel" id="ch-panel" role="dialog" aria-modal="true" aria-labelledby="ch-title" aria-describedby="ch-privacy-note" aria-hidden="true">
      <header class="ch-head">
        <div class="ch-avatar" aria-hidden="true">🔧</div>
        <div class="ch-head-copy"><strong id="ch-title">Ask Alex</strong><span>California Handymen project assistant</span></div>
        <button class="ch-close" type="button" aria-label="Close chat">×</button>
      </header>
      <div class="ch-messages" role="log" aria-live="polite" aria-relevant="additions">
        <div class="ch-message ch-message-bot">Hi! I’m Alex. I can answer questions about minor handyman services and the Santa Clarita Valley service area. What do you need help with?</div>
      </div>
      <div class="ch-quick-row" aria-label="Suggested questions">
        <button class="ch-quick" type="button" data-message="What areas do you serve?">📍 Service area</button>
        <button class="ch-quick" type="button" data-message="What handyman services do you offer?">🔧 Services</button>
        <button class="ch-quick" type="button" data-book="true">📝 Request estimate</button>
      </div>
      <p class="ch-privacy" id="ch-privacy-note">AI-assisted intent classification is processed by OpenRouter. Each question is handled independently. Do not enter contact, payment, password, or other sensitive information here. Use the secure request form for contact details. <a href="privacy.html">Privacy</a></p>
      <form class="ch-composer">
        <label class="ch-sr-only" for="ch-message-input">Chat message</label>
        <input id="ch-message-input" name="message" type="text" maxlength="1200" autocomplete="off" aria-describedby="ch-privacy-note" placeholder="Ask about your project…">
        <button class="ch-send" type="submit" aria-label="Send message">➤</button>
      </form>
      <form class="ch-form" novalidate>
        <div class="ch-form-title">Request a project review</div>
        <div class="ch-form-sub">Submitting starts a review. It does not confirm an appointment.</div>
        <label class="ch-field-label" for="ch-name">Name *</label>
        <input id="ch-name" name="name" type="text" maxlength="100" autocomplete="name" required>
        <label class="ch-field-label" for="ch-phone">Phone *</label>
        <input id="ch-phone" name="phone" type="tel" maxlength="30" autocomplete="tel" inputmode="tel" required>
        <label class="ch-field-label" for="ch-zip">SCV ZIP code *</label>
        <input id="ch-zip" name="zip" type="text" maxlength="10" autocomplete="postal-code" inputmode="numeric" required>
        <label class="ch-field-label" for="ch-service">Service *</label>
        <select id="ch-service" name="service" required>
          <option value="">Choose a service *</option>
          <option value="general-repairs">General repairs</option>
          <option value="fixtures-installations">Fixtures & installations</option>
          <option value="painting-drywall">Painting & drywall</option>
          <option value="furniture-assembly">Furniture assembly</option>
          <option value="carpentry">Carpentry</option>
          <option value="plumbing-maintenance">Plumbing maintenance</option>
          <option value="other">Other project</option>
        </select>
        <div class="ch-hp" aria-hidden="true"><label>Fax number<input name="fax_number" type="text" tabindex="-1" autocomplete="off"></label></div>
        <label class="ch-consent"><input name="contact_consent" type="checkbox" required><span>I am 18 or older and agree to the <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>. I consent to contact about this request.</span></label>
        <div class="ch-form-error" role="alert"></div>
        <button class="ch-book" type="submit">Send estimate request</button>
      </form>
    </section>`;
  document.body.appendChild(root);

  const launcher = root.querySelector('.ch-launcher');
  const panel = root.querySelector('.ch-panel');
  const closeButton = root.querySelector('.ch-close');
  const messagesNode = root.querySelector('.ch-messages');
  const composer = root.querySelector('.ch-composer');
  const messageInput = composer.elements.message;
  const sendButton = root.querySelector('.ch-send');
  const bookingForm = root.querySelector('.ch-form');
  const bookingError = root.querySelector('.ch-form-error');
  const history = [];
  let busy = false;
  let lastFocused = null;

  function setOpen(open) {
    if (open) lastFocused = document.activeElement;
    panel.classList.toggle('ch-open', open);
    panel.setAttribute('aria-hidden', String(!open));
    launcher.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('ch-dialog-open', open);
    if (open) window.setTimeout(() => closeButton.focus(), 100);
    else (lastFocused instanceof window.HTMLElement ? lastFocused : launcher).focus();
  }

  function addMessage(text, type = 'bot') {
    const node = document.createElement('div');
    node.className = `ch-message ch-message-${type}`;
    node.textContent = String(text);
    messagesNode.appendChild(node);
    messagesNode.scrollTop = messagesNode.scrollHeight;
    return node;
  }

  function showBooking() {
    bookingForm.classList.add('ch-visible');
    root.querySelector('.ch-quick-row').hidden = true;
    root.querySelector('.ch-composer').hidden = true;
    bookingForm.elements.name.focus();
  }

  function showTyping() {
    const node = document.createElement('div');
    node.className = 'ch-typing';
    node.setAttribute('aria-label', 'Alex is typing');
    node.innerHTML = '<i></i><i></i><i></i>';
    messagesNode.appendChild(node);
    messagesNode.scrollTop = messagesNode.scrollHeight;
    return node;
  }

  async function sendChat(text) {
    if (busy || !text.trim()) return;
    busy = true;
    sendButton.disabled = true;
    const cleanText = text.trim().slice(0, 1200);
    addMessage(cleanText, 'user');
    history.push({ role: 'user', content: cleanText });
    const typing = showTyping();
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: cleanText }] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.reply) throw new Error(payload.message || 'Chat request failed');
      const reply = String(payload.reply).slice(0, 1600);
      addMessage(reply, 'bot');
      if (/estimate|request form|name.*phone|project review/i.test(reply)) showBooking();
    } catch (error) {
      addMessage(error.message || 'Chat is temporarily unavailable. Please use the estimate form.', 'status');
    } finally {
      typing.remove();
      busy = false;
      sendButton.disabled = false;
      messageInput.focus();
    }
  }

  launcher.addEventListener('click', () => setOpen(true));
  closeButton.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.classList.contains('ch-open')) setOpen(false);
    if (event.key === 'Tab' && panel.classList.contains('ch-open')) {
      const focusable = [...panel.querySelectorAll('a[href], button, input, select, textarea')]
        .filter(element => !element.disabled && !element.closest('[hidden]') && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  root.querySelectorAll('.ch-quick').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.book) showBooking();
      else sendChat(button.dataset.message || '');
    });
  });

  composer.addEventListener('submit', event => {
    event.preventDefault();
    const text = messageInput.value;
    messageInput.value = '';
    sendChat(text);
  });

  bookingForm.addEventListener('submit', async event => {
    event.preventDefault();
    bookingError.textContent = '';
    if (!bookingForm.reportValidity()) return;
    const submit = bookingForm.querySelector('.ch-book');
    submit.disabled = true;
    submit.textContent = 'Sending…';
    const form = new FormData(bookingForm);
    const payload = {
      name: form.get('name'),
      phone: form.get('phone'),
      email: '',
      zip: form.get('zip'),
      service: form.get('service'),
      message: history.filter(item => item.role === 'user').map(item => item.content).join(' | ').slice(0, 2000) || 'Submitted through website chat.',
      form_type: 'chat_form',
      urgent: false,
      contact_consent: form.get('contact_consent') === 'on',
      consent_version: '2026-08-20',
      fax_number: form.get('fax_number') || '',
    };
    try {
      const response = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true || result.delivered !== true) throw new Error(result.message || 'Could not send the request.');
      bookingForm.reset();
      bookingForm.classList.remove('ch-visible');
      root.querySelector('.ch-composer').hidden = false;
      addMessage('Thanks — your request was delivered for review. This does not confirm an appointment; the team will contact you about the next step.', 'bot');
    } catch (error) {
      bookingError.textContent = error.message || 'Could not send the request. Please try again.';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Send estimate request';
    }
  });
})();
