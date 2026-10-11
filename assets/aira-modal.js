(function () {
  'use strict';

  // The one modal behaviour in the theme. Any element carrying [data-modal]
  // with an id gets open/close, a focus trap, Escape, backdrop dismissal and a
  // scroll lock — so a section only owns *when* its dialog opens, never the
  // plumbing. Extracted from sections/newsletter-popup.liquid when the offer
  // popup needed the same shell (CLAUDE.md hard rules 1 and 4).
  //
  // Contract, all set in snippets/modal-dialog.liquid:
  //   [data-modal][id]        the fixed backdrop; hidden <-> flex is the toggle
  //   [data-modal-card]       the panel; the focus trap scopes to this
  //   [data-modal-close]      any number of dismiss buttons
  //   [data-modal-autofocus]  optional; what takes focus on open
  //   [data-modal-handle]     optional; the bottom sheet's drag handle, a
  //                           downward drag past DRAG_CLOSE px closes
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

  var DRAG_CLOSE = 80;

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
    // offer popup shows one step at a time and hides its close button for a
    // moment. Those elements match FOCUSABLE but cannot take focus, so a raw
    // query puts an unfocusable node at the boundary and the trap silently
    // stops holding.
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
      // Read by critical.source.css to park Shopify's hCaptcha badge while a
      // dialog is up: it sits bottom-right on top of a bottom sheet's button.
      document.body.classList.add('aira-modal-open');
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
      document.body.classList.remove('aira-modal-open');
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

    // Bottom sheet: dragging the handle down closes, the way phone sheets
    // dismiss. Pointer Events cover touch and mouse in one path.
    var handle = card.querySelector('[data-modal-handle]');
    if (handle) {
      var dragFrom = null;
      handle.addEventListener('pointerdown', function (e) {
        dragFrom = e.clientY;
        if (handle.setPointerCapture) { handle.setPointerCapture(e.pointerId); }
      });
      handle.addEventListener('pointermove', function (e) {
        if (dragFrom === null) return;
        if (e.clientY - dragFrom > DRAG_CLOSE) {
          dragFrom = null;
          self.close();
        }
      });
      handle.addEventListener('pointerup', function () { dragFrom = null; });
      handle.addEventListener('pointercancel', function () { dragFrom = null; });
    }

    return self;
  }

  function register(modal) {
    if (!modal || !modal.id) return null;
    var held = registry[modal.id];
    if (held && (held.modal === modal || document.contains(held.modal))) return held;
    // Same id on a new element: the theme editor re-rendered a section and
    // dropped the dialog this entry points at. Let go of it properly — left
    // open, it keeps the body scroll-locked and isAnyOpen() answering true.
    if (held) {
      held.close();
      delete registry[modal.id];
    }
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
    // The other overlays predate this file and each shows "open" its own way:
    // cart-drawer and ugc-gallery lock the body with the inline style,
    // how-it-works-hero uses .video-modal-open, custom-reviews uses
    // .lightbox-open, the header's mobile menu toggles .menu-open, and the
    // Judge.me write-review modal is app markup that is simply displayed.
    // Read every signal so a timed popup never surfaces on top of one.
    isAnyOpen: function () {
      if (openId) return true;
      if (document.body.style.overflow === 'hidden') return true;
      if (document.body.classList.contains('video-modal-open')
        || document.body.classList.contains('lightbox-open')) return true;
      if (document.querySelector('[data-cart-drawer].cart-drawer-open')) return true;
      if (document.querySelector('[data-mobile-menu].menu-open')) return true;
      var jdgm = document.querySelector('.jdgm-write-review-modal, .jdgm-review-widget-modal');
      return !!(jdgm && jdgm.offsetParent !== null);
    }
  };
})();
