window.Views = window.Views || {};

Views.learn = function (app, params) {
  'use strict';
  var esc = UI.esc, icon = UI.icon;
  if (!C.requireLogin()) return;
  var c = Store.course(params.id);
  if (!c) { app.innerHTML = '<div class="container">' + UI.emptyState('alert', '找不到課程', '', '<a class="btn btn-primary" href="#/my-courses">我的課程</a>') + '</div>'; return; }
  if (!Store.isEnrolled(c.id) && !Store.isAdmin()) {
    UI.toast('請先購買此課程', 'info');
    C.go('/course/' + c.id);
    return;
  }
  var lessons = Store.lessons(c);
  if (!lessons.length) { app.innerHTML = '<div class="container">' + UI.emptyState('playCircle', '此課程尚無單元', '講師正在準備內容，敬請期待') + '</div>'; return; }
  var prog = Store.progressOf(c.id);
  var current = Store.findLesson(c, params.lesson) || Store.findLesson(c, prog.last) ||
    lessons.find(function (l) { return prog.done.indexOf(l.id) === -1; }) || lessons[0];
  var tab = 'overview';
  var video = null, lastSaved = 0;
  var celebrated = Store.percent(c.id) === 100;

  function youtubeId(url) {
    var m = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url || '');
    return m ? m[1] : null;
  }

  app.innerHTML = '<div class="player-layout"><div class="player-main">' +
    '<div class="video-wrap" id="vw"></div>' +
    '<div class="player-bar"><div class="flex items-center gap-8"><a class="btn btn-ghost btn-sm" href="#/my-courses">' + icon('chevronLeft', 'icon-sm') + '我的課程</a></div>' +
    '<div class="flex items-center gap-8 wrap"><button class="btn btn-outline btn-sm" id="prev">' + icon('skipBack', 'icon-sm') + '上一單元</button>' +
    '<button class="btn btn-sm" id="done-btn"></button>' +
    '<button class="btn btn-outline btn-sm" id="next">下一單元' + icon('skipForward', 'icon-sm') + '</button></div></div>' +
    '<div class="player-info"><div class="small subtle mono" id="crumb"></div><h1 id="lt"></h1>' +
    '<div class="tabs">' + [['overview', '概覽'], ['notes', '我的筆記'], ['qa', '問答討論']].map(function (t) { return '<button data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
    '<div id="tab-body"></div></div></div>' +
    '<aside class="player-side"><div class="ps-head"><h3>' + esc(c.title) + '</h3><div class="flex items-center gap-12"><div class="progress" style="flex:1"><i id="pbar"></i></div><span class="mono small" id="ptext"></span></div></div>' +
    '<div class="ps-list" id="ps-list"></div></aside></div>';

  function chapterOf(l) { return c.chapters.find(function (ch) { return ch.lessons.indexOf(l) > -1; }); }

  function renderList() {
    var html = '';
    c.chapters.forEach(function (ch, ci) {
      html += '<div class="ps-chapter">' + String(ci + 1).padStart(2, '0') + ' · ' + esc(ch.title) + '</div>';
      ch.lessons.forEach(function (l) {
        var done = Store.isLessonDone(c.id, l.id);
        html += '<button class="ps-lesson ' + (l.id === current.id ? 'active' : '') + '" data-lesson="' + esc(l.id) + '">' +
          '<span class="tick ' + (done ? 'done' : '') + '">' + (done ? icon('check') : '') + '</span>' +
          '<span class="lt">' + esc(l.title) + '<small>' + icon('playCircle', 'icon-sm') + ' ' + UI.clock(l.duration) + '</small></span></button>';
      });
    });
    app.querySelector('#ps-list').innerHTML = html;
    var p = Store.percent(c.id);
    app.querySelector('#pbar').style.width = p + '%';
    app.querySelector('#ptext').textContent = p + '%';
    var a = app.querySelector('.ps-lesson.active');
    if (a && a.scrollIntoViewIfNeeded) a.scrollIntoViewIfNeeded();
  }

  function renderDoneBtn() {
    var done = Store.isLessonDone(c.id, current.id);
    var b = app.querySelector('#done-btn');
    b.className = 'btn btn-sm ' + (done ? 'btn-soft' : 'btn-primary');
    b.innerHTML = icon(done ? 'checkCircle' : 'check', 'icon-sm') + (done ? '已完成' : '標記為完成');
  }

  function renderVideo() {
    var vw = app.querySelector('#vw');
    var yt = youtubeId(current.video);
    video = null;
    if (yt) {
      vw.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + yt + '?rel=0" title="' + esc(current.title) + '" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      return;
    }
    if (!current.video) {
      vw.innerHTML = '<div class="video-fallback"><div>' + icon('playCircle', 'icon-lg') + '<p>此單元影片尚未上傳</p></div></div>';
      return;
    }
    vw.innerHTML = '<video controls playsinline preload="metadata" controlsList="nodownload"></video>';
    video = vw.querySelector('video');
    video.src = current.video;
    var resume = Store.position(c.id, current.id);
    video.addEventListener('loadedmetadata', function () {
      if (resume > 5 && resume < video.duration - 5) {
        video.currentTime = resume;
        UI.toast('已從上次觀看位置 ' + UI.clock(resume) + ' 繼續播放', 'info');
      }
    }, { once: true });
    video.addEventListener('timeupdate', function () {
      var t = video.currentTime;
      if (Math.abs(t - lastSaved) > 5) { lastSaved = t; Store.savePosition(c.id, current.id, t); }
      if (video.duration && t / video.duration > 0.9 && !Store.isLessonDone(c.id, current.id)) {
        Store.setLessonDone(c.id, current.id, true); renderList(); renderDoneBtn();
      }
    });
    video.addEventListener('ended', function () {
      Store.savePosition(c.id, current.id, 0);
      if (!Store.isLessonDone(c.id, current.id)) { Store.setLessonDone(c.id, current.id, true); renderList(); renderDoneBtn(); }
      checkComplete();
      var i = lessons.indexOf(current);
      if (Views.prefAutoplay() && i < lessons.length - 1) {
        UI.toast('即將播放下一單元', 'info');
        setTimeout(function () { if (document.body.contains(app)) select(lessons[i + 1], true); }, 1500);
      }
    });
    video.addEventListener('error', function () {
      vw.innerHTML = '<div class="video-fallback"><div>' + icon('alert', 'icon-lg') + '<p>影片載入失敗，請檢查網路連線後重試</p></div></div>';
    });
  }

  function checkComplete() {
    if (!celebrated && Store.percent(c.id) === 100) {
      celebrated = true;
      UI.modal({
        title: '🎉 恭喜完成課程！',
        body: '<div class="text-center"><div class="success-hero" style="padding:12px 0"><div class="ok">' + icon('award') + '</div></div><p>你已完成《' + esc(c.title) + '》的所有單元。</p><p class="muted small">別忘了留下評價，幫助其他同學做選擇！</p></div>',
        foot: '<a class="btn btn-ghost" href="#/course/' + esc(c.id) + '" data-close>留下評價</a><a class="btn btn-primary" href="#/certificate/' + esc(c.id) + '" data-close>' + icon('award', 'icon-sm') + '查看證書</a>'
      });
    }
  }

  function renderTab() {
    app.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
    var el = app.querySelector('#tab-body');
    if (tab === 'overview') {
      var ins = Store.instructor(c.instructorId) || {};
      el.innerHTML = '<div class="prose"><p>本單元屬於《' + esc(c.title) + '》課程，片長 ' + UI.clock(current.duration) + '。</p>' +
        String(c.description || '').split(/\n+/).slice(0, 1).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
        '<div class="card card-pad mt-16"><div class="instructor-card"><span class="avatar">' + esc(UI.initials(ins.name)) + '</span><div><strong>' + esc(ins.name || '') + '</strong><div class="small muted">' + esc(ins.title || '') + '</div></div></div></div>' +
        '<div class="flex gap-8 mt-16 wrap"><span class="badge">' + icon('note', 'icon-sm') + '小技巧：在「我的筆記」中記下重點，會自動標記影片時間</span></div>';
    } else if (tab === 'notes') {
      var notes = Store.notes(c.id);
      el.innerHTML = '<form id="note-form" class="mb-24"><textarea class="textarea" name="text" placeholder="在此輸入筆記，將標記於目前影片時間點…" maxlength="2000" required style="min-height:90px"></textarea>' +
        '<div class="flex justify-between items-center mt-8"><span class="small subtle" id="note-time"></span><button class="btn btn-primary btn-sm">' + icon('plus', 'icon-sm') + '新增筆記</button></div></form>' +
        (notes.length ? notes.map(function (n) {
          var l = Store.findLesson(c, n.lessonId);
          return '<div class="note-item"><div class="nh"><span class="flex items-center gap-8"><button class="ts" data-seek="' + esc(n.lessonId) + '" data-t="' + n.time + '">' + UI.clock(n.time) + '</button><span class="small subtle">' + esc(l ? l.title : '') + '</span></span>' +
            '<button class="btn btn-ghost btn-sm btn-icon" data-del-note="' + esc(n.id) + '" aria-label="刪除筆記">' + icon('trash', 'icon-sm') + '</button></div><p>' + esc(n.text) + '</p></div>';
        }).join('') : '<p class="muted small">還沒有筆記，開始記錄你的學習重點吧！</p>');
      var nt = el.querySelector('#note-time');
      nt.textContent = '時間點：' + UI.clock(video ? video.currentTime : 0);
      el.querySelector('#note-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var text = e.target.text.value.trim();
        if (!text) return;
        Store.addNote(c.id, current.id, text, video ? video.currentTime : 0);
        UI.toast('筆記已儲存');
        renderTab();
      });
      el.querySelector('textarea').addEventListener('focus', function () { nt.textContent = '時間點：' + UI.clock(video ? video.currentTime : 0); });
    } else {
      el.innerHTML = '<div class="card card-pad text-center"><div class="empty" style="padding:24px">' +
        '<div class="ei">' + icon('message') + '</div><h3>有問題想問講師嗎？</h3><p class="muted">寄信至 <a href="mailto:hello@101academy.com" style="color:var(--primary)">hello@101academy.com</a>，並附上課程與單元名稱，講師將於 2 個工作天內回覆。</p></div></div>';
    }
  }

  function select(l, autoplay) {
    if (video && !video.paused) Store.savePosition(c.id, current.id, video.currentTime);
    current = l;
    lastSaved = 0;
    Store.setLastLesson(c.id, l.id);
    history.replaceState(null, '', '#/learn/' + encodeURIComponent(c.id) + '/' + encodeURIComponent(l.id));
    var ch = chapterOf(l);
    var idx = lessons.indexOf(l);
    app.querySelector('#crumb').textContent = (ch ? ch.title : '') + ' · 單元 ' + (idx + 1) + ' / ' + lessons.length;
    app.querySelector('#lt').textContent = l.title;
    app.querySelector('#prev').disabled = idx === 0;
    app.querySelector('#next').disabled = idx === lessons.length - 1;
    renderVideo();
    renderList();
    renderDoneBtn();
    renderTab();
    if (autoplay && video) video.play().catch(function () {});
  }

  app.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-lesson]'))) { select(Store.findLesson(c, t.getAttribute('data-lesson')), true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if ((t = e.target.closest('[data-tab]'))) { tab = t.getAttribute('data-tab'); renderTab(); return; }
    if ((t = e.target.closest('[data-seek]'))) {
      var l = Store.findLesson(c, t.getAttribute('data-seek'));
      var time = +t.getAttribute('data-t');
      if (l && l !== current) select(l, false);
      if (video) {
        var seek = function () { video.currentTime = time; video.play().catch(function () {}); };
        if (video.readyState >= 1) seek(); else video.addEventListener('loadedmetadata', seek, { once: true });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if ((t = e.target.closest('[data-del-note]'))) { Store.deleteNote(c.id, t.getAttribute('data-del-note')); renderTab(); return; }
    if (e.target.closest('#prev')) { var i = lessons.indexOf(current); if (i > 0) select(lessons[i - 1], true); return; }
    if (e.target.closest('#next')) { var j = lessons.indexOf(current); if (j < lessons.length - 1) select(lessons[j + 1], true); return; }
    if (e.target.closest('#done-btn')) {
      var done = !Store.isLessonDone(c.id, current.id);
      Store.setLessonDone(c.id, current.id, done);
      renderList(); renderDoneBtn();
      if (done) { UI.toast('已標記完成，進度 ' + Store.percent(c.id) + '%'); checkComplete(); }
    }
  });

  select(current, false);

  return function cleanup() {
    if (video) { Store.savePosition(c.id, current.id, video.currentTime); video.pause(); }
  };
};
