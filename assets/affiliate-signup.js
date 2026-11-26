/*
  Affiliate signup (sections/affiliate-signup.liquid). Shopify only.

  1. Reads the invite from the link (?i=KIT-XXXXXXXX&h=handle) and asks the
     Storefront API whether that discount code can still be used.
  2. Shows the private-link state, the agreement and form, or "you're in".
  3. Runs the code name picker: TOM gives TOM15 (and TEAMTOM for a coach), and
     Shopify is asked whether those codes exist yet.
  4. On submit, opens a cart permalink: one kit, the invite code, and the
     signing details as cart attributes. Shopify checkout does the rest.

  Every question to Shopify is a throwaway cart made through the Storefront
  API, with no token. It never touches the visitor's own cart.
*/
(function () {
  var root = document.querySelector('[data-affiliate-signup]');
  if (!root) return;

  var KEY = 'aira_affiliate_signup';
  // The Storefront API is not a storefront page: it is served from the domain
  // root in every language, so it takes no routes.root prefix.
  var API_VERSION = '2026-10';
  var API_URL = '/api/' + API_VERSION + '/graphql.json';
  var INVITE_RE = /^KIT-[A-Z0-9]{8}$/;
  var HANDLE_RE = /^[a-z0-9._]{1,30}$/;
  var NAME_RE = /^[A-Z]{3,12}$/;
  var PROBE_TIMEOUT_MS = 4000;
  var CHECK_TIMEOUT_MS = 8000;
  var CHECK_DELAY_MS = 400;
  var COPIED_MS = 2000;
  // Isolates keep a Latin code the right way round inside Arabic.
  var LTR_START = '⁦';
  var LTR_END = '⁩';

  var PROBE = 'mutation Probe($lines: [CartLineInput!], $codes: [String!], $country: CountryCode) {'
    + ' cartCreate(input: { lines: $lines, discountCodes: $codes, buyerIdentity: { countryCode: $country } }) {'
    + ' cart { totalQuantity discountCodes { code applicable } }'
    + ' userErrors { field message }'
    + ' warnings { code }'
    + ' } }';

  var variantId = root.getAttribute('data-variant-id');
  var country = root.getAttribute('data-country') || null;
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
    Asks Shopify about one discount code, with one kit in a throwaway cart.
    Exactly one code per call: with two order discounts in a cart, only the
    better one is reported as applicable.

    Resolves, never rejects:
      state  'applicable'  the code can be used on this cart
             'missing'     Shopify knows no such code
             'exists'      the code is there but cannot be used (used up,
                           switched off, or not for this cart)
             'failed'      no usable answer
      inactive  true when Shopify says the code is switched off or expired
      lines     how many kits made it into the cart. 0 means the kit is not
                sold where this visitor is, so "cannot be used" proves nothing.
  */
  function ask(code, timeoutMs) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, timeoutMs);
    var failed = { state: 'failed', inactive: false, lines: 0 };
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
        if (!out || !out.cart) return failed;
        var lines = Number(out.cart.totalQuantity) || 0;
        var entry = (out.cart.discountCodes || [])[0];
        if (entry && entry.applicable === true) return { state: 'applicable', inactive: false, lines: lines };
        var warnings = (out.warnings || []).map(function (w) { return String(w.code || ''); });
        if (warnings.indexOf('DISCOUNT_NOT_FOUND') !== -1) return { state: 'missing', inactive: false, lines: lines };
        var refusals = warnings.filter(function (w) { return w.indexOf('DISCOUNT_') === 0; });
        if (refusals.length) return { state: 'exists', inactive: refusals.indexOf('DISCOUNT_CURRENTLY_INACTIVE') !== -1, lines: lines };
        // No word about the code at all. With a kit in the cart, "not
        // applicable" means the code is not there. Without one, nothing is known.
        return lines ? { state: 'missing', inactive: false, lines: lines } : failed;
      })
      .catch(function () {
        clearTimeout(timer);
        return failed;
      });
  }

  /* ---- The record this browser keeps of a signature ---- */

  function readRecord(invite) {
    try {
      var record = JSON.parse(localStorage.getItem(KEY));
      return record && record.invite === invite && record.code ? record : null;
    } catch (e) {
      return null;
    }
  }

  function saveRecord(record) {
    try {
      localStorage.setItem(KEY, JSON.stringify(record));
    } catch (e) {
      /* No storage (a private window, say): the code still arrives by email. */
    }
  }

  /* ---- States ---- */

  var VISIBLE = {
    private: ['state:private'],
    success: ['state:success', 'part:agreement'],
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

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'fixed opacity-0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  // In-app browsers do not all allow the clipboard API, so fall back.
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function showSuccess(record) {
    var shareLink = root.getAttribute('data-share-base') + record.code;
    setText('[data-affiliate-code]', record.code);
    setText('[data-affiliate-link]', shareLink);
    var team = root.querySelector('[data-affiliate-team]');
    if (team) {
      setText('[data-affiliate-team-code]', record.team_code || '');
      team.hidden = !record.team_code;
    }
    all('[data-affiliate-copy]').forEach(function (button) {
      button.onclick = function () {
        var text = button.getAttribute('data-affiliate-copy') === 'link' ? 'https://' + shareLink : record.code;
        copy(text).then(function (ok) {
          if (!ok) return;
          var label = button.querySelector('[data-affiliate-copy-label]');
          if (!label) return;
          if (!label.getAttribute('data-original')) label.setAttribute('data-original', label.textContent);
          label.textContent = button.getAttribute('data-copied');
          setTimeout(function () { label.textContent = label.getAttribute('data-original'); }, COPIED_MS);
        });
      };
    });
    show('success');
  }

  /* ---- Which state ---- */

  var params = new URLSearchParams(window.location.search);
  var invite = String(params.get('i') || '').trim().toUpperCase();
  var linkHandle = String(params.get('h') || '').trim().replace(/^@/, '').toLowerCase();
  if (!HANDLE_RE.test(linkHandle)) linkHandle = '';

  /*
    Preview only. On an unpublished theme, ?show=form, ?show=in or
    ?show=private opens that state without asking Shopify, so every state can
    be looked at without placing an order. The theme editor, which cannot take
    a link, opens the form. The section only sets data-affiliate-show off the
    live theme, so none of this reaches a creator.
  */
  var showMode = root.getAttribute('data-affiliate-show');
  var forced = showMode ? params.get('show') || (showMode === 'editor' ? 'form' : '') : '';
  if (forced === 'private') {
    show('private');
    return;
  }
  if (forced === 'in') {
    showInvitation(linkHandle);
    showSuccess(readRecord(invite) || { code: 'SARA15', team_code: 'TEAMSARA' }); // the brief's own example name
    return;
  }
  if (forced === 'form' && variantId && form) {
    showInvitation(linkHandle);
    show('form');
    startForm();
    return;
  }

  if (!INVITE_RE.test(invite) || !variantId || !form) {
    show('private');
    return;
  }

  showInvitation(linkHandle);
  ask(invite, PROBE_TIMEOUT_MS).then(function (answer) {
    var usable = answer.state === 'applicable';
    // No answer, or the kit could not even be put in the test cart: let the
    // creator through. Checkout is the real gate.
    var unsure = answer.state === 'failed' || (answer.state === 'exists' && !answer.inactive && !answer.lines);
    if (usable || unsure) {
      show('form');
      startForm();
      return;
    }
    var record = readRecord(invite);
    if (record) {
      showSuccess(record);
    } else {
      showInvitation('');
      show('private');
    }
  });

  /* ---- The form ---- */

  function startForm() {
    var el = function (id) { return form.querySelector('#' + id); };
    var codeName = el('affiliate-code-name');
    var coachInput = form.querySelector('[data-affiliate-coach]');
    var handleInput = el('affiliate-instagram');
    var agreedInput = el('affiliate-agreed');
    var signatureInput = el('affiliate-signature');
    var button = form.querySelector('button[type="submit"]');
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

    if (linkHandle) {
      handleInput.value = linkHandle;
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
      setCheck(name, 'checking');
      return Promise.all([ask(name + '15', CHECK_TIMEOUT_MS), ask('TEAM' + name, CHECK_TIMEOUT_MS)]).then(function (answers) {
        if (seq !== checkSeq) return check; // a newer question is out; ignore this answer
        var taken = answers.some(function (a) { return a.state === 'applicable' || a.state === 'exists'; });
        var failed = answers.some(function (a) { return a.state === 'failed'; });
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

    /* The other fields. Each rule returns '' or the message to show. */

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

    function cleanHandle() {
      return handleInput.value.trim().replace(/^@+/, '').toLowerCase();
    }

    handleInput.addEventListener('input', function () {
      if (handleInput.readOnly) return;
      var clean = handleInput.value.replace(/^\s*@+/, '').toLowerCase();
      if (clean !== handleInput.value) handleInput.value = clean;
    });

    var rules = [
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
        var message = rule[1]();
        fieldError(rule[0], message);
        if (message && !first) first = rule[0];
      });
      if (first) first.focus();
      return !first;
    }

    rules.forEach(function (rule) {
      var input = rule[0];
      input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', function () {
        if (input.hasAttribute('aria-invalid')) fieldError(input, '');
      });
    });

    /* Submit: one more name check, then on to checkout. */

    function setBusy(state) {
      busy = state;
      if (!button) return;
      button.disabled = state;
      if (state) {
        button.setAttribute('aria-busy', 'true');
      } else {
        button.removeAttribute('aria-busy');
      }
    }

    function checkoutUrl(name) {
      var enc = encodeURIComponent;
      var parts = [
        'discount=' + enc(invite),
        'attributes[affiliate_code]=' + enc(name + '15')
      ];
      if (coachInput.checked) parts.push('attributes[client_code]=' + enc('TEAM' + name));
      parts.push('attributes[instagram]=' + enc(cleanHandle()));
      parts.push('attributes[signed_by]=' + enc(tidy(signatureInput.value)));
      parts.push('attributes[signed_at]=' + enc(new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')));
      parts.push('attributes[agreement_version]=' + enc(root.getAttribute('data-agreement-version')));
      if (root.getAttribute('data-locale') === 'ar') parts.push('locale=ar');
      return root.getAttribute('data-cart-url') + '/' + variantId + ':1?' + parts.join('&');
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (busy) return;
      if (!validate()) return;
      // A previewed form with no invite in the link has no checkout to open.
      if (!INVITE_RE.test(invite)) return;
      var name = codeName.value;
      setBusy(true);
      // Asked again whatever the last answer was: the name may have gone since.
      runCheck().then(function (result) {
        if (result.name !== name || result.state !== 'available') {
          setBusy(false);
          codeName.focus();
          return;
        }
        saveRecord({ invite: invite, code: name + '15', team_code: coachInput.checked ? 'TEAM' + name : '' });
        // The same tab: in-app browsers do not all open new ones.
        window.location.assign(checkoutUrl(name));
      });
    });

    // Back from checkout with the browser's back button: the page can come
    // back exactly as it was left, with the button still switched off.
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) setBusy(false);
    });
  }
})();
