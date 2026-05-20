(function () {
  'use strict';

  var article = document.querySelector('.policy-prose');
  var tocNodes = document.querySelectorAll('[data-policy-toc]');
  if (!article || !tocNodes.length) return;

  var headings = article.querySelectorAll('h2');
  if (!headings.length) return;

  // Assign stable IDs to each H2 the first time we see it, so anchor
  // links survive the editor stripping them during WYSIWYG edits.
  // Classes used below are plain CSS (see assets/policy-page.css) — the
  // Tailwind build only scans .liquid files, not this JS, so we cannot
  // rely on utility classes injected here.
  var headingMeta = [];
  for (var i = 0; i < headings.length; i++) {
    var h = headings[i];
    var slug = (h.textContent || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);
    var id = h.id || ('section-' + (i + 1) + '-' + slug);
    h.id = id;
    h.setAttribute('tabindex', '-1');
    headingMeta.push({ id: id, text: h.textContent });
  }

  // Render the same TOC into every [data-policy-toc] node (we have one
  // for mobile inside <details>, one for desktop sticky sidebar).
  tocNodes.forEach(function (tocEl) {
    var label = document.createElement('p');
    label.className = 'policy-toc__label';
    label.textContent = 'On this page';
    tocEl.appendChild(label);

    var ol = document.createElement('ol');
    ol.className = 'policy-toc__list';

    headingMeta.forEach(function (meta) {
      var li = document.createElement('li');
      li.className = 'policy-toc__item';
      var a = document.createElement('a');
      a.href = '#' + meta.id;
      a.textContent = meta.text;
      a.className = 'policy-toc__link';
      a.dataset.tocLink = meta.id;
      li.appendChild(a);
      ol.appendChild(li);
    });

    tocEl.appendChild(ol);
  });

  // Delegate click → smooth scroll + close the mobile <details> wrapper.
  // Capture phase so this runs before the global smooth-scroll handler
  // (assets/smooth-scroll.js) — calling preventDefault here makes that
  // handler skip the link, avoiding a double scroll.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[data-toc-link]');
    if (!link) return;
    var target = document.getElementById(link.dataset.tocLink);
    if (!target) return;
    e.preventDefault();
    if (window.lenis) {
      window.lenis.scrollTo(target, { offset: -90 });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    target.focus({ preventScroll: true });
    history.replaceState(null, '', link.getAttribute('href'));
    var details = link.closest('details');
    if (details) details.open = false;
  }, true);

  // Highlight the current section in the TOC as the user scrolls.
  function clearActive() {
    document.querySelectorAll('a[data-toc-link]').forEach(function (l) {
      l.removeAttribute('aria-current');
      l.classList.remove('is-active');
    });
  }

  function setActive(id) {
    document.querySelectorAll('a[data-toc-link="' + id + '"]').forEach(function (l) {
      l.setAttribute('aria-current', 'true');
      l.classList.add('is-active');
    });
  }

  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          clearActive();
          setActive(entry.target.id);
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    headings.forEach(function (h) { obs.observe(h); });
  }
})();
