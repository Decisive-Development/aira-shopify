/*
  Lazy video: the one autoplay behaviour in the theme.

  snippets/lazy-video.liquid ships each <video data-lazy-video> with a poster,
  preload="none", no autoplay attribute and its <source> URLs in data-src, so
  a page load requests no video bytes. This script promotes data-src to src
  and plays the video once its section is within 200px of the viewport,
  pauses it when it leaves, and honours the data-saver setting (poster only,
  tap to play). If play() is refused (iOS Low Power Mode, an autoplay policy)
  the same tap-to-play fallback arms, so a poster always has a way to play.

  Loaded with defer from layout/theme.liquid. A script that reveals a
  display:none video itself can call window.airaLazyVideo.activate(video);
  the product gallery no longer needs to, since its items sit in a scroll
  track that the observer sees.

  A video rendered with poster_defer carries data-poster instead of poster,
  so its poster is not fetched at parse time. A second observer sets it
  once the video is within 450px of the viewport, ahead of the 200px
  activation margin: measured on a Moto G profile over slow 4G (12 Oct
  2026), posters set at activation were still downloading when the tiles
  came into view, because the video streams start at the same moment. 450px
  is the widest margin that keeps the kit page's UGC row (1325px down on a
  412x823 phone) out of reach at load, so nothing is fetched before a
  scroll. activate() also sets the poster, as a fallback. With no observer
  (data-saver, no IntersectionObserver) the poster is set at bind time,
  since those visitors get the poster and a tap.
  Inside a [data-poster-group] (a horizontal track, where cards off to the
  side only intersect once swiped in) the whole group's posters are set
  together, so a card never slides in as an empty box.

  Strip tiles (video[data-lazy-video="tile"], from lazy-video.liquid's tile
  mode; UGC tiles brief v2, 13 Oct 2026) take their own path. Nothing is
  attached before window load. After it, a tile gets one mp4 as its src
  with preload="metadata" while its track ([data-tile-track]) is within a
  screen of the viewport and the tile is visible in the track or is the
  next card along. At the end of the row the first screenful counts as
  next, because the auto-scroll goes back to the start. A tile plays while
  at least half of it is on screen and pauses below that. Out of range it
  pauses and drops its src, so it stops downloading. The track is the
  observer root for left and right, since its overflow clips anything
  measured against the viewport. A file that errors, a refused play() (Low
  Power Mode, an in-app browser) or Save-Data leaves the poster. Tiles
  have no tap-to-play of their own: a tap on the card
  opens the strip's player, which calls suspendTiles() and resumeTiles() to
  stop every tile while it is open.
  The file is picked when it is attached: the 480p mp4 (data-src) below md,
  and from md up the 720p one (data-src-md) only when the tile's width at
  the screen's pixel ratio is wider than the 480p file (data-src-width), as
  on a 2x laptop. A 1x desktop screen gets 480p too (Tom, 13 Oct 2026).
*/
(function () {
  'use strict';

  var SELECTOR = 'video[data-lazy-video]';
  var saveData = !!(navigator.connection && navigator.connection.saveData === true);
  var inView = [];
  var io = null;
  var posterIo = null;

  function setPoster(video) {
    var poster = video.getAttribute('data-poster');
    if (!poster) return;
    video.setAttribute('poster', poster);
    video.removeAttribute('data-poster');
    if (posterIo) posterIo.unobserve(video);
  }

  function showPoster(video) {
    if (!video.hasAttribute('data-poster')) return;
    var group = video.closest('[data-poster-group]');
    if (!group) { setPoster(video); return; }
    var pending = group.querySelectorAll(SELECTOR + '[data-poster]');
    for (var i = 0; i < pending.length; i++) setPoster(pending[i]);
  }

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
    showPoster(video);
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

  /* ── Strip tiles ── */
  var MD_QUERY = '(min-width: 48rem)'; /* Tailwind md, where the strip cards widen */
  var strips = [];
  var tilesStarted = false;
  var tilesRefused = false;
  var nearIo = null;
  var halfIo = null;

  function wide() {
    return !!(window.matchMedia && window.matchMedia(MD_QUERY).matches);
  }

  /* The UGC player's file: data-src below md, data-src-md from md up. */
  function pickSource(el) {
    return el.getAttribute(wide() ? 'data-src-md' : 'data-src') || '';
  }

  /* A tile's file: 480p, unless the screen is md or wider and the tile needs
     more pixels than the 480p file has (width x pixel ratio). */
  function tileSource(video) {
    var sd = video.getAttribute('data-src') || '';
    var hd = video.getAttribute('data-src-md');
    if (!hd || !wide()) return sd;
    var sdWidth = parseFloat(video.getAttribute('data-src-width')) || 0;
    return video.clientWidth * (window.devicePixelRatio || 1) > sdWidth ? hd : sd;
  }

  function attachTile(t) {
    var src = tileSource(t.video);
    if (!src) { t.failed = true; return; }
    t.video.muted = true;
    t.video.preload = 'metadata';
    t.video.src = src;
    t.attached = true;
  }

  function detachTile(t) {
    t.attached = false;
    t.video.pause();
    t.video.removeAttribute('src');
    t.video.load();
  }

  /* The 450px poster observer has normally set the poster long before a tile
     is half on screen; showPoster() here is the fallback, as in activate(). */
  function playTile(t) {
    showPoster(t.video);
    var p = t.video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        if (!err || err.name !== 'NotAllowedError') return;
        /* Autoplay refused: every tile keeps its poster. */
        tilesRefused = true;
        strips.forEach(updateStrip);
      });
    }
  }

  function updateTile(t) {
    var s = t.strip;
    var want = tilesStarted && s.near && !s.suspended && t.inRange && !t.failed && !tilesRefused;
    if (want && !t.attached) attachTile(t);
    else if (!want && t.attached) detachTile(t);
    if (!t.attached) return;
    if (t.half && !document.hidden) {
      if (t.video.paused) playTile(t);
    } else if (!t.video.paused) {
      t.video.pause();
    }
  }

  function startsInView(s, t) {
    var trackBox = s.track.getBoundingClientRect();
    var left = t.video.getBoundingClientRect().left - trackBox.left + s.track.scrollLeft;
    return left < s.track.clientWidth;
  }

  function updateStrip(s) {
    var last = -1;
    s.tiles.forEach(function (t, i) { if (t.inStrip) last = i; });
    var atEnd = last === s.tiles.length - 1;
    s.tiles.forEach(function (t, i) {
      t.inRange = t.inStrip || (last !== -1 && i === last + 1) || (atEnd && startsInView(s, t));
      updateTile(t);
    });
  }

  function watchStrip(s) {
    nearIo.observe(s.track);
    s.io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var t = entry.target.airaTile;
        if (t) t.inStrip = entry.isIntersecting;
      });
      updateStrip(s);
    }, { root: s.track });
    s.tiles.forEach(function (t) { s.io.observe(t.video); halfIo.observe(t.video); });
  }

  function stripFor(track) {
    for (var i = 0; i < strips.length; i++) {
      if (strips[i].track === track) return strips[i];
    }
    var s = { track: track, tiles: [], near: false, suspended: false, io: null };
    strips.push(s);
    if (tilesStarted) watchStrip(s);
    return s;
  }

  function bindTile(video) {
    if (saveData || !io) { showPoster(video); return; }
    if (posterIo && video.hasAttribute('data-poster')) posterIo.observe(video);
    var s = stripFor(video.closest('[data-tile-track]') || video.parentElement);
    var t = { video: video, strip: s, inStrip: false, inRange: false, half: false, attached: false, failed: false };
    video.airaTile = t;
    s.tiles.push(t);
    /* The file is missing (or will not decode): keep the poster. */
    video.addEventListener('error', function () {
      if (!t.attached) return;
      t.failed = true;
      updateTile(t);
    });
    if (tilesStarted) { s.io.observe(video); halfIo.observe(video); }
  }

  function startTiles() {
    if (tilesStarted || !io) return;
    tilesStarted = true;
    nearIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var s = stripFor(entry.target);
        s.near = entry.isIntersecting;
        updateStrip(s);
      });
    }, { rootMargin: '100% 0px' });
    halfIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var t = entry.target.airaTile;
        if (!t) return;
        t.half = entry.intersectionRatio >= 0.5;
        updateTile(t);
      });
    }, { threshold: [0, 0.5] });
    strips.forEach(watchStrip);
  }

  function setTilesSuspended(root, on) {
    strips.forEach(function (s) {
      if (root && !root.contains(s.track)) return;
      s.suspended = on;
      updateStrip(s);
    });
  }

  function bind(video) {
    if (video.dataset.lazyBound) return;
    video.dataset.lazyBound = '1';
    if (video.getAttribute('data-lazy-video') === 'tile') { bindTile(video); return; }
    if (saveData || !io) { showPoster(video); armTap(video); return; }
    if (posterIo && video.hasAttribute('data-poster')) posterIo.observe(video);
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

    posterIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        showPoster(entry.target);
        posterIo.unobserve(entry.target);
      });
    }, { rootMargin: '450px 0px' });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      document.querySelectorAll(SELECTOR).forEach(pause);
    } else {
      inView.forEach(activate);
    }
    strips.forEach(updateStrip);
  });

  /* The theme editor re-renders a section in place: bind its new videos. */
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });

  window.airaLazyVideo = {
    activate: activate,
    pause: pause,
    pickSource: pickSource,
    suspendTiles: function (root) { setTilesSuspended(root, true); },
    resumeTiles: function (root) { setTilesSuspended(root, false); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }

  /* Strip tiles wait for window load, so they never compete with the page. */
  if (document.readyState === 'complete') {
    startTiles();
  } else {
    window.addEventListener('load', startTiles);
  }
})();
