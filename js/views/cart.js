window.Views = window.Views || {};

(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon;
  var appliedCoupon = null; // 購物車與結帳頁共用的優惠碼

  function summaryHtml(items, opts) {
    opts = opts || {};
    var subtotal = items.reduce(function (s, c) { return s + c.price; }, 0);
    var original = items.reduce(function (s, c) { return s + Math.max(c.originalPrice || 0, c.price); }, 0);
    var discount = 0, couponErr = '';
    if (appliedCoupon) {
      try { discount = Store.validateCoupon(appliedCoupon, subtotal).discount; }
      catch (e) { couponErr = e.message; }
    }
    var total = Math.max(0, subtotal - discount);
    return {
      subtotal: subtotal, discount: discount, total: total, couponErr: couponErr,
      html:
        '<div class="summary-row"><span>原價</span><span class="mono">' + UI.money(original) + '</span></div>' +
        (original > subtotal ? '<div class="summary-row"><span>限時優惠</span><span class="mono" style="color:var(--success)">-' + UI.money(original - subtotal) + '</span></div>' : '') +
        (discount ? '<div class="summary-row"><span>優惠碼 <span class="badge badge-success mono">' + esc(appliedCoupon) + '</span></span><span class="mono" style="color:var(--success)">-' + UI.money(discount) + '</span></div>' : '') +
        '<div class="summary-row total"><span>應付金額</span><span class="mono">' + UI.money(total) + '</span></div>' +
        (original > total ? '<p class="small mb-0" style="color:var(--success);text-align:right">共省下 ' + UI.money(original - total) + '</p>' : '')
    };
  }

  function couponBox() {
    if (appliedCoupon) {
      return '<div class="applied-coupon"><span>' + icon('tag', 'icon-sm') + ' 已套用 <span class="mono">' + esc(appliedCoupon) + '</span></span><button data-remove-coupon aria-label="移除優惠碼">' + icon('x', 'icon-sm') + '</button></div>';
    }
    return '<form class="coupon-row" data-coupon-form><input class="input" name="code" placeholder="輸入優惠碼" aria-label="優惠碼" /><button class="btn btn-outline btn-sm" style="height:40px">套用</button></form>' +
      '<p class="small subtle mt-8 mb-0">試試看：<button class="mono" data-try="WELCOME10" style="border:none;background:none;color:var(--primary);padding:0">WELCOME10</button></p>';
  }

  function bindCoupon(root, getSubtotal, rerender) {
    root.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-coupon-form]');
      if (!f) return;
      e.preventDefault();
      applyCode(f.code.value);
    });
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-remove-coupon]')) { appliedCoupon = null; rerender(); }
      var t = e.target.closest('[data-try]');
      if (t) applyCode(t.getAttribute('data-try'));
    });
    function applyCode(code) {
      try {
        var r = Store.validateCoupon(code, getSubtotal());
        appliedCoupon = r.code;
        UI.toast('優惠碼已套用，折抵 ' + UI.money(r.discount));
        rerender();
      } catch (err) { UI.toast(err.message, 'error'); }
    }
  }

  /* ================= 購物車 ================= */
  Views.cart = function (app) {
    app.innerHTML = C.pageHead('購物車', '', '<a href="#/">首頁</a>' + icon('chevronRight', 'icon-sm') + '<span>購物車</span>') + '<div class="container" id="cart-body"></div>';
    var body = app.querySelector('#cart-body');

    function items() { return Store.cart().map(Store.course).filter(function (c) { return c && !Store.isEnrolled(c.id); }); }

    function render() {
      var list = items();
      if (!list.length) {
        body.innerHTML = UI.emptyState('cart', '購物車是空的', '去看看有哪些課程能幫你更上一層樓吧！', '<a href="#/courses" class="btn btn-primary">探索課程</a>');
        return;
      }
      var s = summaryHtml(list);
      if (s.couponErr) { appliedCoupon = null; s = summaryHtml(list); }
      body.innerHTML = '<div class="two-col"><div>' +
        '<div class="flex justify-between items-center mb-16"><strong>' + list.length + ' 門課程</strong><button class="btn btn-ghost btn-sm" data-clear-cart>' + icon('trash', 'icon-sm') + '清空購物車</button></div>' +
        '<div class="card">' + list.map(function (c) {
          var ins = Store.instructor(c.instructorId) || {};
          return '<div class="cart-item"><a href="#/course/' + esc(c.id) + '">' + C.thumb(c, { noTag: true }) + '</a>' +
            '<div><a href="#/course/' + esc(c.id) + '"><h3>' + esc(c.title) + '</h3></a><div class="small muted">' + esc(ins.name || '') + ' · ' + UI.hours(Store.totalDuration(c)) + ' · ' + esc(c.level) + '</div>' +
            '<div class="actions"><button data-remove="' + esc(c.id) + '">' + icon('trash', 'icon-sm') + '移除</button>' +
            (Store.currentUser() ? '<button class="save" data-save="' + esc(c.id) + '">' + icon('heart', 'icon-sm') + '移至收藏</button>' : '') + '</div></div>' +
            C.price(c) + '</div>';
        }).join('') + '</div>' +
        '<a href="#/courses" class="btn btn-ghost mt-16">' + icon('chevronLeft', 'icon-sm') + '繼續選購</a></div>' +
        '<aside class="sticky-side"><div class="card card-pad"><h3>訂單摘要</h3>' + s.html +
        '<div class="mt-16">' + couponBox() + '</div>' +
        '<a href="#/checkout" class="btn btn-primary btn-block btn-lg mt-16">前往結帳 ' + icon('arrowRight') + '</a>' +
        '<div class="secure-note">' + icon('lock', 'icon-sm') + 'SSL 安全加密 · 7 天退款保證</div></div></aside></div>';
    }

    bindCoupon(body, function () { return items().reduce(function (s, c) { return s + c.price; }, 0); }, render);
    body.addEventListener('click', function (e) {
      var r = e.target.closest('[data-remove]');
      if (r) { Store.removeFromCart(r.getAttribute('data-remove')); UI.toast('已從購物車移除', 'info'); render(); return; }
      var sv = e.target.closest('[data-save]');
      if (sv) {
        var id = sv.getAttribute('data-save');
        if (!Store.inWishlist(id)) Store.toggleWishlist(id);
        Store.removeFromCart(id); UI.toast('已移至收藏清單'); render(); return;
      }
      if (e.target.closest('[data-clear-cart]')) {
        UI.confirm('確定要清空購物車嗎？', { danger: true, ok: '清空' }).then(function (ok) { if (ok) { Store.clearCart(); render(); } });
      }
    });
    render();
  };

  /* ================= 結帳 ================= */
  Views.checkout = function (app, params, query) {
    if (!C.requireLogin()) return;
    var u = Store.currentUser();
    var ids = query.items ? query.items.split(',') : Store.cart();
    var list = ids.map(Store.course).filter(function (c) { return c && !Store.isEnrolled(c.id); });
    if (!list.length) {
      app.innerHTML = '<div class="container">' + UI.emptyState('cart', '沒有需要結帳的課程', '購物車是空的，或你已擁有這些課程', '<a href="#/courses" class="btn btn-primary">探索課程</a>') + '</div>';
      return;
    }
    var method = 'card';

    app.innerHTML = C.pageHead('結帳', '', '<a href="#/cart">購物車</a>' + icon('chevronRight', 'icon-sm') + '<span>結帳</span>') +
      '<div class="container"><form class="two-col" id="checkout-form" novalidate><div>' +
      '<div class="steps"><div class="step done"><i>' + icon('check', 'icon-sm') + '</i>購物車</div><span class="line"></span><div class="step on"><i>2</i>填寫資料與付款</div><span class="line"></span><div class="step"><i>3</i>完成訂單</div></div>' +

      '<div class="card card-pad mb-24"><h3>' + icon('user') + ' 購買人資料</h3>' +
      '<div class="row mt-16"><div class="field"><label for="b-name">姓名</label><input class="input" id="b-name" name="name" required value="' + esc(u.name) + '" /></div>' +
      '<div class="field"><label for="b-email">Email（收據寄送）</label><input class="input" id="b-email" name="email" type="email" required value="' + esc(u.email) + '" /></div></div>' +
      '<div class="row"><div class="field"><label for="b-phone">手機號碼</label><input class="input" id="b-phone" name="phone" inputmode="tel" placeholder="09xx-xxx-xxx" value="' + esc(u.phone || '') + '" /></div>' +
      '<div class="field"><label for="b-inv">發票類型</label><select class="select" id="b-inv" name="invoice"><option value="personal">個人電子發票（會員載具）</option><option value="mobile">手機條碼載具</option><option value="company">公司發票（統一編號）</option><option value="donate">捐贈發票</option></select></div></div>' +
      '<div class="row hidden" id="company-fields"><div class="field"><label for="b-tax">統一編號</label><input class="input mono" id="b-tax" name="taxId" maxlength="8" inputmode="numeric" placeholder="8 碼數字" /></div><div class="field"><label for="b-title">公司抬頭</label><input class="input" id="b-title" name="companyTitle" /></div></div>' +
      '<div class="field hidden" id="mobile-fields"><label for="b-carrier">手機條碼</label><input class="input mono" id="b-carrier" name="carrier" placeholder="/ABC+123" maxlength="8" /></div>' +
      '</div>' +

      '<div class="card card-pad"><h3>' + icon('wallet') + ' 付款方式</h3><div class="pay-methods mt-16">' +
      pm('card', 'card', '信用卡 / 金融卡', '一次付清，立即開通課程', '<div class="brands"><b>VISA</b><b>MC</b><b>JCB</b></div>') +
      pm('linepay', 'smartphone', 'LINE Pay', '使用 LINE Pay 快速付款') +
      pm('atm', 'bank', 'ATM 虛擬帳號轉帳', '3 天內完成轉帳，入帳後自動開通') +
      '</div><div id="card-fields">' +
      '<div class="card-preview"><div class="flex justify-between items-center"><div class="chip-ic"></div><span>1.01 PAY</span></div><div class="num" id="cp-num">•••• •••• •••• ••••</div><div class="row2"><div><small>Card Holder</small><span id="cp-name">' + esc(u.name) + '</span></div><div><small>Expires</small><span id="cp-exp">MM/YY</span></div></div></div>' +
      '<div class="field"><label for="cc-num">卡號</label><input class="input mono" id="cc-num" name="cc" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" maxlength="19" /></div>' +
      '<div class="row"><div class="field"><label for="cc-exp">有效期限</label><input class="input mono" id="cc-exp" name="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5" /></div>' +
      '<div class="field"><label for="cc-cvc">安全碼</label><input class="input mono" id="cc-cvc" name="cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC" maxlength="4" /></div></div>' +
      '<p class="small subtle mb-0">' + icon('info', 'icon-sm') + ' 示範模式：可使用測試卡號 <span class="mono">4242 4242 4242 4242</span>，任一未來日期與 3 碼安全碼。</p></div>' +
      '<label class="check mt-16"><input type="checkbox" name="agree" required /> 我已閱讀並同意 <a href="#/" style="color:var(--primary)">服務條款</a> 與 <a href="#/" style="color:var(--primary)">退款政策</a></label>' +
      '</div></div>' +

      '<aside class="sticky-side"><div class="card card-pad"><h3>訂單明細</h3>' +
      list.map(function (c) { return '<div class="flex justify-between gap-12 small" style="padding:8px 0;border-bottom:1px dashed var(--border)"><span>' + esc(c.title) + '</span><span class="mono" style="white-space:nowrap">' + UI.money(c.price) + '</span></div>'; }).join('') +
      '<div class="mt-16" id="co-coupon"></div><div id="co-summary" class="mt-8"></div>' +
      '<button class="btn btn-primary btn-block btn-lg mt-16" id="pay-btn">' + icon('lock') + '<span>確認付款</span></button>' +
      '<div class="secure-note">' + icon('shield', 'icon-sm') + '交易經 256-bit SSL 加密保護</div></div></aside>' +
      '</form></div>';

    function pm(val, ic, title, desc, extra) {
      return '<label class="pay-method ' + (val === method ? 'active' : '') + '"><input type="radio" name="method" value="' + val + '" ' + (val === method ? 'checked' : '') + ' /><span class="pm-icon">' + icon(ic) + '</span><span><strong>' + title + '</strong><span>' + desc + '</span></span>' + (extra || '') + '</label>';
    }

    var form = app.querySelector('#checkout-form');
    var subtotal = list.reduce(function (s, c) { return s + c.price; }, 0);
    var totals;

    function renderSummary() {
      totals = summaryHtml(list);
      if (totals.couponErr) { UI.toast(totals.couponErr, 'error'); appliedCoupon = null; totals = summaryHtml(list); }
      app.querySelector('#co-coupon').innerHTML = couponBox();
      app.querySelector('#co-summary').innerHTML = totals.html;
      app.querySelector('#pay-btn span').textContent = totals.total ? '確認付款 ' + UI.money(totals.total) : '確認送出';
    }
    bindCoupon(app.querySelector('#co-coupon'), function () { return subtotal; }, renderSummary);
    renderSummary();

    form.addEventListener('change', function (e) {
      if (e.target.name === 'method') {
        method = e.target.value;
        form.querySelectorAll('.pay-method').forEach(function (l) { l.classList.toggle('active', l.querySelector('input').checked); });
        form.querySelector('#card-fields').classList.toggle('hidden', method !== 'card');
      }
      if (e.target.name === 'invoice') {
        form.querySelector('#company-fields').classList.toggle('hidden', e.target.value !== 'company');
        form.querySelector('#mobile-fields').classList.toggle('hidden', e.target.value !== 'mobile');
      }
    });

    // 信用卡欄位格式化與預覽
    var ccNum = form.querySelector('#cc-num'), ccExp = form.querySelector('#cc-exp'), ccCvc = form.querySelector('#cc-cvc');
    ccNum.addEventListener('input', function () {
      var d = ccNum.value.replace(/\D/g, '').slice(0, 16);
      ccNum.value = d.replace(/(.{4})/g, '$1 ').trim();
      var shown = (d + '•'.repeat(16 - d.length)).replace(/(.{4})/g, '$1 ').trim();
      app.querySelector('#cp-num').textContent = shown;
    });
    ccExp.addEventListener('input', function () {
      var d = ccExp.value.replace(/\D/g, '').slice(0, 4);
      ccExp.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
      app.querySelector('#cp-exp').textContent = ccExp.value || 'MM/YY';
    });
    ccCvc.addEventListener('input', function () { ccCvc.value = ccCvc.value.replace(/\D/g, '').slice(0, 4); });
    form.querySelector('#b-name').addEventListener('input', function (e) { app.querySelector('#cp-name').textContent = e.target.value || 'NAME'; });

    function luhn(n) {
      var sum = 0, alt = false;
      for (var i = n.length - 1; i >= 0; i--) {
        var d = +n[i];
        if (alt) { d *= 2; if (d > 9) d -= 9; }
        sum += d; alt = !alt;
      }
      return n.length >= 13 && sum % 10 === 0;
    }

    function fail(input, msg) {
      UI.toast(msg, 'error');
      if (input) { input.classList.add('invalid'); input.focus(); input.addEventListener('input', function () { input.classList.remove('invalid'); }, { once: true }); }
      return false;
    }

    function validate() {
      if (!form.elements.name.value.trim()) return fail(form.elements.name, '請填寫姓名');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) return fail(form.email, 'Email 格式不正確');
      if (form.phone.value && !/^09\d{2}-?\d{3}-?\d{3}$/.test(form.phone.value.trim())) return fail(form.phone, '手機號碼格式不正確');
      if (form.invoice.value === 'company') {
        if (!/^\d{8}$/.test(form.taxId.value)) return fail(form.taxId, '統一編號需為 8 碼數字');
        if (!form.companyTitle.value.trim()) return fail(form.companyTitle, '請填寫公司抬頭');
      }
      if (form.invoice.value === 'mobile' && !/^\/[0-9A-Z.+-]{7}$/.test(form.carrier.value.trim().toUpperCase())) return fail(form.carrier, '手機條碼格式不正確（/ 開頭共 8 碼）');
      if (method === 'card' && totals.total > 0) {
        if (!luhn(ccNum.value.replace(/\s/g, ''))) return fail(ccNum, '信用卡號無效');
        var m = /^(\d{2})\/(\d{2})$/.exec(ccExp.value);
        if (!m || +m[1] < 1 || +m[1] > 12) return fail(ccExp, '有效期限格式為 MM/YY');
        var exp = new Date(2000 + +m[2], +m[1], 0, 23, 59, 59);
        if (exp < new Date()) return fail(ccExp, '信用卡已過期');
        if (!/^\d{3,4}$/.test(ccCvc.value)) return fail(ccCvc, '安全碼需為 3–4 碼');
      }
      if (!form.agree.checked) return fail(null, '請先同意服務條款與退款政策');
      return true;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      var payMethod = totals.total === 0 ? 'free' : method;
      var overlay = document.createElement('div');
      overlay.className = 'processing';
      overlay.innerHTML = '<div class="box"><div class="spinner"></div><strong>' + (payMethod === 'atm' ? '正在產生轉帳帳號…' : payMethod === 'linepay' ? '正在連線 LINE Pay…' : '付款處理中…') + '</strong><p class="small muted">請勿關閉或重新整理頁面</p></div>';
      document.body.appendChild(overlay);
      setTimeout(function () {
        overlay.remove();
        try {
          var cardNum = ccNum.value.replace(/\s/g, '');
          var order = Store.checkout(list.map(function (c) { return c.id; }), appliedCoupon, payMethod, {
            name: form.elements.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(),
            invoice: form.invoice.value, taxId: form.taxId.value, companyTitle: form.companyTitle.value.trim(), carrier: form.carrier.value.trim().toUpperCase(),
            cardLast4: payMethod === 'card' ? cardNum.slice(-4) : null
          });
          appliedCoupon = null;
          C.go('/order/' + order.id + '?new=1');
        } catch (err) { UI.toast(err.message, 'error'); }
      }, 1400);
    });
  };

  /* ================= 訂單完成 / 明細 ================= */
  var METHOD = { card: '信用卡', linepay: 'LINE Pay', atm: 'ATM 轉帳', free: '免費課程' };
  var STATUS = { paid: ['已付款', 'success'], pending: ['待付款', 'warning'], refunded: ['已退款', 'danger'], cancelled: ['已取消', ''] };
  Views.METHOD = METHOD; Views.STATUS = STATUS;

  Views.order = function (app, params, query) {
    if (!C.requireLogin()) return;
    var o = Store.order(params.id);
    if (!o) { app.innerHTML = '<div class="container">' + UI.emptyState('receipt', '找不到訂單', '訂單不存在或你沒有檢視權限', '<a class="btn btn-primary" href="#/orders">我的訂單</a>') + '</div>'; return; }
    var st = STATUS[o.status] || [o.status, ''];
    var isNew = query.new === '1';
    var head = '';
    if (isNew && o.status === 'paid') {
      head = '<div class="success-hero"><div class="ok">' + icon('check') + '</div><h1>付款成功！</h1><p class="muted">感謝你的購買，課程已開通，現在就開始學習吧！</p>' +
        '<div class="flex gap-12 wrap" style="justify-content:center">' + (o.items.length === 1 ? '<a class="btn btn-primary btn-lg" href="#/learn/' + esc(o.items[0].courseId) + '">' + icon('play') + '開始上課</a>' : '<a class="btn btn-primary btn-lg" href="#/my-courses">' + icon('book') + '前往我的課程</a>') +
        '<a class="btn btn-outline btn-lg" href="#/courses">繼續逛逛</a></div></div>';
    } else if (isNew && o.status === 'pending') {
      head = '<div class="success-hero"><div class="ok" style="background:var(--warning-soft);color:var(--warning)">' + icon('clock') + '</div><h1>訂單已成立</h1><p class="muted">請於期限內完成 ATM 轉帳，款項確認後課程將自動開通。</p></div>';
    }
    app.innerHTML = (head ? '' : C.pageHead('訂單明細', '', '<a href="#/orders">訂單紀錄</a>' + icon('chevronRight', 'icon-sm') + '<span class="mono">' + esc(o.id) + '</span>')) +
      '<div class="container" style="max-width:820px">' + head +
      (o.status === 'pending' && o.atm ? '<div class="atm-box mt-24 mb-24"><strong>' + icon('bank') + ' ATM 轉帳資訊</strong><dl class="kv mt-16"><dt>銀行代碼</dt><dd class="mono">' + esc(o.atm.bank) + '</dd><dt>虛擬帳號</dt><dd class="mono" style="font-size:18px">' + esc(o.atm.account.replace(/(\d{4})/g, '$1 ')) + '</dd><dt>應付金額</dt><dd class="mono">' + UI.money(o.total) + '</dd><dt>繳費期限</dt><dd>' + UI.date(o.atm.expireAt, true) + '</dd></dl>' +
        '<p class="small muted mt-16 mb-0">示範模式：管理員可在後台「訂單管理」中將此訂單標記為已付款。</p></div>' : '') +
      '<div class="card card-pad mt-24"><div class="flex justify-between items-center wrap gap-8 mb-16"><h3 class="mb-0">訂單資訊</h3><span class="badge badge-' + st[1] + '">' + st[0] + '</span></div>' +
      '<dl class="kv"><dt>訂單編號</dt><dd class="mono">' + esc(o.id) + '</dd><dt>訂購時間</dt><dd>' + UI.date(o.createdAt, true) + '</dd>' +
      '<dt>付款方式</dt><dd>' + esc(METHOD[o.method] || o.method) + (o.billing && o.billing.cardLast4 ? ' <span class="mono subtle">•••• ' + esc(o.billing.cardLast4) + '</span>' : '') + '</dd>' +
      (o.paidAt ? '<dt>付款時間</dt><dd>' + UI.date(o.paidAt, true) + '</dd>' : '') +
      '<dt>購買人</dt><dd>' + esc(o.billing ? o.billing.name : '') + '（' + esc(o.billing ? o.billing.email : '') + '）</dd>' +
      (o.billing && o.billing.taxId ? '<dt>統一編號</dt><dd class="mono">' + esc(o.billing.taxId) + ' ' + esc(o.billing.companyTitle) + '</dd>' : '') + '</dl>' +
      '<div class="table-wrap mt-24"><table class="table"><thead><tr><th>課程</th><th style="text-align:right">金額</th></tr></thead><tbody>' +
      o.items.map(function (it) { return '<tr><td><a href="#/course/' + esc(it.courseId) + '">' + esc(it.title) + '</a></td><td class="mono" style="text-align:right">' + UI.money(it.price) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<div style="max-width:320px;margin-left:auto" class="mt-16"><div class="summary-row"><span>小計</span><span class="mono">' + UI.money(o.subtotal) + '</span></div>' +
      (o.discount ? '<div class="summary-row"><span>優惠碼 ' + esc(o.coupon) + '</span><span class="mono">-' + UI.money(o.discount) + '</span></div>' : '') +
      '<div class="summary-row total"><span>總計</span><span class="mono">' + UI.money(o.total) + '</span></div></div></div>' +
      '<div class="flex gap-12 mt-24 wrap no-print"><a href="#/orders" class="btn btn-ghost">' + icon('chevronLeft', 'icon-sm') + '所有訂單</a><button class="btn btn-outline" onclick="window.print()">' + icon('printer', 'icon-sm') + '列印收據</button>' +
      (o.status === 'pending' ? '<button class="btn btn-danger" id="cancel-order">取消訂單</button>' : '') + '</div></div>';

    var cancel = app.querySelector('#cancel-order');
    if (cancel) cancel.addEventListener('click', function () {
      UI.confirm('確定要取消這筆訂單嗎？', { danger: true, ok: '取消訂單' }).then(function (ok) {
        if (ok) { Store.cancelOrder(o.id); UI.toast('訂單已取消', 'info'); Views.order(app, params, {}); }
      });
    });
  };
})();
