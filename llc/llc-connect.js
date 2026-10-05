/*!
 * Lasting Legacy Cleaners - Connect layer  v1.0.0
 * - Sitewide "Call 317-970-3904" top bar + floating/sticky call dock
 * - Funeral Home ZIP Locator (calls /api/llc-funeral-homes, a Vercel function)
 * - "Request a Call Back" form posted to Formspree (AJAX, no page reload)
 * - Takes over the existing Elementor "Memorial Service Request" form so it posts to
 *   Formspree instead of WordPress admin-ajax.php (which does not exist on Vercel)
 *
 * No dependencies (plain JavaScript). Load with:
 *   <link rel="stylesheet" href="/llc/llc-connect.css">
 *   <script src="/llc/llc-connect.js" defer></script>
 *
 * Optional overrides (place BEFORE the script tag):
 *   <script>window.LLC_CONFIG = { showTopbar: false };</script>
 */
(function () {
  'use strict';

  if (window.__llcConnectLoaded) return;
  window.__llcConnectLoaded = true;

  var CFG = {
    phoneDisplay: '317-970-3904',
    phoneTel: '+13179703904',
    formspree: 'https://formspree.io/f/mdeanrnv',
    api: '/api/llc-funeral-homes',
    termsUrl: '/terms-conditions/',
    privacyUrl: '/privacy-policy/',
    showTopbar: true,
    showDock: true,
    showBand: true
  };
  var user = window.LLC_CONFIG || {};
  for (var k in user) { if (Object.prototype.hasOwnProperty.call(user, k)) CFG[k] = user[k]; }

  var TEL = 'tel:' + CFG.phoneTel;

  // Same consent language already used on the site's Memorial Service Request form.
  var SMS_CONSENT = 'By checking this box, you consent to receive marketing text messages from Lasting Legacy Cleaners. Reply STOP to opt out. Reply HELP for help. Message and data rates may apply. Message frequency may vary.';

  /* ------------------------------------------------------------------ utils */
  var ICON = {
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>',
    route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.7 11.3l-9-9a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16zM8 8H5.1a8 8 0 0 1 4.3-3.6C8.8 5.5 8.3 6.7 8 8zm4 12c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function telHref(phone) {
    var d = String(phone || '').replace(/[^0-9+]/g, '');
    if (/^\d{10}$/.test(d)) d = '+1' + d;
    return 'tel:' + d;
  }
  function track(name, params) {
    params = params || {};
    try {
      if (window.dataLayer && typeof window.dataLayer.push === 'function') {
        var o = { event: name }; for (var p in params) o[p] = params[p];
        window.dataLayer.push(o);
      }
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
      if (typeof window.fbq === 'function' && name === 'llc_callback_submit') window.fbq('track', 'Lead');
    } catch (e) { /* analytics is optional */ }
  }
  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  var uid = 0;
  function nextId(p) { uid += 1; return 'llc-' + p + '-' + uid; }

  /* --------------------------------------------------------------- Formspree */
  var STRIP_FIELDS = [
    'activelayer_env_signals', 'activelayer_behavioral_signals', 'al_hp_email',
    'post_id', 'form_id', 'referer_title', 'queried_id'
  ];

  function postToFormspree(form) {
    // Honeypots: real visitors never fill these. Pretend success for bots.
    var hp1 = form.querySelector('[name="_gotcha"]');
    var hp2 = form.querySelector('[name="al_hp_email"]');
    if ((hp1 && hp1.value) || (hp2 && hp2.value)) {
      return Promise.resolve({ ok: true, data: { ok: true, bot: true } });
    }
    var fd = new FormData(form);
    STRIP_FIELDS.forEach(function (n) { fd.delete(n); });
    fd.set('page_url', window.location.href);
    fd.set('page_title', document.title);
    var action = form.getAttribute('action');
    var url = action && /formspree\.io/.test(action) ? action : CFG.formspree;
    return fetch(url, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      });
  }

  function formspreeErrorText(res, fallback) {
    if (res && res.data && Array.isArray(res.data.errors) && res.data.errors.length) {
      return res.data.errors.map(function (e) { return e.message; }).join(' ');
    }
    return fallback;
  }

  /* ---------------------------------------------- Existing Elementor form */
  // The "Memorial Service Request" form is marked data-llc-formspree in the HTML.
  // A capture-phase listener runs before Elementor's own handler (which would post
  // to wp-admin/admin-ajax.php and fail with 403 on Vercel) and stops it.
  function handleServiceRequest(form) {
    var btn = form.querySelector('button[type="submit"]');
    var status = form.querySelector('.llc-form-status');
    if (!status) {
      status = el('<div class="llc-form-status" role="status" aria-live="polite"></div>');
      var wrap = form.querySelector('.elementor-form-fields-wrapper') || form;
      wrap.parentNode.insertBefore(status, wrap.nextSibling);
    }
    var successMsg = form.getAttribute('data-llc-success') || 'Your submission was successful.';
    var errorMsg = form.getAttribute('data-llc-error') || 'Your submission failed because of an error.';

    status.className = 'llc-form-status';
    status.textContent = '';
    if (btn) {
      btn.disabled = true; btn.classList.add('is-loading');
      if (!btn.querySelector('.llc-spin')) {
        var inner = btn.querySelector('.elementor-button-content-wrapper') || btn;
        inner.appendChild(el('<span class="llc-spin" aria-hidden="true"></span>'));
      }
    }

    postToFormspree(form).then(function (res) {
      if (res.ok) {
        status.className = 'llc-form-status is-success';
        status.innerHTML = esc(successMsg) + ' Need help sooner? Call <a href="' + TEL + '"><strong>' + esc(CFG.phoneDisplay) + '</strong></a>.';
        form.reset();
        track('llc_service_request_submit', { form: 'memorial_service_request' });
      } else {
        status.className = 'llc-form-status is-error';
        status.innerHTML = esc(formspreeErrorText(res, errorMsg)) + ' You can also call us at <a href="' + TEL + '"><strong>' + esc(CFG.phoneDisplay) + '</strong></a>.';
      }
    }).catch(function () {
      status.className = 'llc-form-status is-error';
      status.innerHTML = esc(errorMsg) + ' Please call us at <a href="' + TEL + '"><strong>' + esc(CFG.phoneDisplay) + '</strong></a>.';
    }).then(function () {
      if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
    });
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches) return;
    if (form.matches('form[data-llc-formspree="service-request"]')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleServiceRequest(form);
    }
  }, true);

  /* -------------------------------------------------------- Call-back form */
  function callbackFormHTML(prefill) {
    prefill = prefill || {};
    var id = nextId('cb');
    var fh = prefill.funeralHome || '';
    var fhBox = fh
      ? '<div class="llc-cb__fh">' + ICON.pin + '<span>Regarding: <strong>' + esc(fh) + '</strong>' +
        (prefill.funeralHomeAddress ? '<br><small>' + esc(prefill.funeralHomeAddress) + '</small>' : '') + '</span></div>'
      : '';
    return '' +
      '<div class="llc-cb">' +
        '<h3 class="llc-cb__title">Request a Call Back</h3>' +
        '<p class="llc-cb__sub">Leave your details and a member of the Lasting Legacy team will call you, usually within 24 hours.</p>' +
        fhBox +
        '<form class="llc-cb__form" action="' + esc(CFG.formspree) + '" method="POST" novalidate>' +
          '<input type="hidden" name="_subject" value="Call Back Request - Lasting Legacy Website">' +
          '<input type="hidden" name="form_type" value="Call Back Request">' +
          '<input type="hidden" name="funeral_home_phone" value="' + esc(prefill.funeralHomePhone || '') + '">' +
          '<input type="hidden" name="funeral_home_address" value="' + esc(prefill.funeralHomeAddress || '') + '">' +
          '<input type="hidden" name="source" value="' + esc(prefill.source || 'website') + '">' +
          '<div class="llc-hp" aria-hidden="true"><label>Leave this field empty<input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></label></div>' +
          '<div class="llc-cb__grid">' +
            '<div><label class="llc-label" for="' + id + '-name">Full Name <em>*</em></label>' +
              '<input class="llc-input" id="' + id + '-name" name="name" type="text" autocomplete="name" required>' +
              '<span class="llc-field-err" data-for="name"></span></div>' +
            '<div><label class="llc-label" for="' + id + '-phone">Phone Number <em>*</em></label>' +
              '<input class="llc-input" id="' + id + '-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required>' +
              '<span class="llc-field-err" data-for="phone"></span></div>' +
            '<div><label class="llc-label" for="' + id + '-email">Email Address</label>' +
              '<input class="llc-input" id="' + id + '-email" name="email" type="email" autocomplete="email">' +
              '<span class="llc-field-err" data-for="email"></span></div>' +
            '<div><label class="llc-label" for="' + id + '-zip">ZIP Code</label>' +
              '<input class="llc-input" id="' + id + '-zip" name="zip" type="text" inputmode="numeric" maxlength="5" autocomplete="postal-code" value="' + esc(prefill.zip || '') + '"></div>' +
            '<div><label class="llc-label" for="' + id + '-time">Best Time to Call</label>' +
              '<select class="llc-input" id="' + id + '-time" name="best_time_to_call">' +
                '<option value="Anytime">Anytime</option><option value="Morning">Morning</option>' +
                '<option value="Afternoon">Afternoon</option><option value="Evening">Evening</option>' +
              '</select></div>' +
            '<div><label class="llc-label" for="' + id + '-fh">Funeral Home or Cemetery</label>' +
              '<input class="llc-input" id="' + id + '-fh" name="funeral_home" type="text" value="' + esc(fh) + '"></div>' +
            '<div class="llc-cb__full"><label class="llc-label" for="' + id + '-msg">Message</label>' +
              '<textarea class="llc-input" id="' + id + '-msg" name="message" rows="3" placeholder="How can we help? (optional)"></textarea></div>' +
            '<div class="llc-cb__full"><label class="llc-check"><input type="checkbox" name="sms_consent" value="Yes"> <span>' + esc(SMS_CONSENT) + '</span></label></div>' +
            '<div class="llc-cb__full"><label class="llc-check"><input type="checkbox" name="terms_agreed" value="Yes" required> <span>I agree to the <a href="' + esc(CFG.termsUrl) + '" target="_blank" rel="noopener">Terms and Conditions</a> and <a href="' + esc(CFG.privacyUrl) + '" target="_blank" rel="noopener">Privacy Policy</a>. <em style="color:#b3261e;font-style:normal">*</em></span></label>' +
              '<span class="llc-field-err" data-for="terms_agreed"></span></div>' +
          '</div>' +
          '<div class="llc-msg llc-msg--error" role="alert"></div>' +
          '<div class="llc-cb__submit"><button type="submit" class="llc-btn llc-btn--gold llc-btn--block">' + ICON.phone + '<span>Request My Call Back</span><span class="llc-spin" aria-hidden="true"></span></button></div>' +
          '<p class="llc-cb__alt">Prefer to call now? <a href="' + TEL + '" data-llc-track="call_us">' + esc(CFG.phoneDisplay) + '</a></p>' +
        '</form>' +
      '</div>';
  }

  function validateCallback(form) {
    var ok = true;
    function setErr(name, msg) {
      var input = form.querySelector('[name="' + name + '"]');
      var slot = form.querySelector('.llc-field-err[data-for="' + name + '"]');
      if (slot) slot.textContent = msg || '';
      if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg && ok) { ok = false; if (input) input.focus(); }
    }
    var name = form.elements.name.value.trim();
    var phone = form.elements.phone.value.replace(/\D/g, '');
    var email = form.elements.email.value.trim();
    setErr('name', name ? '' : 'This field is required.');
    setErr('phone', phone.length >= 10 ? '' : 'Please enter a 10-digit phone number.');
    setErr('email', !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Please enter a valid email address.');
    setErr('terms_agreed', form.elements.terms_agreed.checked ? '' : 'Please agree to the Terms and Conditions and Privacy Policy.');
    return ok;
  }

  function mountCallback(container, prefill, onDone) {
    container.innerHTML = callbackFormHTML(prefill);
    var form = container.querySelector('form');
    var btn = form.querySelector('button[type="submit"]');
    var msg = form.querySelector('.llc-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.textContent = '';
      if (!validateCallback(form)) return;
      btn.disabled = true; btn.classList.add('is-loading');
      postToFormspree(form).then(function (res) {
        if (res.ok) {
          track('llc_callback_submit', { funeral_home: form.elements.funeral_home.value || '', zip: form.elements.zip.value || '' });
          container.innerHTML =
            '<div class="llc-success" role="status">' +
              '<div class="llc-success__icon">' + ICON.check + '</div>' +
              '<h3>Thank You</h3>' +
              '<p>Your call back request was received. A member of the Lasting Legacy team will reach out to you soon.</p>' +
              '<a class="llc-btn llc-btn--navy" href="' + TEL + '" data-llc-track="call_us">' + ICON.phone + '<span>Need us now? Call ' + esc(CFG.phoneDisplay) + '</span></a>' +
            '</div>';
          var okBtn = container.querySelector('.llc-success .llc-btn');
          if (okBtn) { try { okBtn.focus({ preventScroll: true }); } catch (x) { okBtn.focus(); } }
          if (onDone) onDone();
        } else {
          msg.textContent = formspreeErrorText(res, 'Sorry, your request could not be sent. Please call us at ' + CFG.phoneDisplay + '.');
        }
      }).catch(function () {
        msg.textContent = 'Sorry, your request could not be sent. Please call us at ' + CFG.phoneDisplay + '.';
      }).then(function () {
        if (btn.isConnected) { btn.disabled = false; btn.classList.remove('is-loading'); }
      });
    });
  }

  /* ---------------------------------------------------------------- Locator */
  function locatorHTML(variant) {
    var id = nextId('zip');
    var head = variant === 'inline'
      ? '<p class="llc-locator__kicker">Funeral Home Locator</p>' +
        '<p class="llc-locator__sub">Enter your ZIP code to see funeral homes near you. Call them and ask about the Lasting Legacy Memorial Care Plan.</p>'
      : '<p class="llc-locator__kicker">Funeral Home Locator</p>' +
        '<h2 class="llc-locator__title">Find a Funeral Home Near You</h2>' +
        '<p class="llc-locator__sub">Enter your ZIP code to find nearby funeral homes. Call them and ask about the Lasting Legacy Memorial Care Plan, or call us directly and we will help.</p>';
    return '' +
      '<div class="llc-locator__panel">' + head +
        '<form class="llc-search" role="search" novalidate>' +
          '<div class="llc-search__field">' + ICON.pin +
            '<label class="llc-sr" for="' + id + '">ZIP code</label>' +
            '<input class="llc-search__input" id="' + id + '" name="zip" type="text" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" autocomplete="postal-code" placeholder="Enter ZIP code">' +
          '</div>' +
          '<button type="submit" class="llc-btn llc-btn--gold">' + ICON.search + '<span>Find Funeral Homes</span><span class="llc-spin" aria-hidden="true"></span></button>' +
        '</form>' +
        '<div class="llc-msg" role="status" aria-live="polite"></div>' +
        '<div class="llc-callstrip">' +
          '<p class="llc-callstrip__text"><strong>Rather talk to us?</strong> Call Lasting Legacy directly or request a call back.</p>' +
          '<div class="llc-callstrip__actions">' +
            '<a class="llc-bigphone" href="' + TEL + '" data-llc-track="call_us">' + ICON.phone + '<span>' + esc(CFG.phoneDisplay) + '</span></a>' +
            '<button type="button" class="llc-btn llc-btn--navy llc-btn--sm" data-llc-open="callback">' + ICON.chat + '<span>Request a Call Back</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="llc-results-wrap" aria-live="polite"></div>' +
      '</div>';
  }

  function cardHTML(p, i, zip) {
    var status = p.openNow === true ? '<span class="llc-badge llc-badge--open">Open now</span>'
      : p.openNow === false ? '<span class="llc-badge llc-badge--closed">Closed now</span>' : '';
    var rating = p.rating ? '<span>&#9733; ' + esc(p.rating.toFixed ? p.rating.toFixed(1) : p.rating) + (p.ratingCount ? ' (' + esc(p.ratingCount) + ')' : '') + '</span>' : '';
    var meta = (status || rating) ? '<div class="llc-card__meta">' + status + rating + '</div>' : '';
    var primary = p.phone
      ? '<a class="llc-btn llc-btn--gold" href="' + esc(telHref(p.phone)) + '" data-llc-fh-call="' + i + '">' + ICON.phone + '<span>Call ' + esc(p.phone) + '</span></a>'
      : (p.mapsUri ? '<a class="llc-btn llc-btn--gold" href="' + esc(p.mapsUri) + '" target="_blank" rel="noopener">' + ICON.pin + '<span>View on Google Maps</span></a>' : '');
    var row2 = '';
    var dir = p.mapsUri ? '<a class="llc-btn llc-btn--ghost llc-btn--sm" href="' + esc(p.mapsUri) + '" target="_blank" rel="noopener">' + ICON.route + '<span>Directions</span></a>' : '';
    var web = p.website ? '<a class="llc-btn llc-btn--ghost llc-btn--sm" href="' + esc(p.website) + '" target="_blank" rel="noopener nofollow">' + ICON.globe + '<span>Website</span></a>' : '';
    if (dir || web) row2 = '<div class="llc-card__row2"' + ((dir && web) ? '' : ' style="grid-template-columns:1fr"') + '>' + dir + web + '</div>';
    return '' +
      '<article class="llc-card">' +
        '<div class="llc-card__top"><span class="llc-card__num">' + (i + 1) + '</span>' +
          '<h4 class="llc-card__name">' + esc(p.name) + '</h4></div>' +
        meta +
        (p.address ? '<p class="llc-card__addr">' + esc(p.address) + '</p>' : '') +
        '<div class="llc-card__actions">' + primary + row2 + '</div>' +
        '<a class="llc-card__ask" href="#request-call-back" data-llc-fh-ask="' + i + '">Have Lasting Legacy call me about this funeral home</a>' +
      '</article>';
  }

  function fallbackHTML(text) {
    return '<div class="llc-empty"><p>' + esc(text) + '</p>' +
      '<div class="llc-empty__actions">' +
        '<a class="llc-btn llc-btn--gold" href="' + TEL + '" data-llc-track="call_us">' + ICON.phone + '<span>Call ' + esc(CFG.phoneDisplay) + '</span></a>' +
        '<button type="button" class="llc-btn llc-btn--ghost" data-llc-open="callback">' + ICON.chat + '<span>Request a Call Back</span></button>' +
      '</div></div>';
  }

  function Locator(root, variant) {
    this.root = root;
    this.variant = variant || 'inline';
    this.places = [];
    this.zip = '';
    root.classList.add('llc-root', 'llc-locator', 'llc-locator--' + this.variant);
    root.innerHTML = locatorHTML(this.variant);
    this.form = root.querySelector('.llc-search');
    this.input = root.querySelector('.llc-search__input');
    this.btn = root.querySelector('.llc-search .llc-btn');
    this.msg = root.querySelector('.llc-msg');
    this.out = root.querySelector('.llc-results-wrap');
    var last = store.get('llc_zip');
    if (last) this.input.value = last;
    var self = this;
    this.input.addEventListener('input', function () { self.input.value = self.input.value.replace(/\D/g, '').slice(0, 5); });
    this.form.addEventListener('submit', function (e) { e.preventDefault(); self.search(self.input.value); });
    root.addEventListener('click', function (e) {
      var call = e.target.closest('[data-llc-fh-call]');
      if (call) {
        var p = self.places[+call.getAttribute('data-llc-fh-call')];
        if (p) {
          track('llc_funeral_home_call', { funeral_home: p.name, zip: self.zip });
          showToast(p, self.zip);
        }
        return;
      }
      var ask = e.target.closest('[data-llc-fh-ask]');
      if (ask) {
        e.preventDefault();
        var q = self.places[+ask.getAttribute('data-llc-fh-ask')];
        openCallback({
          funeralHome: q ? q.name : '', funeralHomePhone: q ? q.phone : '',
          funeralHomeAddress: q ? q.address : '', zip: self.zip, source: 'locator_card'
        });
      }
    });
  }

  Locator.prototype.setMsg = function (text, type) {
    this.msg.className = 'llc-msg' + (type ? ' llc-msg--' + type : '');
    this.msg.textContent = text || '';
  };

  Locator.prototype.search = function (raw) {
    var self = this;
    var zip = String(raw || '').trim();
    this.input.value = zip;
    if (!/^\d{5}$/.test(zip)) {
      this.setMsg('Please enter a valid 5-digit US ZIP code.', 'error');
      this.input.focus();
      return Promise.resolve();
    }
    this.zip = zip;
    store.set('llc_zip', zip);
    track('llc_zip_search', { zip: zip });
    this.setMsg('Searching for funeral homes near ' + zip + '...', 'info');
    this.btn.disabled = true; this.btn.classList.add('is-loading');
    this.out.innerHTML = '';

    return fetch(CFG.api + '?zip=' + encodeURIComponent(zip), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false, code: 'bad_json' }; })
          .then(function (data) { return { status: r.status, data: data }; });
      })
      .then(function (res) {
        var d = res.data || {};
        if (!d.ok) {
          if (d.message) console.warn('[LLC locator]', d.code || res.status, d.message);
          var userFacing = (d.code === 'invalid_zip' || res.status === 404) && d.message
            ? d.message
            : 'We could not load funeral homes right now. Call us and we will connect you with a provider near ' + zip + '.';
          self.setMsg('', '');
          self.out.innerHTML = fallbackHTML(userFacing);
          return;
        }
        self.places = d.results || [];
        self.setMsg('', '');
        if (!self.places.length) {
          self.out.innerHTML = fallbackHTML('We did not find funeral homes near ' + zip + '. Call us and we will help you find a Memorial Care Plan provider.');
          return;
        }
        var where = d.location && d.location.formatted_address ? d.location.formatted_address : zip;
        self.out.innerHTML =
          '<div class="llc-results-head"><div><h3>Funeral Homes Near ' + esc(zip) + '</h3>' +
          '<p>' + self.places.length + ' found near ' + esc(where) + '. Call any of them and ask about the Lasting Legacy Memorial Care Plan.</p></div></div>' +
          '<div class="llc-results">' + self.places.map(function (p, i) { return cardHTML(p, i, zip); }).join('') + '</div>';
      })
      .catch(function (err) {
        console.warn('[LLC locator]', err);
        self.setMsg('', '');
        self.out.innerHTML = fallbackHTML('We could not load funeral homes right now. Call us and we will connect you with a provider.');
      })
      .then(function () { self.btn.disabled = false; self.btn.classList.remove('is-loading'); });
  };

  /* ------------------------------------------------------------------ Modal */
  var modal = null;
  var modalLocator = null;
  var lastFocus = null;

  function buildModal() {
    if (modal) return modal;
    modal = el(
      '<div class="llc-root llc-modal" role="dialog" aria-modal="true" aria-label="Find a funeral home or request a call back">' +
        '<div class="llc-modal__scrim" data-llc-close></div>' +
        '<div class="llc-modal__dialog">' +
          '<div class="llc-modal__head">' +
            '<span class="llc-modal__brand">Lasting Legacy Cleaners</span>' +
            '<div class="llc-modal__head-actions">' +
              '<a class="llc-modal__phone" href="' + TEL + '" data-llc-track="call_us">' + ICON.phone + '<span>' + esc(CFG.phoneDisplay) + '</span></a>' +
              '<button type="button" class="llc-modal__close" data-llc-close aria-label="Close">&times;</button>' +
            '</div>' +
          '</div>' +
          '<div class="llc-modal__body">' +
            '<div class="llc-view" data-view="locator"><div class="llc-modal-locator"></div></div>' +
            '<div class="llc-view" data-view="callback" hidden>' +
              '<button type="button" class="llc-back" data-llc-view="locator">&larr; Back to funeral home search</button>' +
              '<div class="llc-modal-callback"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(modal);
    modalLocator = new Locator(modal.querySelector('.llc-modal-locator'), 'modal');
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-llc-close]')) { closeModal(); return; }
      var v = e.target.closest('[data-llc-view]');
      if (v) showView(v.getAttribute('data-llc-view'));
    });
    // Escape closes from anywhere while open (focus can drop to <body> when views re-render).
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && modal.classList.contains('is-open')) closeModal();
    });
    modal.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = modal.querySelectorAll('a[href], button:not([disabled]), input:not([type="hidden"]):not([tabindex="-1"]), select, textarea');
      f = Array.prototype.filter.call(f, function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    return modal;
  }

  function showView(name) {
    Array.prototype.forEach.call(modal.querySelectorAll('.llc-view'), function (v) {
      v.hidden = v.getAttribute('data-view') !== name;
    });
    modal.querySelector('.llc-modal__dialog').scrollTop = 0;
  }

  function openModal(view) {
    buildModal();
    if (!modal.classList.contains('is-open')) lastFocus = document.activeElement;
    modal.classList.add('is-open');
    document.body.classList.add('llc-modal-open');
    showView(view);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('llc-modal-open');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); } }
  }

  function openLocator(zip) {
    openModal('locator');
    if (zip) modalLocator.search(zip);
    else setTimeout(function () { modalLocator.input.focus(); }, 30);
  }

  function openCallback(prefill) {
    openModal('callback');
    var box = modal.querySelector('.llc-modal-callback');
    mountCallback(box, prefill || {});
    setTimeout(function () { var n = box.querySelector('input[name="name"]'); if (n) n.focus(); }, 30);
  }

  /* ------------------------------------------------------------------ Toast */
  var toast = null, toastTimer = null;
  function showToast(place, zip) {
    if (!toast) {
      toast = el('<div class="llc-root llc-toast" role="status" aria-live="polite"><p></p>' +
        '<button type="button" class="llc-btn llc-btn--gold llc-btn--sm" data-llc-toast-cb>Request a Call Back</button>' +
        '<button type="button" class="llc-toast__x" aria-label="Dismiss">&times;</button></div>');
      document.body.appendChild(toast);
      toast.querySelector('.llc-toast__x').addEventListener('click', function () { toast.classList.remove('is-show'); });
    }
    toast.querySelector('p').innerHTML = '<strong>Calling ' + esc(place.name) + '?</strong> Ask about the Lasting Legacy Memorial Care Plan. Want us to follow up too?';
    var b = toast.querySelector('[data-llc-toast-cb]');
    b.onclick = function () {
      toast.classList.remove('is-show');
      openCallback({ funeralHome: place.name, funeralHomePhone: place.phone, funeralHomeAddress: place.address, zip: zip, source: 'after_funeral_home_call' });
    };
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-show'); }, 15000);
  }

  /* ------------------------------------------------------ Sitewide CTAs */
  function findAction() {
    // On the home page, "Find" scrolls to the existing provider section; elsewhere it opens the modal.
    return document.getElementById('funreal') ? 'scroll' : 'modal';
  }

  function buildTopbar() {
    if (!CFG.showTopbar || document.querySelector('.llc-topbar')) return;
    var bar = el(
      '<div class="llc-root llc-topbar" role="region" aria-label="Contact Lasting Legacy">' +
        '<div class="llc-topbar__inner">' +
          '<div class="llc-topbar__msg"><strong>Memorial care questions?</strong> Talk to Lasting Legacy today.</div>' +
          '<div class="llc-topbar__actions">' +
            '<a class="llc-topbar__phone" href="' + TEL + '" data-llc-track="call_us">' + ICON.phone + '<span>' + esc(CFG.phoneDisplay) + '</span></a>' +
            '<button type="button" class="llc-btn llc-btn--gold llc-btn--sm" data-llc-open="locator">' + ICON.pin + '<span>Find a Funeral Home</span></button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    var header = document.querySelector('.elementor-location-header');
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  function buildDock() {
    if (!CFG.showDock || document.querySelector('.llc-dock')) return;
    var dock = el(
      '<div class="llc-root llc-dock" role="region" aria-label="Quick contact">' +
        '<a class="llc-btn llc-btn--gold llc-dock__call" href="' + TEL + '" data-llc-track="call_us" aria-label="Call Lasting Legacy at ' + esc(CFG.phoneDisplay) + '">' + ICON.phone +
          '<span class="llc-dock__d">Call ' + esc(CFG.phoneDisplay) + '</span><span class="llc-dock__m">Call Now<small>' + esc(CFG.phoneDisplay) + '</small></span></a>' +
        '<button type="button" class="llc-btn llc-btn--navy" data-llc-open="locator">' + ICON.pin +
          '<span class="llc-dock__d">Find a Funeral Home</span><span class="llc-dock__m">Find Funeral Home<small>Search by ZIP</small></span></button>' +
      '</div>'
    );
    document.body.appendChild(dock);
    document.body.classList.add('llc-has-dock');
    // Desktop only (CSS-gated): hide the floating dock while a locator or form is in view,
    // so it never covers results or form fields.
    if ('IntersectionObserver' in window) {
      var visible = new Set();
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
        dock.classList.toggle('is-tucked', visible.size > 0);
      }, { threshold: 0.15 });
      var watch = function () {
        Array.prototype.forEach.call(document.querySelectorAll('.llc-locator:not(.llc-locator--modal), form[data-llc-formspree], .llc-band'), function (n) {
          if (!n.__llcWatched) { n.__llcWatched = true; io.observe(n); }
        });
      };
      watch();
      setTimeout(watch, 1500);
    }
  }

  function buildBand() {
    if (!CFG.showBand || document.querySelector('[data-llc-locator]') || document.querySelector('.llc-band')) return;
    var band = el('<section class="llc-root llc-band" aria-label="Find a funeral home"><div data-llc-locator="band"></div></section>');
    var footer = document.querySelector('.elementor-location-footer, footer');
    if (footer && footer.parentNode) footer.parentNode.insertBefore(band, footer);
    else document.body.appendChild(band);
  }

  function mountInlineLocators() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-llc-locator]'), function (node) {
      if (node.__llc) return;
      node.__llc = new Locator(node, node.getAttribute('data-llc-locator') || 'inline');
    });
  }

  function firstInlineLocator() {
    var n = document.querySelector('#funreal [data-llc-locator]') || document.querySelector('[data-llc-locator]');
    return n && n.__llc;
  }

  /* --------------------------------------------------------- Global clicks */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var opener = t.closest('[data-llc-open]');
    if (opener) {
      e.preventDefault();
      var what = opener.getAttribute('data-llc-open');
      if (what === 'callback') {
        var loc = opener.closest('.llc-locator');
        var zip = loc && loc.__llcZip ? loc.__llcZip : (store.get('llc_zip') || '');
        openCallback({ zip: zip, source: 'callback_button' });
        return;
      }
      if (what === 'locator') {
        track('llc_find_funeral_home_click', { from: opener.closest('.llc-dock') ? 'dock' : opener.closest('.llc-topbar') ? 'topbar' : 'other' });
        if (findAction() === 'scroll' && !opener.closest('.llc-modal')) {
          var sec = document.getElementById('funreal');
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          var il = firstInlineLocator();
          if (il) setTimeout(function () { try { il.input.focus({ preventScroll: true }); } catch (x) { il.input.focus(); } }, 600);
        } else {
          openLocator();
        }
        return;
      }
    }

    // Existing "Find a Trusted Provider" buttons point to #funreal. On pages without that
    // section (e.g. Our Work) open the locator instead of jumping nowhere.
    var a = t.closest('a[href]');
    if (a) {
      var href = a.getAttribute('href') || '';
      if (/#funreal$/.test(href)) {
        if (document.getElementById('funreal')) {
          var il2 = firstInlineLocator();
          if (il2) setTimeout(function () { try { il2.input.focus({ preventScroll: true }); } catch (x) { il2.input.focus(); } }, 700);
        } else {
          e.preventDefault();
          openLocator();
        }
        return;
      }
      if (/^tel:/i.test(href) && !a.hasAttribute('data-llc-fh-call')) {
        track('llc_call_us_click', { location: a.closest('.llc-dock') ? 'dock' : a.closest('.llc-topbar') ? 'topbar' : 'page' });
      }
    }
  });

  /* -------------------------------------------------------------- Boot */
  function boot() {
    buildTopbar();
    buildBand();
    mountInlineLocators();
    buildDock();
    // If someone lands on /#funreal, focus the search box.
    if (window.location.hash === '#funreal') {
      var il = firstInlineLocator();
      if (il) setTimeout(function () { try { il.input.focus({ preventScroll: true }); } catch (x) { il.input.focus(); } }, 800);
    }
    // Deep link support: /?zip=46062 runs a search immediately.
    var m = /[?&]zip=(\d{5})(?:&|$)/.exec(window.location.search);
    if (m) {
      var target = firstInlineLocator();
      if (target) { target.search(m[1]); target.root.scrollIntoView({ block: 'start' }); }
      else openLocator(m[1]);
    }
  }

  // Keep the current ZIP on the locator root so "Request a Call Back" can prefill it.
  var origSearch = Locator.prototype.search;
  Locator.prototype.search = function (z) {
    this.root.__llcZip = String(z || '').trim();
    return origSearch.call(this, z);
  };

  window.LLCConnect = { openLocator: openLocator, openCallback: openCallback, config: CFG };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
