'use strict';

const fs = require('fs');
const path = require('path');

/**
 * description.txt からチャプター情報を解析する
 * @param {string} filePath - description.txtのパス
 * @returns {{ index: number, title: string, timestamp: string, seconds: number }[]}
 */
function parseDescription(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // タイムスタンプ行を検出する正規表現
  // 対応フォーマット: 0:00 / 00:00 / 1:02:45 / 01:02:45
  const timestampRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+)$/;

  const chapters = [];
  const seenSeconds = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(timestampRegex);
    if (!match) continue;

    const g1 = parseInt(match[1], 10);
    const g2 = parseInt(match[2], 10);
    const g3 = match[3] !== undefined ? parseInt(match[3], 10) : null;

    let seconds;
    let timestamp;
    if (g3 !== null) {
      // H:MM:SS 形式
      seconds = g1 * 3600 + g2 * 60 + g3;
      timestamp = `${g1}:${String(g2).padStart(2, '0')}:${String(g3).padStart(2, '0')}`;
    } else {
      // M:SS 形式
      seconds = g1 * 60 + g2;
      timestamp = `${g1}:${String(g2).padStart(2, '0')}`;
    }

    // 同じ秒数は重複スキップ
    if (seenSeconds.has(seconds)) continue;
    seenSeconds.add(seconds);

    const title = match[4].trim().slice(0, 80);

    chapters.push({
      index: chapters.length,
      title,
      timestamp,
      seconds,
    });
  }

  if (chapters.length === 0) {
    throw new Error('description.txt にタイムスタンプが見つかりませんでした。\n例: 0:00 はじめに');
  }

  return chapters;
}

// CLIから直接実行する場合
if (require.main === module) {
  const filePath = process.argv[2] || path.join(__dirname, '../work/description.txt');
  try {
    const chapters = parseDescription(filePath);
    console.log(`✅ ${chapters.length}件のチャプターを検出しました:`);
    chapters.forEach(c => console.log(`  [${c.timestamp}] ${c.title}`));
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

module.exports = { parseDescription };
