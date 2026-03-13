'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');

const { parseDescription } = require('./parse-description');
const { extractFrames } = require('./extract-frames');
const { generateArticle } = require('./generate-article');
const { formatOutput } = require('./format-output');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf-8'));

function getTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[-:T]/g, (c) => ({ '-': '', ':': '', 'T': '_' })[c] || c)
    .slice(0, 13);
}

async function main() {
  const args = process.argv.slice(2);
  const saveExample = args.includes('--save-example');
  const workDirOverride = args.find(a => a.startsWith('--work-dir='))?.split('=')[1];

  const workDir = path.resolve(ROOT, workDirOverride || config.workDir);
  const descriptionPath = path.join(workDir, 'description.txt');
  const videoPath = path.join(workDir, 'video.mp4');

  console.log('\n🎬 YouTube → note 記事生成パイプライン\n');

  // ファイル存在確認
  if (!fs.existsSync(descriptionPath)) {
    console.error(`❌ description.txt が見つかりません: ${descriptionPath}`);
    console.error('   → work/ フォルダに description.txt を置いてください');
    process.exit(1);
  }
  if (!fs.existsSync(videoPath)) {
    console.error(`❌ video.mp4 が見つかりません: ${videoPath}`);
    console.error('   → work/ フォルダに video.mp4 を置いてください');
    process.exit(1);
  }

  // Step 1: チャプター解析
  console.log('📋 Step 1: チャプター解析...');
  const chapters = parseDescription(descriptionPath);
  console.log(`   ✅ ${chapters.length}件のチャプターを検出\n`);

  // Step 2: フレーム抽出
  const outputTimestamp = getTimestamp();
  const outputDir = path.join(ROOT, config.outputDir, outputTimestamp);
  const imagesDir = path.join(outputDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  console.log('🖼️  Step 2: フレーム抽出...');
  const frames = extractFrames(chapters, videoPath, imagesDir, config);
  const successCount = frames.filter(f => f.success).length;
  console.log(`   ✅ ${successCount}/${chapters.length}件のフレームを抽出\n`);

  // Step 3: 記事生成
  console.log('✍️  Step 3: 記事生成（Claude API）...');
  const articleMd = await generateArticle(chapters, frames, config);
  console.log('   ✅ 記事生成完了\n');

  // Step 4: 出力フォーマット & クリップボード
  console.log('📤 Step 4: クリップボードにコピー...');
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
  if (method === 'html') {
    console.log('   → note.com で Ctrl+V を押せば画像込みで貼り付けできます');
  } else {
    console.log('   → article.md をコピーし、画像は images/ から手動アップロードしてください');
  }
  if (!saveExample) {
    console.log('\n💡 記事が気に入ったら --save-example で参考例として保存できます:');
    console.log('   node scripts/pipeline.js --save-example');
  }
  console.log('');
}

main().catch(err => {
  console.error('❌ エラーが発生しました:', err.message);
  process.exit(1);
});
