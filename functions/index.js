/* 1.01 Academy — 綠界 ECPay 線上付款，付款成功後自動開通課程
 *
 * createOrder：學生按「線上付款」時建立訂單，回傳送往綠界付款頁的表單
 * ecpayNotify：綠界付款完成後通知這裡（ReturnURL），驗證後自動開通課程
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

const isFreeNow = (c, now = Date.now()) =>
  !c.price || (c.freeUntil > now && (c.freeFrom || 0) <= now);

// 學生按「線上付款」：建立訂單 → 回傳綠界付款表單
exports.createOrder = onCall({ secrets: [ECPAY_HASH_KEY, ECPAY_HASH_IV] }, async (req) => {
  const token = req.auth && req.auth.token;
  if (!token || !token.email || token.email_verified !== true) {
    throw new HttpsError('unauthenticated', '請先登入並完成 Email 驗證');
  }
  const email = token.email.toLowerCase();
  // 測試環境：只有管理者能付款，避免有人用綠界公開的測試卡號免費開通課程
  if (ECPAY_ENV.value() !== 'prod') {
    const admins = ADMIN_EMAILS.value().split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(email)) throw new HttpsError('failed-precondition', '線上付款準備中，暫時無法使用，請來信洽詢');
  }
  const courseId = String((req.data && req.data.courseId) || '');
  if (!/^[\w-]{1,64}$/.test(courseId)) throw new HttpsError('invalid-argument', '課程不存在');

  const snap = await db.doc(`courses/${courseId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', '課程不存在');
  const course = snap.data();
  if (course.published === false) throw new HttpsError('not-found', '課程不存在');
  if (isFreeNow(course)) throw new HttpsError('failed-precondition', '這門課程目前免費，登入即可觀看');
  const amount = Math.round(Number(course.price));
  if (!(amount > 0)) throw new HttpsError('failed-precondition', '課程價格設定有誤');

  const access = await db.doc(`access/${email}`).get();
  if (access.exists && (access.data().courses || []).includes(courseId)) {
    throw new HttpsError('already-exists', '你已經擁有這門課程');
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
    itemName: course.title || courseId,
    returnUrl: `https://${REGION}-${projectId}.cloudfunctions.net/ecpayNotify`,
    clientBackUrl: `${site}/#/order/${tradeNo}`
  });

  await db.doc(`orders/${tradeNo}`).set({
    uid: req.auth.uid,
    email,
    courseId,
    courseTitle: course.title || courseId,
    amount,
    status: 'pending',
    env: ECPAY_ENV.value(),
    createdAt: FieldValue.serverTimestamp()
  });
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
      if (order.status === 'paid') return; // 重複通知
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
      tx.update(orderRef, {
        status: 'paid',
        simulated,
        ecpayTradeNo: String(p.TradeNo || ''),
        paymentType: String(p.PaymentType || ''),
        paidAt: FieldValue.serverTimestamp()
      });
      tx.set(db.doc(`access/${order.email}`), { courses: FieldValue.arrayUnion(order.courseId) }, { merge: true });
    });
    res.status(200).send('1|OK');
  } catch (err) {
    logger.error('ECPay notify: 處理失敗', err);
    res.status(500).send('0|Error'); // 綠界會稍後重送
  }
});
