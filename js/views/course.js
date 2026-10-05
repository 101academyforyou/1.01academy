window.Views = window.Views || {};

Views.course = function (app, params) {
  'use strict';
  var esc = UI.esc, icon = UI.icon;
  var c = Store.course(params.id);
  if (!c || (!c.published && !Store.isAdmin())) {
    app.innerHTML = '<div class="container">' + UI.emptyState('alert', '找不到這門課程', '課程可能已下架或網址有誤', '<a class="btn btn-primary" href="#/courses">瀏覽其他課程</a>') + '</div>';
    return;
  }
  var ins = Store.instructor(c.instructorId) || { name: '講師', title: '', bio: '' };
  var insStats = Store.instructorStats(ins.id);
  var cat = Store.category(c.category) || {};
  var lessons = Store.lessons(c);
  var previews = lessons.filter(function (l) { return l.preview; });
  var timer;

  function buyBox() {
    var owned = Store.isEnrolled(c.id);
    var inCart = Store.inCart(c.id);
    var pct = owned ? Store.percent(c.id) : 0;
    var html = '';
    if (owned) {
      html = '<div class="badge badge-success mb-16">' + icon('checkCircle', 'icon-sm') + '你已擁有此課程</div>' +
        '<div class="flex justify-between small muted mb-8"><span>學習進度</span><span class="mono">' + pct + '%</span></div>' +
        '<div class="progress mb-16"><i style="width:' + pct + '%"></i></div>' +
        '<a href="#/learn/' + encodeURIComponent(c.id) + '" class="btn btn-primary btn-block btn-lg">' + icon('play') + (pct ? '繼續學習' : '開始上課') + '</a>';
    } else if (!c.price) {
      html = '<div class="price mb-16"><span class="free" style="font-size:28px">免費</span></div>' +
        '<button class="btn btn-primary btn-block btn-lg" data-act="free">' + icon('zap') + '立即免費加入</button>';
    } else {
      var off = c.originalPrice > c.price ? Math.round((1 - c.price / c.originalPrice) * 100) : 0;
      html = '<div class="flex items-center gap-12 wrap">' + C.price(c) + (off ? '<span class="discount-tag">' + off + '% OFF</span>' : '') + '</div>' +
        (off ? '<div class="countdown">' + icon('clock', 'icon-sm') + '<span>優惠倒數 <b class="mono" id="cd">--:--:--</b></span></div>' : '') +
        '<div class="flex gap-8 mt-16" style="flex-direction:column">' +
        (inCart
          ? '<a href="#/cart" class="btn btn-outline btn-block btn-lg">' + icon('cart') + '前往購物車</a>'
          : '<button class="btn btn-outline btn-block btn-lg" data-act="cart">' + icon('cart') + '加入購物車</button>') +
        '<button class="btn btn-primary btn-block btn-lg" data-act="buy">立即購買</button></div>' +
        '<p class="small subtle text-center mt-8 mb-0">7 天內不滿意可申請全額退款</p>';
    }
    return html;
  }

  function renderSide() {
    var wished = Store.inWishlist(c.id);
    app.querySelector('#buy-card').innerHTML =
      C.thumb(c, { lg: true, noTag: true, extra: previews.length ? '<span class="play">' + icon('play', 'icon-lg') + '</span><span class="preview-lbl">預覽此課程</span>' : '' }) +
      '<div class="card-pad">' + buyBox() +
      '<div class="flex gap-8 mt-16"><button class="btn btn-ghost btn-sm" data-act="wish" style="flex:1">' + icon('heart', 'icon-sm') + (wished ? '已收藏' : '加入收藏') + '</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="share" style="flex:1">' + icon('copy', 'icon-sm') + '分享課程</button></div>' +
      '<hr style="border:none;border-top:1px solid var(--border);margin:18px 0">' +
      '<strong class="small">課程包含</strong><ul class="mt-8">' +
      '<li>' + icon('playCircle') + UI.hours(Store.totalDuration(c)) + ' 隨選影片</li>' +
      '<li>' + icon('layers') + lessons.length + ' 個單元 · ' + c.chapters.length + ' 個章節</li>' +
      '<li>' + icon('infinity') + '永久觀看權限</li>' +
      '<li>' + icon('smartphone') + '支援手機、平板與電腦</li>' +
      '<li>' + icon('note') + '影片時間點筆記</li>' +
      '<li>' + icon('award') + '結業證書</li></ul></div>';
    startCountdown();
  }

  function startCountdown() {
    clearInterval(timer);
    var el = app.querySelector('#cd');
    if (!el) return;
    function tick() {
      if (!document.body.contains(el)) { clearInterval(timer); return; }
      var end = new Date(); end.setHours(23, 59, 59, 999);
      var s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      el.textContent = [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
    }
    tick();
    timer = setInterval(tick, 1000);
  }

  function curriculum() {
    return '<div class="flex justify-between items-center wrap gap-8 mb-16"><span class="muted small">' + c.chapters.length + ' 個章節 · ' + lessons.length + ' 個單元 · 總長 ' + UI.hours(Store.totalDuration(c)) + '</span>' +
      '<button class="btn btn-ghost btn-sm" id="toggle-all">全部展開</button></div>' +
      '<div class="curriculum">' + c.chapters.map(function (ch, i) {
        var dur = ch.lessons.reduce(function (s, l) { return s + l.duration; }, 0);
        return '<details class="chapter" ' + (i === 0 ? 'open' : '') + '><summary>' + icon('chevronRight', 'chev') +
          '<span>' + esc(ch.title) + '</span><span class="cm">' + ch.lessons.length + ' 單元 · ' + UI.clock(dur) + '</span></summary>' +
          ch.lessons.map(function (l) {
            return '<div class="lesson-row">' + icon(l.preview || Store.isEnrolled(c.id) ? 'playCircle' : 'lock', 'icon-sm') + '<span>' + esc(l.title) + '</span>' +
              '<span class="dur">' + (l.preview ? '<button class="prev" data-preview="' + esc(l.id) + '">免費試看</button> · ' : '') + UI.clock(l.duration) + '</span></div>';
          }).join('') + '</details>';
      }).join('') + '</div>';
  }

  function reviewsHtml() {
    var r = Store.rating(c);
    var d = Store.ratingDistribution(c);
    var list = Store.courseReviews(c.id);
    var mine = Store.myReview(c.id);
    var form = '';
    if (Store.isEnrolled(c.id)) {
      form = '<div class="card card-pad mb-24"><strong>' + (mine ? '更新你的評價' : '分享你的學習心得') + '</strong>' +
        '<form id="review-form" class="mt-8"><div class="star-input mb-8" id="star-input">' +
        [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-star="' + n + '" aria-label="' + n + ' 顆星">' + '<svg class="icon" viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg></button>'; }).join('') +
        '</div><textarea class="textarea" name="comment" placeholder="這門課對你有什麼幫助？" required maxlength="1000">' + esc(mine ? mine.comment : '') + '</textarea>' +
        '<button class="btn btn-primary mt-16">送出評價</button></form></div>';
    }
    return '<div class="review-summary"><div class="text-center"><div class="big">' + r.avg.toFixed(1) + '</div><div class="mt-8">' + UI.stars(r.avg) + '</div><div class="small subtle mt-8">' + UI.num(r.count) + ' 則評價</div></div>' +
      '<div class="bars">' + [5, 4, 3, 2, 1].map(function (n) {
        var pct = d.count ? Math.round(d.dist[n - 1] / d.count * 100) : 0;
        return '<div class="bar-row"><span>' + n + ' 星</span><div class="progress"><i style="width:' + pct + '%"></i></div><span class="mono">' + pct + '%</span></div>';
      }).join('') + '</div></div>' + form +
      list.map(function (rv) {
        return '<div class="review"><div class="rh"><span class="avatar">' + esc(UI.initials(rv.userName)) + '</span><div><strong>' + esc(rv.userName) + '</strong>' +
          '<span class="flex items-center gap-8">' + UI.stars(rv.rating) + '<span class="small subtle">' + UI.date(rv.createdAt) + '</span></span></div></div><p>' + esc(rv.comment) + '</p></div>';
      }).join('');
  }

  var tabs = {
    overview: function () {
      return '<div class="card card-pad mb-24"><h3>你將學到</h3><ul class="outcomes mt-16">' +
        (c.outcomes || []).map(function (o) { return '<li>' + icon('check', 'icon-sm') + '<span>' + esc(o) + '</span></li>'; }).join('') + '</ul></div>' +
        '<h3>課程介紹</h3><div class="prose">' + String(c.description || '').split(/\n+/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
        '<h3 class="mt-24">課前準備</h3><div class="prose"><ul>' + (c.requirements || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>' +
        (c.tags && c.tags.length ? '<div class="flex gap-8 wrap mt-16">' + c.tags.map(function (t) { return '<a class="chip" href="#/courses?q=' + encodeURIComponent(t) + '">#' + esc(t) + '</a>'; }).join('') + '</div>' : '');
    },
    curriculum: curriculum,
    instructor: function () {
      var others = Store.courses().filter(function (x) { return x.instructorId === ins.id && x.id !== c.id; });
      return '<div class="card card-pad"><div class="instructor-card"><span class="avatar avatar-lg">' + esc(UI.initials(ins.name)) + '</span><div>' +
        '<h3 class="mb-0">' + esc(ins.name) + '</h3><div class="muted small">' + esc(ins.title) + '</div>' +
        '<div class="stats"><span>' + icon('star', 'icon-sm') + insStats.rating.toFixed(1) + ' 講師評價</span><span>' + icon('users', 'icon-sm') + UI.num(insStats.students) + ' 位學員</span><span>' + icon('playCircle', 'icon-sm') + insStats.courses + ' 門課程</span></div>' +
        '<p class="muted mb-0">' + esc(ins.bio) + '</p></div></div></div>' +
        (others.length ? '<h3 class="mt-32">' + esc(ins.name) + ' 的其他課程</h3><div class="course-grid mt-16">' + others.map(C.courseCard).join('') + '</div>' : '');
    },
    reviews: reviewsHtml
  };
  var currentTab = 'overview';

  app.innerHTML =
    '<section class="cd-hero"><div class="container"><div class="cd-layout"><div>' +
    '<div class="breadcrumb"><a href="#/">首頁</a>' + icon('chevronRight', 'icon-sm') + '<a href="#/courses?cat=' + esc(c.category) + '">' + esc(cat.name || '') + '</a>' + icon('chevronRight', 'icon-sm') + '<span>' + esc(c.title) + '</span></div>' +
    (c.published ? '' : '<span class="badge badge-warning mb-8">未上架（僅管理員可見）</span>') +
    '<h1>' + esc(c.title) + '</h1><p class="sub">' + esc(c.subtitle) + '</p>' +
    '<div class="meta">' + (Store.studentCount(c) > 3000 ? '<span class="badge badge-grad">熱銷課程</span>' : '') + C.ratingInline(c) +
    '<span>' + icon('users', 'icon-sm') + UI.num(Store.studentCount(c)) + ' 位學員</span>' +
    '<span>' + icon('layers', 'icon-sm') + esc(c.level) + '</span>' +
    '<span>' + icon('calendar', 'icon-sm') + '更新於 ' + esc(c.updatedAt) + '</span>' +
    '<span>' + icon('globe', 'icon-sm') + esc(c.language || '中文') + '</span></div>' +
    '<div class="meta">講師 <a href="#" data-tab-link="instructor" style="color:#fff;font-weight:600;text-decoration:underline">' + esc(ins.name) + '</a></div>' +
    '</div><div></div></div></div></section>' +
    '<div class="container"><div class="cd-layout">' +
    '<div class="cd-main"><div class="tabs" role="tablist">' +
    [['overview', '課程概覽'], ['curriculum', '課程內容'], ['instructor', '講師介紹'], ['reviews', '學員評價']].map(function (t) {
      return '<button role="tab" data-tab="' + t[0] + '" class="' + (t[0] === currentTab ? 'active' : '') + '">' + t[1] + '</button>';
    }).join('') + '</div><div id="tab-body" class="fade-in"></div></div>' +
    '<aside class="cd-side"><div class="card buy-card" id="buy-card"></div></aside>' +
    '</div></div>';

  function showTab(name) {
    currentTab = name;
    app.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
    app.querySelector('#tab-body').innerHTML = tabs[name]();
    if (name === 'reviews') bindReviewForm();
  }

  function bindReviewForm() {
    var f = app.querySelector('#review-form');
    if (!f) return;
    var mine = Store.myReview(c.id);
    var val = mine ? mine.rating : 5;
    var starsEl = app.querySelector('#star-input');
    function paint() { starsEl.querySelectorAll('[data-star]').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-star') <= val); }); }
    starsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-star]'); if (b) { val = +b.getAttribute('data-star'); paint(); } });
    paint();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      try {
        Store.addReview(c.id, val, f.comment.value.trim());
        UI.toast('感謝你的評價！');
        showTab('reviews');
      } catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  function openPreview(lessonId) {
    var l = lessonId ? Store.findLesson(c, lessonId) : previews[0];
    if (!l) return;
    var list = previews.map(function (p) {
      return '<button class="ps-lesson ' + (p.id === l.id ? 'active' : '') + '" data-pv="' + esc(p.id) + '">' + icon('playCircle', 'icon-sm') + '<span class="lt">' + esc(p.title) + '<small>' + UI.clock(p.duration) + '</small></span></button>';
    }).join('');
    UI.modal({
      title: '課程預覽：' + c.title, size: 'lg', bodyClass: 'modal-video',
      body: '<video controls autoplay playsinline src="' + esc(l.video) + '"></video><div style="background:var(--bg-elev)"><div class="ps-chapter">免費試看單元</div>' + list + '</div>',
      onOpen: function (m) {
        m.addEventListener('click', function (e) {
          var b = e.target.closest('[data-pv]');
          if (!b) return;
          var nl = Store.findLesson(c, b.getAttribute('data-pv'));
          var v = m.querySelector('video');
          v.src = nl.video; v.play().catch(function () {});
          m.querySelectorAll('[data-pv]').forEach(function (x) { x.classList.toggle('active', x === b); });
        });
      }
    });
  }

  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (t) { showTab(t.getAttribute('data-tab')); return; }
    var tl = e.target.closest('[data-tab-link]');
    if (tl) { e.preventDefault(); showTab(tl.getAttribute('data-tab-link')); app.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    var pv = e.target.closest('[data-preview]');
    if (pv) { openPreview(pv.getAttribute('data-preview')); return; }
    if (e.target.closest('#buy-card .thumb') && previews.length) { openPreview(); return; }
    if (e.target.closest('#toggle-all')) {
      var ds = app.querySelectorAll('.chapter');
      var anyClosed = Array.prototype.some.call(ds, function (d) { return !d.open; });
      ds.forEach(function (d) { d.open = anyClosed; });
      e.target.closest('#toggle-all').textContent = anyClosed ? '全部收合' : '全部展開';
      return;
    }
    var a = e.target.closest('[data-act]');
    if (!a) return;
    var act = a.getAttribute('data-act');
    if (act === 'cart') {
      Store.addToCart(c.id); UI.toast('已加入購物車'); renderSide();
    } else if (act === 'buy') {
      Store.addToCart(c.id);
      C.go('/checkout?items=' + encodeURIComponent(c.id));
    } else if (act === 'free') {
      if (!C.requireLogin()) return;
      try { Store.enrollFree(c.id); UI.toast('已成功加入課程！'); C.go('/learn/' + c.id); } catch (err) { UI.toast(err.message, 'error'); }
    } else if (act === 'wish') {
      if (!C.requireLogin()) return;
      var on = Store.toggleWishlist(c.id); UI.toast(on ? '已加入收藏' : '已從收藏移除', on ? 'success' : 'info'); renderSide();
    } else if (act === 'share') {
      var url = location.href.split('#')[0] + '#/course/' + c.id;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { UI.toast('已複製課程連結'); }, function () { UI.toast(url, 'info'); });
      else UI.toast(url, 'info');
    }
  });
  C.bindWish(app);

  renderSide();
  showTab('overview');

  return function cleanup() { clearInterval(timer); };
};
