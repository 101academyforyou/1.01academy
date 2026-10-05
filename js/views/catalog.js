window.Views = window.Views || {};

Views.catalog = function (app, params, query) {
  'use strict';
  var esc = UI.esc, icon = UI.icon;
  var state = {
    q: query.q || '',
    cat: query.cat || '',
    level: query.level || '',
    price: query.price || '',
    sort: query.sort || 'popular'
  };
  var all = Store.courses();
  var levels = ['入門', '中級', '進階'];

  function count(fn) { return all.filter(fn).length; }

  function filterBtn(key, val, label, n) {
    return '<button data-f="' + key + '" data-v="' + esc(val) + '" class="' + (state[key] === val ? 'active' : '') + '">' + esc(label) + '<span>' + n + '</span></button>';
  }

  app.innerHTML =
    C.pageHead('探索課程', '找到下一個讓你升級的技能', '<a href="#/">首頁</a>' + icon('chevronRight', 'icon-sm') + '<span>所有課程</span>') +
    '<div class="container"><div class="catalog">' +
    '<aside class="filters" id="filters"></aside>' +
    '<div><div class="toolbar">' +
    '<div class="flex items-center gap-12 wrap"><button class="btn btn-outline btn-sm filter-toggle" id="ft">' + icon('filter', 'icon-sm') + '篩選</button>' +
    '<div class="input-group" style="min-width:240px">' + icon('search') + '<input class="input" id="q" placeholder="搜尋課程…" value="' + esc(state.q) + '" style="height:40px" /></div>' +
    '<span class="muted small" id="count"></span></div>' +
    '<select class="select" id="sort" aria-label="排序">' +
    [['popular', '最熱門'], ['rating', '評價最高'], ['newest', '最新上架'], ['price-asc', '價格：低到高'], ['price-desc', '價格：高到低']].map(function (o) {
      return '<option value="' + o[0] + '" ' + (state.sort === o[0] ? 'selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></div>' +
    '<div id="active-filters" class="flex gap-8 wrap mb-16"></div>' +
    '<div class="course-grid" id="results"></div></div>' +
    '</div></div>';

  var filtersEl = app.querySelector('#filters');
  var resultsEl = app.querySelector('#results');

  function renderFilters() {
    filtersEl.innerHTML =
      '<div><h4>分類</h4><div class="filter-list">' + filterBtn('cat', '', '全部分類', all.length) +
      Store.categories().map(function (c) { return filterBtn('cat', c.id, c.name, count(function (x) { return x.category === c.id; })); }).join('') + '</div></div>' +
      '<div><h4>程度</h4><div class="filter-list">' + filterBtn('level', '', '所有程度', all.length) +
      levels.map(function (l) { return filterBtn('level', l, l, count(function (x) { return x.level === l; })); }).join('') + '</div></div>' +
      '<div><h4>價格</h4><div class="filter-list">' + filterBtn('price', '', '全部', all.length) +
      filterBtn('price', 'free', '免費', count(function (x) { return !x.price; })) +
      filterBtn('price', 'paid', '付費', count(function (x) { return x.price > 0; })) + '</div></div>';
  }

  function matches(c) {
    if (state.cat && c.category !== state.cat) return false;
    if (state.level && c.level !== state.level) return false;
    if (state.price === 'free' && c.price > 0) return false;
    if (state.price === 'paid' && !c.price) return false;
    if (state.q) {
      var ins = Store.instructor(c.instructorId) || {};
      var hay = [c.title, c.subtitle, ins.name, (c.tags || []).join(' '), (Store.category(c.category) || {}).name].join(' ').toLowerCase();
      var ok = state.q.toLowerCase().split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) > -1; });
      if (!ok) return false;
    }
    return true;
  }

  function sorter(a, b) {
    switch (state.sort) {
      case 'rating': return Store.rating(b).avg - Store.rating(a).avg;
      case 'newest': return String(b.updatedAt).localeCompare(String(a.updatedAt));
      case 'price-asc': return a.price - b.price;
      case 'price-desc': return b.price - a.price;
      default: return Store.studentCount(b) - Store.studentCount(a);
    }
  }

  function syncUrl() {
    var qs = Object.keys(state).filter(function (k) { return state[k] && !(k === 'sort' && state[k] === 'popular'); })
      .map(function (k) { return k + '=' + encodeURIComponent(state[k]); }).join('&');
    history.replaceState(null, '', '#/courses' + (qs ? '?' + qs : ''));
  }

  function renderResults() {
    var list = all.filter(matches).sort(sorter);
    app.querySelector('#count').textContent = '共 ' + list.length + ' 門課程';
    var chips = [];
    if (state.cat) chips.push(['cat', (Store.category(state.cat) || {}).name]);
    if (state.level) chips.push(['level', state.level]);
    if (state.price) chips.push(['price', state.price === 'free' ? '免費' : '付費']);
    if (state.q) chips.push(['q', '「' + state.q + '」']);
    app.querySelector('#active-filters').innerHTML = chips.map(function (c) {
      return '<button class="chip active" data-clear="' + c[0] + '">' + esc(c[1]) + icon('x', 'icon-sm') + '</button>';
    }).join('') + (chips.length > 1 ? '<button class="chip" data-clear="all">清除全部</button>' : '');
    resultsEl.innerHTML = list.length ? list.map(C.courseCard).join('') :
      '<div style="grid-column:1/-1">' + UI.emptyState('search', '找不到符合的課程', '試試其他關鍵字或調整篩選條件', '<button class="btn btn-outline" data-clear="all">清除篩選</button>') + '</div>';
    syncUrl();
  }

  filtersEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]');
    if (!b) return;
    state[b.getAttribute('data-f')] = b.getAttribute('data-v');
    renderFilters(); renderResults();
  });
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-clear]');
    if (!b) return;
    var k = b.getAttribute('data-clear');
    if (k === 'all') { state.cat = state.level = state.price = state.q = ''; }
    else state[k] = '';
    app.querySelector('#q').value = state.q;
    renderFilters(); renderResults();
  });
  app.querySelector('#q').addEventListener('input', UI.debounce(function (e) {
    state.q = e.target.value.trim(); renderResults();
  }, 200));
  app.querySelector('#sort').addEventListener('change', function (e) { state.sort = e.target.value; renderResults(); });
  app.querySelector('#ft').addEventListener('click', function () { filtersEl.classList.toggle('open'); });
  C.bindWish(app);

  renderFilters();
  renderResults();
};
