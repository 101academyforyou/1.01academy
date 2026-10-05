window.Views = window.Views || {};

(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon;

  function layout(app, active, title, sub, inner) {
    var links = [
      ['my-courses', 'book', '我的課程'], ['wishlist', 'heart', '收藏清單'], ['orders', 'receipt', '訂單紀錄'], ['profile', 'settings', '帳號設定']
    ];
    app.innerHTML = C.pageHead(title, sub) +
      '<div class="container"><div class="account"><nav class="side-nav"><div class="sn-label">My Account</div>' +
      links.map(function (l) { return '<a href="#/' + l[0] + '" class="' + (l[0] === active ? 'active' : '') + '">' + icon(l[1]) + l[2] + '</a>'; }).join('') +
      (Store.isAdmin() ? '<div class="sn-label">Admin</div><a href="#/admin">' + icon('grid') + '管理後台</a>' : '') +
      '</nav><div id="acc-body" class="fade-in">' + inner + '</div></div></div>';
    return app.querySelector('#acc-body');
  }

  /* ================= 我的課程 ================= */
  Views.myCourses = function (app, params, query) {
    if (!C.requireLogin()) return;
    var u = Store.currentUser();
    var filter = query.f || 'all';
    var list = Store.enrolledCourses();
    var completed = list.filter(function (c) { return Store.percent(c.id) === 100; });
    var totalSec = list.reduce(function (s, c) {
      var done = Store.progressOf(c.id).done;
      return s + Store.lessons(c).filter(function (l) { return done.indexOf(l.id) > -1; }).reduce(function (a, l) { return a + l.duration; }, 0);
    }, 0);

    var body = layout(app, 'my-courses', '我的學習', '嗨 ' + u.name + '，今天也要進步 1%！', '');
    function render() {
      var shown = list.filter(function (c) {
        var p = Store.percent(c.id);
        return filter === 'all' || (filter === 'done' ? p === 100 : p < 100);
      }).sort(function (a, b) { return (Store.progressOf(b.id).updatedAt || 0) - (Store.progressOf(a.id).updatedAt || 0); });

      body.innerHTML =
        '<div class="stat-grid">' +
        stat('book', '已購課程', list.length, '門課程') +
        stat('trending', '學習中', list.length - completed.length, '門課程') +
        stat('award', '已完成', completed.length, '張證書') +
        stat('clock', '累積學習', (totalSec / 3600).toFixed(1), '小時') + '</div>' +
        '<div class="tabs">' + [['all', '全部'], ['progress', '學習中'], ['done', '已完成']].map(function (t) {
          return '<button data-f="' + t[0] + '" class="' + (filter === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
        }).join('') + '</div>' +
        (shown.length ? '<div class="learn-list">' + shown.map(card).join('') + '</div>'
          : UI.emptyState('book', list.length ? '這裡還沒有課程' : '你還沒有購買任何課程', list.length ? '換個分類看看吧' : '從免費課程開始你的學習之旅吧！', '<a href="#/courses" class="btn btn-primary">探索課程</a>'));
    }
    function stat(ic, label, val, unit) {
      return '<div class="card stat"><div class="sl">' + label + icon(ic) + '</div><div class="sv">' + val + '</div><div class="sd">' + unit + '</div></div>';
    }
    function card(c) {
      var p = Store.percent(c.id);
      var ins = Store.instructor(c.instructorId) || {};
      var total = Store.lessons(c).length;
      var done = Math.round(p * total / 100);
      return '<div class="card learn-card"><a href="#/learn/' + esc(c.id) + '">' + C.thumb(c, { noTag: true }) + '</a><div class="lc-body">' +
        '<a href="#/learn/' + esc(c.id) + '"><h3>' + esc(c.title) + '</h3></a><div class="small muted">' + esc(ins.name || '') + '</div>' +
        '<div class="flex items-center gap-12"><div class="progress" style="flex:1"><i style="width:' + p + '%"></i></div><span class="mono small">' + p + '%</span></div>' +
        '<div class="small subtle">已完成 ' + done + ' / ' + total + ' 單元</div>' +
        '<div class="lc-foot"><a href="#/learn/' + esc(c.id) + '" class="btn btn-primary btn-sm">' + icon('play', 'icon-sm') + (p === 0 ? '開始學習' : p === 100 ? '重新複習' : '繼續學習') + '</a>' +
        (p === 100 ? '<a href="#/certificate/' + esc(c.id) + '" class="btn btn-soft btn-sm">' + icon('award', 'icon-sm') + '結業證書</a>' : '') +
        '<a href="#/course/' + esc(c.id) + '" class="btn btn-ghost btn-sm">課程介紹</a></div></div></div>';
    }
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]');
      if (!b) return;
      filter = b.getAttribute('data-f');
      history.replaceState(null, '', '#/my-courses' + (filter !== 'all' ? '?f=' + filter : ''));
      render();
    });
    render();
  };

  /* ================= 收藏清單 ================= */
  Views.wishlist = function (app) {
    if (!C.requireLogin()) return;
    var body = layout(app, 'wishlist', '收藏清單', '你感興趣的課程都在這裡', '');
    function render() {
      var list = Store.wishlist().map(Store.course).filter(Boolean);
      body.innerHTML = list.length
        ? '<div class="flex justify-between items-center mb-16 wrap gap-8"><span class="muted">' + list.length + ' 門課程</span>' +
          (list.some(function (c) { return !Store.isEnrolled(c.id) && c.price > 0; }) ? '<button class="btn btn-soft btn-sm" id="all-cart">' + icon('cart', 'icon-sm') + '全部加入購物車</button>' : '') +
          '</div><div class="course-grid">' + list.map(C.courseCard).join('') + '</div>'
        : UI.emptyState('heart', '收藏清單是空的', '看到喜歡的課程，點擊愛心就能收藏起來', '<a href="#/courses" class="btn btn-primary">探索課程</a>');
    }
    body.addEventListener('click', function (e) {
      if (e.target.closest('#all-cart')) {
        Store.wishlist().forEach(function (id) { var c = Store.course(id); if (c && c.price > 0) Store.addToCart(id); });
        UI.toast('已加入購物車'); C.go('/cart');
        return;
      }
      if (e.target.closest('[data-wish]')) setTimeout(render, 0);
    });
    C.bindWish(body);
    render();
  };

  /* ================= 訂單紀錄 ================= */
  Views.orders = function (app) {
    if (!C.requireLogin()) return;
    var list = Store.orders();
    layout(app, 'orders', '訂單紀錄', '查看你的購買紀錄與付款狀態',
      list.length
        ? '<div class="card table-wrap"><table class="table"><thead><tr><th>訂單編號</th><th>日期</th><th>課程</th><th>金額</th><th>狀態</th><th></th></tr></thead><tbody>' +
          list.map(function (o) {
            var st = Views.STATUS[o.status] || [o.status, ''];
            return '<tr><td class="mono small">' + esc(o.id) + '</td><td class="small">' + UI.date(o.createdAt) + '</td>' +
              '<td style="max-width:320px">' + o.items.map(function (i) { return esc(i.title); }).join('<br>') + '</td>' +
              '<td class="mono">' + UI.money(o.total) + '</td><td><span class="badge badge-' + st[1] + '">' + st[0] + '</span></td>' +
              '<td><a class="btn btn-ghost btn-sm" href="#/order/' + esc(o.id) + '">明細</a></td></tr>';
          }).join('') + '</tbody></table></div>'
        : UI.emptyState('receipt', '還沒有訂單', '購買課程後，訂單紀錄會顯示在這裡', '<a href="#/courses" class="btn btn-primary">探索課程</a>'));
  };

  /* ================= 帳號設定 ================= */
  Views.profile = function (app) {
    if (!C.requireLogin()) return;
    var u = Store.currentUser();
    var body = layout(app, 'profile', '帳號設定', '管理你的個人資料與安全性',
      '<div class="card card-pad mb-24"><div class="flex items-center gap-16 mb-24"><span class="avatar avatar-lg">' + esc(UI.initials(u.name)) + '</span><div><h3 class="mb-0">' + esc(u.name) + '</h3><div class="muted small">' + esc(u.email) + '</div><div class="small subtle">加入於 ' + UI.date(u.createdAt) + '</div></div></div>' +
      '<form id="pf"><div class="row"><div class="field"><label for="pf-name">姓名</label><input class="input" id="pf-name" name="fullname" value="' + esc(u.name) + '" required maxlength="40" /></div>' +
      '<div class="field"><label for="pf-phone">手機</label><input class="input" id="pf-phone" name="phone" value="' + esc(u.phone || '') + '" /></div></div>' +
      '<div class="field"><label>Email</label><input class="input" value="' + esc(u.email) + '" disabled /><span class="hint">Email 為登入帳號，無法修改</span></div>' +
      '<div class="field"><label for="pf-bio">自我介紹</label><textarea class="textarea" id="pf-bio" name="bio" maxlength="300" placeholder="分享你的學習目標…">' + esc(u.bio || '') + '</textarea></div>' +
      '<button class="btn btn-primary">儲存變更</button></form></div>' +
      '<div class="card card-pad mb-24"><h3>變更密碼</h3><form id="pw" class="mt-16"><div class="field"><label for="pw-old">目前密碼</label><input class="input" type="password" id="pw-old" name="old" autocomplete="current-password" required /></div>' +
      '<div class="row"><div class="field"><label for="pw-new">新密碼</label><input class="input" type="password" id="pw-new" name="nw" autocomplete="new-password" minlength="6" required /></div>' +
      '<div class="field"><label for="pw-new2">確認新密碼</label><input class="input" type="password" id="pw-new2" name="nw2" autocomplete="new-password" required /></div></div>' +
      '<button class="btn btn-outline">更新密碼</button></form></div>' +
      '<div class="card card-pad"><h3>偏好設定</h3><div class="flex justify-between items-center wrap gap-12"><div><strong class="small">自動播放下一單元</strong><div class="small subtle">影片結束後自動前往下一個單元</div></div><label class="check"><input type="checkbox" id="autoplay" ' + (prefAutoplay() ? 'checked' : '') + ' /> 啟用</label></div></div>');

    body.querySelector('#pf').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      if (!f.fullname.value.trim()) return UI.toast('姓名不可空白', 'error');
      Store.updateProfile({ name: f.fullname.value, phone: f.phone.value, bio: f.bio.value });
      UI.toast('個人資料已更新');
      Views.profile(app);
    });
    body.querySelector('#pw').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      if (f.nw.value.length < 6) return UI.toast('新密碼至少 6 個字元', 'error');
      if (f.nw.value !== f.nw2.value) return UI.toast('兩次輸入的新密碼不一致', 'error');
      try { Store.changePassword(f.old.value, f.nw.value); UI.toast('密碼已更新'); f.reset(); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
    body.querySelector('#autoplay').addEventListener('change', function (e) {
      try { localStorage.setItem('a101_autoplay', e.target.checked ? '1' : '0'); } catch (err) {}
      UI.toast('偏好設定已儲存');
    });
  };

  function prefAutoplay() {
    try { return localStorage.getItem('a101_autoplay') !== '0'; } catch (e) { return true; }
  }
  Views.prefAutoplay = prefAutoplay;

  /* ================= 結業證書 ================= */
  Views.certificate = function (app, params) {
    if (!C.requireLogin()) return;
    var c = Store.course(params.id);
    var u = Store.currentUser();
    if (!c || !Store.isEnrolled(c.id)) { app.innerHTML = '<div class="container">' + UI.emptyState('award', '無法顯示證書', '你尚未擁有此課程', '<a class="btn btn-primary" href="#/my-courses">我的課程</a>') + '</div>'; return; }
    if (Store.percent(c.id) < 100) {
      app.innerHTML = '<div class="container">' + UI.emptyState('award', '尚未完成課程', '完成所有單元後即可取得結業證書（目前進度 ' + Store.percent(c.id) + '%）', '<a class="btn btn-primary" href="#/learn/' + esc(c.id) + '">繼續學習</a>') + '</div>';
      return;
    }
    var ins = Store.instructor(c.instructorId) || {};
    var p = Store.progressOf(c.id);
    var certId = 'CERT-' + (u.id + c.id).split('').reduce(function (h, ch) { return (h * 31 + ch.charCodeAt(0)) >>> 0; }, 7).toString(36).toUpperCase();
    app.innerHTML = '<div class="container"><div class="flex justify-between items-center mt-24 no-print wrap gap-12"><a href="#/my-courses" class="btn btn-ghost">' + icon('chevronLeft', 'icon-sm') + '返回我的課程</a><button class="btn btn-primary" onclick="window.print()">' + icon('printer', 'icon-sm') + '列印 / 另存 PDF</button></div>' +
      '<div class="certificate"><div class="ct-top"><div class="logo"><span class="logo-mark">1.01</span><span style="color:#0f172a">1.01 Academy</span></div><span class="mono" style="font-size:12px;color:#64748b">' + esc(certId) + '</span></div>' +
      '<div><div class="mono" style="letter-spacing:.3em;color:#4f46e5;font-size:13px;font-weight:700">CERTIFICATE OF COMPLETION</div><h1>結業證書</h1>' +
      '<p style="color:#475569;margin:20px 0 0">茲證明</p><div class="name">' + esc(u.name) + '</div>' +
      '<p style="color:#475569;margin:0">已完成 1.01 Academy 線上課程</p><h2 style="font-size:clamp(16px,2.6vw,26px);margin:10px 0 6px">《' + esc(c.title) + '》</h2>' +
      '<p style="color:#64748b;font-size:13px;margin:0">課程總時數 ' + UI.hours(Store.totalDuration(c)) + ' · 共 ' + Store.lessons(c).length + ' 個單元</p></div>' +
      '<div class="ct-foot"><div><div class="small">頒發日期</div><strong style="color:#0f172a">' + UI.date(p.completedAt || Date.now()) + '</strong></div>' +
      '<div class="mono" style="font-size:22px;font-weight:700;color:#4f46e5">1.01<sup style="font-size:.5em">365</sup></div>' +
      '<div class="sig"><strong style="color:#0f172a">' + esc(ins.name || '') + '</strong><div style="font-size:11px">課程講師</div></div></div></div></div>';
  };
})();
