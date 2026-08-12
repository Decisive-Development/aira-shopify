(function () {
  'use strict';

  // The one modal behaviour in the theme. Any element carrying [data-modal]
  // with an id gets open/close, a focus trap, Escape, backdrop dismissal and a
  // scroll lock — so a section only owns *when* its dialog opens, never the
  // plumbing. Extracted from sections/newsletter-popup.liquid when the scratch
  // offer popup needed the same shell (CLAUDE.md hard rules 1 and 4).
  //
  // Contract, all set in snippets/modal-dialog.liquid:
  //   [data-modal][id]        the fixed backdrop; hidden <-> flex is the toggle
  //   [data-modal-card]       the panel; the focus trap scopes to this
  //   [data-modal-close]      any number of dismiss buttons
  //   [data-modal-autofocus]  optional; what takes focus on open
  //
  // Events fired on the modal element, so sections can react without reaching
  // in: aira:modal:open and aira:modal:close, both bubbling.
  //
  // Classes toggled here (hidden, flex) already appear in .liquid, so Tailwind
  // emits them — the build only scans .liquid, never this file.

  // input[type=hidden] is excluded deliberately: Shopify's {% form %} injects
  // three of them (form_type, utf8, contact[tags]), they match a bare
  // input:not([disabled]) and cannot take focus, so leaving them in put an
  // unfocusable node at the end of the ring and the trap stopped holding.
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var registry = {};
  var openId = null;

  function instance(modal) {
    var card = modal.querySelector('[data-modal-card]');
    if (!card) return null;

    var self = {
      modal: modal,
      card: card,
      lastFocus: null,
      isOpen: false
    };

    // A dialog can hold a branch that is temporarily inert or hidden — the
    // scratch popup covers its email form until the foil comes off. Those
    // elements match FOCUSABLE but cannot take focus, so a raw query puts an
    // unfocusable node at the boundary and the trap silently stops holding.
    function reachable(el) {
      return !!el && !el.closest('[inert]') && !el.closest('[hidden]');
    }

    self.tabbable = function () {
      return Array.prototype.filter.call(card.querySelectorAll(FOCUSABLE), reachable);
    };

    self.trapFocus = function (e) {
      if (e.key !== 'Tab') return;
      var items = self.tabbable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    self.focusCard = function () {
      // Explicit target first: on a server-rendered success state there is no
      // field left, and role="status" alone will not announce content that was
      // already in the DOM at load.
      // In order, skipping anything sitting in an inert or hidden branch. The
      // explicit target may carry tabindex="-1" (the success block does), so
      // test reachability rather than membership of the tab order.
      var target = card.querySelector('[data-modal-autofocus]');
      if (!reachable(target)) { target = card.querySelector('input[type="email"]'); }
      if (!reachable(target)) { target = card.querySelector('[data-modal-close]'); }
      if (!reachable(target)) { target = self.tabbable()[0]; }
      if (target && target.focus) { target.focus(); }
    };

    self.open = function () {
      if (self.isOpen) return;
      self.isOpen = true;
      openId = modal.id;
      self.lastFocus = document.activeElement;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', self.trapFocus);
      self.focusCard();
      modal.dispatchEvent(new CustomEvent('aira:modal:open', { bubbles: true }));
    };

    self.close = function () {
      if (!self.isOpen) return;
      self.isOpen = false;
      if (openId === modal.id) { openId = null; }
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', self.trapFocus);
      if (self.lastFocus && self.lastFocus.focus) { self.lastFocus.focus(); }
      modal.dispatchEvent(new CustomEvent('aira:modal:close', { bubbles: true }));
    };

    modal.querySelectorAll('[data-modal-close]').forEach(function (el) {
      el.addEventListener('click', self.close);
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) { self.close(); }
    });

    return self;
  }

  function register(modal) {
    if (!modal || !modal.id || registry[modal.id]) return registry[modal.id] || null;
    var made = instance(modal);
    if (made) { registry[modal.id] = made; }
    return made;
  }

  document.querySelectorAll('[data-modal]').forEach(register);

  // One Escape listener for every dialog, rather than one per section.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (!openId || !registry[openId]) return;
    registry[openId].close();
  });

  // Delegated so a trigger rendered after load still works.
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('[data-modal-open]') : null;
    if (!trigger) return;
    var id = trigger.getAttribute('data-modal-open');
    if (!registry[id]) return;
    e.preventDefault();
    registry[id].open();
  });

  window.airaModal = {
    register: function (el) { return register(el); },
    open: function (id) { if (registry[id]) { registry[id].open(); } },
    close: function (id) { if (registry[id]) { registry[id].close(); } },
    isOpen: function (id) { return !!(registry[id] && registry[id].isOpen); },
    // Four overlays predate this file and each locks the body its own way:
    // cart-drawer and ugc-gallery set the inline style, how-it-works-hero uses
    // .video-modal-open, custom-reviews uses .lightbox-open. Read all three
    // signals so a timed popup never surfaces on top of one of them.
    isAnyOpen: function () {
      if (openId) return true;
      if (document.body.style.overflow === 'hidden') return true;
      return document.body.classList.contains('video-modal-open')
        || document.body.classList.contains('lightbox-open');
    }
  };
})();
