window.Views = window.Views || {};

Views.home = function (app) {
  'use strict';
  var esc = UI.esc, icon = UI.icon;
  var all = Store.courses();
  var featured = all.filter(function (c) { return c.featured; }).slice(0, 8);
  var totalStudents = all.reduce(function (s, c) { return s + Store.studentCount(c); }, 0);
  var totalLessons = all.reduce(function (s, c) { return s + Store.lessons(c).length; }, 0);

  var cats = Store.categories().map(function (cat) {
    var n = all.filter(function (c) { return c.category === cat.id; }).length;
    return '<a class="cat-tile" href="#/courses?cat=' + cat.id + '"><span class="ci">' + icon(cat.icon) + '</span><strong>' + esc(cat.name) + '</strong><span>' + n + ' courses →</span></a>';
  }).join('');

  var testis = SEED.testimonials.map(function (t) {
    return '<div class="card testi">' + UI.stars(5) + '<p>「' + esc(t.text) + '」</p><div class="who"><span class="avatar">' + esc(UI.initials(t.name)) + '</span><div><strong>' + esc(t.name) + '</strong><span>' + esc(t.role) + '</span></div></div></div>';
  }).join('');

  var faqs = SEED.faqs.map(function (f, i) {
    return '<details ' + (i === 0 ? 'open' : '') + '><summary>' + esc(f[0]) + icon('plus') + '</summary><p>' + esc(f[1]) + '</p></details>';
  }).join('');

  var newest = all.slice().sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); }).slice(0, 4);

  app.innerHTML =
    '<section class="hero"><div class="hero-glow"></div><div class="container hero-grid">' +
    '<div class="fade-in">' +
    '<div class="hero-pill"><b>NEW</b>生成式 AI 應用開發課程上線，限時優惠中</div>' +
    '<h1>每天進步 <span class="grad-text">1%</span>，<br>一年後強大 <span class="grad-text">37 倍</span></h1>' +
    '<p class="lead">由業界專家親自授課的線上課程平台。從程式開發、AI 到設計與商業，用專案實戰累積真正帶得走的能力。</p>' +
    '<form class="hero-search" id="hero-search"><div class="input-group" style="flex:1">' + icon('search') + '<input class="input" name="q" placeholder="你想學什麼？例如：React、AI、Python" aria-label="搜尋課程" /></div><button class="btn btn-primary">搜尋</button></form>' +
    '<div class="hero-cta"><a href="#/courses" class="btn btn-primary btn-lg">探索所有課程 ' + icon('arrowRight') + '</a><a href="#/course/git-starter" class="btn btn-outline btn-lg">' + icon('playCircle') + '免費課程試聽</a></div>' +
    '<div class="hero-stats"><div><div class="num">' + UI.num(totalStudents) + '+</div><div class="lbl">位學員正在學習</div></div><div><div class="num">' + all.length + '</div><div class="lbl">門精選課程</div></div><div><div class="num">' + totalLessons + '</div><div class="lbl">支教學影片</div></div><div><div class="num">4.8★</div><div class="lbl">平均課程評價</div></div></div>' +
    '</div>' +
    '<div class="hero-visual fade-in"><div class="code-card"><div class="bar"><i></i><i></i><i></i><span>growth.js</span></div>' +
    '<pre><span class="c">// 持續學習的複利效應</span>\n<span class="k">const</span> <span class="f">growth</span> = (<span class="n">days</span>) =&gt;\n  Math.<span class="f">pow</span>(<span class="n">1.01</span>, days);\n\n<span class="f">growth</span>(<span class="n">365</span>); <span class="c">// → 37.78</span>\n\n<span class="k">const</span> you = <span class="k">await</span> academy\n  .<span class="f">enroll</span>(<span class="s">\'your-next-skill\'</span>)\n  .<span class="f">learn</span>({ daily: <span class="s">\'1%\'</span> });\n\n<span class="c">// ✓ Level up unlocked</span></pre></div>' +
    '<div class="float-card f1"><span class="fi">' + icon('award') + '</span><div><strong>結業證書</strong><span class="subtle">完成課程即可下載</span></div></div>' +
    '<div class="float-card f2"><span class="fi">' + icon('trending') + '</span><div><strong>+37.78x</strong><span class="subtle">一年的累積成長</span></div></div>' +
    '</div></div></section>' +

    '<section class="trust"><div class="container"><span class="subtle small" style="font-family:var(--font);font-weight:500">學員來自</span><span>TSMC</span><span>Google</span><span>LINE</span><span>Shopee</span><span>Appier</span><span>KKday</span></div></section>' +

    '<section class="section"><div class="container">' +
    '<div class="section-head"><div><div class="eyebrow">Categories</div><h2>熱門學習領域</h2><p>選擇你感興趣的領域，開始累積專業能力</p></div></div>' +
    '<div class="cat-grid">' + cats + '</div></div></section>' +

    '<section class="section" style="padding-top:0"><div class="container">' +
    '<div class="section-head"><div><div class="eyebrow">Featured</div><h2>精選推薦課程</h2><p>最受學員喜愛、評價最高的課程</p></div><a href="#/courses" class="btn btn-outline">查看全部 ' + icon('arrowRight', 'icon-sm') + '</a></div>' +
    '<div class="course-grid" id="featured">' + featured.map(C.courseCard).join('') + '</div></div></section>' +

    '<section class="section" style="padding-top:0"><div class="container"><div class="formula">' +
    '<div><div class="eyebrow">Why 1.01</div><h2>小小的進步，驚人的累積</h2><p>如果每天進步 1%，一年後你會是現在的 37.78 倍；如果每天退步 1%，一年後只剩 0.03。<br>1.01 Academy 把學習拆成每天 15 分鐘的小單元，讓成長成為習慣。</p></div>' +
    '<div class="eq"><span class="grad-text">1.01<sup>365</sup></span> = 37.78</div>' +
    '</div></div></section>' +

    '<section class="section" style="padding-top:0"><div class="container">' +
    '<div class="section-head"><div><div class="eyebrow">Platform</div><h2>為什麼選擇 1.01 Academy</h2></div></div>' +
    '<div class="feature-grid">' +
    feature('infinity', '永久觀看', '一次購買，無限次重複觀看。課程更新內容也免費取得。') +
    feature('code', '專案實戰', '每門課都以真實專案為核心，學完就有作品集可以展示。') +
    feature('smartphone', '隨時隨地學', '支援手機、平板與電腦，自動記錄學習進度與播放位置。') +
    feature('note', '影片筆記', '邊看邊記，筆記自動標記影片時間點，一鍵跳回重點。') +
    feature('award', '結業證書', '完成課程即可獲得專屬證書，為你的履歷加分。') +
    feature('shield', '7 天退款保證', '不滿意？購買 7 天內且進度未達 20% 可全額退款。') +
    '</div></div></section>' +

    '<section class="section" style="padding-top:0"><div class="container">' +
    '<div class="section-head"><div><div class="eyebrow">Latest</div><h2>最新上架</h2></div></div>' +
    '<div class="course-grid" id="newest">' + newest.map(C.courseCard).join('') + '</div></div></section>' +

    '<section class="section" style="padding-top:0"><div class="container">' +
    '<div class="section-head"><div><div class="eyebrow">Testimonials</div><h2>學員怎麼說</h2></div></div>' +
    '<div class="testi-grid">' + testis + '</div></div></section>' +

    '<section class="section" style="padding-top:0" id="faq"><div class="container">' +
    '<div class="section-head" style="justify-content:center;text-align:center"><div><div class="eyebrow">FAQ</div><h2>常見問題</h2></div></div>' +
    '<div class="faq">' + faqs + '</div></div></section>' +

    '<section class="section" style="padding-top:0"><div class="container"><div class="cta">' +
    '<h2>今天，就是你開始進步的第一天</h2><p>註冊即享新會員優惠碼 <b class="mono">WELCOME10</b>，全站課程 9 折</p>' +
    '<a href="#/' + (Store.currentUser() ? 'courses' : 'register') + '" class="btn btn-lg btn-white">' + (Store.currentUser() ? '開始選課' : '免費註冊') + ' ' + icon('arrowRight') + '</a>' +
    '</div></div></section>';

  function feature(ic, t, d) {
    return '<div class="card feature"><div class="fi">' + icon(ic, 'icon-lg') + '</div><h3>' + t + '</h3><p>' + d + '</p></div>';
  }

  app.querySelector('#hero-search').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = this.q.value.trim();
    C.go('/courses' + (q ? '?q=' + encodeURIComponent(q) : ''));
  });
  C.bindWish(app);
};
