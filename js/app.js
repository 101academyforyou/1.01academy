/* 1.01 Academy — 精簡版
 * 流程：瀏覽課程 → 課程介紹 → 登入 → 購買 → 上課
 * 資料存在瀏覽器 localStorage（示範用），付款為模擬流程。
 */
(function () {
  'use strict';

  /* ---------------- 小工具 ---------------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function money(n) { return 'NT$' + n.toLocaleString('en-US'); }
  function clock(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function totalMinutes(c) { return Math.round(lessonsOf(c).reduce(function (s, l) { return s + l.duration; }, 0) / 60); }
  function lessonsOf(c) { return c.chapters.reduce(function (all, ch) { return all.concat(ch.lessons); }, []); }
  function findCourse(id) { return COURSES.find(function (c) { return c.id === id; }); }
  function go(path) { location.hash = '#' + path; }

  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  function thumb(c) {
    return '<div class="thumb" style="background:linear-gradient(135deg,' + c.thumb[0] + ',' + c.thumb[1] + ')"><span>' + esc(c.thumb[2]) + '</span></div>';
  }

  function priceTag(c) {
    if (!c.price) return '<span class="price free">免費</span>';
    return '<span class="price">' + money(c.price) + '</span>' +
      (c.originalPrice > c.price ? ' <s class="muted small">' + money(c.originalPrice) + '</s>' : '');
  }

  /* ---------------- 資料（localStorage） ---------------- */
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 無痕模式等 */ }
  }

  // 示範用雜湊；正式上線請改由後端處理密碼
  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
    return (h >>> 0).toString(16);
  }

  var users = load('a101_users', {});        // email → { name, pw, courses: [], done: {} }
  var session = load('a101_session', null);  // email

  function me() { return session && users[session] ? users[session] : null; }
  function persist() { save('a101_users', users); save('a101_session', session); }

  function owns(courseId) { var u = me(); return !!(u && u.courses.indexOf(courseId) > -1); }
  function doneList(courseId) { var u = me(); return (u && u.done[courseId]) || []; }
  function progress(c) { return Math.round(doneList(c.id).length / lessonsOf(c).length * 100); }
  function setDone(courseId, lessonId) {
    var u = me(), list = u.done[courseId] = u.done[courseId] || [];
    if (list.indexOf(lessonId) === -1) { list.push(lessonId); persist(); }
  }
  function enroll(courseId) {
    var u = me();
    if (u.courses.indexOf(courseId) === -1) { u.courses.push(courseId); persist(); }
  }

  /* ---------------- 頁首 ---------------- */
  function renderHeader() {
    var u = me();
    document.getElementById('header').innerHTML =
      '<div class="container nav">' +
      '<a href="#/" class="logo"><span class="logo-mark">1.01</span>1.01 Academy</a>' +
      '<nav>' +
      '<a href="#/">所有課程</a>' +
      (u ? '<a href="#/my">我的課程</a><button class="link" id="logout">登出</button>'
         : '<a href="#/login" class="btn btn-sm">登入 / 註冊</a>') +
      '<button class="icon-btn" id="theme" aria-label="切換深淺色"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>' +
      '</nav></div>';
    var lo = document.getElementById('logout');
    if (lo) lo.onclick = function () { session = null; persist(); toast('已登出'); go('/'); render(); };
    document.getElementById('theme').onclick = function () {
      var now = document.documentElement.getAttribute('data-theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = now === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      save('a101_theme', next);
    };
  }

  /* ---------------- 頁面 ---------------- */
  var pages = {};

  // 首頁：課程列表 + 分類 + 搜尋
  pages.home = function (app) {
    var cat = '全部', q = '';
    app.innerHTML =
      '<section class="hero"><div class="container">' +
      '<h1>每天進步 <span class="grad">1%</span>，一年後強大 <span class="grad">37 倍</span></h1>' +
      '<p class="muted">業界講師親自授課，一次購買、永久觀看。</p>' +
      '<input class="input search" id="q" placeholder="搜尋課程…" aria-label="搜尋課程" />' +
      '</div></section>' +
      '<section class="container"><div class="chips" id="chips">' +
      CATEGORIES.map(function (c) { return '<button class="chip" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') +
      '</div><div class="grid" id="list"></div></section>';

    function draw() {
      app.querySelectorAll('[data-cat]').forEach(function (b) { b.classList.toggle('active', b.dataset.cat === cat); });
      var list = COURSES.filter(function (c) {
        return (cat === '全部' || c.category === cat) &&
          (!q || (c.title + c.subtitle + c.instructor).toLowerCase().indexOf(q) > -1);
      });
      app.querySelector('#list').innerHTML = list.length ? list.map(function (c) {
        return '<a class="card course" href="#/course/' + c.id + '">' + thumb(c) +
          '<div class="pad"><span class="tag">' + esc(c.category) + ' · ' + esc(c.level) + '</span>' +
          '<h3>' + esc(c.title) + '</h3><p class="muted small">' + esc(c.instructor) + ' · ' + totalMinutes(c) + ' 分鐘</p>' +
          '<div>' + (owns(c.id) ? '<span class="owned">✓ 已擁有</span>' : priceTag(c)) + '</div></div></a>';
      }).join('') : '<p class="muted">找不到符合的課程。</p>';
    }
    app.querySelector('#chips').onclick = function (e) {
      if (e.target.dataset.cat) { cat = e.target.dataset.cat; draw(); }
    };
    app.querySelector('#q').oninput = function (e) { q = e.target.value.trim().toLowerCase(); draw(); };
    draw();
  };

  // 課程介紹頁
  pages.course = function (app, id) {
    var c = findCourse(id);
    if (!c) return notFound(app);
    var mine = owns(c.id);
    var action;
    if (mine) action = '<a class="btn btn-block" href="#/learn/' + c.id + '">' + (progress(c) ? '繼續學習' : '開始上課') + '</a>';
    else if (!c.price) action = '<button class="btn btn-block" id="act">免費加入</button>';
    else action = '<a class="btn btn-block" href="#/buy/' + c.id + '">立即購買</a>';

    app.innerHTML = '<div class="container course-page">' +
      '<div><a href="#/" class="muted small">← 所有課程</a>' +
      '<h1>' + esc(c.title) + '</h1><p class="lead muted">' + esc(c.subtitle) + '</p>' +
      '<p class="muted small">講師 ' + esc(c.instructor) + ' · ' + esc(c.level) + ' · ' + lessonsOf(c).length + ' 個單元 · ' + totalMinutes(c) + ' 分鐘</p>' +
      '<h2>課程介紹</h2><p>' + esc(c.description) + '</p>' +
      '<h2>你將學到</h2><ul class="checks">' + c.outcomes.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' +
      '<h2>課程內容</h2>' + c.chapters.map(function (ch) {
        return '<div class="card chapter"><strong>' + esc(ch.title) + '</strong>' + ch.lessons.map(function (l) {
          return '<div class="lesson"><span>' + esc(l.title) + '</span><span class="muted small">' +
            (l.preview && !mine ? '<button class="link" data-preview="' + l.id + '">免費試看</button> · ' : '') + clock(l.duration) + '</span></div>';
        }).join('') + '</div>';
      }).join('') + '</div>' +
      '<aside class="card buy">' + thumb(c) + '<div class="pad">' +
      (mine ? '<p class="owned">✓ 你已擁有此課程（進度 ' + progress(c) + '%）</p>' : '<p>' + priceTag(c) + '</p>') +
      action + '<p class="muted small center">一次購買，永久觀看</p></div></aside></div>';

    app.onclick = function (e) {
      var pv = e.target.dataset && e.target.dataset.preview;
      if (pv) {
        var l = lessonsOf(c).find(function (x) { return x.id === pv; });
        openModal('<video src="' + esc(l.video) + '" controls autoplay playsinline></video><p class="pad">試看：' + esc(l.title) + '</p>');
      }
      if (e.target.id === 'act') {
        if (!me()) return go('/login?next=/course/' + c.id);
        enroll(c.id); toast('已加入課程！'); go('/learn/' + c.id);
      }
    };
  };

  // 購買頁（模擬付款）
  pages.buy = function (app, id) {
    var c = findCourse(id);
    if (!c) return notFound(app);
    if (!me()) return go('/login?next=/buy/' + c.id);
    if (owns(c.id)) return go('/learn/' + c.id);

    app.innerHTML = '<div class="container narrow"><h1>結帳</h1>' +
      '<div class="card pad row-between">' + '<span>' + esc(c.title) + '</span><strong class="price">' + money(c.price) + '</strong></div>' +
      '<form class="card pad" id="pay" novalidate>' +
      '<label>信用卡號<input class="input" name="card" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="19" required /></label>' +
      '<div class="two"><label>有效期限<input class="input" name="exp" placeholder="MM/YY" maxlength="5" required /></label>' +
      '<label>安全碼<input class="input" name="cvc" inputmode="numeric" placeholder="123" maxlength="4" required /></label></div>' +
      '<button class="btn btn-block">付款 ' + money(c.price) + '</button>' +
      '<p class="muted small center">示範模式，不會實際扣款。可使用 4242 4242 4242 4242。</p></form></div>';

    var f = app.querySelector('#pay');
    f.card.oninput = function () { f.card.value = f.card.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 '); };
    f.exp.oninput = function () { var d = f.exp.value.replace(/\D/g, '').slice(0, 4); f.exp.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; };
    f.onsubmit = function (e) {
      e.preventDefault();
      if (f.card.value.replace(/\s/g, '').length < 16) return toast('請輸入正確的卡號');
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.exp.value)) return toast('有效期限格式為 MM/YY');
      if (!/^\d{3,4}$/.test(f.cvc.value)) return toast('請輸入安全碼');
      var btn = f.querySelector('button');
      btn.disabled = true; btn.textContent = '付款處理中…';
      setTimeout(function () {
        enroll(c.id);
        toast('付款成功，課程已開通！');
        go('/learn/' + c.id);
      }, 1000);
    };
  };

  // 登入 / 註冊（同一頁切換）
  pages.login = function (app, _, query) {
    var next = /^\/[^/]/.test(query.next || '') ? query.next : '/my';
    if (me()) return go(next);
    var mode = 'login';
    function draw() {
      var reg = mode === 'register';
      app.innerHTML = '<div class="container narrow"><h1>' + (reg ? '建立帳號' : '登入') + '</h1>' +
        '<form class="card pad" id="auth" novalidate>' +
        (reg ? '<label>姓名<input class="input" name="name" required /></label>' : '') +
        '<label>Email<input class="input" name="email" type="email" autocomplete="email" required /></label>' +
        '<label>密碼<input class="input" name="pw" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" required /></label>' +
        '<button class="btn btn-block">' + (reg ? '註冊' : '登入') + '</button>' +
        '<p class="center small">' + (reg ? '已經有帳號？' : '還沒有帳號？') + ' <button type="button" class="link" id="switch">' + (reg ? '登入' : '免費註冊') + '</button></p>' +
        '</form></div>';
      var f = app.querySelector('#auth');
      app.querySelector('#switch').onclick = function () { mode = reg ? 'login' : 'register'; draw(); };
      f.onsubmit = function (e) {
        e.preventDefault();
        var email = f.email.value.trim().toLowerCase(), pw = f.pw.value;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Email 格式不正確');
        if (pw.length < 6) return toast('密碼至少 6 個字元');
        if (reg) {
          if (!f.name.value.trim()) return toast('請輸入姓名');
          if (users[email]) return toast('此 Email 已註冊');
          users[email] = { name: f.name.value.trim(), pw: hash(email + pw), courses: [], done: {} };
        } else if (!users[email] || users[email].pw !== hash(email + pw)) {
          return toast('Email 或密碼錯誤');
        }
        session = email; persist();
        toast('歡迎，' + users[email].name + '！');
        go(next);
      };
    }
    draw();
  };

  // 我的課程
  pages.my = function (app) {
    var u = me();
    if (!u) return go('/login?next=/my');
    var list = u.courses.map(findCourse).filter(Boolean);
    app.innerHTML = '<div class="container"><h1>我的課程</h1>' + (list.length
      ? '<div class="grid">' + list.map(function (c) {
          var p = progress(c);
          return '<a class="card course" href="#/learn/' + c.id + '">' + thumb(c) + '<div class="pad"><h3>' + esc(c.title) + '</h3>' +
            '<div class="bar"><i style="width:' + p + '%"></i></div><p class="muted small">已完成 ' + p + '%</p></div></a>';
        }).join('') + '</div>'
      : '<p class="muted">你還沒有任何課程。<a href="#/" class="link">去逛逛 →</a></p>') + '</div>';
  };

  // 上課頁
  pages.learn = function (app, id, query, lessonId) {
    var c = findCourse(id);
    if (!c) return notFound(app);
    if (!me()) return go('/login?next=/learn/' + id);
    if (!owns(c.id)) { toast('請先購買此課程'); return go('/course/' + id); }
    var all = lessonsOf(c);
    var cur = all.find(function (l) { return l.id === lessonId; }) ||
      all.find(function (l) { return doneList(c.id).indexOf(l.id) === -1; }) || all[0];
    var i = all.indexOf(cur);

    app.innerHTML = '<div class="player">' +
      '<div><video src="' + esc(cur.video) + '" controls playsinline id="video"></video>' +
      '<div class="pad"><p class="muted small">單元 ' + (i + 1) + ' / ' + all.length + '</p><h2>' + esc(cur.title) + '</h2>' +
      '<div class="row-between">' +
      (i > 0 ? '<a class="btn btn-ghost" href="#/learn/' + c.id + '/' + all[i - 1].id + '">← 上一單元</a>' : '<span></span>') +
      '<button class="btn" id="done">' + (doneList(c.id).indexOf(cur.id) > -1 ? '✓ 已完成' : '標記完成') + '</button>' +
      (i < all.length - 1 ? '<a class="btn btn-ghost" href="#/learn/' + c.id + '/' + all[i + 1].id + '">下一單元 →</a>' : '<span></span>') +
      '</div></div></div>' +
      '<aside class="side"><div class="pad"><strong>' + esc(c.title) + '</strong><div class="bar"><i style="width:' + progress(c) + '%"></i></div>' +
      '<span class="muted small">進度 ' + progress(c) + '%</span></div>' +
      c.chapters.map(function (ch) {
        return '<div class="side-ch">' + esc(ch.title) + '</div>' + ch.lessons.map(function (l) {
          var d = doneList(c.id).indexOf(l.id) > -1;
          return '<a class="side-l' + (l === cur ? ' active' : '') + '" href="#/learn/' + c.id + '/' + l.id + '">' +
            '<span class="dot' + (d ? ' done' : '') + '">' + (d ? '✓' : '') + '</span>' + esc(l.title) + '<span class="muted small">' + clock(l.duration) + '</span></a>';
        }).join('');
      }).join('') + '</aside></div>';

    function complete() {
      setDone(c.id, cur.id);
      if (progress(c) === 100) toast('🎉 恭喜完成整門課程！');
    }
    app.querySelector('#done').onclick = function () { complete(); pages.learn(app, id, query, cur.id); };
    app.querySelector('#video').onended = function () {
      complete();
      if (i < all.length - 1) go('/learn/' + c.id + '/' + all[i + 1].id);
      else pages.learn(app, id, query, cur.id);
    };
  };

  function notFound(app) {
    app.innerHTML = '<div class="container"><h1>找不到頁面</h1><p><a class="link" href="#/">回到首頁</a></p></div>';
  }

  function openModal(html) {
    var wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = '<div class="modal-box"><button class="modal-x" aria-label="關閉">×</button>' + html + '</div>';
    wrap.onclick = function (e) { if (e.target === wrap || e.target.className === 'modal-x') wrap.remove(); };
    document.body.appendChild(wrap);
  }

  /* ---------------- 路由 ---------------- */
  function render() {
    var hash = location.hash.slice(1) || '/';
    var parts = hash.split('?');
    var query = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0]) query[p[0]] = decodeURIComponent(p[1] || '');
    });
    var seg = parts[0].split('/').filter(Boolean); // e.g. ['learn', 'react', 'l3']

    document.querySelectorAll('.modal').forEach(function (m) { m.remove(); });
    renderHeader();
    var main = document.getElementById('app');
    var app = document.createElement('div'); // 每頁一個新容器，避免事件殘留
    main.innerHTML = '';
    main.appendChild(app);
    window.scrollTo(0, 0);

    var page = pages[seg[0] || 'home'];
    if (page) page(app, seg[1], query, seg[2]);
    else notFound(app);
  }

  window.addEventListener('hashchange', render);
  render();
})();
