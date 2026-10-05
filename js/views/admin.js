window.Views = window.Views || {};

(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon;

  function guard() {
    if (!C.requireLogin()) return false;
    if (!Store.isAdmin()) { UI.toast('你沒有管理員權限', 'error'); C.go('/'); return false; }
    return true;
  }

  function layout(app, active, title, inner) {
    var links = [['', 'chart', '總覽儀表板'], ['courses', 'book', '課程管理'], ['orders', 'receipt', '訂單管理'], ['users', 'users', '會員管理'], ['coupons', 'tag', '優惠券']];
    app.innerHTML = '<section class="page-head"><div class="container"><div class="breadcrumb"><span class="badge badge-grad">ADMIN</span></div><h1>' + esc(title) + '</h1></div></section>' +
      '<div class="container"><div class="account"><nav class="side-nav"><div class="sn-label">Console</div>' +
      links.map(function (l) { return '<a href="#/admin' + (l[0] ? '/' + l[0] : '') + '" class="' + (l[0] === active ? 'active' : '') + '">' + icon(l[1]) + l[2] + '</a>'; }).join('') +
      '<div class="sn-label">Site</div><a href="#/">' + icon('home') + '回到前台</a></nav>' +
      '<div id="adm-body" class="fade-in" style="min-width:0">' + inner + '</div></div></div>';
    return app.querySelector('#adm-body');
  }

  /* ================= 儀表板 ================= */
  function dashboard(app) {
    var s = Store.stats();
    var max = Math.max.apply(null, s.days.map(function (d) { return d.value; }).concat([1]));
    var top = Store.courses({ all: true }).map(function (c) { return { c: c, n: s.sales[c.id] || 0 }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
    var recent = Store.orders(true).slice(0, 6);
    layout(app, '', '總覽儀表板',
      '<div class="stat-grid">' +
      stat('wallet', '總營收', UI.money(s.revenue), s.paidOrders + ' 筆已付款訂單') +
      stat('receipt', '訂單數', s.orders, s.pending + ' 筆待付款') +
      stat('users', '註冊學員', s.students, '位學員') +
      stat('book', '課程數', s.courses, Store.courses().length + ' 門已上架') + '</div>' +
      '<div class="grid-2 mb-24"><div class="card card-pad"><div class="flex justify-between items-center"><h3 class="mb-0">近 7 日營收</h3><span class="small subtle mono">NT$</span></div>' +
      '<div class="bar-chart">' + s.days.map(function (d) {
        return '<div class="bc" title="' + d.label + '：' + UI.money(d.value) + '"><b>' + (d.value ? (d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : d.value) : '') + '</b><i style="height:' + Math.max(2, d.value / max * 140) + 'px"></i><span>' + d.label + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="card card-pad"><h3>熱銷課程</h3>' + (top.some(function (t) { return t.n; }) ? top.map(function (t, i) {
        return '<div class="flex items-center gap-12" style="padding:8px 0;border-bottom:1px solid var(--border)"><span class="mono subtle">' + (i + 1) + '</span><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.c.title) + '</span><span class="badge badge-primary mono">' + t.n + ' 售出</span></div>';
      }).join('') : '<p class="muted small">尚無銷售資料。建立一筆測試訂單試試看！</p>') + '</div></div>' +
      '<div class="card"><div class="flex justify-between items-center card-pad" style="padding-bottom:12px"><h3 class="mb-0">最新訂單</h3><a href="#/admin/orders" class="btn btn-ghost btn-sm">查看全部</a></div>' +
      ordersTable(recent) + '</div>');
  }

  function stat(ic, label, val, sub) {
    return '<div class="card stat"><div class="sl">' + label + icon(ic) + '</div><div class="sv">' + val + '</div><div class="sd">' + sub + '</div></div>';
  }

  function userName(id) { var u = Store.users().find(function (x) { return x.id === id; }); return u ? u.name : '(已刪除)'; }

  function ordersTable(list, withActions) {
    if (!list.length) return '<div class="card-pad"><p class="muted small mb-0">目前沒有訂單</p></div>';
    return '<div class="table-wrap"><table class="table"><thead><tr><th>訂單編號</th><th>會員</th><th>課程</th><th>金額</th><th>付款</th><th>狀態</th><th>日期</th>' + (withActions ? '<th></th>' : '') + '</tr></thead><tbody>' +
      list.map(function (o) {
        var st = Views.STATUS[o.status] || [o.status, ''];
        return '<tr><td class="mono small"><a href="#/order/' + esc(o.id) + '">' + esc(o.id) + '</a></td><td>' + esc(userName(o.userId)) + '</td>' +
          '<td class="small" style="max-width:260px">' + o.items.map(function (i) { return esc(i.title); }).join('<br>') + '</td>' +
          '<td class="mono">' + UI.money(o.total) + '</td><td class="small">' + esc(Views.METHOD[o.method] || o.method) + '</td>' +
          '<td><span class="badge badge-' + st[1] + '">' + st[0] + '</span></td><td class="small">' + UI.date(o.createdAt, true) + '</td>' +
          (withActions ? '<td><div class="actions">' +
            (o.status === 'pending' ? '<button class="btn btn-soft btn-sm" data-paid="' + esc(o.id) + '">確認入帳</button>' : '') +
            (o.status === 'paid' && o.total > 0 ? '<button class="btn btn-danger btn-sm" data-refund="' + esc(o.id) + '">退款</button>' : '') +
            '</div></td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ================= 訂單管理 ================= */
  function orders(app, query) {
    var f = query.status || '';
    var list = Store.orders(true).filter(function (o) { return !f || o.status === f; });
    var body = layout(app, 'orders', '訂單管理',
      '<div class="flex gap-8 wrap mb-16">' + [['', '全部'], ['paid', '已付款'], ['pending', '待付款'], ['refunded', '已退款'], ['cancelled', '已取消']].map(function (s) {
        return '<a class="chip ' + (f === s[0] ? 'active' : '') + '" href="#/admin/orders' + (s[0] ? '?status=' + s[0] : '') + '">' + s[1] + '</a>';
      }).join('') + '<button class="btn btn-outline btn-sm" id="export" style="margin-left:auto">' + icon('download', 'icon-sm') + '匯出 CSV</button></div>' +
      '<div class="card">' + ordersTable(list, true) + '</div>');
    body.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-paid]'))) {
        Store.markOrderPaid(b.getAttribute('data-paid')); UI.toast('已確認入帳，課程已開通'); orders(app, query);
      } else if ((b = e.target.closest('[data-refund]'))) {
        var id = b.getAttribute('data-refund');
        UI.confirm('確定要退款訂單 ' + id + ' 嗎？學員將失去課程觀看權限。', { danger: true, ok: '確認退款' }).then(function (ok) {
          if (ok) { Store.refundOrder(id); UI.toast('已完成退款', 'info'); orders(app, query); }
        });
      } else if (e.target.closest('#export')) {
        var rows = [['訂單編號', '會員', 'Email', '課程', '小計', '折扣', '總計', '付款方式', '狀態', '建立時間']].concat(list.map(function (o) {
          return [o.id, userName(o.userId), o.billing ? o.billing.email : '', o.items.map(function (i) { return i.title; }).join(' / '), o.subtotal, o.discount, o.total, Views.METHOD[o.method] || o.method, (Views.STATUS[o.status] || [o.status])[0], UI.date(o.createdAt, true)];
        }));
        var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = 'orders-' + UI.date(Date.now()).replace(/\//g, '') + '.csv';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }
    });
  }

  /* ================= 會員管理 ================= */
  function users(app) {
    var me = Store.currentUser();
    var list = Store.users();
    var body = layout(app, 'users', '會員管理',
      '<div class="card table-wrap"><table class="table"><thead><tr><th>會員</th><th>Email</th><th>角色</th><th>已購課程</th><th>加入日期</th><th>狀態</th><th></th></tr></thead><tbody>' +
      list.map(function (u) {
        return '<tr><td><div class="flex items-center gap-8"><span class="avatar" style="width:30px;height:30px;font-size:12px">' + esc(UI.initials(u.name)) + '</span>' + esc(u.name) + '</div></td>' +
          '<td class="small">' + esc(u.email) + '</td><td><span class="badge ' + (u.role === 'admin' ? 'badge-grad' : '') + '">' + (u.role === 'admin' ? '管理員' : '學員') + '</span></td>' +
          '<td class="mono">' + u.enrolled.length + '</td><td class="small">' + UI.date(u.createdAt) + '</td>' +
          '<td>' + (u.disabled ? '<span class="badge badge-danger">已停用</span>' : '<span class="badge badge-success">正常</span>') + '</td>' +
          '<td><div class="actions">' + (u.id !== me.id ? '<button class="btn btn-ghost btn-sm" data-role="' + esc(u.id) + '">' + (u.role === 'admin' ? '設為學員' : '設為管理員') + '</button>' +
            '<button class="btn btn-sm ' + (u.disabled ? 'btn-soft' : 'btn-danger') + '" data-disable="' + esc(u.id) + '">' + (u.disabled ? '啟用' : '停用') + '</button>' : '<span class="small subtle">（你）</span>') + '</div></td></tr>';
      }).join('') + '</tbody></table></div>');
    body.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-role]'))) {
        var u = list.find(function (x) { return x.id === b.getAttribute('data-role'); });
        Store.setUserRole(u.id, u.role === 'admin' ? 'student' : 'admin'); UI.toast('已更新角色'); users(app);
      } else if ((b = e.target.closest('[data-disable]'))) {
        Store.toggleUserDisabled(b.getAttribute('data-disable')); UI.toast('已更新帳號狀態'); users(app);
      }
    });
  }

  /* ================= 優惠券 ================= */
  function coupons(app) {
    var body = layout(app, 'coupons', '優惠券管理',
      '<div class="card card-pad mb-24"><h3>新增 / 更新優惠券</h3><form id="cp-form" class="mt-16"><div class="row-3">' +
      '<div class="field"><label for="cp-code">優惠碼</label><input class="input mono" id="cp-code" name="code" required maxlength="20" placeholder="SUMMER2026" style="text-transform:uppercase" /></div>' +
      '<div class="field"><label for="cp-type">折扣類型</label><select class="select" id="cp-type" name="type"><option value="percent">百分比折扣 (%)</option><option value="fixed">固定金額 (NT$)</option></select></div>' +
      '<div class="field"><label for="cp-value">折扣值</label><input class="input mono" id="cp-value" name="value" type="number" min="1" required /></div></div>' +
      '<div class="row"><div class="field"><label for="cp-min">最低消費 (NT$)</label><input class="input mono" id="cp-min" name="minAmount" type="number" min="0" value="0" /></div>' +
      '<div class="field"><label for="cp-note">說明</label><input class="input" id="cp-note" name="note" maxlength="40" /></div></div>' +
      '<button class="btn btn-primary">' + icon('plus', 'icon-sm') + '儲存優惠券</button></form></div>' +
      '<div class="card table-wrap"><table class="table"><thead><tr><th>優惠碼</th><th>折扣</th><th>最低消費</th><th>說明</th><th>狀態</th><th></th></tr></thead><tbody>' +
      Store.coupons().map(function (cp) {
        return '<tr><td class="mono"><strong>' + esc(cp.code) + '</strong></td><td>' + (cp.type === 'percent' ? cp.value + '% OFF' : '折 ' + UI.money(cp.value)) + '</td>' +
          '<td class="mono">' + UI.money(cp.minAmount || 0) + '</td><td class="small muted">' + esc(cp.note || '') + '</td>' +
          '<td>' + (cp.active ? '<span class="badge badge-success">啟用中</span>' : '<span class="badge">已停用</span>') + '</td>' +
          '<td><div class="actions"><button class="btn btn-ghost btn-sm" data-toggle="' + esc(cp.code) + '">' + (cp.active ? '停用' : '啟用') + '</button><button class="btn btn-danger btn-sm btn-icon" data-del="' + esc(cp.code) + '" aria-label="刪除">' + icon('trash', 'icon-sm') + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div>');
    body.querySelector('#cp-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var v = +f.value.value;
      if (!f.code.value.trim() || !/^[A-Za-z0-9_-]+$/.test(f.code.value.trim())) return UI.toast('優惠碼只能包含英數字、- 或 _', 'error');
      if (!(v > 0) || (f.type.value === 'percent' && v > 100)) return UI.toast('折扣值不正確', 'error');
      Store.saveCoupon({ code: f.code.value, type: f.type.value, value: v, minAmount: +f.minAmount.value || 0, note: f.note.value.trim(), active: true });
      UI.toast('優惠券已儲存'); coupons(app);
    });
    body.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-toggle]'))) {
        var cp = Store.coupons().find(function (x) { return x.code === b.getAttribute('data-toggle'); });
        cp.active = !cp.active; Store.saveCoupon(cp); coupons(app);
      } else if ((b = e.target.closest('[data-del]'))) {
        var code = b.getAttribute('data-del');
        UI.confirm('確定刪除優惠碼 ' + code + '？', { danger: true, ok: '刪除' }).then(function (ok) { if (ok) { Store.deleteCoupon(code); coupons(app); } });
      }
    });
  }

  /* ================= 課程管理 ================= */
  function courseList(app) {
    var s = Store.stats();
    var body = layout(app, 'courses', '課程管理',
      '<div class="flex justify-between items-center mb-16 wrap gap-8"><span class="muted">共 ' + Store.courses({ all: true }).length + ' 門課程</span><a href="#/admin/course/new" class="btn btn-primary">' + icon('plus', 'icon-sm') + '新增課程</a></div>' +
      '<div class="card table-wrap"><table class="table"><thead><tr><th>課程</th><th>分類</th><th>價格</th><th>單元</th><th>銷售</th><th>狀態</th><th></th></tr></thead><tbody>' +
      Store.courses({ all: true }).map(function (c) {
        return '<tr><td><div class="flex items-center gap-12"><div class="thumb-sm">' + C.thumb(c, { noTag: true }) + '</div><div style="min-width:0"><a href="#/course/' + esc(c.id) + '"><strong class="small">' + esc(c.title) + '</strong></a><div class="small subtle">' + esc((Store.instructor(c.instructorId) || {}).name || '') + '</div></div></div></td>' +
          '<td class="small">' + esc((Store.category(c.category) || {}).name || '') + '</td><td class="mono">' + (c.price ? UI.money(c.price) : '免費') + '</td>' +
          '<td class="mono">' + Store.lessons(c).length + '</td><td class="mono">' + (s.sales[c.id] || 0) + '</td>' +
          '<td>' + (c.published ? '<span class="badge badge-success">已上架</span>' : '<span class="badge">草稿</span>') + (c.featured ? ' <span class="badge badge-primary">精選</span>' : '') + '</td>' +
          '<td><div class="actions"><a class="btn btn-ghost btn-sm btn-icon" href="#/admin/course/' + esc(c.id) + '" aria-label="編輯">' + icon('edit', 'icon-sm') + '</a><button class="btn btn-danger btn-sm btn-icon" data-del="' + esc(c.id) + '" aria-label="刪除">' + icon('trash', 'icon-sm') + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div>');
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]');
      if (!b) return;
      var c = Store.course(b.getAttribute('data-del'));
      UI.confirm('確定要刪除「' + c.title + '」嗎？此動作無法復原。', { danger: true, ok: '刪除課程' }).then(function (ok) {
        if (ok) { Store.deleteCourse(c.id); UI.toast('課程已刪除', 'info'); courseList(app); }
      });
    });
  }

  function courseEdit(app, id) {
    var isNew = id === 'new';
    var src = isNew ? null : Store.course(id);
    if (!isNew && !src) { C.go('/admin/courses'); return; }
    var c = src ? JSON.parse(JSON.stringify(src)) : {
      id: '', title: '', subtitle: '', category: Store.categories()[0].id, level: '入門', price: 1990, originalPrice: 2990,
      instructorId: Store.instructors()[0].id, students: 0, baseRating: 0, baseReviews: 0,
      thumb: { from: '#4f46e5', to: '#06b6d4', mark: 'NEW', tag: 'COURSE' }, featured: false, published: false,
      updatedAt: new Date().toISOString().slice(0, 10), language: '中文', tags: [], description: '', outcomes: [], requirements: [],
      chapters: [{ id: UI.uid('c'), title: '第一章', lessons: [{ id: UI.uid('l'), title: '課程介紹', duration: 300, preview: true, video: SEED.videos[0] }] }]
    };

    function opt(list, val) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '" ' + (String(o[0]) === String(val) ? 'selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }

    var body = layout(app, 'courses', isNew ? '新增課程' : '編輯課程',
      '<form id="ce"><div class="card card-pad mb-24"><h3>基本資訊</h3>' +
      '<div class="field mt-16"><label for="ce-title">課程名稱</label><input class="input" id="ce-title" name="title" required maxlength="80" value="' + esc(c.title) + '" /></div>' +
      '<div class="field"><label for="ce-sub">副標題</label><input class="input" id="ce-sub" name="subtitle" maxlength="120" value="' + esc(c.subtitle) + '" /></div>' +
      (isNew ? '<div class="field"><label for="ce-id">網址代稱 (slug)</label><input class="input mono" id="ce-id" name="slug" placeholder="my-awesome-course" pattern="[a-z0-9\\-]+" /><span class="hint">僅限小寫英數與 -，留空將自動產生</span></div>' : '') +
      '<div class="row-3"><div class="field"><label for="ce-cat">分類</label><select class="select" id="ce-cat" name="category">' + opt(Store.categories().map(function (x) { return [x.id, x.name]; }), c.category) + '</select></div>' +
      '<div class="field"><label for="ce-lv">程度</label><select class="select" id="ce-lv" name="level">' + opt([['入門', '入門'], ['中級', '中級'], ['進階', '進階']], c.level) + '</select></div>' +
      '<div class="field"><label for="ce-ins">講師</label><select class="select" id="ce-ins" name="instructorId">' + opt(Store.instructors().map(function (x) { return [x.id, x.name]; }), c.instructorId) + '</select></div></div>' +
      '<div class="row-3"><div class="field"><label for="ce-price">售價 (NT$)</label><input class="input mono" id="ce-price" name="price" type="number" min="0" value="' + c.price + '" /><span class="hint">設為 0 即為免費課程</span></div>' +
      '<div class="field"><label for="ce-op">原價 (NT$)</label><input class="input mono" id="ce-op" name="originalPrice" type="number" min="0" value="' + (c.originalPrice || 0) + '" /></div>' +
      '<div class="field"><label for="ce-tags">標籤（以逗號分隔）</label><input class="input" id="ce-tags" name="tags" value="' + esc((c.tags || []).join(', ')) + '" /></div></div>' +
      '<div class="flex gap-16 wrap"><label class="check"><input type="checkbox" name="published" ' + (c.published ? 'checked' : '') + ' /> 上架課程</label><label class="check"><input type="checkbox" name="featured" ' + (c.featured ? 'checked' : '') + ' /> 精選推薦</label></div></div>' +

      '<div class="card card-pad mb-24"><h3>封面樣式</h3><div class="grid-2 mt-16"><div><div class="row"><div class="field"><label for="ce-from">漸層色 1</label><input class="input" id="ce-from" name="from" type="color" value="' + esc(c.thumb.from) + '" style="padding:4px" /></div>' +
      '<div class="field"><label for="ce-to">漸層色 2</label><input class="input" id="ce-to" name="to" type="color" value="' + esc(c.thumb.to) + '" style="padding:4px" /></div></div>' +
      '<div class="row"><div class="field"><label for="ce-mark">封面文字</label><input class="input mono" id="ce-mark" name="mark" maxlength="6" value="' + esc(c.thumb.mark) + '" /></div>' +
      '<div class="field"><label for="ce-tag">標籤文字</label><input class="input mono" id="ce-tag" name="tag" maxlength="12" value="' + esc(c.thumb.tag || '') + '" /></div></div></div>' +
      '<div><label class="small muted" style="font-weight:600">預覽</label><div id="thumb-prev" class="mt-8" style="border-radius:12px;overflow:hidden"></div></div></div></div>' +

      '<div class="card card-pad mb-24"><h3>課程介紹</h3>' +
      '<div class="field mt-16"><label for="ce-desc">課程描述</label><textarea class="textarea" id="ce-desc" name="description" style="min-height:140px">' + esc(c.description) + '</textarea><span class="hint">以換行分隔段落</span></div>' +
      '<div class="row"><div class="field"><label for="ce-out">學習成果（每行一項）</label><textarea class="textarea" id="ce-out" name="outcomes">' + esc((c.outcomes || []).join('\n')) + '</textarea></div>' +
      '<div class="field"><label for="ce-req">課前準備（每行一項）</label><textarea class="textarea" id="ce-req" name="requirements">' + esc((c.requirements || []).join('\n')) + '</textarea></div></div></div>' +

      '<div class="card card-pad mb-24"><div class="flex justify-between items-center mb-16 wrap gap-8"><h3 class="mb-0">課程章節與單元</h3><button type="button" class="btn btn-soft btn-sm" data-add-ch>' + icon('plus', 'icon-sm') + '新增章節</button></div>' +
      '<p class="small subtle">影片網址支援 MP4 直連或 YouTube 連結。時長單位為「分鐘」。</p><div id="chapters"></div></div>' +

      '<div class="flex gap-12 wrap"><button class="btn btn-primary btn-lg">' + icon('check') + '儲存課程</button><a href="#/admin/courses" class="btn btn-ghost btn-lg">取消</a>' +
      (!isNew ? '<a href="#/course/' + esc(c.id) + '" class="btn btn-outline btn-lg" style="margin-left:auto">' + icon('eye') + '預覽頁面</a>' : '') + '</div></form>');

    var form = body.querySelector('#ce');
    var chEl = body.querySelector('#chapters');

    function renderThumb() {
      body.querySelector('#thumb-prev').innerHTML = C.thumb({ thumb: { from: form.from.value, to: form.to.value, mark: form.mark.value, tag: form.tag.value }, level: form.level.value }, { level: true });
    }

    // 先把畫面上的值同步回 c.chapters，避免重繪時遺失輸入
    function collectChapters() {
      chEl.querySelectorAll('[data-ch]').forEach(function (chNode) {
        var ch = c.chapters.find(function (x) { return x.id === chNode.getAttribute('data-ch'); });
        if (!ch) return;
        ch.title = chNode.querySelector('[data-ch-title]').value;
        chNode.querySelectorAll('[data-l]').forEach(function (lNode) {
          var l = ch.lessons.find(function (x) { return x.id === lNode.getAttribute('data-l'); });
          if (!l) return;
          l.title = lNode.querySelector('[data-f=title]').value;
          l.video = lNode.querySelector('[data-f=video]').value.trim();
          l.duration = Math.round((parseFloat(lNode.querySelector('[data-f=dur]').value) || 0) * 60);
          l.preview = lNode.querySelector('[data-f=preview]').checked;
        });
      });
    }

    function renderChapters() {
      chEl.innerHTML = c.chapters.map(function (ch, ci) {
        return '<div class="editor-chapter" data-ch="' + esc(ch.id) + '"><div class="ec-head"><span class="badge mono" style="height:38px">CH' + (ci + 1) + '</span>' +
          '<input class="input" data-ch-title value="' + esc(ch.title) + '" placeholder="章節名稱" style="height:38px" />' +
          '<button type="button" class="btn btn-ghost btn-sm btn-icon" data-up="' + ci + '" aria-label="上移" ' + (ci === 0 ? 'disabled' : '') + '>↑</button>' +
          '<button type="button" class="btn btn-danger btn-sm btn-icon" data-del-ch="' + esc(ch.id) + '" aria-label="刪除章節">' + icon('trash', 'icon-sm') + '</button></div>' +
          ch.lessons.map(function (l) {
            return '<div class="editor-lesson" data-l="' + esc(l.id) + '"><input class="input" data-f="title" value="' + esc(l.title) + '" placeholder="單元名稱" />' +
              '<input class="input mono" data-f="video" value="' + esc(l.video || '') + '" placeholder="影片網址 (mp4 / YouTube)" />' +
              '<input class="input mono" data-f="dur" type="number" min="0" step="0.1" value="' + (Math.round(l.duration / 6) / 10) + '" title="分鐘" />' +
              '<label class="check small"><input type="checkbox" data-f="preview" ' + (l.preview ? 'checked' : '') + ' />試看</label>' +
              '<button type="button" class="btn btn-ghost btn-sm btn-icon" data-del-l="' + esc(l.id) + '" aria-label="刪除單元">' + icon('x', 'icon-sm') + '</button></div>';
          }).join('') +
          '<button type="button" class="btn btn-ghost btn-sm" data-add-l="' + esc(ch.id) + '">' + icon('plus', 'icon-sm') + '新增單元</button></div>';
      }).join('') || '<p class="muted small">尚無章節</p>';
    }

    body.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-add-ch]')) {
        collectChapters();
        c.chapters.push({ id: UI.uid('c'), title: '新章節', lessons: [] }); renderChapters();
      } else if ((b = e.target.closest('[data-add-l]'))) {
        collectChapters();
        var ch = c.chapters.find(function (x) { return x.id === b.getAttribute('data-add-l'); });
        ch.lessons.push({ id: UI.uid('l'), title: '', duration: 600, preview: false, video: '' }); renderChapters();
      } else if ((b = e.target.closest('[data-del-ch]'))) {
        collectChapters();
        c.chapters = c.chapters.filter(function (x) { return x.id !== b.getAttribute('data-del-ch'); }); renderChapters();
      } else if ((b = e.target.closest('[data-del-l]'))) {
        collectChapters();
        var lid = b.getAttribute('data-del-l');
        c.chapters.forEach(function (x) { x.lessons = x.lessons.filter(function (l) { return l.id !== lid; }); }); renderChapters();
      } else if ((b = e.target.closest('[data-up]'))) {
        collectChapters();
        var i = +b.getAttribute('data-up');
        var tmp = c.chapters[i - 1]; c.chapters[i - 1] = c.chapters[i]; c.chapters[i] = tmp; renderChapters();
      }
    });
    ['from', 'to', 'mark', 'tag', 'level'].forEach(function (n) { form[n].addEventListener('input', renderThumb); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      collectChapters();
      var title = form.title.value.trim();
      if (!title) return UI.toast('請輸入課程名稱', 'error');
      if (isNew) {
        var slug = (form.slug.value.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || UI.uid('course-')).slice(0, 60);
        if (!/^[a-z0-9-]+$/.test(slug)) return UI.toast('網址代稱格式不正確', 'error');
        if (Store.course(slug)) return UI.toast('此網址代稱已被使用', 'error');
        c.id = slug;
      }
      var empty = c.chapters.some(function (ch) { return !ch.title.trim() || ch.lessons.some(function (l) { return !l.title.trim(); }); });
      if (empty) return UI.toast('請填寫所有章節與單元名稱', 'error');
      c.title = title;
      c.subtitle = form.subtitle.value.trim();
      c.category = form.category.value;
      c.level = form.level.value;
      c.instructorId = form.instructorId.value;
      c.price = Math.max(0, +form.price.value || 0);
      c.originalPrice = Math.max(0, +form.originalPrice.value || 0);
      c.tags = form.tags.value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
      c.published = form.published.checked;
      c.featured = form.featured.checked;
      c.thumb = { from: form.from.value, to: form.to.value, mark: form.mark.value.trim(), tag: form.tag.value.trim() };
      c.description = form.description.value.trim();
      c.outcomes = form.outcomes.value.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
      c.requirements = form.requirements.value.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
      c.updatedAt = new Date().toISOString().slice(0, 10);
      Store.saveCourse(c);
      UI.toast('課程已儲存');
      C.go('/admin/courses');
    });

    renderThumb();
    renderChapters();
  }

  Views.admin = function (app, params, query) {
    if (!guard()) return;
    var sec = params.section || '';
    if (sec === 'courses') courseList(app);
    else if (sec === 'course') courseEdit(app, params.id);
    else if (sec === 'orders') orders(app, query);
    else if (sec === 'users') users(app);
    else if (sec === 'coupons') coupons(app);
    else dashboard(app);
  };
})();
