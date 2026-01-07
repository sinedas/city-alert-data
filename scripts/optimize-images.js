#!/usr/bin/env node

/**
 * Image Optimization Script
 * 
 * Converts images to WebP format with the following specs:
 * - Max dimension: 1024px (maintains aspect ratio)
 * - Quality: 85%
 * - Format: WebP
 * 
 * Usage:
 *   node scripts/optimize-images.js <input-folder> <output-folder>
 *   
 * Example:
 *   node scripts/optimize-images.js v1/img/future v1/img/future_optimized
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const MAX_DIMENSION = 1024;
const QUALITY = 85;
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
 * Optimize a single image
 */
async function optimizeImage(inputPath, outputPath) {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Calculate new dimensions
    let width = metadata.width;
    let height = metadata.height;
    
    if (width > height && width > MAX_DIMENSION) {
      // Width is larger
      height = Math.round(height * (MAX_DIMENSION / width));
      width = MAX_DIMENSION;
    } else if (height > width && height > MAX_DIMENSION) {
      // Height is larger
      width = Math.round(width * (MAX_DIMENSION / height));
      height = MAX_DIMENSION;
    }
    
    // Resize and convert to WebP
    await image
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true, // Don't upscale small images
      })
      .webp({ quality: QUALITY })
      .toFile(outputPath);
    
    // Get file sizes
    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;
    const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);
    
    console.log(`✅ ${path.basename(inputPath)}`);
    console.log(`   ${metadata.width}x${metadata.height} → ${width}x${height}`);
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
    console.error('❌ Usage: node optimize-images.js <input-folder> <output-folder>');
    console.error('Example: node optimize-images.js v1/img/future v1/img/future_optimized');
    process.exit(1);
  }
  
  const inputDir = args[0];
  const outputDir = args[1];
  
  // Validate input directory
  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Input directory does not exist: ${inputDir}`);
    process.exit(1);
  }
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}\n`);
  }
  
  // Get all images
  console.log(`🔍 Scanning for images in: ${inputDir}\n`);
  const imageFiles = getImageFiles(inputDir);
  
  if (imageFiles.length === 0) {
    console.log('⚠️  No images found!');
    process.exit(0);
  }
  
  console.log(`📸 Found ${imageFiles.length} images\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Process all images
  let totalInputSize = 0;
  let totalOutputSize = 0;
  let successCount = 0;
  
  for (const inputPath of imageFiles) {
    const relativePath = path.relative(inputDir, inputPath);
    const outputPath = path.join(
      outputDir,
      relativePath.replace(path.extname(relativePath), '.webp')
    );
    
    // Create subdirectories if needed
    const outputSubDir = path.dirname(outputPath);
    if (!fs.existsSync(outputSubDir)) {
      fs.mkdirSync(outputSubDir, { recursive: true });
    }
    
    const result = await optimizeImage(inputPath, outputPath);
    
    if (result.success) {
      successCount++;
      totalInputSize += result.inputSize;
      totalOutputSize += result.outputSize;
    }
  }
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📊 Summary:`);
  console.log(`   Processed: ${successCount}/${imageFiles.length} images`);
  console.log(`   Total size: ${formatBytes(totalInputSize)} → ${formatBytes(totalOutputSize)}`);
  const totalSavings = ((1 - totalOutputSize / totalInputSize) * 100).toFixed(1);
  console.log(`   Savings: ${totalSavings}%`);
  console.log(`\n✨ Done! Optimized images saved to: ${outputDir}`);
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

