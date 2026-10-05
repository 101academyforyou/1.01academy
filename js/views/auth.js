window.Views = window.Views || {};

(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon;

  function side() {
    return '<div class="auth-side"><a href="#/" class="logo" style="color:#fff;margin-bottom:40px"><span class="logo-mark">1.01</span><span>1.01 Academy</span></a>' +
      '<div class="mono" style="font-size:44px;font-weight:700;margin-bottom:16px"><span class="grad-text">1.01<sup style="font-size:.5em">365</sup></span> = 37.78</div>' +
      '<h2>每天進步一點點，<br>累積驚人的成長</h2>' +
      '<ul><li>' + icon('checkCircle') + '超過 40,000 位學員的選擇</li><li>' + icon('checkCircle') + '業界專家親自授課，專案導向</li><li>' + icon('checkCircle') + '一次購買，永久觀看</li><li>' + icon('checkCircle') + '完課即可獲得結業證書</li></ul></div>';
  }

  function pwField(id, label, auto, extra) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="input-group">' + icon('lock') +
      '<input class="input" id="' + id + '" name="' + id + '" type="password" autocomplete="' + auto + '" required minlength="6" style="padding-right:44px" />' +
      '<button type="button" class="pw-toggle" data-pw="' + id + '" aria-label="顯示密碼">' + icon('eye', 'icon-sm') + '</button></div>' + (extra || '') + '</div>';
  }

  function bindPw(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pw]');
      if (!b) return;
      var inp = root.querySelector('#' + b.getAttribute('data-pw'));
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = icon(show ? 'eyeOff' : 'eye', 'icon-sm');
    });
  }

  function safeNext(next) {
    // 只允許站內路徑，避免開放式重導
    return next && next.charAt(0) === '/' && next.charAt(1) !== '/' ? next : null;
  }

  Views.login = function (app, params, query) {
    var next = safeNext(query.next);
    if (Store.currentUser()) { C.go(next || '/my-courses'); return; }
    app.innerHTML = '<div class="auth-wrap">' + side() + '<div class="auth-form"><div class="inner fade-in">' +
      '<h1>歡迎回來 👋</h1><p class="muted">登入以繼續你的學習旅程</p>' +
      '<form id="login-form" class="mt-24" novalidate>' +
      '<div class="field"><label for="email">Email</label><div class="input-group">' + icon('mail') + '<input class="input" id="email" name="email" type="email" autocomplete="email" required /></div></div>' +
      pwField('password', '密碼', 'current-password') +
      '<div class="flex justify-between items-center mb-16"><label class="check"><input type="checkbox" checked /> 保持登入</label><a href="#" class="small" id="forgot" style="color:var(--primary)">忘記密碼？</a></div>' +
      '<button class="btn btn-primary btn-block btn-lg">登入</button></form>' +
      '<p class="text-center muted mt-24">還沒有帳號？<a href="#/register' + (next ? '?next=' + encodeURIComponent(next) : '') + '" style="color:var(--primary);font-weight:600">免費註冊</a></p>' +
      '<div class="demo-box">' + icon('info', 'icon-sm') + ' 示範管理員帳號：<code>admin@101academy.com</code> / <code>admin123</code> <button class="btn btn-soft btn-sm" id="fill-admin" style="margin-left:4px;height:26px">帶入</button></div>' +
      '</div></div></div>';

    var f = app.querySelector('#login-form');
    bindPw(app);
    app.querySelector('#fill-admin').addEventListener('click', function () {
      f.email.value = 'admin@101academy.com'; f.password.value = 'admin123';
    });
    app.querySelector('#forgot').addEventListener('click', function (e) {
      e.preventDefault();
      UI.modal({ title: '重設密碼', body: '<p class="muted">請輸入註冊 Email，我們會寄送重設密碼連結給你。</p><input class="input" type="email" placeholder="you@example.com" id="fp-email" />',
        foot: '<button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" data-close id="fp-send">寄送連結</button>',
        onOpen: function (m) { m.querySelector('#fp-send').addEventListener('click', function () { UI.toast('若此 Email 已註冊，你將收到重設密碼信件', 'info'); }); } });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.email.value || !f.password.value) { UI.toast('請輸入 Email 與密碼', 'error'); return; }
      try {
        var u = Store.login(f.email.value, f.password.value);
        UI.toast('歡迎回來，' + u.name + '！');
        C.go(next || (u.role === 'admin' ? '/admin' : '/my-courses'));
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  };

  Views.register = function (app, params, query) {
    var next = safeNext(query.next);
    if (Store.currentUser()) { C.go(next || '/my-courses'); return; }
    app.innerHTML = '<div class="auth-wrap">' + side() + '<div class="auth-form"><div class="inner fade-in">' +
      '<h1>建立免費帳號</h1><p class="muted">加入 1.01 Academy，開始每天進步 1%</p>' +
      '<form id="reg-form" class="mt-24" novalidate>' +
      '<div class="field"><label for="name">姓名 / 暱稱</label><div class="input-group">' + icon('user') + '<input class="input" id="name" name="fullname" autocomplete="name" required maxlength="40" /></div></div>' +
      '<div class="field"><label for="email">Email</label><div class="input-group">' + icon('mail') + '<input class="input" id="email" name="email" type="email" autocomplete="email" required /></div></div>' +
      pwField('password', '密碼', 'new-password', '<div class="progress mt-8" style="height:4px"><i id="pw-meter" style="width:0"></i></div><span class="hint" id="pw-hint">至少 6 個字元，建議混合英數與符號</span>') +
      pwField('password2', '確認密碼', 'new-password') +
      '<label class="check mb-16"><input type="checkbox" name="agree" /> 我同意服務條款與隱私權政策</label>' +
      '<button class="btn btn-primary btn-block btn-lg">建立帳號</button></form>' +
      '<p class="text-center muted mt-24">已經有帳號了？<a href="#/login' + (next ? '?next=' + encodeURIComponent(next) : '') + '" style="color:var(--primary);font-weight:600">登入</a></p>' +
      '</div></div></div>';

    var f = app.querySelector('#reg-form');
    bindPw(app);
    f.password.addEventListener('input', function () {
      var v = f.password.value, s = 0;
      if (v.length >= 6) s++; if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
      var labels = ['太短', '弱', '普通', '中等', '強', '非常強'];
      var colors = ['var(--danger)', 'var(--danger)', 'var(--warning)', 'var(--warning)', 'var(--success)', 'var(--success)'];
      var m = app.querySelector('#pw-meter');
      m.style.width = (s / 5 * 100) + '%'; m.style.background = colors[s];
      app.querySelector('#pw-hint').textContent = '密碼強度：' + labels[s];
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.fullname.value.trim(), email = f.email.value.trim();
      if (!name) return UI.toast('請輸入姓名', 'error');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return UI.toast('Email 格式不正確', 'error');
      if (f.password.value.length < 6) return UI.toast('密碼至少需要 6 個字元', 'error');
      if (f.password.value !== f.password2.value) return UI.toast('兩次輸入的密碼不一致', 'error');
      if (!f.agree.checked) return UI.toast('請先同意服務條款', 'error');
      try {
        Store.register(name, email, f.password.value);
        UI.toast('註冊成功！新會員優惠碼 WELCOME10 已可使用');
        C.go(next || '/courses');
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  };
})();
