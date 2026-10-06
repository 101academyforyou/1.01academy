/* 網站設定 —— 部署前請填好這個檔案（步驟見 README.md）
 *
 * firebaseConfig：到 Firebase 主控台 → 專案設定 → 一般 → 你的應用程式 → SDK 設定，
 * 複製「const firebaseConfig = {...}」裡的內容貼到下面。
 * 這些值本來就會公開在網頁上，放在 GitHub 是安全的；真正的保護靠 firestore.rules。
 */
window.SITE_CONFIG = {
  firebaseConfig: {
    apiKey: 'AIzaSyAYqxTZVjg4XZhsXMsmHhFv8ASAmv8RfRU',
    authDomain: 'academy-213ba.firebaseapp.com',
    projectId: 'academy-213ba',
    storageBucket: 'academy-213ba.firebasestorage.app',
    messagingSenderId: '678711804375',
    appId: '1:678711804375:web:fb897bd9b526426e018b92'
  },

  // 學生想購買課程時，課程頁會顯示這段聯絡方式
  contact: '來信 salimachchang@gmail.com 購買，付款後為你開通。',

  // 管理者 Email：登入後可在網站上編輯課程（右上角「管理」）
  // ⚠️ 只改這裡不夠，也要同步修改 firestore.rules 裡的 isAdmin()，那裡才是真正的權限控管
  admins: ['salimachchang@gmail.com'],

  // 免費課程（售價 0）顯示這段
  freeContact: '限時免費！來信 salimachchang@gmail.com 索取觀看權限，我們會為你開通。'
};
