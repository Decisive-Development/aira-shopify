/*
  Lazy video: the one autoplay behaviour in the theme.

  snippets/lazy-video.liquid ships each <video data-lazy-video> with a poster,
  preload="none", no autoplay attribute and its <source> URLs in data-src, so
  a page load requests no video bytes. This script promotes data-src to src
  and plays the video once its section is within 200px of the viewport,
  pauses it when it leaves, and honours the data-saver setting (poster only,
  tap to play). If play() is refused (iOS Low Power Mode, an autoplay policy)
  the same tap-to-play fallback arms, so a poster always has a way to play.

  Loaded with defer from layout/theme.liquid. A section script that reveals
  a hidden video itself (the PDP gallery) calls
  window.airaLazyVideo.activate(video).
*/
(function () {
  'use strict';

  var SELECTOR = 'video[data-lazy-video]';
  var saveData = !!(navigator.connection && navigator.connection.saveData === true);
  var inView = [];
  var io = null;

  function hydrate(video) {
    if (video.dataset.lazyLoaded) return;
    video.dataset.lazyLoaded = '1';
    var sources = video.querySelectorAll('source[data-src]');
    for (var i = 0; i < sources.length; i++) {
      sources[i].setAttribute('src', sources[i].getAttribute('data-src'));
      sources[i].removeAttribute('data-src');
    }
    /* The attribute alone is not enough for a node cloned or re-rendered by
       the theme editor; the property is what the autoplay policy reads. */
    video.muted = true;
    video.load();
  }

  function armTap(video) {
    if (video.dataset.lazyTap) return;
    video.dataset.lazyTap = '1';
    video.addEventListener('click', function onTap() {
      video.removeEventListener('click', onTap);
      delete video.dataset.lazyTap;
      activate(video);
    });
  }

  function activate(video) {
    hydrate(video);
    var p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        /* pause() or load() interrupting a pending play() rejects with AbortError;
           only a refused play (NotAllowedError, Low Power Mode) needs a tap. */
        if (err && err.name === 'AbortError') return;
        armTap(video);
      });
    }
  }

  function pause(video) {
    if (video.dataset.lazyLoaded) video.pause();
  }

  function track(video, intersecting) {
    var idx = inView.indexOf(video);
    if (intersecting && idx === -1) inView.push(video);
    if (!intersecting && idx !== -1) inView.splice(idx, 1);
  }

  function bind(video) {
    if (video.dataset.lazyBound) return;
    video.dataset.lazyBound = '1';
    if (saveData || !io) { armTap(video); return; }
    io.observe(video);
  }

  function init(root) {
    var videos = (root || document).querySelectorAll(SELECTOR);
    for (var i = 0; i < videos.length; i++) bind(videos[i]);
  }

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        track(video, entry.isIntersecting);
        if (entry.isIntersecting) activate(video); else pause(video);
      });
    }, { rootMargin: '200px 0px' });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      document.querySelectorAll(SELECTOR).forEach(pause);
    } else {
      inView.forEach(activate);
    }
  });

  /* The theme editor re-renders a section in place: bind its new videos. */
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });

  window.airaLazyVideo = { activate: activate, pause: pause };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();
