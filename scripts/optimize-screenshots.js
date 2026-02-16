#!/usr/bin/env node

/**
 * Screenshot Optimization Script
 *
 * Resizes screenshots to exact App Store size and outputs JPG:
 * - Exact size: 1290 × 2796 px (iPhone 6.7" portrait)
 * - Format: JPG
 * - Quality: 90%
 *
 * Usage:
 *   node scripts/optimize-screenshots.js <input-folder> <output-folder>
 *
 * Example:
 *   node scripts/optimize-screenshots.js ./screenshots ./screenshots-appstore
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const SCREENSHOT_WIDTH = 1290;
const SCREENSHOT_HEIGHT = 2796;
const JPG_QUALITY = 90;
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/**
 * Get all image files from a directory (recursive)
 */
function getImageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getImageFiles(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_FORMATS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * Optimize a single screenshot: resize to exact 1170×2532, output JPG
 */
async function optimizeScreenshot(inputPath, outputPath) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Resize to exact dimensions (cover = fill area, may crop if aspect ratio differs)
    await image
      .resize(SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: JPG_QUALITY,
        mozjpeg: true,
      })
      .toFile(outputPath);

    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;
    const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);

    console.log(`✅ ${path.basename(inputPath)}`);
    console.log(`   ${metadata.width}x${metadata.height} → ${SCREENSHOT_WIDTH}x${SCREENSHOT_HEIGHT}`);
    console.log(`   ${formatBytes(inputSize)} → ${formatBytes(outputSize)} (${savings}% smaller)\n`);

    return { success: true, inputSize, outputSize };
  } catch (error) {
    console.error(`❌ Failed: ${path.basename(inputPath)}`);
    console.error(`   Error: ${error.message}\n`);
    return { success: false, error };
  }
}

/**
 * Format bytes to human-readable
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Usage: node optimize-screenshots.js <input-folder> <output-folder>');
    console.error('Example: node optimize-screenshots.js ./screenshots ./screenshots-appstore');
    process.exit(1);
  }

  const inputDir = path.resolve(args[0]);
  const outputDir = path.resolve(args[1]);

  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Input directory does not exist: ${inputDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}\n`);
  }

  console.log(`🔍 Scanning for images in: ${inputDir}\n`);
  const imageFiles = getImageFiles(inputDir);

  if (imageFiles.length === 0) {
    console.log('⚠️  No images found!');
    process.exit(0);
  }

  console.log(`📸 Found ${imageFiles.length} images`);
  console.log(`   Output: JPG, ${SCREENSHOT_WIDTH}×${SCREENSHOT_HEIGHT} px, quality ${JPG_QUALITY}%\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let totalInputSize = 0;
  let totalOutputSize = 0;
  let successCount = 0;

  for (const inputPath of imageFiles) {
    const relativePath = path.relative(inputDir, inputPath);
    const outputPath = path.join(
      outputDir,
      relativePath.replace(/\.[^.]+$/i, '.jpg')
    );

    const outputSubDir = path.dirname(outputPath);
    if (!fs.existsSync(outputSubDir)) {
      fs.mkdirSync(outputSubDir, { recursive: true });
    }

    const result = await optimizeScreenshot(inputPath, outputPath);

    if (result.success) {
      successCount++;
      totalInputSize += result.inputSize;
      totalOutputSize += result.outputSize;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📊 Summary:`);
  console.log(`   Processed: ${successCount}/${imageFiles.length} images`);
  console.log(`   Total size: ${formatBytes(totalInputSize)} → ${formatBytes(totalOutputSize)}`);
  const totalSavings = totalInputSize > 0
    ? ((1 - totalOutputSize / totalInputSize) * 100).toFixed(1)
    : 0;
  console.log(`   Savings: ${totalSavings}%`);
  console.log(`\n✨ Done! Screenshots saved to: ${outputDir}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
