/* 設定ファイル：デプロイ時に GAS_URL だけ書き換えてください */
window.APP_CONFIG = {
  // Google Apps Script をウェブアプリとしてデプロイしたときの URL（https://script.google.com/macros/s/.../exec）
  // 空のままだとテストモードになり、回答は送信されず、結果サイトはサンプルデータを表示します。
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyGs7n5_mNoXcYOVL0Rim4VDTMDouFv7h590032H2EAYkr5hkiDaWpzLVLtKIQ86ViP/exec',

  // 自由記述の最低文字数
  MIN_CHARS: 20,

  // 授業名など、回答ページの上部に出る一行
  COURSE_LABEL: 'コンピュータインタラクション'
};
