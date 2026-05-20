/*
  Lenis smooth-scroll — desktop only.

  Gated to ≥1024px viewports with a fine pointer (mouse/trackpad), and
  disabled entirely under prefers-reduced-motion. Touch devices keep
  native scrolling. Re-evaluates on viewport / preference changes.

  Exposes the active instance as window.lenis so other scripts (e.g.
  assets/policy-page.js) can route anchor jumps through it instead of
  fighting it with native scrollIntoView.

  Requires assets/lenis.min.js to have loaded first (provides `Lenis`).
*/
(function () {
  'use strict';

  if (typeof Lenis === 'undefined') return;

  var desktop = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  var lenis = null;
  var rafId = null;

  function raf(time) {
    if (!lenis) return;
    lenis.raf(time);
    rafId = requestAnimationFrame(raf);
  }

  function start() {
    if (lenis) return;
    lenis = new Lenis({
      /* lerp: lower = heavier, slower glide. 0.1 is the Lenis default;
         0.08 gives the slow, weighty feel of the lenis.dev showcase. */
      lerp: 0.08,
      wheelMultiplier: 0.9,
      smoothWheel: true
    });
    window.lenis = lenis;
    rafId = requestAnimationFrame(raf);
  }

  function stop() {
    if (!lenis) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    lenis.destroy();
    lenis = null;
    window.lenis = null;
  }

  function sync() {
    if (desktop.matches && !reduced.matches) start();
    else stop();
  }

  /* In-page anchor links: route through Lenis so they ease instead of
     jumping (and stay in sync with Lenis's scroll position). Only acts
     while Lenis is live — native anchor behaviour is left alone on
     touch / reduced-motion. Skips links a more specific handler has
     already claimed via preventDefault (e.g. the policy-page TOC). */
  document.addEventListener('click', function (e) {
    if (!lenis || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest ? e.target.closest('a[href]') : null;
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#' || href.length < 2) return;
    var target;
    try { target = document.querySelector(href); } catch (err) { return; }
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -90 }); /* clears the fixed header */
    history.replaceState(null, '', href);
  });

  sync();

  function onChange() { sync(); }
  if (desktop.addEventListener) {
    desktop.addEventListener('change', onChange);
    reduced.addEventListener('change', onChange);
  } else if (desktop.addListener) {
    /* Safari < 14 */
    desktop.addListener(onChange);
    reduced.addListener(onChange);
  }
})();
