# create-note-article

note.com記事を生成します。

## 準備
`work/` フォルダに以下のファイルを置いてください:
- `description.txt` — YouTube の説明欄テキスト（チャプター・タイムスタンプ付き）
- `video.mp4` — アップロード済みの動画ファイル

## 実行
!node scripts/pipeline.js $ARGUMENTS

## オプション
- `--save-example` : 生成記事を参考例として保存（次回から精度向上）
- `--work-dir=PATH` : 作業フォルダを指定（デフォルト: work/）
