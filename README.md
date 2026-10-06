# 1.01academy

> 每天進步 1%，一年後強大 37 倍

放在 **GitHub Pages** 的線上課程網站。學生用 Google 或 Email 登入；你為學生開通課程後，學生就能在網站上觀看**不公開的 YouTube 影片**。

- 課程目錄（標題、介紹、章節）公開，任何人都能瀏覽
- 影片的 YouTube 連結存在 Firebase，**只有被開通該課程的學生**讀得到，不會出現在網站原始碼裡
- 學生付款方式由你自訂（轉帳、LINE Pay 等），收到款項後在 Firebase 後台開通

## 檔案

```
index.html        頁面外框
css/style.css     樣式
js/config.js      ← Firebase 設定、購買聯絡方式（部署前要填）
js/data.js        ← 課程目錄（公開資訊，不要放影片連結）
js/app.js         網站功能
firestore.rules   ← 資料庫安全規則（貼到 Firebase）
```

---

## 第一次設定（約 15 分鐘）

### 1. 建立 Firebase 專案（免費）

1. 前往 <https://console.firebase.google.com> → **新增專案**（Google Analytics 可以關閉）
2. 專案首頁點 **「</>」（網頁）** 新增應用程式，暱稱隨意，不用勾選 Hosting
3. 畫面會出現一段 `const firebaseConfig = { ... }`，把裡面的值複製到 `js/config.js`
4. 順便把 `js/config.js` 裡的 `contact` 改成你的購買聯絡方式

> `firebaseConfig` 本來就是設計成公開在網頁上的，放到 GitHub 沒問題。真正保護影片的是第 3 步的安全規則。

### 2. 開啟登入功能

1. 左側選單 **建構 → Authentication → 開始使用**
2. **登入方式** 分頁：啟用 **Google** 與 **電子郵件/密碼**
3. **設定 → 授權網域** → 新增 `101academyforyou.github.io`

### 3. 建立資料庫並設定安全規則

1. 左側選單 **建構 → Firestore Database → 建立資料庫**
2. 位置選 `asia-east1 (台灣)`，模式選 **正式版模式**
3. 到 **規則** 分頁，把整份 `firestore.rules` 的內容貼上，按 **發布**

### 4. 開啟 GitHub Pages

1. 把程式合併到 `main` 分支
2. GitHub repo → **Settings → Pages**
3. Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾 `/ (root)` → Save
4. 約 1 分鐘後網站會出現在 <https://101academyforyou.github.io/1.01academy/>

---

## 管理者：在網站上編輯課程

`js/config.js` 的 `admins` 與 `firestore.rules` 的 `isAdmin()` 裡列出的 Email（目前是 `salimachchang@gmail.com`）登入後，右上角會出現 **「管理」**：

- 第一次使用請按 **「匯入現有課程到資料庫」**，之後課程資料都存在 Firestore 的 `courses` 集合
- 可以新增、編輯、排序、下架、刪除課程
- 可以上傳封面照片（自動裁切成 960×540）、修改課程介紹、單元標題、單元說明與 YouTube 網址
- 管理者可以觀看所有課程
- **學生開通**：在「管理 → 學生開通」輸入學生的登入 Email、勾選付費課程即可開通；也可以修改或移除權限
- **Bunny Stream**：在單元的「影片」欄位貼上 Bunny 影片的 play 或 embed 網址（`https://iframe.mediadelivery.net/play/…`），並在 Bunny 影片庫的安全設定只允許 `101academyforyou.github.io` 播放
- **上傳影片檔**：在編輯課程的每個單元按「上傳影片檔」（存到 Firebase Storage，需 Blaze 方案並發布 `storage.rules`），或貼 YouTube 網址
- **免費課程**（售價 0）：任何登入的學生都能直接觀看，不需要開通
- **限時免費**：編輯課程時填入售價（大於 0）和限時免費的開始／結束時間。期間內登入的學生都能免費觀看，期間結束後恢復售價，需開通才能看（由 Firestore 規則以伺服器時間把關）

> 要新增管理者，**兩個地方都要改**：`js/config.js` 的 `admins`，以及 `firestore.rules` 的 `isAdmin()`（改完要到 Firebase 重新發布規則）。

## 常見問題、隱私權政策、服務條款

內容在 `js/content.js`，直接修改文字即可。隱私權政策與服務條款是範本，正式營運前請確認內容符合你的實際做法。

## 日常操作

### 新增課程

1. 在 `js/data.js` 的 `COURSES` 裡複製一筆課程修改（課程 `id` 用英文，例如 `react`）。單元格式：`['單元id', '單元標題', 秒數]`
2. 把影片上傳到 YouTube，瀏覽權限設為 **「不公開」**（不要選「私人」，私人影片無法嵌入網站）
3. 到 Firestore 新增影片清單：
   - 集合：`courseVideos`（第一次要按「開始集合」建立）
   - 文件 ID：課程 id，例如 `react`
   - 每個單元一個欄位：欄位名稱 = 單元 id（例如 `l1`），類型 `string`，值 = YouTube 網址或影片 ID

```
courseVideos / react
  l1: "https://youtu.be/xxxxxxxxxxx"
  l2: "https://www.youtube.com/watch?v=yyyyyyyyyyy"
```

### 為學生開通課程

學生先在網站上註冊或登入一次，再把他的**登入 Email** 告訴你。

到 Firestore：
- 集合：`access`
- 文件 ID：學生的 Email，**全部小寫**，例如 `student@gmail.com`
- 欄位：`courses`，類型 `array`，每一項是一個 `string` 課程 id（例如 `react`）

```
access / student@gmail.com
  courses: ["react", "figma"]
```

學生重新整理網頁就能看到課程。要加開其他課程，在同一個 array 再加一項；要取消權限，刪掉那一項或整份文件。

> 用 Email/密碼註冊的學生要先點驗證信裡的連結，才能觀看課程。這是為了避免有人用別人的 Email 註冊來冒用權限。用 Google 登入不需要另外驗證。

---

## 本機預覽

```bash
python3 -m http.server 8000
```

打開 <http://localhost:8000>。用本機測試登入時，要在 Firebase 授權網域加入 `localhost`（通常預設已經有）。

## 要知道的限制

- **「不公開」影片的本質**：網站只會把影片連結給已開通的學生。但學生在播放器上點 YouTube 標誌就能拿到原始網址，而任何拿到網址的人都能在 YouTube 上觀看。這點網站無法完全防止。如果需要更嚴格的保護，要改用 Vimeo（可限制只能在你的網域播放）或專門的影音平台。
- 學習進度存在學生自己的瀏覽器，換裝置不會同步。
- 網站沒有線上付款，開通是你在 Firebase 手動操作。
