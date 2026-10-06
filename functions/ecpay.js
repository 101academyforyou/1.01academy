/* 綠界 ECPay 全方位金流（AIO）工具函式 */
const crypto = require('crypto');

const ENDPOINTS = {
  stage: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  prod: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
};

// 依綠界規則做 URL encode（與 .NET HttpUtility.UrlEncode 相同）後轉小寫
function ecpayUrlEncode(str) {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27')
    .toLowerCase();
}

// 產生 CheckMacValue（SHA256）
function checkMacValue(params, hashKey, hashIV) {
  const keys = Object.keys(params)
    .filter((k) => k !== 'CheckMacValue')
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
  const raw = `HashKey=${hashKey}&` + keys.map((k) => `${k}=${params[k]}`).join('&') + `&HashIV=${hashIV}`;
  return crypto.createHash('sha256').update(ecpayUrlEncode(raw)).digest('hex').toUpperCase();
}

function verifyCheckMacValue(params, hashKey, hashIV) {
  if (!params || typeof params.CheckMacValue !== 'string') return false;
  const expected = checkMacValue(params, hashKey, hashIV);
  const got = params.CheckMacValue.toUpperCase();
  return expected.length === got.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

// 台灣時間 yyyy/MM/dd HH:mm:ss
function taipeiDate(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(d).map((p) => [p.type, p.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}/${parts.month}/${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

// 訂單編號：英數字、最多 20 碼、不重複
function newTradeNo() {
  return ('A' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')).toUpperCase().slice(0, 20);
}

// 建立送往綠界付款頁的表單欄位
function buildCheckout({ merchantId, hashKey, hashIV, env, tradeNo, amount, itemName, returnUrl, clientBackUrl, date }) {
  const params = {
    MerchantID: merchantId,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: date || taipeiDate(),
    PaymentType: 'aio',
    TotalAmount: String(amount),
    TradeDesc: '1.01 Academy 線上課程',
    ItemName: String(itemName).replace(/#/g, ' ').slice(0, 200),
    ReturnURL: returnUrl,
    ClientBackURL: clientBackUrl,
    ChoosePayment: 'ALL',
    EncryptType: '1'
  };
  params.CheckMacValue = checkMacValue(params, hashKey, hashIV);
  return { action: ENDPOINTS[env] || ENDPOINTS.stage, fields: params };
}

module.exports = { ENDPOINTS, ecpayUrlEncode, checkMacValue, verifyCheckMacValue, taipeiDate, newTradeNo, buildCheckout };
