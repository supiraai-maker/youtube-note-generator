'use strict';

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
 * Gemini 2.5 Flash で note.com 記事を生成する
 * @param {object[]} chapters - parseDescriptionの出力
 * @param {object[]} frames - extractFramesの出力
 * @param {string} transcript - YouTube字幕テキスト（空文字でも可）
 * @param {object} config - config.json の内容
 * @returns {string} - 生成されたMarkdown記事
 */
async function generateArticle(chapters, frames, transcript, config) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: config.geminiModel || 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 8192,
    },
  });

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

  const transcriptText = transcript
    ? transcript
    : '（字幕データなし。チャプタータイトルから内容を推測してください）';

  const prompt = promptTemplate
    .replace('{{CHAPTERS_LIST}}', chaptersList)
    .replace('{{CHAPTERS_DETAIL}}', chaptersDetail)
    .replace('{{TRANSCRIPT}}', transcriptText)
    .replace('{{STYLE_GUIDE}}', styleGuide)
    .replace('{{EXAMPLES}}', examplesText);

  console.log('  🤖 Gemini 2.5 Flash に記事生成を依頼中...');

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { generateArticle };
