'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * SRT字幕ファイルをパースしてプレーンテキストに変換する
 */
function parseSrt(srtContent) {
  const lines = srtContent.split('\n');
  const textLines = [];
  let prevLine = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 連番行をスキップ
    if (/^\d+$/.test(trimmed)) continue;
    // タイムスタンプ行をスキップ（00:01:23,456 --> 00:01:25,789）
    if (/^\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(trimmed)) continue;

    const clean = trimmed
      .replace(/<[^>]+>/g, '')
      .replace(/\{[^}]+\}/g, '')
      .trim();

    if (!clean) continue;
    if (clean === prevLine) continue;

    textLines.push(clean);
    prevLine = clean;
  }

  return textLines.join(' ');
}

/**
 * workフォルダ内のSRTファイルを読み込んでテキストに変換する
 * SRTがなければnullを返す
 */
function loadLocalSubtitle(workDir) {
  const srtFiles = fs.readdirSync(workDir).filter(f => f.toLowerCase().endsWith('.srt'));
  if (srtFiles.length === 0) return null;

  const srtPath = path.join(workDir, srtFiles[0]);
  const srtContent = fs.readFileSync(srtPath, 'utf-8');
  return { text: parseSrt(srtContent), fileName: srtFiles[0] };
}

/**
 * VTT字幕ファイルをパースしてプレーンテキストに変換する
 */
function parseVtt(vttContent) {
  const lines = vttContent.split('\n');
  const textLines = [];
  let prevLine = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'WEBVTT') continue;
    if (trimmed.startsWith('NOTE')) continue;
    if (/^\d{2}:\d{2}[:.]\d{2}/.test(trimmed)) continue;
    if (/^\d+$/.test(trimmed)) continue;

    const clean = trimmed
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    if (!clean) continue;
    if (clean === prevLine) continue;

    textLines.push(clean);
    prevLine = clean;
  }

  return textLines.join(' ');
}

/**
 * 指定ミリ秒スリープする（同期）
 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * YouTubeから自動生成字幕をダウンロードしてテキストに変換する
 * 429エラー時は最大5回リトライ（60秒間隔）
 */
function fetchTranscript(youtubeUrl, config) {
  const ytDlpPath = config.ytDlpPath || 'yt-dlp';
  const maxRetries = 5;
  const retryDelayMs = 60000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-transcript-'));

    try {
      execFileSync(ytDlpPath, [
        '--write-auto-sub',
        '--sub-lang', 'ja,ja-orig',
        '--sub-format', 'vtt',
        '--skip-download',
        '--no-playlist',
        '--sleep-requests', '2',
        '-o', path.join(tmpDir, 'transcript'),
        youtubeUrl,
      ], { stdio: 'pipe' });

      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.vtt'));
      if (files.length === 0) {
        throw new Error('字幕が見つかりませんでした。YouTube上で自動字幕が生成されているか確認してください。');
      }

      const jaFile = files.find(f => f.includes('.ja')) || files[0];
      const vttContent = fs.readFileSync(path.join(tmpDir, jaFile), 'utf-8');
      return parseVtt(vttContent);

    } catch (err) {
      fs.rmSync(tmpDir, { recursive: true, force: true });

      const is429 = err.message && err.message.includes('429');
      if (is429 && attempt < maxRetries) {
        console.warn(`   ⏳ レート制限 (429)。${retryDelayMs / 1000}秒後にリトライ（${attempt}/${maxRetries}）...`);
        sleepSync(retryDelayMs);
        continue;
      }
      throw err;
    }
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
    console.log(transcript.slice(0, 500) + '...');
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

module.exports = { fetchTranscript, loadLocalSubtitle };
