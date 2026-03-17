# YouTube → note記事 自動生成ツール マニュアル

## このツールでできること

YouTubeに投稿した動画を、note.comの記事に自動変換します。
動画のチャプター構成・字幕・サムネイルを元に、読者が動画を見なくても内容を再現できるレベルの記事を自動で生成します。

---

## 事前準備（初回のみ）

### 1. 必要なソフトのインストール

| ソフト | 用途 | インストール方法 |
|--------|------|-----------------|
| Node.js | ツールの実行環境 | https://nodejs.org/ からダウンロード |
| FFmpeg | 動画からサムネ画像を切り出す | https://ffmpeg.org/ からダウンロード |
| yt-dlp | YouTubeから字幕を取得する | `npm install -g yt-dlp` または公式サイト |

### 2. APIキーの取得

このツールは **Gemini API**（Google）を使って記事を生成します。

1. https://aistudio.google.com/apikey にアクセス
2. APIキーを作成
3. プロジェクトフォルダ内の `.env` ファイルに以下を記載：
   ```
   GEMINI_API_KEY=ここにAPIキーを貼り付け
   ```

### 3. パッケージのインストール

プロジェクトフォルダで以下を実行：
```bash
npm install
```

---

## 毎回の使い方（3ステップ）

### Step 1: 素材を `work/動画名/` フォルダに配置

`work/` の下に**動画ごとのフォルダ**を作り、以下の3ファイルを入れてください：

```
work/
├── 多言語接客AI/
│   ├── description.txt
│   ├── url.txt
│   └── 多言語接客AI.mov
├── 次の動画/
│   ├── description.txt
│   ├── url.txt
│   └── 次の動画.mp4
```

| ファイル名 | 中身 | 例 |
|-----------|------|-----|
| `description.txt` | YouTubeの説明欄テキスト（チャプター付き） | 0:00 オープニング / 1:50 デモ紹介 ... |
| `url.txt` | YouTubeの動画URL（1行だけ） | https://youtu.be/XXXXXXXXX |
| 動画ファイル | mp4, mov, avi, mkv いずれか | 多言語接客AI.mov |

> **ポイント**: description.txt にはチャプター（タイムスタンプ付きの目次）が必要です。YouTubeの説明欄からそのままコピペでOK。
> 素材は消さずに残せるので、あとから再生成も可能です。

### Step 2: コマンドを実行

```bash
node scripts/pipeline.js --work-dir=work/動画名
```

例：
```bash
node scripts/pipeline.js --work-dir=work/多言語接客AI
```

実行すると以下が自動で行われます：
1. YouTubeから動画タイトルを取得
2. チャプターを解析
3. YouTubeから字幕を取得（自動字幕対応）
4. 動画からチャプターごとのサムネイル画像を切り出し
5. AIが記事を生成
6. 記事テキストをクリップボードにコピー

### Step 3: note.comに貼り付け

1. note.comの新規記事作成画面を開く
2. `Ctrl + V` で記事テキストを貼り付け
3. 画像は `output/（日時フォルダ）/images/` から手動でアップロード
4. プレビューで確認して公開！

---

## よくある質問

### Q: 字幕取得に失敗する
YouTubeのレート制限（429エラー）が原因です。ツールは自動で60秒間隔×5回リトライします。それでも失敗する場合は、時間を空けて再実行してください。

### Q: 記事の品質を上げたい
気に入った記事ができたら、以下のコマンドで「お手本」として保存できます：
```bash
node scripts/pipeline.js --save-last
```
これだけでOKです。再生成は走らず、直前に生成した記事がそのまま保存されます。
次回以降、AIがこのお手本を参考にして記事を生成するので、回を重ねるほど品質が上がります。
お手本は複数保存可能（最大10件、プロンプトには最新2件が使用されます）。

### Q: 公式LINEのURLを変えたい
`config.json` の `officialLineUrl` を変更してください：
```json
{
  "officialLineUrl": "https://lin.ee/あなたのURL"
}
```

### Q: 記事の文体やルールを変えたい
- `templates/article-prompt.txt` — 記事の構成・ルール
- `templates/style-guide.md` — 文体・トーン

---

## フォルダ構成

```
Youtube-note-generator/
├── scripts/          ← ツール本体（触らなくてOK）
├── templates/        ← 記事の書き方ルール（カスタマイズ可能）
├── work/             ← ★ 動画ごとにフォルダを作って素材を置く
│   ├── 動画A/
│   │   ├── description.txt
│   │   ├── url.txt
│   │   └── 動画A.mp4
│   └── 動画B/
│       ├── description.txt
│       ├── url.txt
│       └── 動画B.mp4
├── output/           ← 生成された記事と画像
├── config.json       ← 設定ファイル
└── .env              ← APIキー（絶対に共有しない）
```

---

## 生成される記事の構成

```
タイトル（= YouTubeのタイトル）
├── はじめに（読者の悩みに共感 + 動画リンク + LINE誘導）
├── チャプター1（画像 + 本文 + ポイントまとめ）
├── チャプター2（同上）
├── ...
└── まとめ（要点3点 + LINE CTA）
```

---

# 他の人にこの仕組みをプレゼントする場合

## 渡すもの

### 必須ファイル（プロジェクト一式）
```
Youtube-note-generator/
├── scripts/           ← 全ファイル
├── templates/         ← 全ファイル（examples/ は空でOK）
├── work/              ← 空フォルダ（サンプル入れてもOK）
├── config.json        ← FFmpegパスは受け取り手が変更
├── package.json
├── package-lock.json
├── .gitignore
├── .env.example       ← ★ 作成する（下記参照）
└── docs/manual.md     ← このマニュアル
```

### 渡してはいけないもの
- `.env`（APIキーが入っている）
- `output/` フォルダ（生成結果）
- `node_modules/`（受け取り手が `npm install` する）
- `templates/examples/`の中身（あなたの記事データ）

### `.env.example` を作る
受け取り手が何を設定すればいいか分かるように、テンプレートを用意：
```
GEMINI_API_KEY=ここにGemini APIキーを貼り付け
```

## 渡し方の選択肢

### A: ZIPで渡す（一番簡単）
1. 上記の「渡してはいけないもの」を除外
2. フォルダをZIP圧縮
3. LINE / Googleドライブ / ギガファイル便で共有

### B: GitHubリポジトリで共有
1. GitHubにプライベートリポジトリを作成
2. `.gitignore` に `.env`, `output/`, `node_modules/` が含まれていることを確認
3. プッシュしてURLを共有
4. 公開リポジトリにする場合は、コミット履歴に `.env` が含まれていないか要確認

### C: テンプレートリポジトリ化（視聴者プレゼント向き）
1. GitHubで「Template repository」設定をON
2. 視聴者は「Use this template」ボタンで自分のリポジトリにコピーできる
3. READMEにセットアップ手順を書いておく

## 受け取り手のセットアップ手順

受け取り手に伝える内容：

1. **Node.js をインストール**: https://nodejs.org/
2. **FFmpeg をインストール**: https://ffmpeg.org/
3. **フォルダを開いて以下を実行**:
   ```bash
   npm install
   ```
4. **`.env.example` を `.env` にリネーム**して、APIキーを記入
5. **`config.json` を編集**:
   - `ffmpegPath`: 自分のFFmpegパスに変更
   - `officialLineUrl`: 自分の公式LINE URLに変更（不要なら空欄）
6. **`work/動画名/` に素材を入れて実行**:
   ```bash
   node scripts/pipeline.js --work-dir=work/動画名
   ```

## カスタマイズのポイント

受け取り手が自分のスタイルに合わせられる部分：

| 変更したいこと | 編集するファイル |
|--------------|----------------|
| 記事の構成・ルール | `templates/article-prompt.txt` |
| 文体・トーン | `templates/style-guide.md` |
| 公式LINE URL | `config.json` の `officialLineUrl` |
| AIモデル | `config.json` の `geminiModel` |
