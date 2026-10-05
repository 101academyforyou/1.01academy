/* 課程資料：要新增或修改課程，直接編輯這個檔案即可 */
var VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';

var CATEGORIES = ['全部', '網頁開發', 'AI', '資料科學', '設計'];

var COURSES = [
  {
    id: 'react', title: 'React 全端實戰：從零打造產品', subtitle: '掌握 Hooks、Next.js 與部署，完成一個可上線的作品。',
    category: '網頁開發', level: '中級', price: 2680, originalPrice: 4800, instructor: '林子傑',
    thumb: ['#0ea5e9', '#6366f1', '</>'],
    description: '以「完成真實產品」為目標的 React 課程。從核心觀念開始，一路使用 Next.js、TypeScript 打造完整網站並部署上線。',
    outcomes: ['理解 React 元件與 Hooks', '使用 Next.js 建立全端應用', '以 TypeScript 撰寫元件', '將專案部署上線'],
    chapters: [
      { title: '課程介紹', lessons: [['l1', '課程導覽', 270, true, 'ForBiggerBlazes.mp4'], ['l2', '開發環境建置', 432, false, 'ForBiggerEscapes.mp4']] },
      { title: 'React 核心', lessons: [['l3', 'JSX 與元件', 744, false, 'ForBiggerFun.mp4'], ['l4', 'Props 與 State', 846, false, 'ForBiggerJoyrides.mp4'], ['l5', 'useEffect', 978, false, 'ForBiggerMeltdowns.mp4']] },
      { title: '實戰專案', lessons: [['l6', '建立專案', 1260, false, 'BigBuckBunny.mp4'], ['l7', '部署上線', 852, false, 'ElephantsDream.mp4']] }
    ]
  },
  {
    id: 'ai-apps', title: '生成式 AI 應用開發入門', subtitle: '從 Prompt 到打造自己的 AI 助理。',
    category: 'AI', level: '入門', price: 3280, originalPrice: 5600, instructor: '陳雅婷',
    thumb: ['#7c3aed', '#ec4899', 'AI'],
    description: '理解大型語言模型的運作方式，學會撰寫好的 Prompt，並用 Python 打造一個能回答問題的 AI 助理。',
    outcomes: ['理解 LLM 基本原理', '掌握 Prompt 技巧', '打造知識庫問答機器人'],
    chapters: [
      { title: '認識生成式 AI', lessons: [['l1', 'AI 的現在與未來', 486, true, 'ForBiggerJoyrides.mp4'], ['l2', 'LLM 怎麼運作？', 924, false, 'ForBiggerBlazes.mp4']] },
      { title: '動手做', lessons: [['l3', 'Prompt 技巧', 612, false, 'ForBiggerFun.mp4'], ['l4', '打造 AI 助理', 1344, false, 'Sintel.mp4']] }
    ]
  },
  {
    id: 'python-data', title: 'Python 資料分析入門', subtitle: '零基礎也能上手，用資料做出更好的決策。',
    category: '資料科學', level: '入門', price: 1680, originalPrice: 2980, instructor: '王志明',
    thumb: ['#10b981', '#0ea5e9', 'Py'],
    description: '從 Python 基礎語法開始，學會用 Pandas 整理資料、畫出圖表，並完成一份分析報告。',
    outcomes: ['撰寫基本 Python 程式', '用 Pandas 整理資料', '製作資料視覺化圖表'],
    chapters: [
      { title: 'Python 快速入門', lessons: [['l1', '為什麼選擇 Python？', 312, true, 'ForBiggerEscapes.mp4'], ['l2', '變數與流程控制', 876, false, 'ForBiggerFun.mp4']] },
      { title: '資料分析', lessons: [['l3', 'Pandas 基礎', 786, false, 'ForBiggerMeltdowns.mp4'], ['l4', '畫出圖表', 672, false, 'TearsOfSteel.mp4']] }
    ]
  },
  {
    id: 'figma', title: 'UI/UX 設計實戰：Figma 入門', subtitle: '從零開始設計出專業的 App 介面。',
    category: '設計', level: '入門', price: 1980, originalPrice: 3600, instructor: 'Emily Huang',
    thumb: ['#f97316', '#ec4899', 'UX'],
    description: '學習產品設計的基本流程，熟悉 Figma 操作，並完成一份可以互動的 App 原型。',
    outcomes: ['理解 UX 設計流程', '熟悉 Figma 基本操作', '製作互動原型'],
    chapters: [
      { title: '設計基礎', lessons: [['l1', '什麼是 UX？', 384, true, 'ForBiggerBlazes.mp4'], ['l2', 'Figma 介面導覽', 630, false, 'ForBiggerJoyrides.mp4']] },
      { title: '實作', lessons: [['l3', '設計第一個畫面', 1038, false, 'ForBiggerEscapes.mp4'], ['l4', '互動原型', 894, false, 'BigBuckBunny.mp4']] }
    ]
  },
  {
    id: 'git', title: '【免費】Git 與 GitHub 新手入門', subtitle: '每位開發者都必須會的版本控制，30 分鐘上手。',
    category: '網頁開發', level: '入門', price: 0, originalPrice: 0, instructor: '林子傑',
    thumb: ['#334155', '#0f172a', 'git'],
    description: '一堂免費入門課，帶你理解版本控制的概念，學會 Git 常用指令與 GitHub 基本操作。',
    outcomes: ['理解版本控制', '使用 Git 常用指令', '在 GitHub 上分享程式碼'],
    chapters: [
      { title: 'Git 基礎', lessons: [['l1', '什麼是版本控制？', 252, true, 'ForBiggerFun.mp4'], ['l2', 'commit 與 log', 516, true, 'ForBiggerBlazes.mp4'], ['l3', 'GitHub 入門', 606, true, 'ForBiggerEscapes.mp4']] }
    ]
  }
];

// 把精簡的單元陣列轉成物件：[id, 標題, 秒數, 是否試看, 影片檔]
COURSES.forEach(function (c) {
  c.chapters.forEach(function (ch) {
    ch.lessons = ch.lessons.map(function (l) {
      return { id: l[0], title: l[1], duration: l[2], preview: l[3], video: /^https?:/.test(l[4]) ? l[4] : VIDEO + l[4] };
    });
  });
});
