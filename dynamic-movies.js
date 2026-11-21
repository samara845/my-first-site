/* Movie Adda – admin panel se upload hui movies ko site par dikhata hai.
   Ek hi file har page par kaam karti hai:
   - #dynSlider           : home page ka auto-scroll slider
   - #new-movies          : home page "Latest Added" (category tabs ke saath)
   - #dyn-list[data-category] : Movies / Web Series / Hollywood page ki list
   - search box (items) me nayi movies apne-aap judti hain                    */
(function () {
  'use strict';
  var CFG = window.MOVIEADDA_CONFIG;
  var API = (CFG || {}).API_URL || '';

  /* ---- Debug: page ke URL me ?debug=1 lagao (jaise index.html?debug=1) ---- */
  var DEBUG = /[?&]debug=1/.test(location.search), dbgBox = null;
  function dbg(line) {
    if (!DEBUG) return;
    if (!dbgBox) {
      dbgBox = document.createElement('pre');
      dbgBox.style.cssText = 'position:fixed;left:8px;bottom:8px;right:8px;max-height:45vh;overflow:auto;z-index:99999;background:#000;color:#0f0;border:2px solid aqua;border-radius:8px;padding:10px;font:12px/1.5 monospace;white-space:pre-wrap;margin:0';
      document.body.appendChild(dbgBox);
      dbg('MOVIE ADDA DEBUG');
    }
    dbgBox.textContent += line + '\n';
  }
  dbg('dynamic-movies.js: loaded OK');
  dbg('config.js: ' + (CFG ? 'loaded OK' : 'NOT LOADED (config.js upload nahi hui / galat jagah hai)'));
  dbg('API_URL: ' + (API ? API.substring(0, 60) + (API.length > 60 ? '...' : '') : '(khali)'));
  if (!API || API.indexOf('PASTE_YOUR') === 0) { dbg('PROBLEM: config.js me asli /exec URL nahi hai'); return; }
  if (!/\/exec$/.test(API)) dbg('PROBLEM: URL /exec par khatam nahi hota');
  dbg('slider box: ' + (document.getElementById('dynSlider') ? 'mila' : 'NAHI mila (index.html purani hai)') +
      ' | latest box: ' + (document.getElementById('new-movies') ? 'mila' : 'NAHI mila') +
      ' | category box: ' + (document.querySelector('.dyn-list') ? 'mila' : 'NAHI mila'));
  var KEY = 'ma_movies_cache';
  var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="220"><rect width="100%" height="100%" fill="#0b0f12"/><text x="50%" y="50%" fill="#5d8791" font-size="14" text-anchor="middle" font-family="Arial">No poster</text></svg>');
  var movies = [], current = 'All';

  function $(id) { return document.getElementById(id); }
  function link(m) { return 'movie.html?id=' + encodeURIComponent(m.id); }
  function poster(m) {
    var i = new Image(); i.src = m.poster; i.alt = m.name; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer';
    i.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    return i;
  }
  function card(m) {
    var a = document.createElement('a'); a.href = link(m); a.title = m.name;
    a.appendChild(poster(m)); return a;
  }

  function addToSearch() {
    if (typeof items === 'undefined') return;
    movies.forEach(function (m) { items[m.name] = link(m); });
  }

  /* home: EK hi slider  = admin se nayi movies (pehle) + purane slider ki movies (baad me) */
  var staticSlides = null;
  function collectStatic() {            // purane (hand-made) slider ki slides, duplicate hata kar
    if (staticSlides) return staticSlides;
    staticSlides = [];
    var seen = {};
    var as = document.querySelectorAll('.slider .slide-track a');
    Array.prototype.forEach.call(as, function (a) {
      var img = a.querySelector('img');
      if (!img) return;
      var src = img.getAttribute('src') || '', href = a.getAttribute('href') || '#';
      var key = href + '|' + src;
      if (seen[key]) return;
      seen[key] = 1;
      staticSlides.push({ href: href, src: src, name: img.getAttribute('alt') || '' });
    });
    return staticSlides;
  }
  function slideEl(s) {
    var a = document.createElement('a'); a.href = s.href; a.title = s.name;
    var i = new Image(); i.src = s.src; i.alt = s.name; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer';
    i.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    a.appendChild(i); return a;
  }
  function renderSlider() {
    var box = $('dynSlider'), track = $('dynTrack');
    if (!box || !track) return;
    var original = document.querySelector('.slider');
    var fresh = movies.slice(0, 15).map(function (m) { return { href: link(m), src: m.poster, name: m.name }; });
    if (!fresh.length) {                 // koi nayi movie nahi => purana slider hi chalne do
      box.style.display = 'none';
      if (original) original.style.display = '';
      return;
    }
    var list = fresh.concat(collectStatic());
    var itemW = (window.innerWidth <= 600 ? 170 : 250) + 20;
    var half = list.slice();
    while (half.length * itemW < window.innerWidth * 1.2) half = half.concat(list);   // seamless loop ke liye
    track.textContent = '';
    half.concat(half).forEach(function (s) { track.appendChild(slideEl(s)); });
    track.style.animationDuration = Math.max(12, Math.round(half.length * itemW / 60)) + 's';  // ~60px/sec
    box.style.display = 'block';
    if (original) original.style.display = 'none';
  }

  /* home: Latest Added with tabs */
  function renderLatest() {
    var sec = $('new-movies'), grid = $('dynGrid'), tabs = $('dynTabs');
    if (!sec || !grid || !tabs) return;
    if (!movies.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    var cats = ['All'];
    movies.forEach(function (m) { if (m.category && cats.indexOf(m.category) < 0) cats.push(m.category); });
    if (cats.indexOf(current) < 0) current = 'All';
    tabs.textContent = '';
    cats.forEach(function (c) {
      var b = document.createElement('button'); b.textContent = c; b.className = c === current ? 'on' : '';
      b.onclick = function () { current = c; renderLatest(); };
      tabs.appendChild(b);
    });
    grid.textContent = '';
    movies.filter(function (m) { return current === 'All' || m.category === current; })
          .forEach(function (m) { grid.appendChild(card(m)); });
  }

  /* Movies / Web Series / Hollywood pages */
  function renderCategoryLists() {
    var boxes = document.querySelectorAll('.dyn-list[data-category]');
    Array.prototype.forEach.call(boxes, function (box) {
      var cat = box.getAttribute('data-category');
      var wrap = box.querySelector('.dyn-wrap');
      var rows = movies.filter(function (m) { return m.category === cat; });
      if (!wrap || !rows.length) { box.style.display = 'none'; return; }
      wrap.textContent = '';
      rows.forEach(function (m) { wrap.appendChild(card(m)); });
      box.style.display = 'block';
    });
  }

  function apply(list) {
    movies = list || [];
    addToSearch(); renderSlider(); renderLatest(); renderCategoryLists();
  }

  // 1) cache se turant dikhao  2) fresh data aate hi update
  try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.length) apply(c); } catch (e) {}
  fetch(API, { cache: 'no-store' }).then(function (r) {
    dbg('server response: HTTP ' + r.status);
    return r.text();
  }).then(function (t) {
    var j;
    try { j = JSON.parse(t); } catch (e) {
      dbg('PROBLEM: server ne JSON nahi diya -> Deploy me "Who has access" = Anyone karo, New version deploy karo.');
      dbg('response: ' + t.replace(/<[^>]*>/g, ' ').trim().substring(0, 100));
      return;
    }
    if (!j.ok) { dbg('PROBLEM: server error: ' + j.error); return; }
    dbg('movies mili: ' + (j.movies || []).length + (j.movies && j.movies.length ? '' : '  (Sheet me koi Published movie nahi hai)'));
    apply(j.movies);
    try { localStorage.setItem(KEY, JSON.stringify(j.movies)); } catch (e) {}
  }).catch(function (e) {
    dbg('PROBLEM: request fail hui (' + e.message + '). URL galat hai ya "Anyone" access nahi hai.');
  });
})();