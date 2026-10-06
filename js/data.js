/* 課程目錄（公開資訊）：要新增或修改課程，直接編輯這個檔案。
 *
 * ⚠️ 這裡不要放課程影片的 YouTube 連結！這個檔案任何人都看得到。
 *    課程影片 ID 請放在 Firebase 的 courseVideos 集合（見 README.md）。
 *
 * trailer：可選，公開的預告片 YouTube 影片 ID 或網址，會顯示在課程介紹頁。
 * 單元格式：['單元id', '單元標題', 秒數]
 *    「單元id」要和 Firebase courseVideos 裡的欄位名稱一致。
 */
var CATEGORIES = ['全部', '基因演算法'];

var COURSES = [
  {
    id: 'course1', title: '[基因演算法] 執行 DSMGA-II-TwoEdge 簡介',
    subtitle: '#基因演算法 #GeneticAlgorithms #ModelBuildingGeneticAlgorithms',
    category: '基因演算法', level: '入門', price: 0, originalPrice: 0, instructor: '1.01 Academy',
    thumb: ['#10b981', '#6366f1', 'GA'], trailer: '',
    description: '介紹如何執行 DSMGA-II-TwoEdge，一種建構模型的基因演算法（Model-Building Genetic Algorithm）。',
    outcomes: ['認識 DSMGA-II-TwoEdge', '了解建構模型的基因演算法', '學會執行 DSMGA-II-TwoEdge'],
    chapters: [
      // 單元影片網址放在 Firebase：courseVideos / course1 / l1、l2
      { title: '課程內容', lessons: [
        ['l1', '執行 DSMGA-II-TwoEdge 簡介', 0],
        ['l2', 'Introduction to DSMGA-II-TwoEdge', 0]
      ] }
    ]
  }
];

COURSES.forEach(function (c) {
  c.chapters.forEach(function (ch) {
    ch.lessons = ch.lessons.map(function (l) { return { id: l[0], title: l[1], duration: l[2] }; });
  });
});
