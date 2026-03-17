'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 記事テキストをクリップボードにコピーし、画像は images/ フォルダに保存する
 * note.com はHTMLペースト非対応のため、テキストのみコピー
 * @param {string} articleMd - 生成された Markdown 文字列
 * @param {string} imagesDir - 画像ディレクトリのパス
 * @param {string} outputDir - 出力ディレクトリ（article.md の保存先）
 * @param {object} config - config.json の内容
 * @returns {{ method: 'text', outputPath: string }}
 */
async function formatOutput(articleMd, imagesDir, outputDir, config) {
  const articlePath = path.join(outputDir, 'article.md');
  fs.writeFileSync(articlePath, articleMd, 'utf-8');
  console.log(`  📝 article.md を保存しました: ${articlePath}`);

  // 画像の挿入位置をコメントに置換したテキストを作成
  const textForClipboard = articleMd.replace(
    /!\[([^\]]*)\]\((images\/chapter-\d+\.jpg)\)/g,
    (_, alt, src) => `【ここに画像: ${path.basename(src)}】`
  );

  // クリップボードへのコピー (clipboardy は ESM のため動的インポート)
  try {
    const { default: clipboardy } = await import('clipboardy');
    await clipboardy.write(textForClipboard);
    console.log('  📋 記事テキストをクリップボードにコピーしました');
  } catch (err) {
    console.warn('  ⚠️  クリップボードへのコピーに失敗しました:', err.message);
    console.log(`  → article.md を直接開いてください: ${articlePath}`);
  }

  return { method: 'text', outputPath: articlePath };
}

module.exports = { formatOutput };
