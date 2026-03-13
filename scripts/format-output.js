'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Markdown の画像参照を Base64 HTML に変換してクリップボードにコピーする
 * フォールバック: Base64 総サイズが設定超過の場合はプレーン Markdown をコピー
 * @param {string} articleMd - 生成された Markdown 文字列
 * @param {string} imagesDir - 画像ディレクトリのパス
 * @param {string} outputDir - 出力ディレクトリ（article.md の保存先）
 * @param {object} config - config.json の内容
 * @returns {{ method: 'html'|'markdown', outputPath: string }}
 */
async function formatOutput(articleMd, imagesDir, outputDir, config) {
  const articlePath = path.join(outputDir, 'article.md');
  fs.writeFileSync(articlePath, articleMd, 'utf-8');
  console.log(`  📝 article.md を保存しました: ${articlePath}`);

  const limitBytes = (config.base64SizeLimitMB || 3) * 1024 * 1024;

  // 画像を Base64 に変換
  let totalSize = 0;
  const imageMap = {};
  const imgRegex = /!\[([^\]]*)\]\((images\/chapter-\d+\.jpg)\)/g;
  let match;
  while ((match = imgRegex.exec(articleMd)) !== null) {
    const imgRelPath = match[2];
    const imgAbsPath = path.join(imagesDir, path.basename(imgRelPath));
    if (fs.existsSync(imgAbsPath) && !imageMap[imgRelPath]) {
      const data = fs.readFileSync(imgAbsPath);
      totalSize += data.length;
      imageMap[imgRelPath] = `data:image/jpeg;base64,${data.toString('base64')}`;
    }
  }

  // クリップボードへのコピー (clipboardy は ESM のため動的インポート)
  try {
    const { default: clipboardy } = await import('clipboardy');

    if (totalSize > limitBytes) {
      // フォールバック: プレーン Markdown をコピー
      await clipboardy.write(articleMd);
      console.log(`  📋 Markdown をクリップボードにコピーしました（画像は ${imagesDir} を手動アップロード）`);
      return { method: 'markdown', outputPath: articlePath };
    }

    // HTML 版を生成してコピー
    const htmlArticle = buildHtml(articleMd, imageMap);
    await clipboardy.write(htmlArticle);
    console.log('  📋 HTML（画像込み）をクリップボードにコピーしました');
    return { method: 'html', outputPath: articlePath };

  } catch (err) {
    console.warn('  ⚠️  クリップボードへのコピーに失敗しました:', err.message);
    console.log(`  → article.md を直接開いてください: ${articlePath}`);
    return { method: 'markdown', outputPath: articlePath };
  }
}

/**
 * Markdown を簡易 HTML に変換し、画像を Base64 埋め込みにする
 */
function buildHtml(markdown, imageMap) {
  let html = markdown
    // 画像プレースホルダーを Base64 img タグに置換
    .replace(/!\[([^\]]*)\]\((images\/chapter-\d+\.jpg)\)/g, (_, alt, src) => {
      const base64 = imageMap[src];
      if (base64) return `<img src="${base64}" alt="${alt}" style="max-width:100%;margin:16px 0;">`;
      return '';
    })
    // 見出し
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 太字
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 箇条書き
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // 段落（空行区切り）
    .replace(/\n{2,}/g, '</p><p>')
    // li タグをリストで囲む（簡易版）
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  return `<div style="font-family:sans-serif;max-width:800px;line-height:1.8;"><p>${html}</p></div>`;
}

module.exports = { formatOutput };
