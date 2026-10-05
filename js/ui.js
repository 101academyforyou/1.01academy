/* 共用 UI 工具：HTML 跳脫、格式化、圖示、Toast、Modal */
window.UI = (function () {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(n) {
    return 'NT$' + Math.round(Number(n) || 0).toLocaleString('en-US');
  }

  function num(n) {
    return (Number(n) || 0).toLocaleString('en-US');
  }

  // 秒數 → mm:ss 或 h:mm:ss
  function clock(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (h ? String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    return h ? h + ':' + mm : mm;
  }

  // 秒數 → 「x 小時 y 分鐘」
  function hours(sec) {
    var m = Math.round((Number(sec) || 0) / 60);
    var h = Math.floor(m / 60);
    m = m % 60;
    if (!h) return m + ' 分鐘';
    return h + ' 小時' + (m ? ' ' + m + ' 分鐘' : '');
  }

  function date(ts, withTime) {
    if (!ts) return '';
    var d = new Date(ts);
    var s = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
    if (withTime) s += ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return s;
  }

  function uid(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function initials(name) {
    name = String(name || '?').trim();
    if (/^[一-鿿]/.test(name)) return name.slice(0, 1);
    return name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  /* ---------- 圖示（線條風格 SVG） ---------- */
  var P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 8H6.2"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.3a3.5 3.5 0 0 1 0 7.4M18.5 20a6.5 6.5 0 0 0-2.6-5.2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9.5"/><path d="m8 12.5 3 3 5-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    playCircle: '<circle cx="12" cy="12" r="9.5"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
    clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    star: '<path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>',
    infinity: '<path d="M18.2 8a4 4 0 1 1 0 8c-2.4 0-4-2-6.2-4s-3.8-4-6.2-4a4 4 0 1 0 0 8c2.4 0 4-2 6.2-4s3.8-4 6.2-4z"/>',
    smartphone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    shield: '<path d="M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.8-1.2"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
    bank: '<path d="M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M12 3l9 5H3z"/>',
    wallet: '<path d="M20 7V5.5A1.5 1.5 0 0 0 18.5 4H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6"/><circle cx="16" cy="14" r="1.3"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    receipt: '<path d="M5 2.5v19l2.5-1.5 2.5 1.5 2-1.5 2 1.5 2.5-1.5 2.5 1.5v-19L16.5 4 14 2.5 12 4 10 2.5 7.5 4z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v2M11 11v6M15 7v10M19 12v5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.6 5.1A10.5 10.5 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.4 3.4M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1.5V5M15 1.5V5M9 19v3.5M15 19v3.5M1.5 9H5M1.5 15H5M19 9h3.5M19 15h3.5"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    pen: '<path d="m12 19 7-7 3 3-7 7z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="m2 2 7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
    briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2.5 13h19"/>',
    trending: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    cloud: '<path d="M17.5 19H7a5 5 0 1 1 .9-9.9A6.5 6.5 0 0 1 20.4 11 4 4 0 0 1 17.5 19z"/>',
    globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5a14.5 14.5 0 0 1 0 19 14.5 14.5 0 0 1 0-19z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-1L3 20l1.2-4.4A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/>',
    note: '<path d="M14.5 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h6M8 13h8M8 17h5"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    skipForward: '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
    skipBack: '<path d="M19 20 9 12l10-8z"/><path d="M5 19V5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    fileText: '<path d="M14.5 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h6"/>',
    mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }

  function stars(rating) {
    var out = '<span class="stars" aria-label="' + Number(rating).toFixed(1) + ' 顆星">';
    for (var i = 1; i <= 5; i++) {
      out += '<svg class="icon ' + (rating >= i - 0.25 ? '' : 'empty') + '" viewBox="0 0 24 24">' + P.star + '</svg>';
    }
    return out + '</span>';
  }

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    type = type || 'success';
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    var ic = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check';
    el.innerHTML = '<span class="ti">' + icon(ic, 'icon-sm') + '</span><span>' + esc(msg) + '</span>';
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 220);
    }, 2800);
  }

  /* ---------- Modal ---------- */
  function modal(opts) {
    var root = document.getElementById('modal-root');
    var wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<div class="modal ' + (opts.size === 'lg' ? 'modal-lg' : '') + '" role="dialog" aria-modal="true">' +
      (opts.title != null ? '<div class="modal-head"><h3>' + esc(opts.title) + '</h3><button class="icon-btn" data-close aria-label="關閉">' + icon('x') + '</button></div>' : '') +
      '<div class="modal-body ' + (opts.bodyClass || '') + '">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : '') +
      '</div>';
    function close() {
      document.removeEventListener('keydown', onKey);
      wrap.querySelectorAll('video').forEach(function (v) { v.pause(); });
      wrap.remove();
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    root.appendChild(wrap);
    if (opts.onOpen) opts.onOpen(wrap.querySelector('.modal'), close);
    return { el: wrap.querySelector('.modal'), close: close };
  }

  function confirm(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      var m = modal({
        title: opts.title || '請確認',
        body: '<p class="muted mb-0">' + esc(message) + '</p>',
        foot: '<button class="btn btn-ghost" data-close>取消</button><button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(opts.ok || '確定') + '</button>',
        onClose: function () { if (!done) resolve(false); }
      });
      m.el.querySelector('[data-ok]').addEventListener('click', function () { done = true; resolve(true); m.close(); });
    });
  }

  function emptyState(ic, title, text, action) {
    return '<div class="empty fade-in"><div class="ei">' + icon(ic) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (action || '') + '</div>';
  }

  return {
    esc: esc, money: money, num: num, clock: clock, hours: hours, date: date, uid: uid,
    debounce: debounce, initials: initials, icon: icon, stars: stars, toast: toast,
    modal: modal, confirm: confirm, emptyState: emptyState
  };
})();
