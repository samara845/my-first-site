(function () {
  'use strict';
  var API = (window.MOVIEADDA_CONFIG || {}).API_URL || '';
  var pw = sessionStorage.getItem('ma_admin_pw') || '';
  var movies = [];
  var editingId = null;
  var existingPoster = '';

  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.classList.toggle('hide', !on); }
  function msg(el, text, type) {
    el.className = 'msg' + (text ? ' ' + type : '');
    el.textContent = text || '';
  }

  /* ---------- API (POST as text/plain => no CORS preflight) ---------- */
  function api(action, data) {
    if (!API || API.indexOf('PASTE_YOUR') === 0) {
      return Promise.reject(new Error('config.js me API_URL set nahi hai (ya site par purani config.js upload hai).'));
    }
    if (!/\/exec$/.test(API)) {
      return Promise.reject(new Error('API_URL "/exec" par khatam hona chahiye. Abhi: ' + API));
    }
    var body = JSON.stringify(Object.assign({ action: action, password: pw }, data || {}));
    return fetch(API, { method: 'POST', body: body })
      .catch(function () {
        throw new Error('Server tak request nahi pahunchi. Deploy me "Who has access" = Anyone rakho, aur URL /exec wala ho.');
      })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) {
          throw new Error('Server ne JSON nahi diya. Deployment access "Anyone" karke New version deploy karo. (Response: ' + t.replace(/<[^>]*>/g, ' ').trim().substring(0, 80) + ')');
        }
        if (!j.ok) throw new Error(j.error || 'Error');
        return j;
      });
  }

  /* ---------- login ---------- */
  function enter() { show($('loginView'), false); show($('appView'), true); loadList(); }
  function login() {
    pw = $('pw').value.trim();
    $('loginBtn').disabled = true;
    msg($('loginMsg'), '');
    api('login').then(function (j) {
      sessionStorage.setItem('ma_admin_pw', pw);
      show($('defaultWarn'), !!j.usingDefault);
      enter();
    }).catch(function (e) { msg($('loginMsg'), e.message, 'err'); })
      .then(function () { $('loginBtn').disabled = false; });
  }
  $('loginBtn').onclick = login;
  $('pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
  $('logoutBtn').onclick = function () { sessionStorage.removeItem('ma_admin_pw'); location.reload(); };
  if (pw) { api('login').then(function (j) { show($('defaultWarn'), !!j.usingDefault); enter(); }).catch(function () { sessionStorage.removeItem('ma_admin_pw'); pw = ''; }); }

  /* ---------- tabs ---------- */
  function tab(name) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === name); });
    show($('movieForm'), name === 'add');
    show($('listCard'), name === 'list');
    show($('passCard'), name === 'pass');
  }
  document.querySelectorAll('.tab').forEach(function (t) { t.onclick = function () { tab(t.dataset.tab); }; });

  /* ---------- change password ---------- */
  $('passCard').addEventListener('submit', function (ev) {
    ev.preventDefault();
    msg($('passMsg'), '');
    var cur = $('curPw').value.trim(), n1 = $('newPw').value.trim(), n2 = $('newPw2').value.trim();
    if (cur !== pw) { msg($('passMsg'), 'Purana password galat hai.', 'err'); return; }
    if (n1 !== n2) { msg($('passMsg'), 'Dono naye password match nahi karte.', 'err'); return; }
    if (n1.length < 6) { msg($('passMsg'), 'Password kam se kam 6 character ka ho.', 'err'); return; }
    $('passBtn').disabled = true;
    api('change_password', { newPassword: n1 }).then(function () {
      pw = n1; sessionStorage.setItem('ma_admin_pw', pw);
      $('passCard').reset(); show($('defaultWarn'), false);
      msg($('passMsg'), '✅ Password badal gaya. Ab naye password se login hoga.', 'ok');
    }).catch(function (e) { msg($('passMsg'), '❌ ' + e.message, 'err'); })
      .then(function () { $('passBtn').disabled = false; });
  });

  /* ---------- poster preview + compression ---------- */
  function setPreview(src) {
    var box = $('posterPrev');
    box.textContent = '';
    if (!src) { box.innerHTML = 'Poster<br>preview'; return; }
    var img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = src;
    img.onerror = function () { box.textContent = 'Preview nahi dikha'; };
    box.appendChild(img);
  }
  $('posterFile').onchange = function () {
    var f = this.files[0];
    if (f) { setPreview(URL.createObjectURL(f)); $('posterUrl').value = ''; }
  };
  $('posterUrl').oninput = function () { if (this.value) { $('posterFile').value = ''; setPreview(this.value); } };

  function compress(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, maxW / img.width);
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          var fr = new FileReader();
          fr.onload = function () {
            resolve({ name: file.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', data: fr.result.split(',')[1] });
          };
          fr.readAsDataURL(b);
        }, 'image/jpeg', quality);
      };
      img.onerror = function () { reject(new Error('Image padhi nahi ja saki.')); };
      img.src = url;
    });
  }

  /* ---------- save (add / update) ---------- */
  function resetForm() {
    $('movieForm').reset();
    editingId = null; existingPoster = '';
    setPreview('');
    $('formTitle').textContent = 'Nayi Movie Add Karein';
    $('saveBtn').textContent = 'Movie Publish Karein';
    show($('cancelEdit'), false);
  }
  $('cancelEdit').onclick = function () { resetForm(); msg($('formMsg'), ''); };

  $('movieForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    msg($('formMsg'), '');
    var file = $('posterFile').files[0];
    var urlVal = $('posterUrl').value.trim();
    if (!file && !urlVal && !existingPoster) { msg($('formMsg'), 'Poster zaroori hai.', 'err'); return; }

    var data = {
      name: $('name').value, category: $('category').value, status: $('status').value,
      genre: $('genre').value, year: $('year').value, language: $('language').value,
      description: $('description').value, movieUrl: $('movieUrl').value,
      downloadUrl: $('downloadUrl').value,
      poster: urlVal || existingPoster
    };
    var btn = $('saveBtn'); btn.disabled = true;
    btn.textContent = 'Save ho raha hai…';

    var prep = file ? compress(file, 600, 0.82).then(function (pf) { data.posterFile = pf; }) : Promise.resolve();
    prep.then(function () {
      if (editingId) data.id = editingId;
      return api(editingId ? 'update' : 'add', data);
    }).then(function () {
      msg($('formMsg'), editingId ? '✅ Movie update ho gayi — site par live hai.' : '✅ Movie add ho gayi — site par live hai!', 'ok');
      resetForm();
      return loadList();
    }).catch(function (e) { msg($('formMsg'), '❌ ' + e.message, 'err'); })
      .then(function () {
        btn.disabled = false;
        btn.textContent = editingId ? 'Update Karein' : 'Movie Publish Karein';
      });
  });

  /* ---------- list ---------- */
  function loadList() {
    return api('list_all').then(function (j) { movies = j.movies || []; renderList(); })
      .catch(function (e) { $('list').innerHTML = ''; var d = document.createElement('div'); d.className = 'empty'; d.textContent = e.message; $('list').appendChild(d); });
  }
  $('filter').oninput = renderList;

  function renderList() {
    $('count').textContent = movies.length;
    var q = $('filter').value.toLowerCase();
    var box = $('list'); box.innerHTML = '';
    var rows = movies.filter(function (m) { return m.name.toLowerCase().indexOf(q) > -1; });
    if (!rows.length) { var d = document.createElement('div'); d.className = 'empty'; d.textContent = 'Koi movie nahi mili.'; box.appendChild(d); return; }
    rows.forEach(function (m) {
      var it = document.createElement('div'); it.className = 'item';
      var img = new Image(); img.src = m.poster; img.referrerPolicy = 'no-referrer'; img.alt = '';
      var info = document.createElement('div'); info.className = 'info';
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = m.name;
      var meta = document.createElement('div'); meta.className = 'meta';
      var b1 = document.createElement('span'); b1.className = 'badge'; b1.textContent = m.category;
      meta.appendChild(b1);
      if (m.status === 'hidden') { var b2 = document.createElement('span'); b2.className = 'badge hid'; b2.textContent = 'Hidden'; meta.appendChild(b2); }
      meta.appendChild(document.createTextNode([m.year, m.language].filter(Boolean).join(' • ')));
      info.appendChild(nm); info.appendChild(meta);

      var btns = document.createElement('div'); btns.className = 'btns';
      btns.appendChild(mkBtn('View', 'ghost', function () { window.open('movie.html?id=' + encodeURIComponent(m.id), '_blank'); }));
      btns.appendChild(mkBtn('Edit', 'ghost', function () { startEdit(m); }));
      btns.appendChild(mkBtn(m.status === 'hidden' ? 'Show' : 'Hide', 'ghost', function () { toggle(m); }));
      btns.appendChild(mkBtn('Delete', 'danger', function () { del(m); }));
      it.appendChild(img); it.appendChild(info); it.appendChild(btns);
      box.appendChild(it);
    });
  }
  function mkBtn(t, cls, fn) { var b = document.createElement('button'); b.className = 'btn sm ' + cls; b.textContent = t; b.onclick = fn; return b; }

  function startEdit(m) {
    tab('add');
    editingId = m.id; existingPoster = m.poster;
    ['name', 'category', 'status', 'genre', 'year', 'language', 'description', 'movieUrl', 'downloadUrl'].forEach(function (k) { $(k).value = m[k] || ''; });
    $('posterFile').value = ''; $('posterUrl').value = '';
    setPreview(m.poster);
    $('formTitle').textContent = 'Edit: ' + m.name;
    $('saveBtn').textContent = 'Update Karein';
    show($('cancelEdit'), true);
    msg($('formMsg'), 'Poster badalna ho to nayi image upload karein, warna purana rahega.', 'ok');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function toggle(m) {
    var data = Object.assign({}, m, { status: m.status === 'hidden' ? 'published' : 'hidden' });
    api('update', data).then(loadList).catch(function (e) { alert(e.message); });
  }
  function del(m) {
    if (!confirm('"' + m.name + '" permanently delete karein?')) return;
    api('delete', { id: m.id }).then(loadList).catch(function (e) { alert(e.message); });
  }
})();
