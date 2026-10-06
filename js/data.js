/* 課程目錄（公開資訊）：要新增或修改課程，直接編輯這個檔案。
 *
 * ⚠️ 這裡不要放課程影片的 YouTube 連結！這個檔案任何人都看得到。
 *    課程影片 ID 請放在 Firebase 的 courseVideos 集合（見 README.md）。
 *
 * trailer：可選，公開的預告片 YouTube 影片 ID 或網址，會顯示在課程介紹頁。
 * 單元格式：['單元id', '單元標題', 秒數]
 *    「單元id」要和 Firebase courseVideos 裡的欄位名稱一致。
 */
var CATEGORIES = ['全部', '課程'];

var COURSES = [
  {
    // ↓ 標題、介紹、價格請改成你的課程內容
    id: 'course1', title: '1.01 Academy 課程', subtitle: '課程簡介（請修改）',
    category: '課程', level: '入門', price: 0, originalPrice: 0, instructor: '1.01 Academy',
    thumb: ['#0ea5e9', '#6366f1', '1.01'], trailer: '',
    description: '課程介紹（請修改）。',
    outcomes: ['學習重點一（請修改）', '學習重點二（請修改）'],
    chapters: [
      // 單元影片網址放在 Firebase：courseVideos / course1 / l1
      { title: '課程內容', lessons: [['l1', '第 1 堂', 0]] }
    ]
  }
];

COURSES.forEach(function (c) {
  c.chapters.forEach(function (ch) {
    ch.lessons = ch.lessons.map(function (l) { return { id: l[0], title: l[1], duration: l[2] }; });
  });
});
