'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 各チャプターのタイムスタンプでFFmpegを使ってフレームを抽出する
 * @param {object[]} chapters - parseDescriptionの出力
 * @param {string} videoPath - 動画ファイルのパス
 * @param {string} imagesDir - 画像保存先ディレクトリ
 * @param {object} config - config.json の内容
 * @returns {{ chapterIndex: number, title: string, imagePath: string, success: boolean }[]}
 */
function extractFrames(chapters, videoPath, imagesDir, config) {
  const ffmpegPath = config.ffmpegPath || 'ffmpeg';
  const quality = config.frameQuality || 2;
  const format = config.frameFormat || 'jpg';

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const results = [];

  for (const chapter of chapters) {
    const fileName = `chapter-${String(chapter.index).padStart(2, '0')}.${format}`;
    const imagePath = path.join(imagesDir, fileName);

    try {
      execFileSync(ffmpegPath, [
        '-ss', String(chapter.seconds),
        '-i', videoPath,
        '-vframes', '1',
        '-q:v', String(quality),
        '-y',
        imagePath,
      ], { stdio: 'pipe' });

      console.log(`  📷 [${chapter.timestamp}] ${chapter.title} → ${fileName}`);
      results.push({ chapterIndex: chapter.index, title: chapter.title, imagePath, success: true });
    } catch (err) {
      console.warn(`  ⚠️  フレーム抽出失敗: [${chapter.timestamp}] ${chapter.title}`);
      results.push({ chapterIndex: chapter.index, title: chapter.title, imagePath: null, success: false });
    }
  }

  return results;
}

module.exports = { extractFrames };
