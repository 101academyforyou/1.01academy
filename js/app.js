/* 1.01 Academy — GitHub Pages + Firebase 登入版
 *
 * 流程：瀏覽課程（公開）→ 登入 → 你為學生開通課程 → 學生觀看不公開的 YouTube 影片
 *
 * 影片 ID 存在 Firestore 的 courseVideos/{課程id}，
 * 只有在 access/{學生 Email} 裡被開通該課程的學生讀得到（規則見 firestore.rules）。
 */
const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CONFIG = window.SITE_CONFIG || {};
const configured = !!(CONFIG.firebaseConfig && CONFIG.firebaseConfig.apiKey);

let fb = null;           // Firebase 函式
let auth = null, db = null;
let user = null;         // 目前登入的 Firebase 使用者
let access = [];         // 已開通的課程 id
let accessReady = Promise.resolve();
const videoCache = {};   // 課程 id → { 單元 id: YouTube ID }

/* ---------------- 小工具 ---------------- */
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const money = (n) => 'NT$' + n.toLocaleString('en-US');
const clock = (s) => !s ? '' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const lessonsOf = (c) => c.chapters.flatMap((ch) => ch.lessons);
const totalMinutes = (c) => Math.round(lessonsOf(c).reduce((s, l) => s + l.duration, 0) / 60);
const minutesText = (c) => (totalMinutes(c) ? ` · ${totalMinutes(c)} 分鐘` : '');
const findCourse = (id) => COURSES.find((c) => c.id === id);
const go = (path) => { location.hash = '#' + path; };

function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function thumb(c) {
  return `<div class="thumb" style="background:linear-gradient(135deg,${esc(c.thumb[0])},${esc(c.thumb[1])})"><span>${esc(c.thumb[2])}</span></div>`;
}

function priceTag(c) {
  if (!c.price) return '';
  return `<span class="price">${money(c.price)}</span>` +
    (c.originalPrice > c.price ? ` <s class="muted small">${money(c.originalPrice)}</s>` : '');
}

// 接受 YouTube 影片 ID 或各種網址格式，回傳 11 碼 ID
function youtubeId(v) {
  v = String(v || '').trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(v);
  return m ? m[1] : null;
}

function youtubeEmbed(v) {
  const id = youtubeId(v);
  return id
    ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1" title="課程影片" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`
    : '<div class="video empty"><p>此單元影片尚未設定</p></div>';
}

const isVerified = () => !!(user && user.emailVerified);
const owns = (courseId) => isVerified() && access.includes(courseId);

/* ---------------- 學習進度（存在瀏覽器） ---------------- */
function doneList(courseId) {
  try { return (JSON.parse(localStorage.getItem('a101_done_' + user.uid)) || {})[courseId] || []; } catch (e) { return []; }
}
function setDone(courseId, lessonId, done) {
  try {
    const key = 'a101_done_' + user.uid;
    const all = JSON.parse(localStorage.getItem(key)) || {};
    const list = new Set(all[courseId] || []);
    done ? list.add(lessonId) : list.delete(lessonId);
    all[courseId] = [...list];
    localStorage.setItem(key, JSON.stringify(all));
  } catch (e) { /* 無痕模式等 */ }
}
const progress = (c) => Math.round(doneList(c.id).filter((id) => lessonsOf(c).some((l) => l.id === id)).length / lessonsOf(c).length * 100);

/* ---------------- Firebase ---------------- */
async function initFirebase() {
  const [app, a, f] = await Promise.all([
    import(FIREBASE + 'firebase-app.js'),
    import(FIREBASE + 'firebase-auth.js'),
    import(FIREBASE + 'firebase-firestore.js')
  ]);
  fb = { ...a, ...f };
  const firebaseApp = app.initializeApp(CONFIG.firebaseConfig);
  auth = a.getAuth(firebaseApp);
  db = f.getFirestore(firebaseApp);
  return new Promise((resolve) => {
    a.onAuthStateChanged(auth, async (u) => {
      user = u;
      accessReady = loadAccess();
      resolve();
      render();
    });
  });
}

async function loadAccess() {
  access = [];
  if (!isVerified()) return;
  try {
    const snap = await fb.getDoc(fb.doc(db, 'access', user.email.toLowerCase()));
    access = snap.exists() ? (snap.data().courses || []) : [];
  } catch (e) {
    console.error(e);
  }
}

async function loadVideos(courseId) {
  if (videoCache[courseId]) return videoCache[courseId];
  const snap = await fb.getDoc(fb.doc(db, 'courseVideos', courseId));
  videoCache[courseId] = snap.exists() ? snap.data() : {};
  return videoCache[courseId];
}

function authError(e) {
  const map = {
    'auth/invalid-credential': 'Email 或密碼錯誤',
    'auth/wrong-password': 'Email 或密碼錯誤',
    'auth/user-not-found': 'Email 或密碼錯誤',
    'auth/invalid-email': 'Email 格式不正確',
    'auth/email-already-in-use': '此 Email 已註冊，請直接登入',
    'auth/weak-password': '密碼至少需要 6 個字元',
    'auth/too-many-requests': '嘗試次數過多，請稍後再試',
    'auth/popup-closed-by-user': '登入視窗已關閉',
    'auth/popup-blocked': '瀏覽器擋住了登入視窗，請允許彈出視窗',
    'auth/unauthorized-domain': '此網域尚未加入 Firebase 授權網域（見 README）',
    'auth/network-request-failed': '網路連線失敗，請稍後再試'
  };
  return map[e && e.code] || '發生錯誤：' + (e && (e.code || e.message));
}

/* ---------------- 頁首 ---------------- */
function renderHeader() {
  const name = user ? (user.displayName || user.email) : '';
  document.getElementById('header').innerHTML =
    '<div class="container nav">' +
    '<a href="#/" class="logo"><span class="logo-mark">1.01</span>1.01 Academy</a>' +
    '<nav>' +
    '<a href="#/">所有課程</a>' +
    (user
      ? `<a href="#/my">我的課程</a><span class="muted small user-name" title="${esc(user.email)}">${esc(name)}</span><button class="link" id="logout">登出</button>`
      : '<a href="#/login" class="btn btn-sm">登入</a>') +
    '<button class="icon-btn" id="theme" aria-label="切換深淺色"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>' +
    '</nav></div>';
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => { await fb.signOut(auth); toast('已登出'); go('/'); };
  document.getElementById('theme').onclick = () => {
    const now = document.documentElement.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = now === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('a101_theme', JSON.stringify(next)); } catch (e) {}
  };
}

/* ---------------- 頁面 ---------------- */
const pages = {};

// 首頁：課程列表（公開）
pages.home = (app) => {
  let cat = '全部', q = '';
  app.innerHTML =
    '<section class="hero"><div class="container">' +
    '<h1>每天進步 <span class="grad">1%</span>，一年後強大 <span class="grad">37 倍</span></h1>' +
    '<p class="muted">業界講師親自授課，開通後隨時觀看。</p>' +
    '<input class="input search" id="q" placeholder="搜尋課程…" aria-label="搜尋課程" />' +
    '</div></section>' +
    `<section class="container"><div class="chips" id="chips"${CATEGORIES.length > 2 ? '' : ' hidden'}>` +
    CATEGORIES.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('') +
    '</div><div class="grid" id="list"></div></section>';

  function draw() {
    app.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
    const list = COURSES.filter((c) =>
      (cat === '全部' || c.category === cat) &&
      (!q || (c.title + c.subtitle + c.instructor).toLowerCase().includes(q)));
    app.querySelector('#list').innerHTML = list.length ? list.map((c) =>
      `<a class="card course" href="#/course/${c.id}">${thumb(c)}<div class="pad">` +
      `<span class="tag">${esc(c.category)} · ${esc(c.level)}</span>` +
      `<h3>${esc(c.title)}</h3><p class="muted small">${esc(c.instructor)}${minutesText(c)}</p>` +
      `<div>${owns(c.id) ? '<span class="owned">✓ 已開通</span>' : priceTag(c)}</div></div></a>`
    ).join('') : '<p class="muted">找不到符合的課程。</p>';
  }
  app.querySelector('#chips').onclick = (e) => { if (e.target.dataset.cat) { cat = e.target.dataset.cat; draw(); } };
  app.querySelector('#q').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  draw();
};

// 課程介紹頁（公開）
pages.course = (app, id) => {
  const c = findCourse(id);
  if (!c) return notFound(app);
  const mine = owns(c.id);
  let box;
  if (mine) {
    box = `<p class="owned">✓ 已開通（進度 ${progress(c)}%）</p><a class="btn btn-block" href="#/learn/${c.id}">${progress(c) ? '繼續學習' : '開始上課'}</a>`;
  } else if (!user) {
    box = `<p>${priceTag(c)}</p><a class="btn btn-block" href="#/login?next=/course/${c.id}">登入以觀看</a>` +
      '<p class="muted small">已購買的學員請登入觀看課程。</p>';
  } else {
    box = `<p>${priceTag(c)}</p><div class="notice">${esc(CONFIG.contact || '請聯繫我們購買課程。')}</div>` +
      `<p class="muted small">購買時請提供你的登入 Email：<br><strong>${esc(user.email)}</strong></p>`;
  }

  app.innerHTML = '<div class="container course-page">' +
    `<div><a href="#/" class="muted small">← 所有課程</a>` +
    `<h1>${esc(c.title)}</h1><p class="lead muted">${esc(c.subtitle)}</p>` +
    `<p class="muted small">講師 ${esc(c.instructor)} · ${esc(c.level)} · ${lessonsOf(c).length} 個單元${minutesText(c)}</p>` +
    (c.trailer ? '<h2>課程預告</h2>' + youtubeEmbed(c.trailer) : '') +
    `<h2>課程介紹</h2><p>${esc(c.description)}</p>` +
    `<h2>你將學到</h2><ul class="checks">${c.outcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` +
    '<h2>課程內容</h2>' + c.chapters.map((ch) =>
      `<div class="card chapter"><strong>${esc(ch.title)}</strong>` +
      ch.lessons.map((l) => `<div class="lesson"><span>${mine ? '▶' : '🔒'} ${esc(l.title)}</span><span class="muted small">${clock(l.duration)}</span></div>`).join('') +
      '</div>').join('') +
    '</div>' +
    `<aside class="card buy">${thumb(c)}<div class="pad">${box}</div></aside></div>`;
};

// 登入 / 註冊
pages.login = (app, _, query) => {
  const next = /^\/[^/]/.test(query.next || '') ? query.next : '/my';
  if (!configured) return setupNotice(app);
  if (!fb) {
    app.innerHTML = '<div class="container narrow"><h1>無法連線</h1><div class="card pad"><p>登入服務目前無法連線，請檢查網路後重新整理頁面。</p><button class="btn btn-sm" onclick="location.reload()">重新整理</button></div></div>';
    return;
  }
  if (user && isVerified()) return go(next);
  if (user) return pages.verify(app);

  let mode = 'login';
  function draw() {
    const reg = mode === 'register';
    app.innerHTML = `<div class="container narrow"><h1>${reg ? '建立帳號' : '登入'}</h1>` +
      '<div class="card pad">' +
      '<button class="btn btn-google btn-block" id="google"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>使用 Google 帳號登入</button>' +
      '<div class="divider">或使用 Email</div>' +
      '<form id="auth" novalidate>' +
      (reg ? '<label>姓名<input class="input" name="fullname" autocomplete="name" required /></label>' : '') +
      '<label>Email<input class="input" name="email" type="email" autocomplete="email" required /></label>' +
      `<label>密碼<input class="input" name="pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required /></label>` +
      `<button class="btn btn-block">${reg ? '註冊' : '登入'}</button></form>` +
      `<p class="center small">${reg ? '已經有帳號？' : '還沒有帳號？'} <button type="button" class="link" id="switch">${reg ? '登入' : '用 Email 註冊'}</button>` +
      (reg ? '' : ' · <button type="button" class="link" id="forgot">忘記密碼</button>') + '</p>' +
      '</div></div>';

    const f = app.querySelector('#auth');
    app.querySelector('#switch').onclick = () => { mode = reg ? 'login' : 'register'; draw(); };
    app.querySelector('#google').onclick = async () => {
      try {
        await fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
        toast('登入成功'); // 登入狀態改變時會自動重新整理畫面並前往下一頁
      } catch (e) { toast(authError(e)); }
    };
    const forgot = app.querySelector('#forgot');
    if (forgot) forgot.onclick = async () => {
      const email = f.email.value.trim();
      if (!email) return toast('請先在上方輸入你的 Email');
      try { await fb.sendPasswordResetEmail(auth, email); } catch (e) { /* 不透露帳號是否存在 */ }
      toast('若此 Email 已註冊，重設密碼信已寄出');
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const email = f.email.value.trim(), pw = f.pw.value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Email 格式不正確');
      if (pw.length < 6) return toast('密碼至少 6 個字元');
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        if (reg) {
          if (!f.fullname.value.trim()) { btn.disabled = false; return toast('請輸入姓名'); }
          const cred = await fb.createUserWithEmailAndPassword(auth, email, pw);
          await fb.updateProfile(cred.user, { displayName: f.fullname.value.trim() });
          await fb.sendEmailVerification(cred.user);
          render(); // 顯示「請驗證 Email」頁
        } else {
          await fb.signInWithEmailAndPassword(auth, email, pw);
        }
      } catch (err) {
        btn.disabled = false;
        toast(authError(err));
      }
    };
  }
  draw();
};

// Email 註冊者需先驗證信箱（避免有人冒用別人的 Email 取得課程）
pages.verify = (app) => {
  if (!user) return go('/login');
  if (isVerified()) return go('/my');
  app.innerHTML = '<div class="container narrow"><h1>請驗證你的 Email</h1><div class="card pad">' +
    `<p>我們已寄送驗證信到 <strong>${esc(user.email)}</strong>，請點信中的連結完成驗證，再回到這裡。</p>` +
    '<button class="btn btn-block" id="check">我已完成驗證</button>' +
    '<p class="center small"><button class="link" id="resend">重新寄送驗證信</button></p></div></div>';
  app.querySelector('#check').onclick = async () => {
    await user.reload();
    if (!auth.currentUser.emailVerified) return toast('尚未完成驗證，請檢查信箱（包含垃圾郵件）');
    user = auth.currentUser;
    await user.getIdToken(true); // 取得含驗證狀態的新權杖
    accessReady = loadAccess();
    await accessReady;
    toast('驗證完成！');
    go('/my');
  };
  app.querySelector('#resend').onclick = async () => {
    try { await fb.sendEmailVerification(user); toast('驗證信已重新寄出'); } catch (e) { toast(authError(e)); }
  };
};

// 我的課程
pages.my = (app) => {
  if (!user) return go('/login?next=/my');
  if (!isVerified()) return pages.verify(app);
  const list = access.map(findCourse).filter(Boolean);
  app.innerHTML = '<div class="container"><h1>我的課程</h1>' + (list.length
    ? '<div class="grid">' + list.map((c) => {
        const p = progress(c);
        return `<a class="card course" href="#/learn/${c.id}">${thumb(c)}<div class="pad"><h3>${esc(c.title)}</h3>` +
          `<div class="bar"><i style="width:${p}%"></i></div><p class="muted small">已完成 ${p}%</p></div></a>`;
      }).join('') + '</div>'
    : '<div class="card pad"><p>目前還沒有開通的課程。</p>' +
      `<p class="muted small">購買課程後，我們會用你的登入 Email（<strong>${esc(user.email)}</strong>）為你開通。</p>` +
      '<a href="#/" class="btn btn-sm">瀏覽課程</a></div>') + '</div>';
};

// 上課頁：從 Firestore 讀取不公開的 YouTube 影片 ID
pages.learn = async (app, id, query, lessonId) => {
  const c = findCourse(id);
  if (!c) return notFound(app);
  if (!user) return go(`/login?next=/learn/${id}`);
  if (!isVerified()) return pages.verify(app);
  if (!owns(c.id)) {
    app.innerHTML = `<div class="container narrow"><h1>尚未開通</h1><div class="card pad"><p>你還沒有這門課程的觀看權限。</p><a class="btn btn-sm" href="#/course/${c.id}">查看購買方式</a></div></div>`;
    return;
  }
  app.innerHTML = '<div class="container"><p class="muted">載入課程中…</p></div>';
  let videos;
  try {
    videos = await loadVideos(c.id);
  } catch (e) {
    console.error(e);
    app.innerHTML = '<div class="container narrow"><h1>無法載入課程</h1><div class="card pad"><p>你可能沒有觀看權限，或網路連線有問題。請重新整理，若仍無法觀看請聯繫我們。</p></div></div>';
    return;
  }
  if (!document.body.contains(app)) return; // 載入期間已換頁

  const all = lessonsOf(c);
  const done = doneList(c.id);
  const cur = all.find((l) => l.id === lessonId) || all.find((l) => !done.includes(l.id)) || all[0];
  const i = all.indexOf(cur);
  const isDone = done.includes(cur.id);

  app.innerHTML = '<div class="player">' +
    `<div>${youtubeEmbed(videos[cur.id])}` +
    `<div class="pad"><p class="muted small">單元 ${i + 1} / ${all.length}</p><h2>${esc(cur.title)}</h2>` +
    '<div class="row-between">' +
    (i > 0 ? `<a class="btn btn-ghost" href="#/learn/${c.id}/${all[i - 1].id}">← 上一單元</a>` : '<span></span>') +
    `<button class="btn ${isDone ? 'btn-ghost' : ''}" id="done">${isDone ? '✓ 已完成' : '標記完成'}</button>` +
    (i < all.length - 1 ? `<a class="btn btn-ghost" href="#/learn/${c.id}/${all[i + 1].id}">下一單元 →</a>` : '<span></span>') +
    '</div></div></div>' +
    `<aside class="side"><div class="pad"><strong>${esc(c.title)}</strong><div class="bar"><i style="width:${progress(c)}%"></i></div>` +
    `<span class="muted small">進度 ${progress(c)}%</span></div>` +
    c.chapters.map((ch) => `<div class="side-ch">${esc(ch.title)}</div>` + ch.lessons.map((l) => {
      const d = done.includes(l.id);
      return `<a class="side-l${l === cur ? ' active' : ''}" href="#/learn/${c.id}/${l.id}">` +
        `<span class="dot${d ? ' done' : ''}">${d ? '✓' : ''}</span>${esc(l.title)}<span class="muted small">${clock(l.duration)}</span></a>`;
    }).join('')).join('') + '</aside></div>';

  app.querySelector('#done').onclick = () => {
    setDone(c.id, cur.id, !isDone);
    if (!isDone && progress(c) === 100) toast('🎉 恭喜完成整門課程！');
    if (!isDone && i < all.length - 1) go(`/learn/${c.id}/${all[i + 1].id}`);
    else pages.learn(app, id, query, cur.id);
  };
};

function notFound(app) {
  app.innerHTML = '<div class="container"><h1>找不到頁面</h1><p><a class="link" href="#/">回到首頁</a></p></div>';
}

function setupNotice(app) {
  app.innerHTML = '<div class="container narrow"><h1>尚未設定登入</h1><div class="card pad">' +
    '<p>網站管理者還沒填寫 Firebase 設定，所以目前無法登入。</p>' +
    '<p class="muted small">請依照 README.md 的步驟建立 Firebase 專案，並把設定填入 <code>js/config.js</code>。</p></div></div>';
}

/* ---------------- 路由 ---------------- */
let renderId = 0;
async function render() {
  const id = ++renderId;
  await accessReady; // 等開通資料載入完，避免畫面閃一下「尚未開通」
  if (id !== renderId) return; // 期間又換頁了
  const hash = location.hash.slice(1) || '/';
  const [path, qs] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const seg = path.split('/').filter(Boolean); // 例如 ['learn', 'react', 'l3']

  renderHeader();
  const main = document.getElementById('app');
  const app = document.createElement('div'); // 每頁一個新容器
  main.replaceChildren(app);
  window.scrollTo(0, 0);

  const page = pages[seg[0] || 'home'];
  if (page) page(app, seg[1], query, seg[2]);
  else notFound(app);
}

window.addEventListener('hashchange', render);

if (configured) {
  document.getElementById('app').innerHTML = '<div class="container"><p class="muted" style="padding:48px 0">載入中…</p></div>';
  initFirebase().catch((e) => {
    console.error(e);
    toast('無法連線到登入服務，請稍後再試');
    render();
  });
} else {
  render();
}
