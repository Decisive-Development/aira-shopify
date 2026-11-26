/*
  Affiliate signup (sections/affiliate-signup.liquid). No checkout, no order.

  1. Reads the invite from the link (?h=handle&k=signature) and asks the
     Apps Script whether it is good and whether this handle has signed.
  2. Shows the private-link state, the agreement and form, "already signed",
     or the thank-you state.
  3. Runs the form: the code name picker with its live check, the phone, the
     address fields that follow the country.
  4. On submit, posts the form to the Apps Script, which makes the signed
     PDF, emails it, files it and adds a row to Tom's sheet.

  Two outside calls, and no more:
    - the Apps Script (the section setting script_url): the link check and
      the signed form. JSON sent as plain text, so there is no preflight.
    - Shopify's Storefront API, with no token: a throwaway cart that says
      whether a discount code already exists. It never touches a real cart.
  Nothing is created in Shopify and no personal detail goes into a URL.

  The field rules here are the script's (apps-script/Validate.js in the
  affiliate script repo). The script's answer is the one that counts.
*/
(function () {
  var root = document.querySelector('[data-affiliate-signup]');
  if (!root) return;

  var KEY = 'aira_affiliate_signup';
  // The Storefront API is not a storefront page: it is served from the domain
  // root in every language, so it takes no routes.root prefix.
  var API_VERSION = '2026-10';
  var API_URL = '/api/' + API_VERSION + '/graphql.json';
  var HANDLE_RE = /^[a-z0-9._]{1,30}$/;
  var SIGNATURE_RE = /^[A-Za-z0-9_-]{22}$/;
  var NAME_RE = /^[A-Z]{3,12}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var NATIONAL_ADDRESS_RE = /^[A-Z]{4}[0-9]{4}$/;
  var POSTAL_CODE_RE = /^[0-9]{5}$/;
  var GULF_MOBILE_RE = /^5[0-9]{8}$/;
  var OTHER_PHONE_RE = /^[0-9]{6,12}$/;
  var STATUS_TIMEOUT_MS = 8000; // the script can be slow to wake
  var SEND_TIMEOUT_MS = 30000; // it makes a PDF and sends two emails
  var CHECK_TIMEOUT_MS = 8000;
  var CHECK_DELAY_MS = 400;
  // Isolates keep a Latin code or "+971" the right way round inside Arabic.
  var LTR_START = String.fromCharCode(0x2066);
  var LTR_END = String.fromCharCode(0x2069);

  // Calling code per country (ISO 3166 code, then the digits). Country names
  // come from the browser, in the page's language.
  var DIAL = 'AC247 AD376 AE971 AF93 AG1 AI1 AL355 AM374 AO244 AR54 AS1 AT43 AU61 AW297 AX358 AZ994 BA387 BB1 BD880 BE32 BF226 BG359 BH973 BI257 BJ229 BL590 BM1 BN673 BO591 BQ599 BR55 BS1 BT975 BW267 BY375 BZ501 CA1 CC61 CD243 CF236 CG242 CH41 CI225 CK682 CL56 CM237 CN86 CO57 CR506 CU53 CV238 CW599 CX61 CY357 CZ420 DE49 DJ253 DK45 DM1 DO1 DZ213 EC593 EE372 EG20 EH212 ER291 ES34 ET251 FI358 FJ679 FK500 FM691 FO298 FR33 GA241 GB44 GD1 GE995 GF594 GG44 GH233 GI350 GL299 GM220 GN224 GP590 GQ240 GR30 GT502 GU1 GW245 GY592 HK852 HN504 HR385 HT509 HU36 ID62 IE353 IL972 IM44 IN91 IO246 IQ964 IR98 IS354 IT39 JE44 JM1 JO962 JP81 KE254 KG996 KH855 KI686 KM269 KN1 KP850 KR82 KW965 KY1 KZ7 LA856 LB961 LC1 LI423 LK94 LR231 LS266 LT370 LU352 LV371 LY218 MA212 MC377 MD373 ME382 MF590 MG261 MH692 MK389 ML223 MM95 MN976 MO853 MP1 MQ596 MR222 MS1 MT356 MU230 MV960 MW265 MX52 MY60 MZ258 NA264 NC687 NE227 NF672 NG234 NI505 NL31 NO47 NP977 NR674 NU683 NZ64 OM968 PA507 PE51 PF689 PG675 PH63 PK92 PL48 PM508 PR1 PS970 PT351 PW680 PY595 QA974 RE262 RO40 RS381 RU7 RW250 SA966 SB677 SC248 SD249 SE46 SG65 SH290 SI386 SJ47 SK421 SL232 SM378 SN221 SO252 SR597 SS211 ST239 SV503 SX1 SY963 SZ268 TA290 TC1 TD235 TG228 TH66 TJ992 TK690 TL670 TM993 TN216 TO676 TR90 TT1 TV688 TW886 TZ255 UA380 UG256 US1 UY598 UZ998 VA39 VC1 VE58 VG1 VI1 VN84 VU678 WF681 WS685 XK383 YE967 YT262 ZA27 ZM260 ZW263';

  var PROBE = 'mutation Probe($lines: [CartLineInput!], $codes: [String!], $country: CountryCode) {'
    + ' cartCreate(input: { lines: $lines, discountCodes: $codes, buyerIdentity: { countryCode: $country } }) {'
    + ' cart { totalQuantity discountCodes { code applicable } }'
    + ' userErrors { field message }'
    + ' warnings { code }'
    + ' } }';

  var scriptUrl = root.getAttribute('data-script-url') || '';
  var variantId = root.getAttribute('data-variant-id');
  var country = root.getAttribute('data-country') || null;
  var lang = document.documentElement.lang || 'en';
  var form = root.querySelector('#affiliate-signup-form');

  function msg(name) {
    return root.getAttribute('data-msg-' + name) || '';
  }

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || root).querySelectorAll(selector));
  }

  function setText(selector, value) {
    all(selector).forEach(function (el) { el.textContent = value; });
  }

  function tidy(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  /*
    Posts one request to the Apps Script and resolves with its JSON answer, or
    with null when there is none in time. Never rejects.

    No headers of our own and no Content-Type: the browser sends the body as
    plain text, which needs no preflight request, and follows Google's
    redirect to the answer.
  */
  function callScript(payload, timeoutMs) {
    if (!scriptUrl) return Promise.resolve(null);
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, timeoutMs);
    return fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (body) {
        clearTimeout(timer);
        return body && typeof body === 'object' ? body : null;
      })
      .catch(function () {
        clearTimeout(timer);
        return null;
      });
  }

  /*
    Asks Shopify about one discount code, with one kit in a throwaway cart.
    Exactly one code per call: with two order discounts in a cart, only the
    better one is reported as applicable.

    Resolves, never rejects, with the state of the code:
      'applicable'  the code can be used on this cart
      'missing'     Shopify knows no such code
      'exists'      the code is there but cannot be used (used up, switched
                    off, or not for this cart)
      'failed'      no usable answer
  */
  function ask(code) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, CHECK_TIMEOUT_MS);
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: PROBE,
        variables: {
          lines: [{ merchandiseId: 'gid://shopify/ProductVariant/' + variantId, quantity: 1 }],
          codes: [code],
          country: country
        }
      }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (body) {
        clearTimeout(timer);
        var out = body && body.data && body.data.cartCreate;
        if (!out || !out.cart) return 'failed';
        var entry = (out.cart.discountCodes || [])[0];
        if (entry && entry.applicable === true) return 'applicable';
        var warnings = (out.warnings || []).map(function (w) { return String(w.code || ''); });
        if (warnings.indexOf('DISCOUNT_NOT_FOUND') !== -1) return 'missing';
        if (warnings.some(function (w) { return w.indexOf('DISCOUNT_') === 0; })) return 'exists';
        // No word about the code at all. With a kit in the cart, "not
        // applicable" means the code is not there. Without one, nothing is known.
        return Number(out.cart.totalQuantity) ? 'missing' : 'failed';
      })
      .catch(function () {
        clearTimeout(timer);
        return 'failed';
      });
  }

  /* ---- The record this browser keeps of a signature ---- */

  function readRecord(handle) {
    try {
      var record = JSON.parse(localStorage.getItem(KEY));
      return record && record.h === handle && record.receipt ? record : null;
    } catch (e) {
      return null;
    }
  }

  function saveRecord(record) {
    try {
      localStorage.setItem(KEY, JSON.stringify(record));
    } catch (e) {
      /* No storage (a private window, say): the PDF still arrives by email. */
    }
  }

  function clearRecord() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      /* Nothing to clear. */
    }
  }

  /* ---- States ---- */

  var VISIBLE = {
    private: ['state:private'],
    signed: ['state:signed'],
    done: ['state:done', 'part:agreement'],
    form: ['part:agreement', 'part:form']
  };

  function show(state) {
    var visible = VISIBLE[state];
    all('[data-affiliate-state]').forEach(function (el) {
      el.hidden = visible.indexOf('state:' + el.getAttribute('data-affiliate-state')) === -1;
    });
    all('[data-affiliate-part]').forEach(function (el) {
      el.hidden = visible.indexOf('part:' + el.getAttribute('data-affiliate-part')) === -1;
    });
  }

  function showInvitation(handle) {
    var line = root.querySelector('[data-affiliate-invitation]');
    if (!line) return;
    setText('[data-affiliate-handle]', handle || '');
    line.hidden = !handle;
  }

  // Brings a state card into view and tells a screen reader about it.
  function bringUp(state) {
    var panel = root.querySelector('[data-affiliate-state="' + state + '"]');
    if (!panel) return;
    if (panel.hasAttribute('tabindex')) panel.focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'center' });
  }

  function showDone(record) {
    setText('[data-affiliate-first-name]', record.first_name || '');
    setText('[data-affiliate-email]', record.email || '');
    setText('[data-affiliate-code]', record.code || '');
    setText('[data-affiliate-receipt]', record.receipt || '');
    show('done');
  }

  /* ---- Which state ---- */

  var params = new URLSearchParams(window.location.search);
  var handle = String(params.get('h') || '');
  var signature = String(params.get('k') || '');
  var linkOk = HANDLE_RE.test(handle) && SIGNATURE_RE.test(signature);
  var formStarted = false;

  function openForm() {
    show('form');
    if (formStarted) return;
    formStarted = true;
    startForm();
  }

  /*
    Preview only. On an unpublished theme, ?show=form, ?show=done,
    ?show=signed or ?show=private opens that state without asking the script,
    so every state can be looked at without a link. The theme editor, which
    cannot take a link, opens the form. The section only sets
    data-affiliate-show off the live theme, so none of this reaches a creator.
  */
  var showMode = root.getAttribute('data-affiliate-show');
  var forced = showMode ? params.get('show') || (showMode === 'editor' ? 'form' : '') : '';
  if (forced === 'private' || forced === 'signed') {
    show(forced);
    return;
  }
  if (forced === 'done') {
    showInvitation(linkOk ? handle : '');
    showDone({ first_name: 'Sara', email: 'sara@example.com', code: 'SARA15', receipt: 'AFF-261126-K7Q2' }); // sample values
    return;
  }
  if (forced === 'form' && form) {
    showInvitation(linkOk ? handle : '');
    openForm();
    return;
  }

  if (!linkOk || !form) {
    show('private');
    return;
  }

  showInvitation(handle);
  var record = readRecord(handle);
  // A reload after signing shows the thank-you state at once.
  if (record) showDone(record);
  callScript({ action: 'status', h: handle, k: signature }, STATUS_TIMEOUT_MS).then(function (answer) {
    if (!answer || answer.ok !== true) {
      // No answer in time: let the creator read and fill in. The script
      // decides again when the form is sent.
      if (!record) openForm();
      return;
    }
    if (answer.valid !== true) {
      clearRecord();
      showInvitation('');
      show('private');
      return;
    }
    if (answer.signed === true) {
      if (!record) show('signed');
      return;
    }
    // Valid and not signed. A record left in this browser means the signup
    // was removed from the sheet, so the link is open again.
    if (record) clearRecord();
    openForm();
  });

  /* ---- The form ---- */

  function startForm() {
    var el = function (id) { return form.querySelector('#' + id); };
    var codeName = el('affiliate-code-name');
    var coachInput = form.querySelector('[data-affiliate-coach]');
    var firstInput = el('affiliate-first-name');
    var lastInput = el('affiliate-last-name');
    var emailInput = el('affiliate-email');
    var prefix = form.querySelector('[data-affiliate-prefix]');
    var prefixFace = form.querySelector('[data-affiliate-prefix-face]');
    var phoneInput = el('affiliate-phone');
    var countryInput = form.querySelector('[data-affiliate-country]');
    var addressWrap = form.querySelector('[data-affiliate-address]');
    var addressInput = el('affiliate-address');
    var unitInput = el('affiliate-unit');
    var nationalInput = el('affiliate-national-address');
    var cityInput = el('affiliate-city');
    var emirateInput = el('affiliate-emirate');
    var postalInput = el('affiliate-postal-code');
    var handleInput = el('affiliate-instagram');
    var agreedInput = el('affiliate-agreed');
    var signatureInput = el('affiliate-signature');
    var button = form.querySelector('button[type="submit"]');
    var buttonLabel = form.querySelector('[data-affiliate-submit-label]');
    var buttonText = buttonLabel ? buttonLabel.textContent : '';
    var formError = form.querySelector('[data-affiliate-form-error]');
    var preview = form.querySelector('[data-affiliate-preview]');
    var previewCode = form.querySelector('[data-affiliate-preview-code]');
    var previewTeam = form.querySelector('[data-affiliate-preview-team]');
    var previewTeamCode = form.querySelector('[data-affiliate-preview-team-code]');
    var statusLine = form.querySelector('[data-affiliate-code-status]');
    var statusText = form.querySelector('[data-affiliate-code-status-text]');
    var statusOk = form.querySelector('[data-affiliate-code-ok]');
    var busy = false;
    var check = { name: '', state: 'idle' }; // idle | checking | available | taken | invalid | unknown
    var checkTimer = null;
    var checkSeq = 0;

    if (linkOk) {
      handleInput.value = handle;
      handleInput.readOnly = true;
    }

    function fieldError(input, message) {
      var slot = document.getElementById(input.id + '-error');
      if (message) {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.removeAttribute('aria-invalid');
      }
      if (slot) {
        slot.textContent = message || '';
        slot.hidden = !message;
      }
    }

    function showFormError(message) {
      formError.textContent = message || '';
      formError.hidden = !message;
    }

    /* The code name, its preview and the live check. */

    function withCode(template, code) {
      return template.replace('%code%', LTR_START + code + LTR_END);
    }

    function setCheck(name, state) {
      check = { name: name, state: state };
      var text = '';
      if (state === 'checking') text = msg('code-checking');
      if (state === 'available') text = withCode(msg('code-available'), name + '15');
      if (state === 'taken') text = withCode(msg('code-taken'), name + '15');
      if (state === 'invalid') text = msg('code-invalid');
      if (state === 'unknown') text = msg('code-unknown');
      statusText.textContent = text;
      statusOk.hidden = state !== 'available';
      statusLine.hidden = !text;
      if (state === 'taken' || state === 'invalid') {
        codeName.setAttribute('aria-invalid', 'true');
      } else {
        codeName.removeAttribute('aria-invalid');
      }
    }

    function renderPreview() {
      var name = codeName.value;
      var showable = /^[A-Z]{1,12}$/.test(name);
      preview.hidden = !showable;
      previewCode.textContent = showable ? name + '15' : '';
      previewTeamCode.textContent = showable ? 'TEAM' + name : '';
      previewTeam.hidden = !coachInput.checked;
    }

    // A name is free when Shopify knows neither NAME15 nor TEAMNAME. Both are
    // asked even when the coach box is not ticked, so a client code can be
    // added later. Resolves with the check once it is settled.
    function runCheck() {
      clearTimeout(checkTimer);
      checkSeq += 1;
      var seq = checkSeq;
      var name = codeName.value;
      if (!NAME_RE.test(name)) {
        setCheck(name, name ? 'invalid' : 'idle');
        return Promise.resolve(check);
      }
      if (name.indexOf('AIRA') !== -1) {
        setCheck(name, 'taken');
        return Promise.resolve(check);
      }
      if (!variantId) {
        setCheck(name, 'unknown');
        return Promise.resolve(check);
      }
      setCheck(name, 'checking');
      return Promise.all([ask(name + '15'), ask('TEAM' + name)]).then(function (answers) {
        if (seq !== checkSeq) return check; // a newer question is out; ignore this answer
        var taken = answers.some(function (a) { return a === 'applicable' || a === 'exists'; });
        var failed = answers.some(function (a) { return a === 'failed'; });
        setCheck(name, taken ? 'taken' : failed ? 'unknown' : 'available');
        return check;
      });
    }

    function onCodeName() {
      var caret = codeName.selectionStart;
      var upper = codeName.value.toUpperCase();
      if (upper !== codeName.value) {
        codeName.value = upper;
        try {
          codeName.setSelectionRange(caret, caret);
        } catch (e) {
          /* Not every browser lets a script move the caret here. */
        }
      }
      renderPreview();
      clearTimeout(checkTimer);
      checkSeq += 1; // an answer still on its way is for an older name
      setCheck(codeName.value, 'idle');
      if (codeName.value) checkTimer = setTimeout(runCheck, CHECK_DELAY_MS);
    }

    codeName.addEventListener('input', onCodeName);
    coachInput.addEventListener('change', renderPreview);

    /* Phone: a calling code and a number, sent as one value. */

    var dial = {};
    DIAL.split(' ').forEach(function (entry) { dial[entry.slice(0, 2)] = entry.slice(2); });
    var prefixTouched = false;

    (function fillPrefix() {
      var names = null;
      try {
        names = new Intl.DisplayNames([lang], { type: 'region' });
      } catch (e) {
        names = null;
      }
      var rest = Object.keys(dial)
        .filter(function (iso) { return iso !== 'AE' && iso !== 'SA'; })
        .map(function (iso) {
          var name = iso;
          try {
            name = (names && names.of(iso)) || iso;
          } catch (e) {
            name = iso;
          }
          return { iso: iso, name: name };
        });
      rest.sort(function (a, b) { return a.name.localeCompare(b.name, lang); });
      rest.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.iso;
        option.textContent = item.name + ' ' + LTR_START + '+' + dial[item.iso] + LTR_END;
        prefix.appendChild(option);
      });
    })();

    function showPrefix() {
      prefixFace.textContent = '+' + dial[prefix.value];
    }

    // Strips spaces, dashes, a pasted country code and the first 0.
    function tidyPhone() {
      var raw = phoneInput.value.trim();
      var code = dial[prefix.value];
      var digits = raw.replace(/\D/g, '');
      var international = raw.charAt(0) === '+';
      if (!international && digits.indexOf('00') === 0) {
        international = true;
        digits = digits.slice(2);
      }
      if (international && digits.indexOf(code) === 0) {
        digits = digits.slice(code.length);
      } else if ((code === '971' || code === '966') && digits.length === 12 && digits.indexOf(code + '5') === 0) {
        digits = digits.slice(3); // the code typed without a plus, in front of a Gulf mobile
      }
      digits = digits.replace(/^0+/, '');
      phoneInput.value = digits;
      return digits;
    }

    function phoneIsValid(digits) {
      var code = dial[prefix.value];
      return code === '971' || code === '966' ? GULF_MOBILE_RE.test(digits) : OTHER_PHONE_RE.test(digits);
    }

    prefix.addEventListener('change', function () {
      prefixTouched = true;
      showPrefix();
      if (phoneInput.hasAttribute('aria-invalid')) fieldError(phoneInput, '');
    });
    phoneInput.addEventListener('blur', tidyPhone);

    /* Address: the fields follow the country, as checkout does. */

    function applyCountry() {
      var iso = countryInput.value;
      addressWrap.hidden = !iso;
      addressInput.disabled = !iso;
      cityInput.disabled = !iso;
      all('[data-affiliate-for]', form).forEach(function (block) {
        var on = block.getAttribute('data-affiliate-for') === iso;
        block.hidden = !on;
        all('input, select', block).forEach(function (input) {
          input.disabled = !on;
          if (!on) fieldError(input, '');
        });
      });
      // The calling code follows the country until the creator picks one by hand.
      if (iso && !prefixTouched) {
        prefix.value = iso;
        showPrefix();
      }
    }

    countryInput.addEventListener('change', applyCountry);
    nationalInput.addEventListener('input', function () {
      var upper = nationalInput.value.toUpperCase();
      if (upper !== nationalInput.value) nationalInput.value = upper;
    });
    applyCountry();
    showPrefix();

    /* The other rules. Each returns '' or the message to show. */

    // A word of a name has at least one letter, in any alphabet. Built at run
    // time so a browser without Unicode classes still loads the script; there
    // any run of characters counts as a word.
    var letter = null;
    try {
      letter = new RegExp('\\p{L}', 'u');
    } catch (e) {
      letter = null;
    }
    function hasLetter(word) {
      return letter ? letter.test(word) : word.length > 0;
    }

    function required(input) {
      return tidy(input.value) ? '' : msg('required');
    }

    function nameRule(input) {
      return function () { return hasLetter(tidy(input.value)) ? '' : msg('required'); };
    }

    function cleanHandle() {
      return handleInput.value.trim().replace(/^@+/, '').toLowerCase();
    }

    handleInput.addEventListener('input', function () {
      if (handleInput.readOnly) return;
      var clean = handleInput.value.replace(/^\s*@+/, '').toLowerCase();
      if (clean !== handleInput.value) handleInput.value = clean;
    });

    // In the order of the page, so the first field that fails gets the cursor.
    var rules = [
      [firstInput, nameRule(firstInput)],
      [lastInput, nameRule(lastInput)],
      [emailInput, function () {
        var value = emailInput.value.trim();
        return required(emailInput) || (EMAIL_RE.test(value) && value.length <= 254 ? '' : msg('email'));
      }],
      [phoneInput, function () { return required(phoneInput) || (phoneIsValid(tidyPhone()) ? '' : msg('phone')); }],
      [countryInput, function () { return countryInput.value ? '' : msg('required'); }],
      [addressInput, function () { return required(addressInput); }],
      [unitInput, function () { return required(unitInput); }],
      [nationalInput, function () {
        return required(nationalInput) || (NATIONAL_ADDRESS_RE.test(nationalInput.value.trim().toUpperCase()) ? '' : msg('national-address'));
      }],
      [cityInput, function () { return required(cityInput); }],
      [emirateInput, function () { return emirateInput.value ? '' : msg('required'); }],
      [postalInput, function () {
        var value = postalInput.value.trim();
        return !value || POSTAL_CODE_RE.test(value) ? '' : msg('postal-code');
      }],
      [handleInput, function () {
        if (!cleanHandle()) return msg('required');
        return HANDLE_RE.test(cleanHandle()) ? '' : msg('handle');
      }],
      [agreedInput, function () { return agreedInput.checked ? '' : msg('required'); }],
      // The typed name is the signature: a first and a last name, in any script.
      [signatureInput, function () {
        var name = tidy(signatureInput.value);
        if (!name) return msg('required');
        var words = name.split(' ').filter(hasLetter);
        return words.length >= 2 && name.length <= 80 ? '' : msg('signature');
      }]
    ];

    function validate() {
      var first = null;
      // The code name shows its own status line instead of an error slot.
      if (!NAME_RE.test(codeName.value)) {
        clearTimeout(checkTimer);
        checkSeq += 1;
        setCheck(codeName.value, 'invalid');
        first = codeName;
      }
      rules.forEach(function (rule) {
        var input = rule[0];
        if (input.disabled) return;
        var message = rule[1]();
        fieldError(input, message);
        if (message && !first) first = input;
      });
      if (first) first.focus();
      return !first;
    }

    rules.forEach(function (rule) {
      var input = rule[0];
      var eventName = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(eventName, function () {
        if (input.hasAttribute('aria-invalid')) fieldError(input, '');
      });
    });

    /* Sending. */

    function setBusy(state) {
      busy = state;
      if (!button) return;
      button.disabled = state;
      if (state) {
        button.setAttribute('aria-busy', 'true');
      } else {
        button.removeAttribute('aria-busy');
      }
      if (buttonLabel) buttonLabel.textContent = state ? msg('submit-busy') : buttonText;
    }

    function payloadFor(name) {
      var iso = countryInput.value;
      return {
        action: 'sign',
        h: handle,
        k: signature,
        agreement_version: root.getAttribute('data-agreement-version'),
        code_name: name,
        coach: coachInput.checked,
        first_name: tidy(firstInput.value),
        last_name: tidy(lastInput.value),
        email: emailInput.value.trim(),
        phone: '+' + dial[prefix.value] + phoneInput.value,
        country: iso,
        address1: tidy(addressInput.value),
        address2: iso === 'SA' ? nationalInput.value.trim().toUpperCase() : tidy(unitInput.value),
        city: tidy(cityInput.value),
        province: iso === 'AE' ? emirateInput.value : '',
        zip: iso === 'SA' ? postalInput.value.trim() : '',
        signed_by: tidy(signatureInput.value),
        locale: lang === 'ar' ? 'ar' : 'en'
      };
    }

    // The script found a field wrong that the page let through: point at it.
    function serverField(field, name) {
      var iso = countryInput.value;
      var map = {
        first_name: [firstInput, msg('required')],
        last_name: [lastInput, msg('required')],
        email: [emailInput, msg('email')],
        phone: [phoneInput, msg('phone')],
        country: [countryInput, msg('required')],
        address1: [addressInput, msg('required')],
        address2: iso === 'SA' ? [nationalInput, msg('national-address')] : [unitInput, msg('required')],
        city: [cityInput, msg('required')],
        province: [emirateInput, msg('required')],
        zip: [postalInput, msg('postal-code')],
        signed_by: [signatureInput, msg('signature')]
      };
      if (field === 'code_name') {
        setCheck(name, 'invalid');
        codeName.focus();
        return true;
      }
      if (!map[field]) return false;
      fieldError(map[field][0], map[field][1]);
      map[field][0].focus();
      return true;
    }

    function onAnswer(answer, sent) {
      setBusy(false);
      if (answer && answer.ok === true && answer.receipt) {
        var made = { h: handle, receipt: String(answer.receipt), first_name: sent.first_name, code: sent.code_name + '15', email: sent.email };
        saveRecord(made);
        showDone(made);
        bringUp('done');
        return;
      }
      var error = answer && answer.ok === false ? answer.error : '';
      if (error === 'signed') {
        show('signed');
        bringUp('signed');
      } else if (error === 'link') {
        showFormError(msg('link'));
      } else if (error === 'version') {
        showFormError(msg('version'));
      } else if (error === 'invalid' && serverField(answer.field, sent.code_name)) {
        /* The field has the cursor and its message. */
      } else {
        // No answer in time, or anything else. What was typed stays.
        showFormError(msg('send'));
      }
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (busy) return;
      showFormError('');
      if (!validate()) return;
      // A previewed form with no link in the address has nowhere to send.
      if (!linkOk) return;
      var name = codeName.value;
      setBusy(true);
      // Asked again whatever the last answer was: the name may have gone since.
      runCheck().then(function (result) {
        if (result.name !== name || result.state !== 'available') {
          setBusy(false);
          codeName.focus();
          return;
        }
        var payload = payloadFor(name);
        callScript(payload, SEND_TIMEOUT_MS).then(function (answer) { onAnswer(answer, payload); });
      });
    });
  }
})();
