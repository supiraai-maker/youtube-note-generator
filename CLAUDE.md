# CLAUDE.md — youtube-note-generator

## プロジェクト概要

投稿済みのYouTube動画（`description.txt` + `video.mp4`）から、note.com 記事を自動生成するツール。

**対象コンテンツ**: 就活生向け教育動画
**対象プラットフォーム**: note.com（将来: X, Zenn など）
**現在の状態**: 開発中

---

## プロジェクト構成

```
c:/dev/claude/Youtube-note-generator/
├── scripts/
│   ├── pipeline.js              # メインオーケストレーター
│   ├── parse-description.js     # チャプター/タイムスタンプ解析
│   ├── fetch-transcript.js      # 字幕取得（ローカルSRT優先 → yt-dlpフォールバック）
│   ├── extract-frames.js        # FFmpegでフレーム抽出
│   ├── generate-article.js      # Gemini API で記事生成（無料枠）
│   └── format-output.js         # クリップボード出力
├── templates/
│   ├── article-prompt.txt       # 記事生成プロンプトテンプレート
│   ├── style-guide.md           # note記事スタイルガイド
│   └── examples/                # 承認済み記事例（few-shot学習用）
├── work/                        # ここにファイルを置く
│   ├── description.txt          # YouTube説明欄テキスト
│   ├── url.txt                  # YouTube URL
│   ├── video.mp4                # 動画ファイル
│   └── *.srt                    # （任意）字幕ファイル。あればyt-dlpより優先使用
├── output/                      # 生成結果（gitignore）
├── config.json                  # FFmpeg・モデル設定
└── .env                         # GEMINI_API_KEY
```

---

## 実行方法

```bash
# 記事を生成する
node scripts/pipeline.js

# 生成した記事を参考例として保存（次回以降の精度向上に使用）
node scripts/pipeline.js --save-example

# 別フォルダの動画を使う場合
node scripts/pipeline.js --work-dir=path/to/folder
```

## 準備
1. `work/description.txt` — YouTube の説明欄テキスト（チャプター・タイムスタンプ付き）
2. `work/url.txt` — YouTube の動画 URL（タイトル取得・記事内リンクに使用）
3. `work/video.mp4` — アップロード済みの動画ファイル（フレーム抽出用）
4. `work/*.srt` — （任意）字幕ファイル。あればyt-dlpでの取得をスキップ
5. `.env` に `GEMINI_API_KEY` を設定

---

## 技術スタック

| 役割 | 技術 |
|------|------|
| 記事生成 | Google Gemini API (gemini-2.5-flash / 無料枠) |
| 字幕取得 | ローカルSRT優先 / yt-dlp（フォールバック） |
| フレーム抽出 | FFmpeg |
| クリップボード | clipboardy |

---

## 精度向上の仕組み

1. 初回: スタイルガイドのみで記事生成（ゼロショット）
2. 気に入った記事を `--save-example` で `templates/examples/` に保存
3. 次回以降: 保存済み例を few-shot として自動注入（最新2件）
4. 例が10件超えたら古いものを自動削除

---

## 将来の拡張予定

- [ ] X（旧Twitter）投稿用テキスト自動生成
- [ ] Zenn 記事フォーマット対応
- [ ] note API 連携（自動投稿）
- [ ] 複数プラットフォーム同時出力

---

## 設定（config.json）

```json
{
  "ffmpegPath": "C:/Users/110ry/ffmpeg/bin/ffmpeg.exe",
  "ytDlpPath": "...",
  "geminiModel": "gemini-2.5-flash",
  "maxExamplesInPrompt": 2,
  "maxExamplesStored": 10,
  "base64SizeLimitMB": 3
}
```

---

## 必要な環境変数（.env）

```
GEMINI_API_KEY=<Google AI Studio で取得した API キー>
```
