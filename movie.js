(function () {
  'use strict';
  var API = (window.MOVIEADDA_CONFIG || {}).API_URL || '';
  var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="220"><rect width="100%" height="100%" fill="#0b0f12"/><text x="50%" y="50%" fill="#5d8791" font-size="14" text-anchor="middle" font-family="Arial">No poster</text></svg>');
  var id = new URLSearchParams(location.search).get('id');
  var root = document.getElementById('root');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function poster(src, w, h, alt) {
    var i = new Image(); i.src = src || PLACEHOLDER; i.alt = alt || ''; i.referrerPolicy = 'no-referrer'; i.loading = 'lazy';
    if (w) { i.width = w; i.height = h; }
    i.onerror = function () { this.onerror = null; this.src = PLACEHOLDER; };
    return i;
  }
  function driveId(u) {
    var m = /\/d\/([\w-]+)/.exec(u) || /[?&]id=([\w-]+)/.exec(u);
    return m ? m[1] : null;
  }
  function state(t) { root.textContent = ''; root.appendChild(el('div', 'state', t)); }

  if (!id) { state('Movie ID missing hai.'); return; }
  if (!API || API.indexOf('PASTE_YOUR') === 0) { state('Site abhi configure nahi hui (config.js).'); return; }
  state('Loading…');

  fetch(API).then(function (r) { return r.json(); }).then(function (j) {
    if (!j.ok) throw new Error(j.error);
    var all = j.movies || [];
    var m = all.filter(function (x) { return x.id === id; })[0];
    if (!m) { state('Ye movie nahi mili ya hata di gayi hai.'); return; }
    render(m, all);
  }).catch(function () { state('Load nahi ho saka. Thodi der baad try karein.'); });

  function render(m, all) {
    document.title = m.name + ' - Watch Online on Movie Adda';
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', (m.description || '').substring(0, 155));
    document.getElementById('hdrTitle').textContent = m.name;

    root.textContent = '';
    var box = el('div', 'container');

    // player
    var pv = el('div', 'video-container');
    var did = driveId(m.movieUrl);
    if (did) {
      var f = document.createElement('iframe');
      f.src = 'https://drive.google.com/file/d/' + did + '/preview';
      f.allow = 'autoplay; fullscreen'; f.setAttribute('allowfullscreen', '');
      pv.appendChild(f);
    } else if (/\.(mp4|webm|ogg)(\?|$)/i.test(m.movieUrl)) {
      var v = document.createElement('video'); v.controls = true; v.src = m.movieUrl; v.poster = m.poster; pv.appendChild(v);
    } else {
      var f2 = document.createElement('iframe'); f2.src = m.movieUrl; f2.setAttribute('allowfullscreen', ''); pv.appendChild(f2);
    }
    box.appendChild(pv);

    // details
    var d = el('div', 'details');
    d.appendChild(poster(m.poster, 130, 190, m.name));
    var t = el('div', 'txt');
    t.appendChild(el('h2', '', m.name));
    var tags = el('div', 'tags');
    [m.category, m.quality, m.language, m.year, m.genre].filter(Boolean).forEach(function (x) { tags.appendChild(el('span', '', x)); });
    t.appendChild(tags);
    t.appendChild(el('p', 'desc', m.description));
    d.appendChild(t);
    box.appendChild(d);

    // download
    var dl = m.downloadUrl || (did ? 'https://drive.usercontent.google.com/download?id=' + did + '&export=download&authuser=0' : '');
    if (dl) {
      var b = el('div', 'buttons'); var a = el('a', 'btn-download', '⬇ Download'); a.href = dl; a.target = '_blank'; a.rel = 'noopener';
      b.appendChild(a); box.appendChild(b);
    }
    root.appendChild(box);

    // watch next
    var next = all.filter(function (x) { return x.id !== m.id; }).slice(0, 12);
    if (next.length) {
      var h = el('h3', 'wn', 'Watch Next'); root.appendChild(h);
      var w = el('div', 'watch');
      next.forEach(function (x) {
        var a2 = document.createElement('a'); a2.href = 'movie.html?id=' + encodeURIComponent(x.id); a2.title = x.name;
        a2.appendChild(poster(x.poster, 120, 176, x.name)); w.appendChild(a2);
      });
      root.appendChild(w);
    }
  }
})();
