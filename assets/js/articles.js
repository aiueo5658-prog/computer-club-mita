/* =========================================================
   articles.js — 記事の一覧（先輩へのインタビュー・自伝）

   記事を足すときは：
     1. articles/<slug>/article.md に本文、articles/<slug>/img/ に画像を置く
        （本文の書き方は README の「記事を足す」）
     2. 下の list に1件足す（新しいものほど上。no は通し番号）
   planned は予定している本数。まだ書かれていない分は、一覧に
   「準備中」の枠として出る。全部そろったら planned を消してよい。
   ========================================================= */
window.CCMArticles = {
  planned: 4,
  list: [
    {
      slug: 'tanabe',
      no: 4,
      kind: 'interview',
      kindLabel: 'インタビュー',
      title: '好きな曲への情熱で、歌わせる',
      sub: '音楽島の島長・田邊亮さんインタビュー',
      excerpt: 'もともと音楽が「すごい嫌い」だった。そんな島長が、ボカロで好きな曲をカバーし続ける理由と、MIFのボカロ体験・会場BGMの見どころを語る。',
      cover: 'articles/tanabe/img/cover.webp',
      coverAlt: '「もともとは、音楽が嫌いだった。」の文字',
      coverSize: [1200, 675],
      date: '2026-09',
      readMin: 6,
      tags: ['ボカロ', '音楽島', 'カバー', 'BGM'],
      people: [
        { role: 'interviewer', label: '聞き手', name: '能代航史郎', short: '能代',
          icon: 'articles/tanabe/img/icon-noshiro.webp' },
        { role: 'subject', label: '話し手', name: '田邊亮', short: '田邊',
          reading: 'たなべ・りょう', org: 'コンピュータ部 音楽島 島長',
          icon: 'articles/tanabe/img/icon-tanabe.webp' }
      ],
      md: 'articles/tanabe/article.md'
    },
    {
      slug: 'abdillah',
      no: 2,
      kind: 'autobiography',
      kindLabel: '自伝',
      title: 'このサイトができるまで',
      sub: 'AIと一緒に、昆布観測島の特設サイトを作った話',
      excerpt: '8割は AI が書いた。でも、フォントを選び、レイアウトを直し、足しすぎたものを消したのは人間だった。コンピュータ部補佐のアブディラーが、特設サイトができるまでをふり返る。',
      cover: 'articles/abdillah/img/cover.webp',
      coverAlt: 'いまのホーム。部のロゴを望遠鏡の縁に見立てた観測窓',
      coverSize: [1440, 900],
      date: '2026-09',
      readMin: 10,
      tags: ['AI', 'Webデザイン', 'フォント'],
      people: [
        { role: 'subject', label: '書いた人', name: 'アブディラー リョウ', short: 'アブディラー',
          icon: 'articles/abdillah/img/icon-abdillah.webp' }
      ],
      md: 'articles/abdillah/article.md'
    },
    {
      slug: 'noshiro',
      featured: true,   /* 一覧でいちばん大きく出す */
      no: 1,
      kind: 'interview',
      kindLabel: 'インタビュー',
      title: 'メタバースで「時間と場所」を超える',
      titleLines: ['メタバースで', '「時間と場所」を超える'],   /* 見出しの改行位置 */
      sub: 'VRChatワールド制作者・能代航史郎さんインタビュー',
      excerpt: '仮想空間に、乗ることのできなかった青函連絡船を再現した。いまは大人たちと海洋や宇宙の展示をつくる先輩に、チーム制作の裏側と、メタバースの5年後・10年後を聞いた。',
      cover: 'articles/noshiro/img/10_vrc_ship.webp',
      coverAlt: 'VRChat上で建造中の海洋観測船',
      coverSize: [1200, 675],
      date: '2026-09',
      readMin: 12,
      tags: ['VRChat', 'ワールド制作', 'Blender', '海洋', '天文'],
      people: [
        { role: 'interviewer', label: '聞き手', name: 'アブディラー', short: 'アブディラー',
          icon: 'articles/noshiro/img/icon-abdillah.webp' },
        { role: 'subject', label: '話し手', name: '能代航史郎', short: '能代',
          reading: 'のしろ・こうしろう', org: 'S2A',
          icon: 'articles/noshiro/img/icon-noshiro.webp' }
      ],
      md: 'articles/noshiro/article.md'
    }
  ]
};
