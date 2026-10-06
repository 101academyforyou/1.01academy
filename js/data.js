/* 課程目錄（公開資訊）：要新增或修改課程，直接編輯這個檔案。
 *
 * ⚠️ 這裡不要放課程影片的 YouTube 連結！這個檔案任何人都看得到。
 *    課程影片 ID 請放在 Firebase 的 courseVideos 集合（見 README.md）。
 *
 * trailer：可選，公開的預告片 YouTube 影片 ID 或網址，會顯示在課程介紹頁。
 * 單元格式：['單元id', '單元標題', 秒數]
 *    「單元id」要和 Firebase courseVideos 裡的欄位名稱一致。
 */
var CATEGORIES = ['全部', '網頁開發', 'AI', '資料科學', '設計'];

var COURSES = [
  {
    id: 'react', title: 'React 全端實戰：從零打造產品', subtitle: '掌握 Hooks、Next.js 與部署，完成一個可上線的作品。',
    category: '網頁開發', level: '中級', price: 2680, originalPrice: 4800, instructor: '林子傑',
    thumb: ['#0ea5e9', '#6366f1', '</>'], trailer: '',
    description: '以「完成真實產品」為目標的 React 課程。從核心觀念開始，一路使用 Next.js、TypeScript 打造完整網站並部署上線。',
    outcomes: ['理解 React 元件與 Hooks', '使用 Next.js 建立全端應用', '以 TypeScript 撰寫元件', '將專案部署上線'],
    chapters: [
      { title: '課程介紹', lessons: [['l1', '課程導覽', 270], ['l2', '開發環境建置', 432]] },
      { title: 'React 核心', lessons: [['l3', 'JSX 與元件', 744], ['l4', 'Props 與 State', 846], ['l5', 'useEffect', 978]] },
      { title: '實戰專案', lessons: [['l6', '建立專案', 1260], ['l7', '部署上線', 852]] }
    ]
  },
  {
    id: 'ai-apps', title: '生成式 AI 應用開發入門', subtitle: '從 Prompt 到打造自己的 AI 助理。',
    category: 'AI', level: '入門', price: 3280, originalPrice: 5600, instructor: '陳雅婷',
    thumb: ['#7c3aed', '#ec4899', 'AI'], trailer: '',
    description: '理解大型語言模型的運作方式，學會撰寫好的 Prompt，並用 Python 打造一個能回答問題的 AI 助理。',
    outcomes: ['理解 LLM 基本原理', '掌握 Prompt 技巧', '打造知識庫問答機器人'],
    chapters: [
      { title: '認識生成式 AI', lessons: [['l1', 'AI 的現在與未來', 486], ['l2', 'LLM 怎麼運作？', 924]] },
      { title: '動手做', lessons: [['l3', 'Prompt 技巧', 612], ['l4', '打造 AI 助理', 1344]] }
    ]
  },
  {
    id: 'python-data', title: 'Python 資料分析入門', subtitle: '零基礎也能上手，用資料做出更好的決策。',
    category: '資料科學', level: '入門', price: 1680, originalPrice: 2980, instructor: '王志明',
    thumb: ['#10b981', '#0ea5e9', 'Py'], trailer: '',
    description: '從 Python 基礎語法開始，學會用 Pandas 整理資料、畫出圖表，並完成一份分析報告。',
    outcomes: ['撰寫基本 Python 程式', '用 Pandas 整理資料', '製作資料視覺化圖表'],
    chapters: [
      { title: 'Python 快速入門', lessons: [['l1', '為什麼選擇 Python？', 312], ['l2', '變數與流程控制', 876]] },
      { title: '資料分析', lessons: [['l3', 'Pandas 基礎', 786], ['l4', '畫出圖表', 672]] }
    ]
  },
  {
    id: 'figma', title: 'UI/UX 設計實戰：Figma 入門', subtitle: '從零開始設計出專業的 App 介面。',
    category: '設計', level: '入門', price: 1980, originalPrice: 3600, instructor: 'Emily Huang',
    thumb: ['#f97316', '#ec4899', 'UX'], trailer: '',
    description: '學習產品設計的基本流程，熟悉 Figma 操作，並完成一份可以互動的 App 原型。',
    outcomes: ['理解 UX 設計流程', '熟悉 Figma 基本操作', '製作互動原型'],
    chapters: [
      { title: '設計基礎', lessons: [['l1', '什麼是 UX？', 384], ['l2', 'Figma 介面導覽', 630]] },
      { title: '實作', lessons: [['l3', '設計第一個畫面', 1038], ['l4', '互動原型', 894]] }
    ]
  }
];

COURSES.forEach(function (c) {
  c.chapters.forEach(function (ch) {
    ch.lessons = ch.lessons.map(function (l) { return { id: l[0], title: l[1], duration: l[2] }; });
  });
});
