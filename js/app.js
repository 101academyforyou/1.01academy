/* 路由與應用程式啟動 */
(function () {
  'use strict';

  var routes = [
    ['/', Views.home],
    ['/courses', Views.catalog],
    ['/course/:id', Views.course],
    ['/cart', Views.cart],
    ['/checkout', Views.checkout],
    ['/order/:id', Views.order],
    ['/login', Views.login, { bare: true }],
    ['/register', Views.register, { bare: true }],
    ['/my-courses', Views.myCourses],
    ['/wishlist', Views.wishlist],
    ['/orders', Views.orders],
    ['/profile', Views.profile],
    ['/certificate/:id', Views.certificate],
    ['/learn/:id', Views.learn, { bare: true }],
    ['/learn/:id/:lesson', Views.learn, { bare: true }],
    ['/admin', Views.admin],
    ['/admin/course/:id', Views.admin, { params: { section: 'course' } }],
    ['/admin/:section', Views.admin]
  ].map(function (r) {
    var keys = [];
    var re = new RegExp('^' + r[0].replace(/:(\w+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '/?$');
    return { re: re, keys: keys, view: r[1], opts: r[2] || {} };
  });

  var mainEl = document.getElementById('app');
  var cleanup = null;

  function parseQuery(qs) {
    var q = {};
    (qs || '').split('&').forEach(function (p) {
      if (!p) return;
      var i = p.indexOf('=');
      var k = decodeURIComponent(i > -1 ? p.slice(0, i) : p);
      try { q[k] = decodeURIComponent(i > -1 ? p.slice(i + 1).replace(/\+/g, ' ') : ''); } catch (e) { q[k] = ''; }
    });
    return q;
  }

  function render() {
    var hash = location.hash.slice(1) || '/';
    var qi = hash.indexOf('?');
    var path = qi > -1 ? hash.slice(0, qi) : hash;
    var query = parseQuery(qi > -1 ? hash.slice(qi + 1) : '');

    if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null;
    document.querySelectorAll('#modal-root .modal-backdrop').forEach(function (m) { m.remove(); });

    var match = null, params = {};
    for (var i = 0; i < routes.length; i++) {
      var m = routes[i].re.exec(path);
      if (m) {
        match = routes[i];
        params = Object.assign({}, match.opts.params || {});
        match.keys.forEach(function (k, j) { try { params[k] = decodeURIComponent(m[j + 1]); } catch (e) { params[k] = m[j + 1]; } });
        break;
      }
    }

    C.renderHeader();
    // 每次換頁都建立全新容器，避免事件監聽器累積
    var view = document.createElement('div');
    mainEl.innerHTML = '';
    mainEl.appendChild(view);

    if (!match) {
      view.innerHTML = '<div class="container">' + UI.emptyState('alert', '404 找不到頁面', '你要找的頁面不存在或已被移除', '<a class="btn btn-primary" href="#/">回到首頁</a>') + '</div>';
    } else {
      try {
        cleanup = match.view(view, params, query);
      } catch (err) {
        console.error(err);
        view.innerHTML = '<div class="container">' + UI.emptyState('alert', '頁面發生錯誤', String(err && err.message || err), '<a class="btn btn-primary" href="#/">回到首頁</a>') + '</div>';
      }
    }
    document.getElementById('site-footer').style.display = match && match.opts.bare ? 'none' : '';

    if (query.s) {
      setTimeout(function () { var el = document.getElementById(query.s); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 50);
    } else {
      window.scrollTo(0, 0);
    }
    updateTitle(path, params);
  }

  function updateTitle(path, params) {
    var base = '1.01 Academy';
    var t = base + '｜每天進步 1% 的線上課程平台';
    if (params.id && (path.indexOf('/course/') === 0 || path.indexOf('/learn/') === 0)) {
      var c = Store.course(params.id);
      if (c) t = c.title + '｜' + base;
    } else {
      var map = { '/courses': '探索課程', '/cart': '購物車', '/checkout': '結帳', '/login': '登入', '/register': '註冊', '/my-courses': '我的課程', '/wishlist': '收藏清單', '/orders': '訂單紀錄', '/profile': '帳號設定' };
      if (map[path]) t = map[path] + '｜' + base;
      else if (path.indexOf('/admin') === 0) t = '管理後台｜' + base;
    }
    document.title = t;
  }

  // 資料變動時只更新頁首（購物車數量、登入狀態）
  Store.onChange(function () { C.renderHeader(); });

  // 其他分頁登入/登出時同步
  window.addEventListener('storage', function (e) {
    if (e.key === 'a101_session' || e.key === 'a101_cart') location.reload();
  });

  window.addEventListener('hashchange', render);
  C.renderFooter();
  render();
})();
