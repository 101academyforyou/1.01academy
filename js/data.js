/* 預設種子資料：分類、講師、課程、評價、優惠券 */
window.SEED = (function () {
  'use strict';

  var VIDEO_BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';
  var VIDEOS = [
    'ForBiggerBlazes.mp4', 'ForBiggerEscapes.mp4', 'ForBiggerFun.mp4', 'ForBiggerJoyrides.mp4',
    'ForBiggerMeltdowns.mp4', 'BigBuckBunny.mp4', 'ElephantsDream.mp4', 'Sintel.mp4', 'TearsOfSteel.mp4'
  ].map(function (f) { return VIDEO_BASE + f; });

  var categories = [
    { id: 'web', name: '網頁開發', icon: 'code' },
    { id: 'ai', name: 'AI 人工智慧', icon: 'cpu' },
    { id: 'data', name: '資料科學', icon: 'database' },
    { id: 'design', name: 'UI/UX 設計', icon: 'pen' },
    { id: 'cloud', name: '雲端 & DevOps', icon: 'cloud' },
    { id: 'business', name: '商業 & 行銷', icon: 'briefcase' }
  ];

  var instructors = [
    { id: 'i1', name: '林子傑', title: '資深全端工程師 · 前 Google 工程師', bio: '擁有 12 年網頁與系統開發經驗，曾任職於 Google 與多家新創公司，專注於前端架構、效能優化與開發者教育。教學風格務實，強調「做中學」。', students: 0, courses: 0 },
    { id: 'i2', name: '陳雅婷', title: 'AI 研究員 · 機器學習博士', bio: '台大資工博士，研究領域為深度學習與自然語言處理，發表多篇國際期刊論文。擅長把艱深的數學概念轉化為直覺好懂的圖解。', students: 0, courses: 0 },
    { id: 'i3', name: '王志明', title: '資料科學家 · Kaggle Master', bio: '在金融與電商領域打造多套推薦系統與風控模型，Kaggle 競賽多次獲獎。相信資料素養是每位現代工作者的必備技能。', students: 0, courses: 0 },
    { id: 'i4', name: 'Emily Huang', title: '產品設計總監 · Design Lead', bio: '曾主導多款百萬用戶 App 的產品設計，專精設計系統、使用者研究與 Figma 工作流程。', students: 0, courses: 0 },
    { id: 'i5', name: '張家豪', title: 'SRE 架構師 · AWS 認證專家', bio: '擁有 AWS / GCP 全系列認證，負責過日活千萬級服務的雲端架構與可靠性工程。', students: 0, courses: 0 }
  ];

  var vi = 0;
  // 章節建構器：[標題, 分鐘數, 是否免費試看]
  function ch(title, lessons) {
    return {
      id: 'c' + Math.random().toString(36).slice(2, 8),
      title: title,
      lessons: lessons.map(function (l) {
        return {
          id: 'l' + Math.random().toString(36).slice(2, 8),
          title: l[0],
          duration: Math.round(l[1] * 60),
          preview: !!l[2],
          video: VIDEOS[vi++ % VIDEOS.length]
        };
      })
    };
  }

  var courses = [
    {
      id: 'react-mastery', title: 'React 18 全端實戰：從零打造 SaaS 產品', subtitle: '掌握 Hooks、Next.js、狀態管理與部署，完成一個可上線的訂閱制產品。',
      category: 'web', level: '中級', price: 2680, originalPrice: 4800, instructorId: 'i1', students: 3842, baseRating: 4.8, baseReviews: 612,
      thumb: { from: '#0ea5e9', to: '#6366f1', mark: '</>' , tag: 'REACT' }, featured: true, published: true, updatedAt: '2026-08-12', language: '中文',
      tags: ['React', 'Next.js', 'TypeScript'],
      description: '這是一門以「完成真實產品」為目標的 React 課程。我們會從 React 核心觀念開始，一路帶你使用 Next.js App Router、TypeScript、Tailwind CSS 與 Prisma 打造一個完整的 SaaS 產品，包含使用者驗證、訂閱付款、儀表板與部署。\n課程中每個章節都有對應的實作練習與完整原始碼，讓你不只看懂，更能自己寫出來。',
      outcomes: ['理解 React 渲染機制與 Hooks 原理', '使用 Next.js App Router 建立全端應用', '以 TypeScript 撰寫型別安全的元件', '串接金流完成訂閱制功能', '設計可維護的元件與資料夾架構', '將專案部署到 Vercel 並設定 CI/CD'],
      requirements: ['具備 HTML / CSS / JavaScript 基礎', '一台可安裝 Node.js 的電腦', '對打造產品有熱情！'],
      chapters: [
        ch('課程介紹與環境建置', [['課程導覽：我們要做出什麼？', 4.5, true], ['安裝 Node.js 與 VS Code', 7.2, true], ['建立第一個 Next.js 專案', 9.8]]),
        ch('React 核心觀念', [['JSX 與元件思維', 12.4], ['Props 與 State', 14.1], ['useEffect 與副作用', 16.3], ['自訂 Hooks', 13.7]]),
        ch('Next.js App Router', [['路由與版面配置', 11.6], ['Server Components 深入解析', 18.2], ['資料讀取與快取策略', 15.5]]),
        ch('打造 SaaS 功能', [['使用者驗證與權限', 21.0], ['訂閱付款整合', 24.3], ['儀表板與圖表', 19.8], ['部署與監控', 14.2]])
      ]
    },
    {
      id: 'chatgpt-llm-apps', title: '生成式 AI 應用開發：LLM、RAG 與 AI Agent', subtitle: '從 Prompt Engineering 到打造能使用工具的 AI Agent，跟上最新 AI 浪潮。',
      category: 'ai', level: '中級', price: 3280, originalPrice: 5600, instructorId: 'i2', students: 5120, baseRating: 4.9, baseReviews: 845,
      thumb: { from: '#7c3aed', to: '#ec4899', mark: 'LLM', tag: 'GEN AI' }, featured: true, published: true, updatedAt: '2026-09-20', language: '中文',
      tags: ['LLM', 'RAG', 'Python', 'Agent'],
      description: '大型語言模型正在改變每一個產業。本課程帶你從原理到實作，理解 Transformer 與 LLM 的運作方式，學會撰寫高品質 Prompt，並使用 Python 建立 RAG 知識庫問答系統與具備工具使用能力的 AI Agent。\n課程最後你將完成一個可部署的企業內部知識助理。',
      outcomes: ['理解 Transformer 與 LLM 的基本原理', '掌握 Prompt Engineering 技巧', '使用向量資料庫打造 RAG 系統', '設計可呼叫工具的 AI Agent', '評估與改善 LLM 應用品質', '將 AI 應用部署上線'],
      requirements: ['基本 Python 程式能力', '不需要機器學習背景'],
      chapters: [
        ch('認識生成式 AI', [['生成式 AI 的現在與未來', 8.1, true], ['LLM 是怎麼運作的？', 15.4, true]]),
        ch('Prompt Engineering', [['Prompt 的基本結構', 10.2], ['Few-shot 與 Chain-of-Thought', 13.8], ['結構化輸出', 11.5]]),
        ch('RAG 知識庫系統', [['Embedding 與向量資料庫', 17.6], ['文件切割與檢索策略', 16.0], ['打造問答機器人', 22.4]]),
        ch('AI Agent', [['Tool Use 原理', 14.3], ['多步驟任務規劃', 18.9], ['專案：企業知識助理', 28.5]])
      ]
    },
    {
      id: 'python-data', title: 'Python 資料分析入門：Pandas 與視覺化', subtitle: '零基礎也能上手，用資料做出更好的決策。',
      category: 'data', level: '入門', price: 1680, originalPrice: 2980, instructorId: 'i3', students: 7280, baseRating: 4.7, baseReviews: 1320,
      thumb: { from: '#10b981', to: '#0ea5e9', mark: 'Py', tag: 'PANDAS' }, featured: true, published: true, updatedAt: '2026-07-02', language: '中文',
      tags: ['Python', 'Pandas', 'Matplotlib'],
      description: '不論你是行銷、財務、營運還是工程背景，資料分析都能讓你的工作更有說服力。本課程從 Python 基礎語法開始，帶你學會 Pandas 資料處理、資料清理與視覺化，並透過真實資料集完成三個分析專案。',
      outcomes: ['撰寫基本 Python 程式', '使用 Pandas 讀取、清理與轉換資料', '以 Matplotlib / Seaborn 製作圖表', '進行探索式資料分析 (EDA)', '撰寫有洞察的分析報告'],
      requirements: ['完全不需要程式基礎', '會使用電腦與 Excel 即可'],
      chapters: [
        ch('Python 快速入門', [['為什麼選擇 Python？', 5.2, true], ['變數、型別與流程控制', 14.6, true], ['函式與模組', 12.3]]),
        ch('Pandas 資料處理', [['DataFrame 基礎', 13.1], ['資料清理實戰', 18.4], ['分組與彙總', 15.7]]),
        ch('資料視覺化', [['Matplotlib 基礎', 11.2], ['Seaborn 統計圖表', 13.5]]),
        ch('實戰專案', [['電商銷售分析', 24.0], ['撰寫分析報告', 10.8]])
      ]
    },
    {
      id: 'figma-uiux', title: 'UI/UX 設計實戰：Figma 設計系統全攻略', subtitle: '從使用者研究到高保真原型，建立專業的產品設計流程。',
      category: 'design', level: '入門', price: 1980, originalPrice: 3600, instructorId: 'i4', students: 2915, baseRating: 4.8, baseReviews: 402,
      thumb: { from: '#f97316', to: '#ec4899', mark: 'UX', tag: 'FIGMA' }, featured: true, published: true, updatedAt: '2026-06-18', language: '中文',
      tags: ['Figma', 'Design System', 'Prototype'],
      description: '好的設計不只是好看，而是解決問題。本課程完整走過產品設計流程：使用者研究、資訊架構、線框圖、視覺設計到互動原型，並教你在 Figma 中建立可擴充的設計系統 (Design System)。',
      outcomes: ['執行使用者訪談與研究', '建立資訊架構與使用者流程', '掌握 Figma Auto Layout 與元件', '建立完整設計系統', '製作可互動的高保真原型'],
      requirements: ['不需設計背景', '註冊免費 Figma 帳號'],
      chapters: [
        ch('設計思維', [['什麼是 UX？', 6.4, true], ['使用者研究方法', 14.2]]),
        ch('Figma 基礎', [['介面與基本工具', 10.5, true], ['Auto Layout 完全解析', 17.3], ['元件與變體', 15.8]]),
        ch('設計系統', [['色彩與字體規範', 12.6], ['建立元件庫', 19.4]]),
        ch('原型與交付', [['互動原型製作', 14.9], ['與工程師協作交付', 9.7]])
      ]
    },
    {
      id: 'aws-devops', title: 'AWS 雲端架構與 DevOps 實務', subtitle: 'Docker、Kubernetes、Terraform 與 CI/CD，一次學會現代雲端部署。',
      category: 'cloud', level: '進階', price: 3680, originalPrice: 6200, instructorId: 'i5', students: 1688, baseRating: 4.7, baseReviews: 238,
      thumb: { from: '#f59e0b', to: '#ef4444', mark: 'λ', tag: 'AWS' }, featured: false, published: true, updatedAt: '2026-08-30', language: '中文',
      tags: ['AWS', 'Docker', 'Kubernetes', 'Terraform'],
      description: '本課程以實際的微服務專案為例，帶你使用 Docker 容器化應用、以 Terraform 建立 AWS 基礎設施、部署到 Kubernetes，並設定 GitHub Actions 自動化流程與監控告警。',
      outcomes: ['設計高可用的 AWS 架構', '使用 Docker 容器化應用', '以 Terraform 管理基礎設施', '部署與維運 Kubernetes 叢集', '建立 CI/CD 與監控告警'],
      requirements: ['熟悉 Linux 指令', '具備任一程式語言開發經驗'],
      chapters: [
        ch('雲端基礎', [['雲端運算核心概念', 9.3, true], ['AWS 核心服務總覽', 16.1]]),
        ch('容器化', [['Docker 入門', 15.2], ['多階段建置與最佳化', 13.4]]),
        ch('基礎設施即程式碼', [['Terraform 基礎', 17.8], ['模組化與狀態管理', 16.6]]),
        ch('Kubernetes 與 CI/CD', [['K8s 核心物件', 21.5], ['GitHub Actions 自動部署', 18.0], ['監控與告警', 15.3]])
      ]
    },
    {
      id: 'growth-marketing', title: '數位行銷與成長駭客：數據驅動的增長策略', subtitle: '學會 GA4、廣告投放、轉換率優化與 A/B 測試。',
      category: 'business', level: '入門', price: 1480, originalPrice: 2600, instructorId: 'i3', students: 2240, baseRating: 4.6, baseReviews: 310,
      thumb: { from: '#14b8a6', to: '#8b5cf6', mark: '↗', tag: 'GROWTH' }, featured: false, published: true, updatedAt: '2026-05-10', language: '中文',
      tags: ['GA4', '廣告', 'CRO'],
      description: '用數據找到成長槓桿。本課程介紹 AARRR 成長模型、GA4 追蹤設定、社群與搜尋廣告投放、轉換率優化與 A/B 測試，讓你能系統化地規劃與執行增長實驗。',
      outcomes: ['理解 AARRR 成長漏斗', '設定 GA4 事件與轉換追蹤', '規劃 Google / Meta 廣告', '設計與分析 A/B 測試'],
      requirements: ['不需任何技術背景'],
      chapters: [
        ch('成長思維', [['什麼是成長駭客？', 7.0, true], ['AARRR 模型', 12.2]]),
        ch('數據追蹤', [['GA4 基礎設定', 15.6], ['事件與轉換', 13.3]]),
        ch('增長實驗', [['A/B 測試設計', 14.0], ['案例分析', 16.5]])
      ]
    },
    {
      id: 'ml-foundations', title: '機器學習基礎：從線性回歸到神經網路', subtitle: '用直覺和程式碼理解機器學習的核心演算法。',
      category: 'ai', level: '進階', price: 2980, originalPrice: 4980, instructorId: 'i2', students: 3010, baseRating: 4.8, baseReviews: 528,
      thumb: { from: '#6366f1', to: '#06b6d4', mark: '∑', tag: 'ML' }, featured: false, published: true, updatedAt: '2026-04-22', language: '中文',
      tags: ['scikit-learn', 'PyTorch', '數學'],
      description: '本課程用大量圖解與互動範例，帶你理解機器學習最重要的演算法：線性與邏輯回歸、決策樹、集成學習、SVM 與神經網路，並使用 scikit-learn 與 PyTorch 實作。',
      outcomes: ['理解監督式與非監督式學習', '實作常見機器學習演算法', '正確評估與調整模型', '使用 PyTorch 建立神經網路'],
      requirements: ['熟悉 Python', '高中程度數學'],
      chapters: [
        ch('機器學習概論', [['什麼是機器學習？', 8.8, true], ['資料集與特徵工程', 14.5]]),
        ch('經典演算法', [['線性回歸與梯度下降', 18.3], ['邏輯回歸與分類', 15.9], ['決策樹與隨機森林', 17.1]]),
        ch('深度學習入門', [['神經網路原理', 19.6], ['PyTorch 實作', 22.7]])
      ]
    },
    {
      id: 'typescript-pro', title: 'TypeScript 進階型別與工程實踐', subtitle: '寫出更安全、更好維護的大型前端與 Node.js 專案。',
      category: 'web', level: '進階', price: 1880, originalPrice: 3200, instructorId: 'i1', students: 1956, baseRating: 4.9, baseReviews: 287,
      thumb: { from: '#2563eb', to: '#0ea5e9', mark: 'TS', tag: 'TYPESCRIPT' }, featured: false, published: true, updatedAt: '2026-09-02', language: '中文',
      tags: ['TypeScript', 'Node.js'],
      description: '深入 TypeScript 型別系統：泛型、條件型別、映射型別、型別推論與型別體操，並分享在大型專案中導入 TypeScript 的工程實踐與團隊規範。',
      outcomes: ['精通泛型與條件型別', '設計型別安全的 API', '在大型專案中導入 TypeScript', '撰寫自訂型別工具'],
      requirements: ['熟悉 JavaScript', '寫過基本 TypeScript 更佳'],
      chapters: [
        ch('型別系統基礎回顧', [['為什麼需要 TypeScript', 6.2, true], ['結構化型別', 10.4]]),
        ch('進階型別', [['泛型深入', 16.8], ['條件型別與 infer', 18.1], ['映射型別與樣板字面型別', 15.2]]),
        ch('工程實踐', [['tsconfig 最佳設定', 11.7], ['Monorepo 與型別共享', 14.6]])
      ]
    },
    {
      id: 'git-starter', title: '【免費】Git 與 GitHub 新手入門', subtitle: '每位開發者都必須會的版本控制工具，30 分鐘輕鬆上手。',
      category: 'web', level: '入門', price: 0, originalPrice: 0, instructorId: 'i1', students: 12480, baseRating: 4.7, baseReviews: 2104,
      thumb: { from: '#334155', to: '#0f172a', mark: 'git', tag: 'FREE' }, featured: true, published: true, updatedAt: '2026-03-15', language: '中文',
      tags: ['Git', 'GitHub'],
      description: '一堂免費的入門課，帶你理解版本控制的概念，學會 Git 常用指令、分支操作與 GitHub 協作流程（Pull Request）。',
      outcomes: ['理解版本控制概念', '使用 Git 常用指令', '分支與合併', '在 GitHub 上協作'],
      requirements: ['無'],
      chapters: [
        ch('Git 基礎', [['什麼是版本控制？', 4.2, true], ['commit 與 log', 8.6, true]]),
        ch('分支與協作', [['branch 與 merge', 9.4, true], ['GitHub 與 Pull Request', 10.1, true]])
      ]
    }
  ];

  var reviewTexts = [
    [5, '講解非常清楚，每個概念都有實際範例，學完馬上可以應用在工作上！'],
    [5, '老師的教學節奏很好，專案導向的設計讓我學得很扎實，強烈推薦。'],
    [4, '內容很充實，如果能再多一些練習題會更好。整體非常值得。'],
    [5, '這是我上過最棒的線上課程之一，CP 值超高。'],
    [4, '影片品質很好，講義也很完整，期待老師開更多進階課程。']
  ];
  var reviewNames = ['Kevin L.', '佳穎', 'Jason C.', '小美', 'Andy W.', '思妤', 'Ryan T.', '冠廷'];
  var reviews = [];
  courses.forEach(function (c, ci) {
    for (var i = 0; i < 3; i++) {
      var r = reviewTexts[(ci + i) % reviewTexts.length];
      reviews.push({
        id: 'r' + ci + '_' + i, courseId: c.id, userId: null, userName: reviewNames[(ci * 3 + i) % reviewNames.length],
        rating: r[0], comment: r[1], createdAt: Date.now() - (ci * 3 + i + 1) * 86400000 * 4
      });
    }
  });

  var coupons = [
    { code: 'WELCOME10', type: 'percent', value: 10, minAmount: 0, active: true, note: '新會員 9 折' },
    { code: 'TECH500', type: 'fixed', value: 500, minAmount: 3000, active: true, note: '滿 3,000 折 500' },
    { code: 'LEARN101', type: 'percent', value: 20, minAmount: 5000, active: true, note: '滿 5,000 享 8 折' }
  ];

  var testimonials = [
    { name: '李柏翰', role: '前端工程師 @ 新創公司', text: '從行政轉職成前端工程師，1.01 Academy 的 React 課程是我的轉捩點。專案導向的設計讓我在面試時有作品可以展示。' },
    { name: '黃詩涵', role: '產品經理', text: '生成式 AI 課程讓我真正理解 LLM 能做什麼、不能做什麼，現在可以和工程團隊用同樣的語言溝通。' },
    { name: '周承恩', role: '數據分析師', text: '從零開始學 Python，老師講解非常有耐心。三個月後我已經能自己完成每週的營運報表自動化。' }
  ];

  var faqs = [
    ['購買後可以觀看多久？', '所有課程一次購買、永久觀看。課程內容更新時你也能免費取得最新版本。'],
    ['支援哪些付款方式？', '支援信用卡（Visa / Master / JCB）、ATM 轉帳與 LINE Pay。ATM 付款於款項確認後自動開通課程。'],
    ['可以先試看嗎？', '每門課程都有標示「免費試看」的單元，無須登入即可觀看，確認適合再購買。'],
    ['完成課程有證書嗎？', '有！完成課程 100% 單元後，即可在「我的課程」下載專屬的結業證書。'],
    ['可以申請退款嗎？', '購買 7 天內且觀看進度未超過 20%，可透過客服申請全額退款。'],
    ['可以開立公司發票嗎？', '可以，結帳時填寫統一編號與公司抬頭即可開立三聯式電子發票。']
  ];

  return {
    version: 3,
    categories: categories,
    instructors: instructors,
    courses: courses,
    reviews: reviews,
    coupons: coupons,
    testimonials: testimonials,
    faqs: faqs,
    videos: VIDEOS
  };
})();
