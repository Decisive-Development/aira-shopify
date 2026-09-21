/*
  Product gallery: the swipeable media frame on both product pages
  (snippets/product-gallery.liquid).

  The frame is a native scroll-snap track, so a thumb swipe needs no script.
  This file only keeps the thumbnail row in step with the frame, scrolls the
  frame to a tapped thumbnail, and fetches the images either side of the one
  in view a moment before they can be swiped to. Each browser starts a lazy
  image's request at a distance of its own choosing (Chrome a few hundred
  pixels on a fast connection, less on a slow one), so promoting the
  neighbour to eager is what makes the next swipe land on a loaded image
  every time. The warm-up waits for the first image so it never competes
  with the page's LCP.

  Videos in the track play and pause through assets/lazy-video.js, which
  already treats an item scrolled out of the frame as out of view.

  Loaded with defer from the snippet; re-binds on shopify:section:load for
  the theme editor.
*/
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setup(gallery) {
    if (gallery.dataset.galleryReady) return;
    var track = gallery.querySelector('[data-gallery-track]');
    if (!track) return;
    var items = track.querySelectorAll('[data-gallery-item]');
    if (items.length < 2) return;
    gallery.dataset.galleryReady = '1';

    var thumbs = gallery.querySelectorAll('[data-thumb-btn]');
    var current = 0;
    /* The thumbnail a tap is scrolling to. While set, the scroll handler
       stays quiet so the highlight does not run through every thumbnail
       the smooth scroll passes; any pointer or wheel input hands control
       back to the finger. */
    var pending = -1;

    function setActive(idx) {
      if (idx === current) return;
      current = idx;
      thumbs.forEach(function (btn) {
        var on = parseInt(btn.getAttribute('data-thumb-index'), 10) === idx;
        btn.classList.toggle('border-main', on);
        btn.classList.toggle('border-transparent', !on);
        if (on) {
          btn.setAttribute('aria-current', 'true');
        } else {
          btn.removeAttribute('aria-current');
        }
      });
    }

    function indexInView() {
      var width = track.clientWidth || 1;
      var idx = Math.round(track.scrollLeft / width);
      return Math.max(0, Math.min(items.length - 1, idx));
    }

    var queued = false;
    track.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var idx = indexInView();
        if (pending >= 0) {
          if (idx === pending) pending = -1;
          return;
        }
        setActive(idx);
      });
    }, { passive: true });

    function release() { pending = -1; }
    track.addEventListener('pointerdown', release, { passive: true });
    track.addEventListener('wheel', release, { passive: true });

    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-thumb-index'), 10);
        if (!items[idx]) return;
        pending = idx;
        setActive(idx);
        track.scrollTo({
          left: items[idx].offsetLeft,
          behavior: reduced.matches ? 'auto' : 'smooth'
        });
      });
    });

    /* Warm-up: an item within a frame width of the scrollport gets its lazy
       image promoted to eager, which starts the request at once. The margin
       stops just short of a full frame because the observer counts touching
       edges as intersecting, which would take in the item two frames away. */
    function warm(item) {
      var img = item.querySelector('img[loading="lazy"]');
      if (img) img.loading = 'eager';
    }

    function startWarming() {
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          warm(entry.target);
          io.unobserve(entry.target);
        });
      }, { root: track, rootMargin: '0px 95% 0px 95%' });
      items.forEach(function (item) { io.observe(item); });
    }

    var first = items[0].querySelector('img');
    if (!first || first.complete) {
      startWarming();
    } else {
      var started = false;
      var once = function () {
        if (started) return;
        started = true;
        startWarming();
      };
      first.addEventListener('load', once);
      first.addEventListener('error', once);
    }
  }

  /* [data-gallery] is the wrapper that holds both the track and the
     thumbnail row, so one query finds each gallery on the page. */
  function init(root) {
    (root || document).querySelectorAll('[data-gallery]').forEach(setup);
  }

  /* The theme editor re-renders a section in place: bind its new gallery. */
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();
