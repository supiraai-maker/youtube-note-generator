'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * VTT字幕ファイルをパースしてプレーンテキストに変換する
 * @param {string} vttContent - VTTファイルの内容
 * @returns {string} - クリーンなテキスト
 */
function parseVtt(vttContent) {
  const lines = vttContent.split('\n');
  const textLines = [];
  let prevLine = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // タイムスタンプ行・ヘッダー・空行・NOTE行をスキップ
    if (!trimmed) continue;
    if (trimmed === 'WEBVTT') continue;
    if (trimmed.startsWith('NOTE')) continue;
    if (/^\d{2}:\d{2}[:.]\d{2}/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue;

    // HTMLタグを除去（<c>、<00:00:00.000>など）
    const clean = trimmed
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    if (!clean) continue;
    // 直前と同じ行（字幕の重複）はスキップ
    if (clean === prevLine) continue;

    textLines.push(clean);
    prevLine = clean;
  }

  return textLines.join(' ');
}

/**
 * YouTubeから自動生成字幕をダウンロードしてテキストに変換する
 * @param {string} youtubeUrl - YouTubeのURL
 * @param {object} config - config.jsonの内容
 * @returns {string} - 字幕のプレーンテキスト
 */
function fetchTranscript(youtubeUrl, config) {
  const ytDlpPath = config.ytDlpPath || 'yt-dlp';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-transcript-'));

  try {
    // 自動生成字幕（ja）を優先、なければ en も試みる
    execFileSync(ytDlpPath, [
      '--write-auto-sub',
      '--sub-lang', 'ja,ja-orig,en',
      '--sub-format', 'vtt',
      '--skip-download',
      '--no-playlist',
      '-o', path.join(tmpDir, 'transcript'),
      youtubeUrl,
    ], { stdio: 'pipe' });

    // ダウンロードされた vtt ファイルを探す
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.vtt'));
    if (files.length === 0) {
      throw new Error('字幕が見つかりませんでした。YouTube上で自動字幕が生成されているか確認してください。');
    }

    // 日本語字幕を優先して選択
    const jaFile = files.find(f => f.includes('.ja')) || files[0];
    const vttContent = fs.readFileSync(path.join(tmpDir, jaFile), 'utf-8');
    return parseVtt(vttContent);

  } finally {
    // 一時ファイルを削除
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// CLIから直接実行する場合
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.error('使用方法: node scripts/fetch-transcript.js <YouTube URL>');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf-8'));
  try {
    const transcript = fetchTranscript(url, config);
    console.log('✅ 字幕取得成功:');
    console.log(transcript.slice(0, 300) + '...');
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

module.exports = { fetchTranscript };
