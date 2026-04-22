'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');

const { execFileSync } = require('child_process');
const { parseDescription } = require('./parse-description');
const { fetchTranscript, loadLocalSubtitle } = require('./fetch-transcript');
const { extractFrames } = require('./extract-frames');
const { generateArticle } = require('./generate-article');
const { formatOutput } = require('./format-output');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf-8'));

function toShareUrl(url) {
  try {
    const parsed = new URL(url);
    // youtube.com/watch?v=XXX → youtu.be/XXX
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
      return `https://youtu.be/${parsed.searchParams.get('v')}`;
    }
    // youtu.be形式の場合、siパラメータを除去（429エラーの原因になるため）
    if (parsed.hostname === 'youtu.be') {
      return `https://youtu.be${parsed.pathname}`;
    }
    return url;
  } catch {
    return url;
  }
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[-:T]/g, (c) => ({ '-': '', ':': '', 'T': '_' })[c] || c)
    .slice(0, 13);
}

async function main() {
  const args = process.argv.slice(2);
  const saveExample = args.includes('--save-example');
  const saveLast = args.includes('--save-last');
  const workDirOverride = args.find(a => a.startsWith('--work-dir='))?.split('=')[1];

  // --save-last: 直前に生成した記事をお手本として保存（再生成なし）
  if (saveLast) {
    const outputBase = path.join(ROOT, config.outputDir);
    if (!fs.existsSync(outputBase)) {
      console.error('❌ output/ フォルダが見つかりません。まず記事を生成してください。');
      process.exit(1);
    }
    const dirs = fs.readdirSync(outputBase).filter(d => fs.statSync(path.join(outputBase, d)).isDirectory()).sort();
    if (dirs.length === 0) {
      console.error('❌ 生成済みの記事がありません。まず記事を生成してください。');
      process.exit(1);
    }
    const lastDir = path.join(outputBase, dirs[dirs.length - 1]);
    const articlePath = path.join(lastDir, 'article.md');
    if (!fs.existsSync(articlePath)) {
      console.error(`❌ article.md が見つかりません: ${articlePath}`);
      process.exit(1);
    }

    const examplesDir = path.join(ROOT, 'templates/examples');
    fs.mkdirSync(examplesDir, { recursive: true });
    const examplePath = path.join(examplesDir, `good-example-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
    fs.copyFileSync(articlePath, examplePath);

    const maxStored = config.maxExamplesStored || 10;
    const existingExamples = fs.readdirSync(examplesDir)
      .filter(f => f.startsWith('good-example-') && f.endsWith('.md'))
      .sort();
    if (existingExamples.length > maxStored) {
      const toDelete = existingExamples.slice(0, existingExamples.length - maxStored);
      toDelete.forEach(f => fs.unlinkSync(path.join(examplesDir, f)));
      console.log(`🗂️  古い例を${toDelete.length}件削除しました（最大${maxStored}件）`);
    }

    console.log(`⭐ 直前の記事をお手本として保存しました: ${examplePath}`);
    console.log(`   元ファイル: ${articlePath}`);
    process.exit(0);
  }

  const workDir = path.resolve(ROOT, workDirOverride || config.workDir);
  const descriptionPath = path.join(workDir, 'description.txt');
  const urlPath = path.join(workDir, 'url.txt');

  // 動画ファイルを自動検出（mp4/mov/avi/mkv）
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv'];
  let videoPath = null;
  for (const ext of videoExtensions) {
    const files = fs.readdirSync(workDir).filter(f => f.toLowerCase().endsWith('.' + ext));
    if (files.length > 0) {
      videoPath = path.join(workDir, files[0]);
      break;
    }
  }

  console.log('\n🎬 YouTube → note 記事生成パイプライン\n');

  // ファイル存在確認
  if (!fs.existsSync(descriptionPath)) {
    console.error(`❌ description.txt が見つかりません: ${descriptionPath}`);
    console.error('   → work/ フォルダに description.txt を置いてください');
    process.exit(1);
  }
  if (!fs.existsSync(urlPath)) {
    console.error(`❌ url.txt が見つかりません: ${urlPath}`);
    console.error('   → work/ フォルダに url.txt（YouTube URL）を置いてください');
    process.exit(1);
  }
  if (!videoPath) {
    console.error('❌ 動画ファイルが見つかりません（mp4/mov/avi/mkv）');
    console.error('   → work/ フォルダに動画ファイルを置いてください');
    process.exit(1);
  }
  console.log(`   🎥 動画ファイル: ${path.basename(videoPath)}`);

  const descriptionText = fs.readFileSync(descriptionPath, 'utf-8');
  const rawUrl = fs.readFileSync(urlPath, 'utf-8').trim();
  // YouTube URLを共有用形式（youtu.be）に変換（note.comで埋め込み表示されるため）
  const youtubeUrl = toShareUrl(rawUrl);

  // 動画タイトル取得（yt-dlp）
  const ytDlpPath = config.ytDlpPath || 'yt-dlp';
  let videoTitle = '';
  try {
    videoTitle = execFileSync(ytDlpPath, ['--print', 'title', '--no-playlist', youtubeUrl], { encoding: 'utf-8' }).trim();
    console.log(`   📌 動画タイトル: ${videoTitle}`);
  } catch (err) {
    console.warn(`   ⚠️  タイトル取得失敗: ${err.message}`);
  }

  // Step 1: チャプター解析
  console.log('📋 Step 1: チャプター解析...');
  const chapters = parseDescription(descriptionPath);
  console.log(`   ✅ ${chapters.length}件のチャプターを検出\n`);

  // Step 2: 字幕取得（ローカルSRT優先 → なければYouTubeから取得）
  console.log('📝 Step 2: 字幕取得...');
  let transcript = '';
  const localSub = loadLocalSubtitle(workDir);
  if (localSub) {
    transcript = localSub.text;
    console.log(`   ✅ ローカル字幕ファイル使用: ${localSub.fileName}（${transcript.length}文字）\n`);
  } else {
    console.log('   📡 ローカル字幕なし → YouTubeから取得（yt-dlp）...');
    try {
      transcript = fetchTranscript(youtubeUrl, config);
      console.log(`   ✅ 字幕取得完了（${transcript.length}文字）\n`);
    } catch (err) {
      console.error(`   ❌ 字幕取得失敗: ${err.message}`);
      console.error('   → 字幕がないと正確な記事を生成できないため、処理を中止します。');
      console.error('   → しばらく時間を置いてから再実行してください（YouTubeのレート制限の可能性があります）。');
      process.exit(1);
    }
  }

  // Step 3: フレーム抽出
  const outputTimestamp = getTimestamp();
  const outputDir = path.join(ROOT, config.outputDir, outputTimestamp);
  const imagesDir = path.join(outputDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  console.log('🖼️  Step 3: フレーム抽出...');
  const frames = extractFrames(chapters, videoPath, imagesDir, config);
  const successCount = frames.filter(f => f.success).length;
  console.log(`   ✅ ${successCount}/${chapters.length}件のフレームを抽出\n`);

  // Step 4: 記事生成
  console.log('✍️  Step 4: 記事生成（Gemini API）...');
  const articleMd = await generateArticle(chapters, frames, transcript, config, youtubeUrl, videoTitle, descriptionText);
  console.log('   ✅ 記事生成完了\n');

  // Step 5: 出力フォーマット & クリップボード
  console.log('📤 Step 5: クリップボードにコピー...');
  const { method, outputPath } = await formatOutput(articleMd, imagesDir, outputDir, config);
  console.log(`   ✅ 出力方式: ${method}\n`);

  // --save-example フラグ: 生成記事を few-shot 例として保存
  if (saveExample) {
    const examplesDir = path.join(ROOT, 'templates/examples');
    fs.mkdirSync(examplesDir, { recursive: true });
    const examplePath = path.join(examplesDir, `good-example-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
    fs.copyFileSync(outputPath, examplePath);

    // 例が多すぎる場合は古いものを削除
    const maxStored = config.maxExamplesStored || 10;
    const existingExamples = fs.readdirSync(examplesDir)
      .filter(f => f.startsWith('good-example-') && f.endsWith('.md'))
      .sort();
    if (existingExamples.length > maxStored) {
      const toDelete = existingExamples.slice(0, existingExamples.length - maxStored);
      toDelete.forEach(f => fs.unlinkSync(path.join(examplesDir, f)));
      console.log(`🗂️  古い例を${toDelete.length}件削除しました（最大${maxStored}件）`);
    }

    console.log(`⭐ 記事を参考例として保存しました: ${examplePath}`);
  }

  console.log('━'.repeat(60));
  console.log('✨ 完了！');
  console.log(`   出力先: ${outputDir}`);
  console.log('   → note.com で Ctrl+V でテキストを貼り付け後、');
  console.log(`      画像フォルダ: ${imagesDir}`);
  console.log('      画像を images/ フォルダから手動でアップロードしてください');
  if (!saveExample) {
    console.log('\n💡 記事が気に入ったら、お手本として保存できます:');
    console.log('   node scripts/pipeline.js --save-last');
  }
  console.log('');
}

main().catch(err => {
  console.error('❌ エラーが発生しました:', err.message);
  process.exit(1);
});
