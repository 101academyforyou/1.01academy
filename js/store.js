/*
 * 資料層：目前以 localStorage 模擬後端資料庫。
 * 所有讀寫都集中在這裡，未來串接真正的後端 API / 金流時只需替換此檔案。
 */
window.Store = (function () {
  'use strict';

  var DB_KEY = 'a101_db';
  var SESSION_KEY = 'a101_session';
  var CART_KEY = 'a101_cart';
  var listeners = [];
  var db;

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隱私模式等情況 */ } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function seedDb() {
    return {
      version: SEED.version,
      categories: clone(SEED.categories),
      instructors: clone(SEED.instructors),
      courses: clone(SEED.courses),
      reviews: clone(SEED.reviews),
      coupons: clone(SEED.coupons),
      users: [{
        id: 'u_admin', name: '平台管理員', email: 'admin@101academy.com',
        password: hashSync('admin123', 'u_admin'), role: 'admin',
        enrolled: [], wishlist: [], createdAt: Date.now(), bio: '', phone: ''
      }],
      orders: [],
      progress: {},
      notes: {}
    };
  }

  function load() {
    var raw = safeGet(DB_KEY);
    if (raw) {
      try {
        db = JSON.parse(raw);
        if (db && db.version === SEED.version) return;
      } catch (e) { /* 資料損毀則重建 */ }
    }
    db = seedDb();
    save();
  }

  function save() {
    safeSet(DB_KEY, JSON.stringify(db));
  }

  function emit() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); }
  function commit() { save(); emit(); }

  /* 示範用雜湊（非加密等級）——正式環境請在後端以 bcrypt/argon2 處理密碼 */
  function hashSync(str, salt) {
    var s = String(salt) + ':' + String(str);
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }

  /* ---------------- 分類 / 講師 ---------------- */
  function categories() { return db.categories; }
  function category(id) { return db.categories.find(function (c) { return c.id === id; }); }
  function instructors() { return db.instructors; }
  function instructor(id) { return db.instructors.find(function (i) { return i.id === id; }); }
  function instructorStats(id) {
    var cs = db.courses.filter(function (c) { return c.instructorId === id && c.published; });
    return {
      courses: cs.length,
      students: cs.reduce(function (s, c) { return s + studentCount(c); }, 0),
      rating: cs.length ? cs.reduce(function (s, c) { return s + rating(c).avg; }, 0) / cs.length : 0
    };
  }

  /* ---------------- 課程 ---------------- */
  function courses(opts) {
    opts = opts || {};
    return db.courses.filter(function (c) { return opts.all || c.published; });
  }
  function course(id) { return db.courses.find(function (c) { return c.id === id; }); }
  function lessons(c) {
    var out = [];
    (c.chapters || []).forEach(function (ch) { ch.lessons.forEach(function (l) { out.push(l); }); });
    return out;
  }
  function totalDuration(c) { return lessons(c).reduce(function (s, l) { return s + (Number(l.duration) || 0); }, 0); }
  function findLesson(c, lessonId) { return lessons(c).find(function (l) { return l.id === lessonId; }); }
  function studentCount(c) {
    var real = db.users.filter(function (u) { return u.enrolled.indexOf(c.id) > -1; }).length;
    return (c.students || 0) + real;
  }
  function courseReviews(courseId) {
    return db.reviews.filter(function (r) { return r.courseId === courseId; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  // 合併基礎評分（模擬歷史資料）與實際評價
  function rating(c) {
    var rs = courseReviews(c.id);
    var baseN = c.baseReviews || 0, baseAvg = c.baseRating || 0;
    var sum = baseAvg * baseN + rs.reduce(function (s, r) { return s + r.rating; }, 0);
    var n = baseN + rs.length;
    return { avg: n ? sum / n : 0, count: n };
  }
  function ratingDistribution(c) {
    // 依平均分數推估歷史分布，再加上真實評價
    var r = rating(c), dist = [0, 0, 0, 0, 0];
    var base = c.baseReviews || 0, avg = c.baseRating || 0;
    var w5 = Math.max(0, Math.min(1, (avg - 3.5) / 1.5));
    var shares = [0.01, 0.02, 0.07, 0.9 - w5 * 0.75, w5 * 0.75];
    var total = shares.reduce(function (a, b) { return a + b; }, 0);
    shares.forEach(function (s, i) { dist[i] = Math.round(base * s / total); });
    courseReviews(c.id).forEach(function (rv) { dist[rv.rating - 1]++; });
    return { dist: dist, count: r.count };
  }
  function saveCourse(c) {
    var i = db.courses.findIndex(function (x) { return x.id === c.id; });
    if (i > -1) db.courses[i] = c; else db.courses.unshift(c);
    commit();
  }
  function deleteCourse(id) {
    db.courses = db.courses.filter(function (c) { return c.id !== id; });
    removeFromCart(id, true);
    commit();
  }
  function addReview(courseId, ratingVal, comment) {
    var u = currentUser();
    if (!u) throw new Error('請先登入');
    if (!isEnrolled(courseId)) throw new Error('購買課程後才能評價');
    var existing = db.reviews.find(function (r) { return r.courseId === courseId && r.userId === u.id; });
    if (existing) {
      existing.rating = ratingVal; existing.comment = comment; existing.createdAt = Date.now();
    } else {
      db.reviews.push({ id: 'r' + Date.now().toString(36), courseId: courseId, userId: u.id, userName: u.name, rating: ratingVal, comment: comment, createdAt: Date.now() });
    }
    commit();
  }
  function myReview(courseId) {
    var u = currentUser();
    return u ? db.reviews.find(function (r) { return r.courseId === courseId && r.userId === u.id; }) : null;
  }

  /* ---------------- 使用者 / 驗證 ---------------- */
  function users() { return db.users; }
  function publicUser(u) {
    if (!u) return null;
    var o = clone(u); delete o.password; return o;
  }
  function currentUserRaw() {
    var id = safeGet(SESSION_KEY);
    return id ? db.users.find(function (u) { return u.id === id; }) || null : null;
  }
  function currentUser() { return currentUserRaw(); }
  function isAdmin() { var u = currentUser(); return !!(u && u.role === 'admin'); }

  function register(name, email, password) {
    email = String(email).trim().toLowerCase();
    if (db.users.some(function (u) { return u.email === email; })) throw new Error('此 Email 已被註冊');
    var id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var u = { id: id, name: String(name).trim(), email: email, password: hashSync(password, id), role: 'student', enrolled: [], wishlist: [], createdAt: Date.now(), bio: '', phone: '' };
    db.users.push(u);
    safeSet(SESSION_KEY, id);
    commit();
    return u;
  }
  function login(email, password) {
    email = String(email).trim().toLowerCase();
    var u = db.users.find(function (x) { return x.email === email; });
    if (!u || u.password !== hashSync(password, u.id)) throw new Error('Email 或密碼錯誤');
    if (u.disabled) throw new Error('此帳號已被停用，請聯繫客服');
    safeSet(SESSION_KEY, u.id);
    emit();
    return u;
  }
  function logout() { safeDel(SESSION_KEY); emit(); }
  function updateProfile(patch) {
    var u = currentUserRaw();
    if (!u) throw new Error('請先登入');
    ['name', 'phone', 'bio'].forEach(function (k) { if (patch[k] != null) u[k] = String(patch[k]).trim(); });
    commit();
  }
  function changePassword(oldPw, newPw) {
    var u = currentUserRaw();
    if (!u) throw new Error('請先登入');
    if (u.password !== hashSync(oldPw, u.id)) throw new Error('目前密碼不正確');
    u.password = hashSync(newPw, u.id);
    commit();
  }
  function setUserRole(id, role) {
    var u = db.users.find(function (x) { return x.id === id; });
    if (u) { u.role = role; commit(); }
  }
  function toggleUserDisabled(id) {
    var u = db.users.find(function (x) { return x.id === id; });
    if (u) { u.disabled = !u.disabled; commit(); }
  }

  /* ---------------- 購物車 / 收藏 ---------------- */
  function cart() {
    try {
      var ids = JSON.parse(safeGet(CART_KEY) || '[]');
      return ids.filter(function (id) { return course(id); });
    } catch (e) { return []; }
  }
  function setCart(ids, silent) { safeSet(CART_KEY, JSON.stringify(ids)); if (!silent) emit(); }
  function addToCart(id) {
    if (isEnrolled(id)) return false;
    var c = cart();
    if (c.indexOf(id) === -1) { c.push(id); setCart(c); }
    return true;
  }
  function removeFromCart(id, silent) { setCart(cart().filter(function (x) { return x !== id; }), silent); }
  function inCart(id) { return cart().indexOf(id) > -1; }
  function clearCart() { setCart([]); }

  function wishlist() { var u = currentUser(); return u ? u.wishlist.filter(function (id) { return course(id); }) : []; }
  function inWishlist(id) { return wishlist().indexOf(id) > -1; }
  function toggleWishlist(id) {
    var u = currentUserRaw();
    if (!u) throw new Error('請先登入');
    var i = u.wishlist.indexOf(id);
    if (i > -1) u.wishlist.splice(i, 1); else u.wishlist.push(id);
    commit();
    return i === -1;
  }

  /* ---------------- 優惠券 ---------------- */
  function coupons() { return db.coupons; }
  function validateCoupon(code, subtotal) {
    code = String(code || '').trim().toUpperCase();
    var cp = db.coupons.find(function (c) { return c.code === code; });
    if (!cp || !cp.active) throw new Error('優惠碼無效或已過期');
    if (subtotal < (cp.minAmount || 0)) throw new Error('此優惠碼需消費滿 NT$' + cp.minAmount.toLocaleString());
    var discount = cp.type === 'percent' ? Math.round(subtotal * cp.value / 100) : cp.value;
    return { code: cp.code, discount: Math.min(discount, subtotal), coupon: cp };
  }
  function saveCoupon(cp) {
    cp.code = String(cp.code).trim().toUpperCase();
    var i = db.coupons.findIndex(function (x) { return x.code === cp.code; });
    if (i > -1) db.coupons[i] = cp; else db.coupons.push(cp);
    commit();
  }
  function deleteCoupon(code) { db.coupons = db.coupons.filter(function (c) { return c.code !== code; }); commit(); }

  /* ---------------- 訂單 / 選課 ---------------- */
  function isEnrolled(courseId) {
    var u = currentUser();
    return !!(u && u.enrolled.indexOf(courseId) > -1);
  }
  function enrolledCourses() {
    var u = currentUser();
    return u ? u.enrolled.map(course).filter(Boolean) : [];
  }
  function enrollUser(userId, courseIds) {
    var u = db.users.find(function (x) { return x.id === userId; });
    if (!u) return;
    courseIds.forEach(function (id) { if (u.enrolled.indexOf(id) === -1) u.enrolled.push(id); });
  }
  function enrollFree(courseId) {
    var u = currentUserRaw();
    if (!u) throw new Error('請先登入');
    var c = course(courseId);
    if (!c || c.price > 0) throw new Error('此課程非免費課程');
    createOrderInternal(u, [c], null, 'free', { name: u.name, email: u.email });
    commit();
  }

  function createOrderInternal(u, items, couponInfo, method, billing) {
    var subtotal = items.reduce(function (s, c) { return s + c.price; }, 0);
    var discount = couponInfo ? couponInfo.discount : 0;
    var now = Date.now();
    var d = new Date(now);
    var order = {
      id: 'A' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + String(Math.floor(Math.random() * 1e6)).padStart(6, '0'),
      userId: u.id,
      items: items.map(function (c) { return { courseId: c.id, title: c.title, price: c.price }; }),
      subtotal: subtotal,
      discount: discount,
      coupon: couponInfo ? couponInfo.code : null,
      total: Math.max(0, subtotal - discount),
      method: method,
      status: method === 'atm' ? 'pending' : 'paid',
      billing: billing,
      createdAt: now,
      paidAt: method === 'atm' ? null : now
    };
    if (method === 'atm') {
      order.atm = { bank: '812 台新銀行', account: '9910' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0'), expireAt: now + 3 * 86400000 };
    } else {
      enrollUser(u.id, items.map(function (c) { return c.id; }));
    }
    db.orders.unshift(order);
    return order;
  }

  // 結帳：items 為課程 id 陣列
  function checkout(itemIds, couponCode, method, billing) {
    var u = currentUserRaw();
    if (!u) throw new Error('請先登入');
    var items = itemIds.map(course).filter(function (c) { return c && u.enrolled.indexOf(c.id) === -1; });
    if (!items.length) throw new Error('沒有可結帳的課程');
    var subtotal = items.reduce(function (s, c) { return s + c.price; }, 0);
    var couponInfo = couponCode ? validateCoupon(couponCode, subtotal) : null;
    var order = createOrderInternal(u, items, couponInfo, method, billing);
    // 從購物車移除已結帳項目
    var paidIds = items.map(function (c) { return c.id; });
    setCart(cart().filter(function (id) { return paidIds.indexOf(id) === -1; }), true);
    commit();
    return order;
  }

  function orders(all) {
    if (all) return db.orders;
    var u = currentUser();
    return u ? db.orders.filter(function (o) { return o.userId === u.id; }) : [];
  }
  function order(id) {
    var o = db.orders.find(function (x) { return x.id === id; });
    if (!o) return null;
    var u = currentUser();
    if (!u || (o.userId !== u.id && u.role !== 'admin')) return null;
    return o;
  }
  function markOrderPaid(id) {
    var o = db.orders.find(function (x) { return x.id === id; });
    if (!o || o.status === 'paid') return;
    o.status = 'paid'; o.paidAt = Date.now();
    enrollUser(o.userId, o.items.map(function (i) { return i.courseId; }));
    commit();
  }
  function refundOrder(id) {
    var o = db.orders.find(function (x) { return x.id === id; });
    if (!o) return;
    o.status = 'refunded'; o.refundedAt = Date.now();
    var u = db.users.find(function (x) { return x.id === o.userId; });
    if (u) {
      var ids = o.items.map(function (i) { return i.courseId; });
      u.enrolled = u.enrolled.filter(function (cid) { return ids.indexOf(cid) === -1; });
    }
    commit();
  }
  function cancelOrder(id) {
    var o = order(id);
    if (!o || o.status !== 'pending') return;
    o.status = 'cancelled';
    commit();
  }

  /* ---------------- 學習進度 / 筆記 ---------------- */
  function progressOf(courseId, userId) {
    var u = userId ? { id: userId } : currentUser();
    if (!u) return { done: [], last: null };
    var p = (db.progress[u.id] || {})[courseId];
    return p || { done: [], last: null };
  }
  function percent(courseId, userId) {
    var c = course(courseId);
    if (!c) return 0;
    var total = lessons(c).length;
    if (!total) return 0;
    var ids = lessons(c).map(function (l) { return l.id; });
    var done = progressOf(courseId, userId).done.filter(function (id) { return ids.indexOf(id) > -1; }).length;
    return Math.round(done / total * 100);
  }
  function ensureProgress(courseId) {
    var u = currentUser();
    if (!u) return null;
    db.progress[u.id] = db.progress[u.id] || {};
    db.progress[u.id][courseId] = db.progress[u.id][courseId] || { done: [], last: null, positions: {} };
    var p = db.progress[u.id][courseId];
    p.positions = p.positions || {};
    return p;
  }
  function setLastLesson(courseId, lessonId) {
    var p = ensureProgress(courseId);
    if (!p) return;
    p.last = lessonId; p.updatedAt = Date.now();
    save();
  }
  function savePosition(courseId, lessonId, sec) {
    var p = ensureProgress(courseId);
    if (!p) return;
    p.positions[lessonId] = Math.floor(sec);
    save();
  }
  function position(courseId, lessonId) {
    var p = progressOf(courseId);
    return (p.positions && p.positions[lessonId]) || 0;
  }
  function setLessonDone(courseId, lessonId, done) {
    var p = ensureProgress(courseId);
    if (!p) return;
    var i = p.done.indexOf(lessonId);
    if (done && i === -1) p.done.push(lessonId);
    if (!done && i > -1) p.done.splice(i, 1);
    p.updatedAt = Date.now();
    if (done && percent(courseId) === 100 && !p.completedAt) p.completedAt = Date.now();
    commit();
  }
  function isLessonDone(courseId, lessonId) { return progressOf(courseId).done.indexOf(lessonId) > -1; }

  function notes(courseId) {
    var u = currentUser();
    if (!u) return [];
    return ((db.notes[u.id] || {})[courseId] || []).slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  function addNote(courseId, lessonId, text, time) {
    var u = currentUser();
    if (!u) return;
    db.notes[u.id] = db.notes[u.id] || {};
    db.notes[u.id][courseId] = db.notes[u.id][courseId] || [];
    db.notes[u.id][courseId].push({ id: 'n' + Date.now().toString(36), lessonId: lessonId, text: text, time: Math.floor(time || 0), createdAt: Date.now() });
    save();
  }
  function deleteNote(courseId, noteId) {
    var u = currentUser();
    if (!u || !db.notes[u.id] || !db.notes[u.id][courseId]) return;
    db.notes[u.id][courseId] = db.notes[u.id][courseId].filter(function (n) { return n.id !== noteId; });
    save();
  }

  /* ---------------- 後台統計 ---------------- */
  function stats() {
    var paid = db.orders.filter(function (o) { return o.status === 'paid'; });
    var revenue = paid.reduce(function (s, o) { return s + o.total; }, 0);
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      var start = d.getTime(), end = start + 86400000;
      days.push({
        label: (d.getMonth() + 1) + '/' + d.getDate(),
        value: paid.filter(function (o) { return o.paidAt >= start && o.paidAt < end; }).reduce(function (s, o) { return s + o.total; }, 0)
      });
    }
    var sales = {};
    paid.forEach(function (o) { o.items.forEach(function (it) { sales[it.courseId] = (sales[it.courseId] || 0) + 1; }); });
    return {
      revenue: revenue,
      orders: db.orders.length,
      paidOrders: paid.length,
      pending: db.orders.filter(function (o) { return o.status === 'pending'; }).length,
      students: db.users.filter(function (u) { return u.role === 'student'; }).length,
      courses: db.courses.length,
      days: days,
      sales: sales
    };
  }

  function resetAll() {
    safeDel(DB_KEY); safeDel(SESSION_KEY); safeDel(CART_KEY);
    load(); emit();
  }

  load();

  return {
    onChange: onChange, resetAll: resetAll,
    categories: categories, category: category, instructors: instructors, instructor: instructor, instructorStats: instructorStats,
    courses: courses, course: course, lessons: lessons, totalDuration: totalDuration, findLesson: findLesson,
    studentCount: studentCount, courseReviews: courseReviews, rating: rating, ratingDistribution: ratingDistribution,
    saveCourse: saveCourse, deleteCourse: deleteCourse, addReview: addReview, myReview: myReview,
    users: users, publicUser: publicUser, currentUser: currentUser, isAdmin: isAdmin, register: register, login: login, logout: logout,
    updateProfile: updateProfile, changePassword: changePassword, setUserRole: setUserRole, toggleUserDisabled: toggleUserDisabled,
    cart: cart, addToCart: addToCart, removeFromCart: removeFromCart, inCart: inCart, clearCart: clearCart,
    wishlist: wishlist, inWishlist: inWishlist, toggleWishlist: toggleWishlist,
    coupons: coupons, validateCoupon: validateCoupon, saveCoupon: saveCoupon, deleteCoupon: deleteCoupon,
    isEnrolled: isEnrolled, enrolledCourses: enrolledCourses, enrollFree: enrollFree, checkout: checkout,
    orders: orders, order: order, markOrderPaid: markOrderPaid, refundOrder: refundOrder, cancelOrder: cancelOrder,
    progressOf: progressOf, percent: percent, setLastLesson: setLastLesson, setLessonDone: setLessonDone, isLessonDone: isLessonDone,
    savePosition: savePosition, position: position,
    notes: notes, addNote: addNote, deleteNote: deleteNote,
    stats: stats
  };
})();
