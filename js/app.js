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
let courses = COURSES;   // 課程目錄：優先讀 Firestore 的 courses 集合，讀不到時用 data.js
let coursesFromDb = false;

/* ---------------- 小工具 ---------------- */
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const money = (n) => 'NT$' + n.toLocaleString('en-US');
const clock = (s) => !s ? '' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const lessonsOf = (c) => c.chapters.flatMap((ch) => ch.lessons);
const totalMinutes = (c) => Math.round(lessonsOf(c).reduce((s, l) => s + l.duration, 0) / 60);
const minutesText = (c) => (totalMinutes(c) ? ` · ${totalMinutes(c)} 分鐘` : '');
const findCourse = (id) => courses.find((c) => c.id === id);
const visibleCourses = () => courses.filter((c) => c.published !== false || isAdmin());
const categoriesOf = () => ['全部', ...new Set(visibleCourses().map((c) => c.category).filter(Boolean))];
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
  if (c.cover) return `<div class="thumb"><img src="${esc(c.cover)}" alt="${esc(c.title)}"></div>`;
  return `<div class="thumb" style="background:linear-gradient(135deg,${esc(c.thumb[0])},${esc(c.thumb[1])})"><span>${esc(c.thumb[2])}</span></div>`;
}

// 時間格式：2026/10/31 23:59
const pad2 = (n) => String(n).padStart(2, '0');
const fmtTime = (ms) => { const d = new Date(ms); return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

// 限時免費期間：freeFrom（可為 0 = 立即）≤ 現在 < freeUntil
const inFreeWindow = (c) => !!c && c.freeUntil > 0 && (c.freeFrom || 0) <= Date.now() && Date.now() < c.freeUntil;
const freeUpcoming = (c) => !!c && c.freeUntil > Date.now() && c.freeFrom > Date.now();

function priceTag(c) {
  if (c.price && inFreeWindow(c)) {
    return `<span class="price free">限時免費</span> <s class="muted small">${money(Math.max(c.price, c.originalPrice || 0))}</s>` +
      `<span class="free-until">優惠至 ${fmtTime(c.freeUntil)}</span>`;
  }
  if (!c.price) {
    // 售價 0 = 永久免費；有原價時劃掉原價
    return `<span class="price free">免費</span>` + (c.originalPrice > 0 ? ` <s class="muted small">${money(c.originalPrice)}</s>` : '');
  }
  return `<span class="price">${money(c.price)}</span>` +
    (c.originalPrice > c.price ? ` <s class="muted small">${money(c.originalPrice)}</s>` : '') +
    (freeUpcoming(c) ? `<span class="free-until">${fmtTime(c.freeFrom)} 起限時免費</span>` : '');
}

// 接受 YouTube 影片 ID 或各種網址格式，回傳 11 碼 ID
function youtubeId(v) {
  v = String(v || '').trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(v);
  return m ? m[1] : null;
}

// 已跳脫的文字中，把網址變成可點擊的連結
const linkify = (html) => html.replace(/https?:\/\/[^\s<]+/g, (u) => `<a class="link" href="${u}" target="_blank" rel="noopener">${u}</a>`);

// 上傳到 Firebase Storage 的影片（或其他 https 影片檔網址）
const isFileVideo = (v) => /^https:\/\//.test(String(v || '').trim()) && !youtubeId(v);

function youtubeEmbed(v) {
  if (isFileVideo(v)) {
    return `<div class="video"><video src="${esc(v)}" controls playsinline preload="metadata" controlsList="nodownload" disablePictureInPicture oncontextmenu="return false"></video></div>`;
  }
  const id = youtubeId(v);
  return id
    ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1" title="課程影片" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`
    : '<div class="video empty"><p>此單元影片尚未設定</p></div>';
}

const isVerified = () => !!(user && user.emailVerified);
const isAdmin = () => isVerified() && (CONFIG.admins || []).some((e) => e.toLowerCase() === user.email.toLowerCase());
// 免費：售價 0（永久免費）或在限時免費期間內
const isFree = (c) => !!c && (!c.price || inFreeWindow(c));
// 免費課程：登入（並驗證 Email）就能看；付費課程：需要開通
const owns = (courseId) => isVerified() && (access.includes(courseId) || isAdmin() || isFree(findCourse(courseId)));

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
  auth.languageCode = 'zh-TW'; // 驗證信、重設密碼信使用繁體中文
  db = f.getFirestore(firebaseApp);
  const coursesReady = loadCourses();
  return new Promise((resolve) => {
    a.onAuthStateChanged(auth, async (u) => {
      user = u;
      accessReady = Promise.all([coursesReady, loadAccess()]);
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

// 從 Firestore 讀取課程目錄；資料庫還沒有課程時，沿用 data.js
async function loadCourses() {
  try {
    const snap = await fb.getDocs(fb.collection(db, 'courses'));
    if (!snap.empty) {
      courses = snap.docs.map((d) => ({ ...d.data(), id: d.id }))
        .sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
      coursesFromDb = true;
    }
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
    '<a href="#/" class="logo"><span class="logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M12 2.5C8.6 7 5 11.3 5 15a7 7 0 0 0 14 0c0-3.7-3.6-8-7-12.5z"/><path fill="none" stroke="rgba(79,70,229,.45)" stroke-width="1.6" stroke-linecap="round" d="M9 15.2a3 3 0 0 0 2.6 2.9"/></svg></span>1.01 Academy</a>' +
    '<nav>' +
    '<a href="#/">所有課程</a>' +
    (user
      ? `<a href="#/my">我的課程</a>${isAdmin() ? '<a href="#/admin">管理</a>' : ''}<span class="muted small user-name" title="${esc(user.email)}">${esc(name)}</span><button class="link" id="logout">登出</button>`
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
    '<h1>每天進步 <span class="grad">1%</span>，一年後成長 <span class="grad">37 倍</span></h1>' +
    '<input class="input search" id="q" placeholder="搜尋課程…" aria-label="搜尋課程" />' +
    '</div></section>' +
    `<section class="container"><div class="chips" id="chips"${categoriesOf().length > 2 ? '' : ' hidden'}>` +
    categoriesOf().map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('') +
    '</div><div class="grid" id="list"></div></section>' +
    '<section class="container home-faq"><h2>常見問題</h2>' + faqList(SITE_PAGES.faq.slice(0, 5)) +
    '<p><a class="link" href="#/faq">查看全部常見問題 →</a></p></section>';

  function draw() {
    app.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
    const list = visibleCourses().filter((c) =>
      (cat === '全部' || c.category === cat) &&
      (!q || (c.title + c.subtitle + c.instructor).toLowerCase().includes(q)));
    app.querySelector('#list').innerHTML = list.length ? list.map((c) =>
      `<a class="card course" href="#/course/${c.id}">${thumb(c)}<div class="pad">` +
      `<span class="tag">${esc(c.category)} · ${esc(c.level)}</span>` +
      `<h3>${esc(c.title)}</h3><p class="muted small">${esc(c.instructor)}${minutesText(c)}</p>` +
      `<div>${isVerified() && access.includes(c.id) ? '<span class="owned">✓ 已開通</span>' : priceTag(c)}</div></div></a>`
    ).join('') : '<p class="muted">找不到符合的課程。</p>';
  }
  app.querySelector('#chips').onclick = (e) => { if (e.target.dataset.cat) { cat = e.target.dataset.cat; draw(); } };
  app.querySelector('#q').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  draw();
};

// 課程介紹頁（公開）
pages.course = (app, id) => {
  const c = findCourse(id);
  if (!c || (c.published === false && !isAdmin())) return notFound(app);
  const mine = owns(c.id);
  let box;
  if (mine) {
    box = (access.includes(c.id) || isAdmin() ? `<p class="owned">✓ 已開通（進度 ${progress(c)}%）</p>` : `<p>${priceTag(c)}</p>`) + `<a class="btn btn-block" href="#/learn/${c.id}">${progress(c) ? '繼續學習' : '開始上課'}</a>`;
  } else if (!user) {
    box = `<p>${priceTag(c)}</p><a class="btn btn-block" href="#/login?next=/course/${c.id}">${isFree(c) ? '免費登入觀看' : '登入以觀看'}</a>` +
      `<p class="muted small">${isFree(c) ? '免費課程，登入後即可直接觀看。' : '已購買的學員請登入觀看課程。'}</p>`;
  } else if (!isVerified()) {
    box = `<p>${priceTag(c)}</p><a class="btn btn-block" href="#/verify">請先驗證 Email</a>` +
      '<p class="muted small">完成 Email 驗證後即可觀看。</p>';
  } else {
    box = `<p>${priceTag(c)}</p><div class="notice">${esc(CONFIG.contact || '請聯繫我們開通課程。')}</div>` +
      `<p class="muted small">來信時請提供你的登入 Email：<br><strong>${esc(user.email)}</strong></p>`;
  }

  app.innerHTML = '<div class="container course-page">' +
    `<div><a href="#/" class="muted small">← 所有課程</a>` +
    (isAdmin() ? ` · <a href="#/admin/${c.id}" class="link small">✎ 編輯此課程</a>` + (c.published === false ? ' <span class="tag">（未上架）</span>' : '') : '') +
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
      toast('若此 Email 已註冊，重設密碼信已寄出（請一併檢查垃圾郵件）');
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
    '<div class="notice">📬 沒收到信嗎？請檢查<strong>垃圾郵件</strong>或<strong>促銷內容</strong>資料夾。寄件者通常是 noreply@…firebaseapp.com，找到後可標記為「不是垃圾郵件」。</div>' +
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
    try { await fb.sendEmailVerification(user); toast('驗證信已重新寄出，請一併檢查垃圾郵件'); } catch (e) { toast(authError(e)); }
  };
};

// 我的課程
pages.my = (app) => {
  if (!user) return go('/login?next=/my');
  if (!isVerified()) return pages.verify(app);
  // 已開通的課程 + 所有免費課程
  const list = visibleCourses().filter((c) => access.includes(c.id) || isFree(c) || isAdmin());
  app.innerHTML = '<div class="container"><h1>我的課程</h1>' + (list.length
    ? '<div class="grid">' + list.map((c) => {
        const p = progress(c);
        return `<a class="card course" href="#/learn/${c.id}">${thumb(c)}<div class="pad"><h3>${esc(c.title)}</h3>` +
          `<div class="bar"><i style="width:${p}%"></i></div><p class="muted small">已完成 ${p}%</p></div></a>`;
      }).join('') + '</div>'
    : '<div class="card pad"><p>目前還沒有開通的課程。</p>' +
      `<p class="muted small">課程開通時，我們會用你的登入 Email（<strong>${esc(user.email)}</strong>）為你開通。</p>` +
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
    '<div>' +
    // 單元資訊與按鈕在影片上方
    `<div class="pad lesson-head"><div><p class="muted small">單元 ${i + 1} / ${all.length}</p><h2>${esc(cur.title)}</h2></div>` +
    '<div class="lesson-nav">' +
    (i > 0 ? `<a class="btn btn-ghost btn-sm" href="#/learn/${c.id}/${all[i - 1].id}">← 上一單元</a>` : '') +
    `<button class="btn btn-sm ${isDone ? 'btn-ghost' : ''}" id="done">${isDone ? '✓ 已完成' : '標記完成'}</button>` +
    (i < all.length - 1 ? `<a class="btn btn-ghost btn-sm" href="#/learn/${c.id}/${all[i + 1].id}">下一單元 →</a>` : '') +
    '</div></div>' +
    youtubeEmbed(videos[cur.id]) +
    '<div class="pad share-warning">🔒 本課程影片為不公開影片，影片連結僅供你本人觀看學習，<strong>請勿分享給其他人</strong>。</div>' +
    // 單元說明（在 data.js 每個單元的第 4 個欄位填寫）
    (cur.note ? `<div class="pad lesson-note"><h3>單元說明</h3><div>${linkify(esc(cur.note)).replace(/\n/g, '<br>')}</div></div>` : '') +
    '</div>' +
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

/* ---------------- 管理者：編輯課程 ---------------- */
// 毫秒 ↔ <input type="datetime-local"> 的本地時間字串
const toLocalInput = (ms) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function adminGuard(app) {
  if (!user) { go('/login?next=/admin'); return false; }
  if (!isAdmin()) { notFound(app); return false; }
  return true;
}

// 把圖片縮成 960×540（16:9 裁切）的 JPEG，存成文字放進資料庫
async function resizeCover(file) {
  const img = await createImageBitmap(file);
  const W = 960, H = 540;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale, h = img.height * scale;
  canvas.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  let q = 0.85, url = canvas.toDataURL('image/jpeg', q);
  while (url.length > 600000 && q > 0.4) { q -= 0.15; url = canvas.toDataURL('image/jpeg', q); }
  return url;
}

// 課程列表
pages.admin = async (app, id) => {
  if (!adminGuard(app)) return;
  if (id === 'students') return pages.students(app);
  if (id) return pages.edit(app, id);
  app.innerHTML = '<div class="container">' + adminTabs('courses') + '<div class="row-between"><h1>課程管理</h1><a class="btn btn-sm" href="#/admin/new">＋ 新增課程</a></div>' +
    (coursesFromDb ? '' :
      '<div class="card pad notice-card"><strong>第一次使用：請先匯入課程</strong><p class="muted small">目前的課程資料來自網站內建檔案。按下面的按鈕把課程匯入資料庫後，就能在網站上直接編輯。</p>' +
      '<button class="btn btn-sm" id="import">匯入現有課程到資料庫</button></div>') +
    '<div class="admin-list">' + courses.map((c, i) =>
      `<div class="card admin-row">${thumb(c)}<div class="pad"><strong>${esc(c.title)}</strong>` +
      `<p class="muted small">${esc(c.category || '')} · ${lessonsOf(c).length} 個單元 · ${c.published === false ? '<span class="tag">未上架</span>' : '已上架'}` +
      (inFreeWindow(c) ? ` · <span class="tag">限時免費中，至 ${fmtTime(c.freeUntil)}</span>` : freeUpcoming(c) ? ` · ${fmtTime(c.freeFrom)} 起限時免費` : c.freeUntil > 0 && c.price ? ' · 限時免費已結束' : '') + '</p>' +
      `<div class="lesson-nav">${coursesFromDb ? `<a class="btn btn-sm" href="#/admin/${c.id}">編輯</a>` : ''}` +
      `<a class="btn btn-ghost btn-sm" href="#/course/${c.id}">查看</a>` +
      (coursesFromDb && i > 0 ? `<button class="btn btn-ghost btn-sm" data-up="${i}">↑ 往前</button>` : '') +
      '</div></div></div>').join('') + '</div></div>';

  const imp = app.querySelector('#import');
  if (imp) imp.onclick = async () => {
    imp.disabled = true; imp.textContent = '匯入中…';
    try {
      for (const [i, c] of courses.entries()) {
        await fb.setDoc(fb.doc(db, 'courses', c.id), { ...c, published: c.published !== false, order: i, updatedAt: Date.now() });
      }
      await loadCourses();
      toast('匯入完成，現在可以編輯課程了');
      pages.admin(app);
    } catch (e) { console.error(e); imp.disabled = false; imp.textContent = '匯入現有課程到資料庫'; toast('匯入失敗：' + (e.code || e.message) + '（請確認已更新 Firestore 規則）'); }
  };
  app.onclick = async (e) => {
    const up = e.target.dataset && e.target.dataset.up;
    if (up == null) return;
    const i = +up;
    [courses[i - 1], courses[i]] = [courses[i], courses[i - 1]];
    try {
      await Promise.all(courses.map((c, k) => fb.setDoc(fb.doc(db, 'courses', c.id), { order: k }, { merge: true })));
      pages.admin(app);
    } catch (err) { toast('排序失敗：' + (err.code || err.message)); }
  };
};

const adminTabs = (cur) => '<div class="chips admin-tabs">' +
  `<a class="chip${cur === 'courses' ? ' active' : ''}" href="#/admin">課程管理</a>` +
  `<a class="chip${cur === 'students' ? ' active' : ''}" href="#/admin/students">學生開通</a></div>`;

// 學生開通管理：access/{Email} = { courses: [...] }
pages.students = async (app) => {
  if (!adminGuard(app)) return;
  app.innerHTML = '<div class="container"><p class="muted">載入中…</p></div>';
  let list = [];
  try {
    const snap = await fb.getDocs(fb.collection(db, 'access'));
    list = snap.docs.map((d) => ({ email: d.id, courses: d.data().courses || [] }))
      .sort((a, b) => a.email.localeCompare(b.email));
  } catch (e) {
    console.error(e);
    app.innerHTML = '<div class="container">' + adminTabs('students') + '<h1>學生開通</h1><div class="card pad"><p>無法讀取學生名單：' + esc(e.code || e.message) + '</p><p class="muted small">請確認 Firebase 的 Firestore 規則已更新為最新版本。</p></div></div>';
    return;
  }
  if (!document.body.contains(app)) return;
  // 只列出付費課程（免費課程登入就能看，不需開通）
  const paid = courses.filter((c) => c.price > 0); // 含限時免費的課程（期間結束後需要開通）
  const name = (id) => (findCourse(id) || {}).title || id + '（已刪除的課程）';
  const boxes = (prefix, selected) => paid.length
    ? paid.map((c) => `<label class="check"><input type="checkbox" data-${prefix}="${esc(c.id)}" ${selected.includes(c.id) ? 'checked' : ''}/> ${esc(c.title)}</label>`).join('')
    : '<p class="muted small">目前沒有付費課程。免費課程登入後就能直接觀看，不需要開通。</p>';
  let filter = '';

  function draw() {
    const shown = list.filter((s) => !filter || s.email.includes(filter));
    app.innerHTML = '<div class="container editor">' + adminTabs('students') + '<h1>學生開通</h1>' +
      '<form class="card pad" id="add" novalidate><h3>開通新學生</h3>' +
      '<label>學生的登入 Email<input class="input" name="email" type="email" placeholder="student@gmail.com" required/></label>' +
      '<p class="muted small">要開通的課程：</p>' + boxes('add', []) +
      '<button class="btn btn-sm">開通</button>' +
      '<p class="muted small">學生必須用這個 Email 登入網站；Email 註冊的學生需完成 Email 驗證。</p></form>' +
      `<div class="row-between"><h2>已開通的學生（${list.length}）</h2>` +
      `<input class="input search-small" id="filter" placeholder="搜尋 Email" value="${esc(filter)}"/></div>` +
      (shown.length ? shown.map((s) =>
        `<div class="card pad student" data-email="${esc(s.email)}"><div class="row-between"><strong>${esc(s.email)}</strong>` +
        `<span class="lesson-nav"><button type="button" class="btn btn-sm" data-act="save">儲存</button>` +
        `<button type="button" class="btn btn-ghost btn-sm" data-act="remove">移除</button></span></div>` +
        boxes('c', s.courses) +
        s.courses.filter((id) => !paid.some((c) => c.id === id)).map((id) => `<p class="muted small">另有：${esc(name(id))}</p>`).join('') +
        '</div>').join('') : '<p class="muted">還沒有開通任何學生。</p>') +
      '</div>';

    const f = app.querySelector('#add');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const email = f.email.value.trim().toLowerCase();
      if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) return toast('Email 格式不正確');
      const picked = [...f.querySelectorAll('[data-add]:checked')].map((el) => el.dataset.add);
      if (!picked.length) return toast('請至少勾選一門課程');
      const existing = list.find((s) => s.email === email);
      const merged = [...new Set([...(existing ? existing.courses : []), ...picked])];
      try {
        await fb.setDoc(fb.doc(db, 'access', email), { courses: merged });
        if (existing) existing.courses = merged; else list.push({ email, courses: merged });
        list.sort((a, b) => a.email.localeCompare(b.email));
        toast(`已為 ${email} 開通`);
        draw();
      } catch (err) { toast('開通失敗：' + (err.code || err.message)); }
    };
    app.querySelector('#filter').oninput = (e) => {
      filter = e.target.value.trim().toLowerCase();
      const pos = e.target.selectionStart;
      draw();
      const el = app.querySelector('#filter'); el.focus(); el.setSelectionRange(pos, pos);
    };
    app.querySelectorAll('.student').forEach((card) => {
      card.onclick = async (e) => {
        const act = e.target.dataset && e.target.dataset.act;
        if (!act) return;
        const email = card.dataset.email;
        const s = list.find((x) => x.email === email);
        try {
          if (act === 'remove') {
            if (!confirm(`確定移除 ${email} 的所有課程權限？`)) return;
            await fb.deleteDoc(fb.doc(db, 'access', email));
            list = list.filter((x) => x.email !== email);
            toast('已移除');
          } else {
            // 保留不在付費清單中的課程 id（例如已刪除的課程），只更新勾選的付費課程
            const others = s.courses.filter((id) => !paid.some((c) => c.id === id));
            s.courses = [...others, ...[...card.querySelectorAll('[data-c]:checked')].map((el) => el.dataset.c)];
            await fb.setDoc(fb.doc(db, 'access', email), { courses: s.courses });
            toast('已儲存');
          }
          draw();
        } catch (err) { toast('操作失敗：' + (err.code || err.message)); }
      };
    });
  }
  draw();
};

// 編輯單一課程
pages.edit = async (app, id) => {
  const isNew = id === 'new';
  const src = isNew ? null : findCourse(id);
  if (!isNew && !src) return notFound(app);
  if (!coursesFromDb) { toast('請先匯入課程到資料庫'); return go('/admin'); }
  app.innerHTML = '<div class="container"><p class="muted">載入中…</p></div>';

  // 工作副本
  const c = isNew ? {
    id: newId('c'), title: '', subtitle: '', category: '', level: '入門', price: 0, originalPrice: 0, instructor: '',
    thumb: ['#0ea5e9', '#6366f1', '1.01'], cover: '', trailer: '', description: '', outcomes: [],
    chapters: [{ title: '課程內容', lessons: [{ id: newId('l'), title: '', duration: 0, note: '' }] }],
    published: false, order: courses.length
  } : JSON.parse(JSON.stringify(src));
  c.thumb = c.thumb || ['#0ea5e9', '#6366f1', '1.01'];
  let videos = {};
  if (!isNew) {
    try { videos = { ...(await fb.getDoc(fb.doc(db, 'courseVideos', c.id))).data() }; } catch (e) { console.error(e); }
  }
  if (!document.body.contains(app)) return;

  const field = (label, name, val, attrs = '') => `<label>${label}<input class="input" name="${name}" value="${esc(val)}" ${attrs}/></label>`;
  const area = (label, name, val, rows = 4, hint = '') => `<label>${label}${hint ? ` <span class="muted small">${hint}</span>` : ''}<textarea class="input textarea" name="${name}" rows="${rows}">${esc(val)}</textarea></label>`;

  function draw() {
    app.innerHTML = `<div class="container editor"><a href="#/admin" class="muted small">← 課程管理</a><h1>${isNew ? '新增課程' : '編輯課程'}</h1>` +
      '<form id="ed" novalidate>' +
      '<div class="card pad"><h3>基本資訊</h3>' +
      field('課程名稱', 'title', c.title, 'required') +
      field('副標題', 'subtitle', c.subtitle) +
      '<div class="two">' + field('分類', 'category', c.category) + field('程度', 'level', c.level) + '</div>' +
      '<div class="two">' + field('講師', 'instructor', c.instructor) + '<span></span></div>' +
      '<div class="two">' + field('售價（0 = 永久免費）', 'price', c.price, 'type="number" min="0"') + field('原價（會顯示劃掉的價格，0 = 不顯示）', 'originalPrice', c.originalPrice, 'type="number" min="0"') + '</div>' +
      '<div class="free-window"><strong class="small">限時免費</strong><p class="muted small">在這段時間內，登入的學生都能免費觀看；時間到了就恢復售價，需要開通才能看。售價請填一般價格（大於 0）。兩個都留空 = 不設定。</p>' +
      '<div class="two">' + field('開始時間（留空 = 立即開始）', 'freeFrom', toLocalInput(c.freeFrom), 'type="datetime-local"') +
      field('結束時間', 'freeUntil', toLocalInput(c.freeUntil), 'type="datetime-local"') + '</div></div>' +
      `<label class="check"><input type="checkbox" name="published" ${c.published !== false ? 'checked' : ''}/> 上架（取消勾選則只有管理者看得到）</label></div>` +

      '<div class="card pad"><h3>封面</h3><div class="cover-edit">' +
      `<div class="cover-preview" id="cover-prev">${thumb(c)}</div><div>` +
      '<label>上傳封面照片 <span class="muted small">建議 16:9 橫向圖片，會自動裁切成 960×540</span><input class="input" type="file" accept="image/*" id="cover-file"/></label>' +
      (c.cover ? '<button type="button" class="btn btn-ghost btn-sm" id="cover-remove">移除封面照片</button>' : '') +
      '<p class="muted small">沒有封面照片時，會顯示下面的漸層色和文字：</p>' +
      `<div class="two"><label>顏色 1<input class="input" type="color" name="c1" value="${esc(c.thumb[0])}"/></label><label>顏色 2<input class="input" type="color" name="c2" value="${esc(c.thumb[1])}"/></label></div>` +
      field('封面文字', 'mark', c.thumb[2], 'maxlength="6"') +
      '</div></div></div>' +

      '<div class="card pad"><h3>課程介紹</h3>' +
      area('課程介紹', 'description', c.description, 5) +
      area('你將學到', 'outcomes', (c.outcomes || []).join('\n'), 4, '每行一項') +
      field('公開預告片 YouTube 網址（可留空，任何人都看得到）', 'trailer', c.trailer || '') +
      '</div>' +

      '<div class="card pad"><div class="row-between"><h3>章節與單元</h3><button type="button" class="btn btn-ghost btn-sm" data-act="add-ch">＋ 新增章節</button></div>' +
      '<p class="muted small">單元影片網址只有開通的學生和管理者看得到。</p>' +
      c.chapters.map((ch, ci) =>
        `<div class="ed-chapter"><div class="row-between"><input class="input" data-ch="${ci}" value="${esc(ch.title)}" placeholder="章節名稱"/>` +
        `<button type="button" class="btn btn-ghost btn-sm" data-act="del-ch" data-ci="${ci}">刪除章節</button></div>` +
        ch.lessons.map((l, li) =>
          `<div class="ed-lesson"><div class="row-between"><strong class="small">單元 ${li + 1}</strong><span class="lesson-nav">` +
          (li > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-act="up" data-ci="${ci}" data-li="${li}">↑</button>` : '') +
          (li < ch.lessons.length - 1 ? `<button type="button" class="btn btn-ghost btn-sm" data-act="down" data-ci="${ci}" data-li="${li}">↓</button>` : '') +
          `<button type="button" class="btn btn-ghost btn-sm" data-act="del-l" data-ci="${ci}" data-li="${li}">刪除</button></span></div>` +
          `<label>單元標題<input class="input" data-l="title" data-ci="${ci}" data-li="${li}" value="${esc(l.title)}"/></label>` +
          `<label>影片 <span class="muted small">按「上傳影片檔」，或貼上 YouTube 網址</span><input class="input" data-l="video" data-ci="${ci}" data-li="${li}" value="${esc(videos[l.id] || '')}" placeholder="https://youtu.be/…"/></label>` +
          `<div class="upload-row"><label class="btn btn-ghost btn-sm">📤 上傳影片檔<input type="file" accept="video/*" data-upload="${esc(l.id)}" data-ci="${ci}" data-li="${li}" hidden/></label>` +
          `<span class="muted small" data-prog="${esc(l.id)}">${uploads[l.id] != null ? `上傳中 ${uploads[l.id]}%` : isFileVideo(videos[l.id]) ? '✓ 使用已上傳的影片檔' : ''}</span></div>` +
          `<label>單元說明 <span class="muted small">顯示在影片下方，網址會變成連結</span><textarea class="input textarea" rows="3" data-l="note" data-ci="${ci}" data-li="${li}">${esc(l.note || '')}</textarea></label></div>`
        ).join('') +
        `<button type="button" class="btn btn-ghost btn-sm" data-act="add-l" data-ci="${ci}">＋ 新增單元</button></div>`
      ).join('') + '</div>' +

      '<div class="editor-actions"><button class="btn" id="save">儲存</button>' +
      (isNew ? '' : '<button type="button" class="btn btn-ghost" data-act="delete">刪除課程</button>') +
      '</div></form></div>';
  }

  // 把表單內容寫回工作副本（重畫前呼叫，避免輸入內容遺失）
  function collect() {
    const f = app.querySelector('#ed');
    if (!f) return;
    c.title = f.title.value.trim();
    c.subtitle = f.subtitle.value.trim();
    c.category = f.category.value.trim();
    c.level = f.level.value.trim();
    c.instructor = f.instructor.value.trim();
    c.price = Math.max(0, +f.price.value || 0);
    c.originalPrice = Math.max(0, +f.originalPrice.value || 0);
    c.freeFrom = f.freeFrom.value ? new Date(f.freeFrom.value).getTime() : 0;
    c.freeUntil = f.freeUntil.value ? new Date(f.freeUntil.value).getTime() : 0;
    c.published = f.published.checked;
    c.thumb = [f.c1.value, f.c2.value, f.mark.value.trim()];
    c.description = f.description.value.trim();
    c.outcomes = f.outcomes.value.split('\n').map((t) => t.trim()).filter(Boolean);
    c.trailer = f.trailer.value.trim();
    f.querySelectorAll('[data-ch]').forEach((el) => { c.chapters[+el.dataset.ch].title = el.value.trim(); });
    f.querySelectorAll('[data-l]').forEach((el) => {
      const l = c.chapters[+el.dataset.ci].lessons[+el.dataset.li];
      if (el.dataset.l === 'video') { if (el.value.trim()) videos[l.id] = el.value.trim(); else delete videos[l.id]; }
      else l[el.dataset.l] = el.dataset.l === 'note' ? el.value.trim() : el.value.trim();
    });
  }

  // 上傳中的單元：單元 id → 進度 %
  const uploads = {};
  let storageMod = null, storage = null;
  async function uploadVideo(lessonId, file) {
    if (!/^video\//.test(file.type)) return toast('請選擇影片檔（例如 .mp4）');
    if (file.size > 2 * 1024 ** 3) return toast('影片檔超過 2GB，請先壓縮後再上傳');
    if (!storageMod) {
      storageMod = await import(FIREBASE + 'firebase-storage.js');
      storage = storageMod.getStorage();
    }
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const r = storageMod.ref(storage, `videos/${c.id}/${lessonId}-${Date.now()}.${ext}`);
    const task = storageMod.uploadBytesResumable(r, file, { contentType: file.type });
    uploads[lessonId] = 0;
    const show = (t) => { const el = app.querySelector(`[data-prog="${lessonId}"]`); if (el) el.textContent = t; };
    show('上傳中 0%');
    task.on('state_changed', (snap) => {
      uploads[lessonId] = Math.floor(snap.bytesTransferred / snap.totalBytes * 100);
      show(`上傳中 ${uploads[lessonId]}%`);
    });
    try {
      await task;
      const url = await storageMod.getDownloadURL(r);
      collect();
      videos[lessonId] = url;
      delete uploads[lessonId];
      draw(); bind();
      toast('影片上傳完成，記得按「儲存」');
    } catch (err) {
      console.error(err);
      delete uploads[lessonId];
      show('上傳失敗');
      toast('上傳失敗：' + (err.code || err.message) + '（請確認已啟用 Storage 並更新規則）');
    }
  }

  function bind() {
    const f = app.querySelector('#ed');
    f.onchange = (e) => {
      const lid = e.target.dataset && e.target.dataset.upload;
      if (lid && e.target.files[0]) uploadVideo(lid, e.target.files[0]);
    };
    const fileInput = app.querySelector('#cover-file');
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try { collect(); c.cover = await resizeCover(file); draw(); bind(); toast('封面已更新，記得按「儲存」'); }
      catch (e) { toast('無法讀取這張圖片'); }
    };
    const rm = app.querySelector('#cover-remove');
    if (rm) rm.onclick = () => { collect(); c.cover = ''; draw(); bind(); };
    ['c1', 'c2', 'mark'].forEach((n) => { f[n].oninput = () => { if (!c.cover) { collect(); app.querySelector('#cover-prev').innerHTML = thumb(c); } }; });

    f.onclick = async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act, ci = +b.dataset.ci, li = +b.dataset.li;
      collect();
      if (act === 'add-ch') c.chapters.push({ title: '新章節', lessons: [] });
      if (act === 'del-ch') { if (!confirm('確定刪除這個章節和裡面的所有單元？')) return; c.chapters.splice(ci, 1); }
      if (act === 'add-l') c.chapters[ci].lessons.push({ id: newId('l'), title: '', duration: 0, note: '' });
      if (act === 'del-l') { if (!confirm('確定刪除這個單元？')) return; c.chapters[ci].lessons.splice(li, 1); }
      if (act === 'up' || act === 'down') {
        const ls = c.chapters[ci].lessons, j = act === 'up' ? li - 1 : li + 1;
        [ls[li], ls[j]] = [ls[j], ls[li]];
      }
      if (act === 'delete') {
        if (!confirm(`確定刪除「${src.title}」？此動作無法復原。`)) return;
        try {
          await fb.deleteDoc(fb.doc(db, 'courses', c.id));
          await fb.deleteDoc(fb.doc(db, 'courseVideos', c.id));
          courses = courses.filter((x) => x.id !== c.id);
          toast('課程已刪除');
          return go('/admin');
        } catch (err) { return toast('刪除失敗：' + (err.code || err.message)); }
      }
      draw(); bind();
    };

    f.onsubmit = async (e) => {
      e.preventDefault();
      collect();
      if (!c.title) return toast('請輸入課程名稱');
      if (!lessonsOf(c).length) return toast('至少需要一個單元');
      if (lessonsOf(c).some((l) => !l.title)) return toast('請填寫所有單元的標題');
      if (c.freeFrom && !c.freeUntil) return toast('請設定限時免費的結束時間');
      if (c.freeUntil && c.freeFrom && c.freeUntil <= c.freeFrom) return toast('限時免費的結束時間必須晚於開始時間');
      if (c.freeUntil && !c.price) return toast('設定限時免費時，售價請填一般價格（大於 0）；售價 0 代表永久免費');
      if (Object.keys(uploads).length) return toast('還有影片正在上傳，請等上傳完成再儲存');
      const bad = lessonsOf(c).find((l) => videos[l.id] && !youtubeId(videos[l.id]) && !isFileVideo(videos[l.id]));
      if (bad) return toast(`「${bad.title}」的影片網址格式不正確`);
      // 只保留還存在的單元的影片
      const ids = lessonsOf(c).map((l) => l.id);
      Object.keys(videos).forEach((k) => { if (!ids.includes(k)) delete videos[k]; });
      const btn = app.querySelector('#save');
      btn.disabled = true; btn.textContent = '儲存中…';
      try {
        const data = { ...c, updatedAt: Date.now() };
        delete data.id;
        await fb.setDoc(fb.doc(db, 'courses', c.id), data);
        await fb.setDoc(fb.doc(db, 'courseVideos', c.id), videos);
        videoCache[c.id] = { ...videos };
        const i = courses.findIndex((x) => x.id === c.id);
        if (i > -1) courses[i] = { ...c }; else courses.push({ ...c });
        toast('已儲存');
        go('/course/' + c.id);
      } catch (err) {
        console.error(err);
        btn.disabled = false; btn.textContent = '儲存';
        toast('儲存失敗：' + (err.code || err.message));
      }
    };
  }

  draw();
  bind();
};

/* ---------------- 說明頁：常見問題、隱私權政策、服務條款 ---------------- */
const paragraphs = (t) => linkify(esc(t)).replace(/\n/g, '<br>');
function faqList(items) {
  return '<div class="faq">' + items.map(([q, a]) =>
    `<details class="card"><summary>${esc(q)}</summary><div class="faq-a">${paragraphs(a)}</div></details>`).join('') + '</div>';
}
function infoPage(app, title, body) {
  app.innerHTML = `<div class="container info-page"><a href="#/" class="muted small">← 回到首頁</a><h1>${title}</h1>${body}` +
    `<p class="muted small">最後更新：${esc(SITE_PAGES.updated)} · 聯絡我們：<a class="link" href="mailto:${esc(SITE_PAGES.email)}">${esc(SITE_PAGES.email)}</a></p></div>`;
}
const sections = (list) => list.map(([h, t]) => `<h2>${esc(h)}</h2><p>${paragraphs(t)}</p>`).join('');
pages.faq = (app) => infoPage(app, '常見問題', faqList(SITE_PAGES.faq));
pages.privacy = (app) => infoPage(app, '隱私權政策', sections(SITE_PAGES.privacy));
pages.terms = (app) => infoPage(app, '服務條款', sections(SITE_PAGES.terms));

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
