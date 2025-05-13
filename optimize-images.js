const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const IMG_DIR = 'img';
const QUALITY = 80;
const SIZES = {
  thumbnail: 300,
  medium: 600,
  large: 1200
};

async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  // Skip if already processed
  if (fileName.includes('-optimized')) return;

  try {
    if (ext === '.gif') {
      // Convert GIF to MP4 and WebP
      const outputPath = path.join(dir, `${fileName}.mp4`);
      await execPromise(`ffmpeg -i "${filePath}" -vf "scale=600:-1" -b:v 2M "${outputPath}"`);
      
      // Create a static preview image
      await execPromise(`ffmpeg -i "${filePath}" -vframes 1 "${path.join(dir, `${fileName}-preview.jpg`)}"`);
      
      // Optimize the preview image
      await sharp(path.join(dir, `${fileName}-preview.jpg`))
        .resize(SIZES.medium)
        .webp({ quality: QUALITY })
        .toFile(path.join(dir, `${fileName}-preview.webp`));
        
      console.log(`Converted ${filePath} to MP4 and created preview`);
    } else if (['.jpg', '.jpeg', '.png', '.svg'].includes(ext)) {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      // Create WebP version
      await image
        .webp({ quality: QUALITY })
        .toFile(path.join(dir, `${fileName}.webp`));

      // Create responsive versions
      for (const [size, width] of Object.entries(SIZES)) {
        if (metadata.width > width) {
          // Create regular format
          await image
            .resize(width)
            .toFile(path.join(dir, `${fileName}-${size}${ext}`));
            
          // Create WebP version
          await image
            .resize(width)
            .webp({ quality: QUALITY })
            .toFile(path.join(dir, `${fileName}-${size}.webp`));
        }
      }

      // Optimize original
      await image
        .resize(metadata.width)
        .toFile(path.join(dir, `${fileName}-optimized${ext}`));

      console.log(`Optimized ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

async function processDirectory(dir) {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      await processDirectory(filePath);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(ext)) {
        await optimizeImage(filePath);
      }
    }
  }
}

// Run the optimization
processDirectory(IMG_DIR)
  .then(() => console.log('Image optimization complete!'))
  .catch(console.error); 