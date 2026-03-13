'use strict';

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const TEMPLATES_DIR = path.join(__dirname, '../templates');
const EXAMPLES_DIR = path.join(TEMPLATES_DIR, 'examples');

/**
 * examples/ から最新のN件の承認済み記事を読み込む
 */
function loadExamples(maxCount) {
  if (!fs.existsSync(EXAMPLES_DIR)) return [];

  const files = fs.readdirSync(EXAMPLES_DIR)
    .filter(f => f.startsWith('good-example-') && f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, maxCount);

  return files.map((f, i) => {
    const content = fs.readFileSync(path.join(EXAMPLES_DIR, f), 'utf-8');
    return `### 承認済み記事例 ${i + 1}\n\n${content}\n\n---`;
  });
}

/**
 * Anthropic Claude API で note.com 記事を生成する
 * @param {object[]} chapters - parseDescriptionの出力
 * @param {object[]} frames - extractFramesの出力
 * @param {object} config - config.json の内容
 * @returns {string} - 生成されたMarkdown記事
 */
async function generateArticle(chapters, frames, config) {
  const client = new Anthropic();

  const promptTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'article-prompt.txt'), 'utf-8');
  const styleGuide = fs.readFileSync(path.join(TEMPLATES_DIR, 'style-guide.md'), 'utf-8');
  const examplesList = loadExamples(config.maxExamplesInPrompt || 2);

  // チャプター一覧テキスト
  const chaptersList = chapters
    .map(c => `${c.index + 1}. [${c.timestamp}] ${c.title}`)
    .join('\n');

  // チャプター詳細（画像パス付き）
  const chaptersDetail = chapters.map(c => {
    const frameNum = String(c.index).padStart(2, '0');
    const frame = frames.find(f => f.chapterIndex === c.index);
    const imageNote = frame && frame.success ? `画像: images/chapter-${frameNum}.jpg` : '（画像なし）';
    return `- [${c.timestamp}] ${c.title} (${imageNote})`;
  }).join('\n');

  const examplesText = examplesList.length > 0
    ? examplesList.join('\n\n')
    : '（まだ承認済みの記事例がありません。初回生成後に --save-example で保存できます）';

  const prompt = promptTemplate
    .replace('{{CHAPTERS_LIST}}', chaptersList)
    .replace('{{CHAPTERS_DETAIL}}', chaptersDetail)
    .replace('{{STYLE_GUIDE}}', styleGuide)
    .replace('{{EXAMPLES}}', examplesText);

  console.log('  🤖 Claude API に記事生成を依頼中...');

  const message = await client.messages.create({
    model: config.claudeModel || 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

module.exports = { generateArticle };
