/*
  Athlete partner signup (sections/athlete-signup.liquid).

  Decides which state the page shows, then on submit:
    1. checks the form,
    2. asks the aira-athletes function to issue the code named in the invite
       link (handle, code and signature only, never a personal detail),
    3. saves the answer in sessionStorage and lets the native contact form
       post, so Shopify emails the details and its bot check can run.

  The success state is keyed on the saved record: Shopify's captcha detour
  returns to the bare page address, with no posted flag and no link.
*/
(function () {
  var root = document.querySelector('[data-athlete-signup]');
  if (!root) return;

  var KEY = 'aira_athlete_signup';
  var HANDLE_RE = /^[a-z0-9._]{1,30}$/;
  var CODE_RE = /^[A-Z0-9]{4,14}$/;
  var SIG_RE = /^[A-Za-z0-9_-]{22}$/;
  var TIMEOUT_MS = 20000;
  var RETRY_AFTER_MS = 15000;

  var form = root.querySelector('#athlete-signup-form');
  var strings = {
    required: root.getAttribute('data-error-required'),
    signature: root.getAttribute('data-error-signature'),
    link: root.getAttribute('data-error-link'),
    taken: root.getAttribute('data-error-taken'),
    server: root.getAttribute('data-error-server')
  };

  function all(selector) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function setText(selector, value) {
    all(selector).forEach(function (el) { el.textContent = value; });
  }

  function readRecord() {
    try {
      var record = JSON.parse(sessionStorage.getItem(KEY));
      return record && record.code ? record : null;
    } catch (e) {
      return null;
    }
  }

  function saveRecord(record) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(record));
    } catch (e) {
      /* No storage: the page falls back to the plain success line. */
    }
  }

  // An invite link is complete only when all three parts have the right shape.
  function linkFrom(source) {
    if (!source) return null;
    var h = String(source.h || '');
    var c = String(source.c || '');
    var k = String(source.k || '');
    return HANDLE_RE.test(h) && CODE_RE.test(c) && SIG_RE.test(k) ? { h: h, c: c, k: k } : null;
  }

  var VISIBLE = {
    private: ['state:private'],
    generic: ['state:generic'],
    success: ['state:success', 'part:agreement'],
    form: ['part:summary', 'part:agreement', 'part:form']
  };

  function show(state) {
    var visible = VISIBLE[state];
    all('[data-athlete-state]').forEach(function (el) {
      el.hidden = visible.indexOf('state:' + el.getAttribute('data-athlete-state')) === -1;
    });
    all('[data-athlete-part]').forEach(function (el) {
      el.hidden = visible.indexOf('part:' + el.getAttribute('data-athlete-part')) === -1;
    });
  }

  function showSuccess(record) {
    setText('[data-athlete-first-name]', record.first_name || '');
    setText('[data-athlete-code]', record.code);
    setText('[data-athlete-link]', root.getAttribute('data-share-base') + record.code);
    setText('[data-athlete-receipt]', record.receipt || '');
    var team = root.querySelector('[data-athlete-team]');
    if (team && record.team_code) {
      setText('[data-athlete-team-code]', record.team_code);
      team.hidden = false;
    }
    show('success');
    var panel = root.querySelector('[data-athlete-state="success"]');
    if (panel) {
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'center' });
    }
  }

  var params = new URLSearchParams(window.location.search);
  var urlLink = linkFrom({ h: params.get('h'), c: params.get('c'), k: params.get('k') });
  var record = readRecord();
  // A record from an earlier invite must not answer for a different link.
  if (record && urlLink && record.c !== urlLink.c) record = null;
  var link = urlLink || linkFrom(record);
  var serverErrors = root.querySelector('[data-athlete-server-errors]');

  if (serverErrors && link && form) {
    show('form');
  } else if (record) {
    showSuccess(record);
    return;
  } else if (link && form) {
    show('form');
  } else if (root.hasAttribute('data-athlete-posted')) {
    show('generic');
    return;
  } else {
    show('private');
    return;
  }

  /* ---- Form state ---- */

  var nameInput = form.querySelector('#athlete-name');
  var signatureInput = form.querySelector('#athlete-signature');
  var handleInput = form.querySelector('#athlete-instagram');
  var coachInput = form.querySelector('[data-athlete-coach]');
  var honeypot = form.querySelector('[data-athlete-honeypot]');
  var button = form.querySelector('button[type="submit"]');
  var formError = form.querySelector('[data-athlete-form-error]');
  var required = Array.prototype.slice.call(form.querySelectorAll('[required]'));
  var busy = false;
  var cleared = false;

  // The script checks the fields itself, with the page's own wording.
  form.noValidate = true;
  handleInput.value = '@' + link.h;
  setText('[data-athlete-code]', link.c);

  function fieldError(input, message) {
    var slot = document.getElementById(input.getAttribute('aria-describedby'));
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

  function tidy(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function validate() {
    var first = null;
    required.forEach(function (input) {
      var empty = input.type === 'checkbox' ? !input.checked : !tidy(input.value);
      var message = '';
      if (empty) {
        message = strings.required;
      } else if (input.type === 'email' && !input.checkValidity()) {
        message = input.validationMessage; // the browser's own wording, in its own language
      }
      fieldError(input, message);
      if (message && !first) first = input;
    });
    var signed = tidy(signatureInput.value);
    if (signed && signed.toLowerCase() !== tidy(nameInput.value).toLowerCase()) {
      fieldError(signatureInput, strings.signature);
      if (!first) first = signatureInput;
    }
    if (first) first.focus();
    return !first;
  }

  required.forEach(function (input) {
    input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', function () {
      if (input.hasAttribute('aria-invalid')) fieldError(input, '');
    });
  });

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

  function showFormError(message) {
    formError.textContent = message || '';
    formError.hidden = !message;
  }

  function setField(name, value) {
    var input = form.elements['contact[' + name + ']'];
    if (input) input.value = value || '';
  }

  function finish(answer) {
    setField('code', answer.code);
    setField('team_code', answer.team_code);
    setField('receipt', answer.receipt);
    setField('accepted_at', answer.accepted_at);
    // Submitted values stay English whatever language the page is in.
    setField('subject', 'Athlete partner signup: @' + link.h + ' (' + answer.code + ') ' + answer.receipt);
    saveRecord({
      code: answer.code,
      team_code: answer.team_code || '',
      receipt: answer.receipt,
      first_name: tidy(nameInput.value).split(' ')[0],
      h: link.h,
      c: link.c,
      k: link.k
    });
    // A real submit, not fetch, so Shopify's bot check can run. The second
    // pass through the handler below is let through untouched.
    cleared = true;
    if (form.requestSubmit) {
      form.requestSubmit();
    } else {
      form.submit();
    }
    // Still here after a while (a captcha was closed, say): give the button
    // back. Pressing it again is a plain submit; the code is already issued.
    setTimeout(function () { setBusy(false); }, RETRY_AFTER_MS);
  }

  form.addEventListener('submit', function (event) {
    if (cleared) return;
    event.preventDefault();
    if (busy) return;
    showFormError('');
    if (!validate()) return;
    if (honeypot && honeypot.value) return;

    setBusy(true);
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, TIMEOUT_MS);

    fetch(root.getAttribute('data-function-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        h: link.h,
        c: link.c,
        k: link.k,
        coach: Boolean(coachInput && coachInput.checked),
        agreement_version: root.getAttribute('data-agreement-version')
      }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (out) {
        clearTimeout(timer);
        if (out.status === 200 && out.body && out.body.code) {
          finish(out.body);
          return;
        }
        setBusy(false);
        showFormError(out.status === 403 ? strings.link : out.status === 409 ? strings.taken : strings.server);
      })
      .catch(function () {
        clearTimeout(timer);
        setBusy(false);
        showFormError(strings.server);
      });
  });
})();
