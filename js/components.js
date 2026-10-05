/* 共用元件：頁首、頁尾、課程卡片、縮圖、價格 */
window.C = (function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon;

  function go(path) { location.hash = '#' + path; }

  function thumb(c, opts) {
    opts = opts || {};
    var t = c.thumb || { from: '#4f46e5', to: '#06b6d4', mark: '1.01' };
    return '<div class="thumb ' + (opts.lg ? 'thumb-lg' : '') + '" style="background:linear-gradient(135deg,' + esc(t.from) + ',' + esc(t.to) + ')">' +
      (opts.noTag ? '' : (t.tag ? '<span class="tag">' + esc(t.tag) + '</span>' : '')) +
      '<span class="mark">' + esc(t.mark || '') + '</span>' +
      (opts.level ? '<span class="lvl">' + esc(c.level) + '</span>' : '') +
      (opts.extra || '') +
      '</div>';
  }

  function price(c) {
    if (!c.price) return '<span class="price"><span class="free">免費</span></span>';
    return '<span class="price"><span class="now">' + UI.money(c.price) + '</span>' +
      (c.originalPrice > c.price ? '<span class="was">' + UI.money(c.originalPrice) + '</span>' : '') + '</span>';
  }

  function ratingInline(c) {
    var r = Store.rating(c);
    return '<span class="rating"><b>' + r.avg.toFixed(1) + '</b>' + UI.stars(r.avg) + '<span class="subtle">(' + UI.num(r.count) + ')</span></span>';
  }

  function courseCard(c) {
    var ins = Store.instructor(c.instructorId) || {};
    var lessonsN = Store.lessons(c).length;
    var wished = Store.inWishlist(c.id);
    var owned = Store.isEnrolled(c.id);
    return '<article class="course-card fade-in">' +
      '<button class="wish ' + (wished ? 'on' : '') + '" data-wish="' + esc(c.id) + '" aria-label="加入收藏">' + icon('heart', 'icon-sm') + '</button>' +
      '<a href="#/course/' + encodeURIComponent(c.id) + '">' + thumb(c, { level: true }) + '</a>' +
      '<div class="body">' +
      '<a href="#/course/' + encodeURIComponent(c.id) + '"><h3>' + esc(c.title) + '</h3></a>' +
      '<div class="instructor">' + esc(ins.name || '') + '</div>' +
      ratingInline(c) +
      '<div class="meta"><span>' + icon('clock', 'icon-sm') + UI.hours(Store.totalDuration(c)) + '</span><span>' + icon('playCircle', 'icon-sm') + lessonsN + ' 單元</span><span>' + icon('users', 'icon-sm') + UI.num(Store.studentCount(c)) + '</span></div>' +
      '<div class="foot">' + (owned ? '<span class="badge badge-success">' + icon('check', 'icon-sm') + '已擁有</span>' : price(c)) +
      (c.originalPrice > c.price && c.price > 0 && !owned ? '<span class="badge badge-danger">-' + Math.round((1 - c.price / c.originalPrice) * 100) + '%</span>' : '') +
      '</div></div></article>';
  }

  // 綁定收藏按鈕（事件委派）
  function bindWish(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wish]');
      if (!b) return;
      e.preventDefault();
      if (!Store.currentUser()) { UI.toast('請先登入才能收藏課程', 'info'); go('/login?next=' + encodeURIComponent(location.hash.slice(1))); return; }
      var on = Store.toggleWishlist(b.getAttribute('data-wish'));
      b.classList.toggle('on', on);
      UI.toast(on ? '已加入收藏' : '已從收藏移除', on ? 'success' : 'info');
    });
  }

  /* ---------------- Header ---------------- */
  function renderHeader() {
    var u = Store.currentUser();
    var count = Store.cart().length;
    var path = (location.hash.slice(1) || '/').split('?')[0];
    function nav(href, label) {
      var active = href === '/' ? path === '/' : path.indexOf(href) === 0;
      return '<a href="#' + href + '" class="' + (active ? 'active' : '') + '">' + label + '</a>';
    }
    var theme = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    var userArea = u
      ? '<div class="dropdown" id="user-dd"><button class="avatar-btn" aria-label="帳號選單" data-dd><span class="avatar">' + esc(UI.initials(u.name)) + '</span></button>' +
        '<div class="dropdown-menu"><div class="dm-head"><strong>' + esc(u.name) + '</strong><span>' + esc(u.email) + '</span></div>' +
        '<a href="#/my-courses">' + icon('book') + '我的課程</a>' +
        '<a href="#/wishlist">' + icon('heart') + '收藏清單</a>' +
        '<a href="#/orders">' + icon('receipt') + '訂單紀錄</a>' +
        '<a href="#/profile">' + icon('settings') + '帳號設定</a>' +
        (u.role === 'admin' ? '<hr><a href="#/admin">' + icon('grid') + '管理後台</a>' : '') +
        '<hr><button data-logout>' + icon('logout') + '登出</button></div></div>'
      : '<a href="#/login" class="btn btn-ghost btn-sm">登入</a><a href="#/register" class="btn btn-primary btn-sm">免費註冊</a>';

    document.getElementById('site-header').innerHTML =
      '<header class="header"><div class="container">' +
      '<a href="#/" class="logo"><span class="logo-mark">1.01</span><span>1.01 Academy<small>LEARN · BUILD · GROW</small></span></a>' +
      '<nav class="nav">' + nav('/', '首頁') + nav('/courses', '探索課程') + (u ? nav('/my-courses', '我的學習') : '') + '</nav>' +
      '<form class="header-search" data-search><div class="input-group">' + icon('search') + '<input class="input" name="q" placeholder="搜尋課程、技能或講師…" aria-label="搜尋課程" /></div></form>' +
      '<div class="header-actions">' +
      '<button class="icon-btn" data-theme-toggle aria-label="切換深淺色">' + icon(theme === 'dark' ? 'sun' : 'moon') + '</button>' +
      '<a href="#/cart" class="icon-btn" aria-label="購物車">' + icon('cart') + (count ? '<span class="count">' + count + '</span>' : '') + '</a>' +
      userArea +
      '<button class="icon-btn menu-toggle" data-menu aria-label="選單">' + icon('menu') + '</button>' +
      '</div></div></header>' +
      '<div class="mobile-nav" id="mobile-nav">' +
      '<form class="header-search" data-search><div class="input-group">' + icon('search') + '<input class="input" name="q" placeholder="搜尋課程…" aria-label="搜尋課程" /></div></form>' +
      '<a href="#/">' + icon('home') + '首頁</a><a href="#/courses">' + icon('grid') + '探索課程</a>' +
      (u ? '<a href="#/my-courses">' + icon('book') + '我的課程</a><a href="#/wishlist">' + icon('heart') + '收藏清單</a><a href="#/orders">' + icon('receipt') + '訂單紀錄</a><a href="#/profile">' + icon('settings') + '帳號設定</a>' + (u.role === 'admin' ? '<a href="#/admin">' + icon('chart') + '管理後台</a>' : '')
        : '<a href="#/login">' + icon('user') + '登入 / 註冊</a>') +
      '<a href="#/cart">' + icon('cart') + '購物車 (' + count + ')</a>' +
      '</div>';

    var header = document.getElementById('site-header');
    header.querySelectorAll('[data-search]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = f.q.value.trim();
        go('/courses' + (q ? '?q=' + encodeURIComponent(q) : ''));
      });
    });
    var dd = header.querySelector('#user-dd');
    if (dd) {
      dd.querySelector('[data-dd]').addEventListener('click', function (e) { e.stopPropagation(); dd.classList.toggle('open'); });
      dd.querySelector('[data-logout]').addEventListener('click', function () {
        Store.logout(); UI.toast('已登出', 'info'); go('/');
      });
    }
    header.querySelector('[data-menu]').addEventListener('click', function () {
      header.querySelector('#mobile-nav').classList.toggle('open');
    });
    header.querySelector('[data-theme-toggle]').addEventListener('click', function () {
      var next = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('a101_theme', next); } catch (e) {}
      renderHeader();
    });
  }

  function renderFooter() {
    var cats = Store.categories().map(function (c) { return '<li><a href="#/courses?cat=' + c.id + '">' + esc(c.name) + '</a></li>'; }).join('');
    document.getElementById('site-footer').innerHTML =
      '<footer class="footer"><div class="container"><div class="footer-grid">' +
      '<div><a href="#/" class="logo"><span class="logo-mark">1.01</span><span>1.01 Academy</span></a>' +
      '<p class="muted small mt-16" style="max-width:320px">每天進步 1%，一年後你會強大 37 倍。<br>我們相信持續學習的力量，陪你把技能變成實力。</p>' +
      '<p class="mono small subtle">1.01<sup>365</sup> ≈ 37.78</p></div>' +
      '<div><h4>課程分類</h4><ul>' + cats + '</ul></div>' +
      '<div><h4>平台</h4><ul><li><a href="#/courses">所有課程</a></li><li><a href="#/my-courses">我的學習</a></li><li><a href="#/?s=faq">常見問題</a></li><li><a href="#/register">成為會員</a></li></ul></div>' +
      '<div><h4>聯絡我們</h4><ul><li><a href="mailto:hello@101academy.com">hello@101academy.com</a></li><li><a href="#/">服務條款</a></li><li><a href="#/">隱私權政策</a></li><li><a href="#/">退款政策</a></li></ul></div>' +
      '</div><div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' 1.01 Academy. All rights reserved.</span><span class="mono">Made for lifelong learners</span></div></div></footer>';
  }

  // 未登入時導向登入頁並記住來源
  function requireLogin() {
    if (Store.currentUser()) return true;
    UI.toast('請先登入', 'info');
    go('/login?next=' + encodeURIComponent(location.hash.slice(1) || '/'));
    return false;
  }

  function pageHead(title, sub, crumbs) {
    return '<section class="page-head"><div class="container">' +
      (crumbs ? '<div class="breadcrumb">' + crumbs + '</div>' : '') +
      '<h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div></section>';
  }

  document.addEventListener('click', function (e) {
    var dd = document.getElementById('user-dd');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
  });

  return {
    go: go, thumb: thumb, price: price, ratingInline: ratingInline, courseCard: courseCard, bindWish: bindWish,
    renderHeader: renderHeader, renderFooter: renderFooter, requireLogin: requireLogin, pageHead: pageHead
  };
})();
