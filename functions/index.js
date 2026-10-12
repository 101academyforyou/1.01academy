/* 1.01 Academy — 綠界 ECPay 線上付款，付款成功後自動開通課程
 *
 * createOrder：學生按「線上付款」時建立訂單（課程或筆記，可用折扣碼），回傳送往綠界付款頁的表單；
 *              全額折價券（折扣後 0 元）直接開通
 * checkCoupon：學生輸入折扣碼時，回傳折扣後的價格
 * ecpayNotify：綠界付款完成後通知這裡（ReturnURL），驗證後自動開通課程
 * islamLinkPreview：循序漸進學伊斯蘭的管理者貼上文章連結時，讀取標題、摘要、封面圖片（linkPreview.js）
 *
 * 設定（見 README.md）：
 *   functions/.env：ECPAY_ENV（stage = 測試、prod = 正式）、ECPAY_MERCHANT_ID、SITE_URL
 *   密鑰：ECPAY_HASH_KEY、ECPAY_HASH_IV（第一次部署時會詢問）
 */
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const ecpay = require('./ecpay');
const linkPreview = require('./linkPreview');

initializeApp();
const db = getFirestore();
const REGION = 'asia-east1';
setGlobalOptions({ region: REGION, maxInstances: 5 });

const ECPAY_ENV = defineString('ECPAY_ENV', { default: 'stage' });
const ECPAY_MERCHANT_ID = defineString('ECPAY_MERCHANT_ID');
const SITE_URL = defineString('SITE_URL');
const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { default: '' });
const ECPAY_HASH_KEY = defineSecret('ECPAY_HASH_KEY');
const ECPAY_HASH_IV = defineSecret('ECPAY_HASH_IV');

// 付費課程觀看期限：一年
const oneYearFrom = (ms) => { const d = new Date(ms); d.setFullYear(d.getFullYear() + 1); return d.getTime(); };
const activeGrant = (data, courseId, now = Date.now()) => {
  if (!data || !(data.courses || []).includes(courseId)) return false;
  const exp = Number((data.expires || {})[courseId]) || 0;
  return !exp || exp > now;
};

const isFreeNow = (c, now = Date.now()) =>
  !c.price || (c.freeUntil > now && (c.freeFrom || 0) <= now);

function requireStudent(req) {
  const token = req.auth && req.auth.token;
  if (!token || !token.email || token.email_verified !== true) {
    throw new HttpsError('unauthenticated', '請先登入並完成 Email 驗證');
  }
  return token.email.toLowerCase();
}

// 讀取要買的課程（courseId）或筆記（noteId），並確認可以購買
async function loadItem(email, data) {
  const noteId = String((data && data.noteId) || '');
  const isNote = !!noteId;
  const courseId = isNote ? '' : String((data && data.courseId) || '');
  const itemId = isNote ? noteId : courseId;
  const label = isNote ? '筆記' : '課程';
  if (!/^[\w-]{1,64}$/.test(itemId)) throw new HttpsError('invalid-argument', `${label}不存在`);

  const snap = await db.doc(`${isNote ? 'notes' : 'courses'}/${itemId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', `${label}不存在`);
  const item = snap.data();
  if (item.published === false) throw new HttpsError('not-found', `${label}不存在`);
  if (isNote ? !item.price : isFreeNow(item)) {
    throw new HttpsError('failed-precondition', isNote ? '這份筆記免費，登入即可打開' : '這門課程目前免費，請在課程頁按「免費加入課程」');
  }
  const amount = Math.round(Number(item.price));
  if (!(amount > 0)) throw new HttpsError('failed-precondition', `${label}價格設定有誤`);

  const access = await db.doc(`access/${email}`).get();
  if (isNote && access.exists && (access.data().notes || []).includes(noteId)) {
    throw new HttpsError('already-exists', '你已經購買過這份筆記');
  }
  if (!isNote && access.exists && activeGrant(access.data(), courseId)) {
    throw new HttpsError('already-exists', '你已經擁有這門課程，觀看期限內不需要重新購買');
  }
  return { isNote, noteId, courseId, itemId, kind: isNote ? 'note' : 'course', title: item.title || itemId, amount };
}

/* ---------------- 折扣碼 ----------------
 * coupons/{代碼（大寫）} = {
 *   type: 'percent'（打折，value = 折扣 %，100 = 全額）或 'amount'（折抵金額，value = 元）,
 *   value, appliesTo: ['course:課程id', 'note:筆記id']（空陣列 = 全部適用）,
 *   maxUses（0 = 不限）, used, expiresAt（毫秒，0 = 不限）, active
 * }
 * couponUses/{代碼}__{Email}：每個帳號每個折扣碼只能用一次
 */
const normCode = (c) => String(c || '').trim().toUpperCase();
const useId = (code, email) => `${code}__${email}`;

// 檢查折扣碼（可在交易中重新檢查），回傳 { final, discount }
function evalCoupon(code, c, used, item) {
  if (!c || c.active === false) throw new HttpsError('not-found', '折扣碼無效');
  if (c.expiresAt && c.expiresAt <= Date.now()) throw new HttpsError('failed-precondition', '折扣碼已過期');
  if (c.maxUses > 0 && (c.used || 0) >= c.maxUses) throw new HttpsError('resource-exhausted', '折扣碼已被使用完畢');
  const scope = c.appliesTo || [];
  if (scope.length && !scope.includes(`${item.kind}:${item.itemId}`)) throw new HttpsError('failed-precondition', `這個折扣碼不適用於這個${item.isNote ? '筆記' : '課程'}`);
  if (used) throw new HttpsError('already-exists', '你已經使用過這個折扣碼');
  const v = Number(c.value) || 0;
  const discount = c.type === 'amount'
    ? Math.min(item.amount, Math.max(0, Math.round(v)))
    : Math.min(item.amount, Math.round(item.amount * Math.min(100, Math.max(0, v)) / 100));
  if (!(discount > 0)) throw new HttpsError('failed-precondition', '折扣碼無效');
  return { final: item.amount - discount, discount };
}

async function checkCode(rawCode, email, item) {
  const code = normCode(rawCode);
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) throw new HttpsError('not-found', '折扣碼無效');
  const [c, u] = await Promise.all([db.doc(`coupons/${code}`).get(), db.doc(`couponUses/${useId(code, email)}`).get()]);
  return { code, ...evalCoupon(code, c.exists ? c.data() : null, u.exists, item) };
}

// 學生輸入折扣碼：回傳折扣後的價格（還不會使用掉）
exports.checkCoupon = onCall(async (req) => {
  const email = requireStudent(req);
  const item = await loadItem(email, req.data);
  const r = await checkCode(req.data && req.data.coupon, email, item);
  return { code: r.code, original: item.amount, discount: r.discount, final: r.final };
});

// 學生按「線上付款」：建立訂單 → 回傳綠界付款表單
// 有折扣碼且折扣後為 0 元（全額折價券）：不經過綠界，直接開通
exports.createOrder = onCall({ secrets: [ECPAY_HASH_KEY, ECPAY_HASH_IV] }, async (req) => {
  const email = requireStudent(req);
  const item = await loadItem(email, req.data);
  const coupon = req.data && req.data.coupon ? await checkCode(req.data.coupon, email, item) : null;
  const amount = coupon ? coupon.final : item.amount;
  const base = {
    uid: req.auth.uid,
    email,
    kind: item.kind,
    ...(item.isNote ? { noteId: item.noteId } : { courseId: item.courseId }),
    courseTitle: item.title,
    amount,
    ...(coupon ? { coupon: coupon.code, discount: coupon.discount, originalAmount: item.amount } : {})
  };

  if (coupon && amount === 0) {
    const orderId = 'FREE' + ecpay.newTradeNo().slice(4);
    const couponRef = db.doc(`coupons/${coupon.code}`);
    const usedRef = db.doc(`couponUses/${useId(coupon.code, email)}`);
    const accessRef = db.doc(`access/${email}`);
    let expiresAt = 0;
    await db.runTransaction(async (tx) => {
      const [c, u, a] = await Promise.all([tx.get(couponRef), tx.get(usedRef), tx.get(accessRef)]);
      const r = evalCoupon(coupon.code, c.exists ? c.data() : null, u.exists, item); // 交易中重新檢查（避免同時兌換超過次數）
      if (r.final !== 0) throw new HttpsError('aborted', '折扣碼已變更，請重新輸入');
      tx.update(couponRef, { used: FieldValue.increment(1) });
      tx.set(usedRef, { code: coupon.code, email, orderId, at: FieldValue.serverTimestamp() });
      if (item.isNote) {
        tx.set(accessRef, { notes: FieldValue.arrayUnion(item.noteId) }, { merge: true });
      } else {
        const now = Date.now();
        const current = a.exists ? Number((a.data().expires || {})[item.courseId]) || 0 : 0;
        expiresAt = oneYearFrom(activeGrant(a.data(), item.courseId, now) && current > now ? current : now);
        tx.set(accessRef, { courses: FieldValue.arrayUnion(item.courseId), expires: { [item.courseId]: expiresAt } }, { merge: true });
      }
      tx.set(db.doc(`orders/${orderId}`), {
        ...base, status: 'paid', paymentType: 'coupon', ...(expiresAt ? { expiresAt } : {}),
        createdAt: FieldValue.serverTimestamp(), paidAt: FieldValue.serverTimestamp()
      });
    });
    return { orderId, free: true };
  }

  // 測試環境：只有管理者能付款，避免有人用綠界公開的測試卡號免費開通課程
  if (ECPAY_ENV.value() !== 'prod') {
    const admins = ADMIN_EMAILS.value().split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(email)) throw new HttpsError('failed-precondition', '線上付款準備中，暫時無法使用，請來信洽詢');
  }

  const tradeNo = ecpay.newTradeNo();
  const site = SITE_URL.value().replace(/\/+$/, '');
  const projectId = process.env.GCLOUD_PROJECT || JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;
  const checkout = ecpay.buildCheckout({
    merchantId: ECPAY_MERCHANT_ID.value(),
    hashKey: ECPAY_HASH_KEY.value(),
    hashIV: ECPAY_HASH_IV.value(),
    env: ECPAY_ENV.value(),
    tradeNo,
    amount,
    itemName: item.title,
    returnUrl: `https://${REGION}-${projectId}.cloudfunctions.net/ecpayNotify`,
    clientBackUrl: `${site}/#/order/${tradeNo}`
  });

  await db.doc(`orders/${tradeNo}`).set({ ...base, status: 'pending', env: ECPAY_ENV.value(), createdAt: FieldValue.serverTimestamp() });
  return { orderId: tradeNo, action: checkout.action, fields: checkout.fields };
});

// 綠界付款結果通知（伺服器對伺服器）：驗證後自動開通課程，必須回應 1|OK
exports.ecpayNotify = onRequest({ secrets: [ECPAY_HASH_KEY, ECPAY_HASH_IV], invoker: 'public' }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('0|Method Not Allowed'); return; }
  const p = req.body || {};
  if (!ecpay.verifyCheckMacValue(p, ECPAY_HASH_KEY.value(), ECPAY_HASH_IV.value())) {
    logger.warn('ECPay notify: CheckMacValue 驗證失敗', { tradeNo: p.MerchantTradeNo });
    res.status(400).send('0|CheckMacValueError');
    return;
  }
  const tradeNo = String(p.MerchantTradeNo || '');
  const orderRef = db.doc(`orders/${tradeNo}`);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) { logger.warn('ECPay notify: 找不到訂單', { tradeNo }); return; }
      const order = snap.data();
      const accessRef = db.doc(`access/${order.email}`);
      const accessSnap = await tx.get(accessRef); // 交易中所有讀取要在寫入之前
      const usedRef = order.coupon ? db.doc(`couponUses/${useId(order.coupon, order.email)}`) : null;
      const usedSnap = usedRef ? await tx.get(usedRef) : null;
      if (order.status === 'paid') return; // 重複通知
      // 付款成功時記下折扣碼使用次數（每個帳號一次）
      const markCoupon = () => {
        if (!usedRef || usedSnap.exists) return;
        tx.set(db.doc(`coupons/${order.coupon}`), { used: FieldValue.increment(1) }, { merge: true });
        tx.set(usedRef, { code: order.coupon, email: order.email, orderId: tradeNo, at: FieldValue.serverTimestamp() });
      };
      const simulated = String(p.SimulatePaid) === '1';
      if (String(p.RtnCode) !== '1') {
        tx.update(orderRef, { status: 'failed', rtnCode: String(p.RtnCode || ''), rtnMsg: String(p.RtnMsg || ''), updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      if (Number(p.TradeAmt) !== order.amount) {
        logger.error('ECPay notify: 金額不符', { tradeNo, paid: p.TradeAmt, expected: order.amount });
        tx.update(orderRef, { status: 'amount_mismatch', updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      // 正式環境不接受綠界後台的「模擬付款」
      if (simulated && ECPAY_ENV.value() === 'prod') {
        tx.update(orderRef, { status: 'simulated', updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      // 筆記：購買後永久可看，不設期限
      if (order.kind === 'note') {
        tx.update(orderRef, {
          status: 'paid',
          simulated,
          ecpayTradeNo: String(p.TradeNo || ''),
          paymentType: String(p.PaymentType || ''),
          paidAt: FieldValue.serverTimestamp()
        });
        tx.set(accessRef, { notes: FieldValue.arrayUnion(order.noteId) }, { merge: true });
        markCoupon();
        return;
      }
      // 觀看期限：付款後一年；若還在期限內（例如重複購買）則從原到期日再延長一年
      const now = Date.now();
      const current = accessSnap.exists ? Number(((accessSnap.data().expires || {})[order.courseId])) || 0 : 0;
      const expiresAt = oneYearFrom(activeGrant(accessSnap.data(), order.courseId, now) && current > now ? current : now);
      tx.update(orderRef, {
        status: 'paid',
        expiresAt,
        simulated,
        ecpayTradeNo: String(p.TradeNo || ''),
        paymentType: String(p.PaymentType || ''),
        paidAt: FieldValue.serverTimestamp()
      });
      tx.set(accessRef, { courses: FieldValue.arrayUnion(order.courseId), expires: { [order.courseId]: expiresAt } }, { merge: true });
      markCoupon();
    });
    res.status(200).send('1|OK');
  } catch (err) {
    logger.error('ECPay notify: 處理失敗', err);
    res.status(500).send('0|Error'); // 綠界會稍後重送
  }
});

// 循序漸進學伊斯蘭：讀取文章連結的標題、摘要、封面圖片（只有伊斯蘭網站的管理者能用）
exports.islamLinkPreview = onCall({ memory: '512MiB', timeoutSeconds: 30 }, async (req) => {
  const email = String((req.auth && req.auth.token.email) || '').toLowerCase();
  if (!req.auth || !req.auth.token.email_verified || !linkPreview.ISLAM_ADMINS.includes(email)) {
    throw new HttpsError('permission-denied', '只有管理者可以使用');
  }
  const url = String((req.data && req.data.url) || '').trim();
  if (!url || url.length > 2000) throw new HttpsError('invalid-argument', '請貼上文章網址');
  try {
    return await linkPreview.preview(url);
  } catch (e) {
    logger.warn('islamLinkPreview', url, e.message);
    throw new HttpsError('failed-precondition', e.message || '無法讀取這個網址');
  }
});
