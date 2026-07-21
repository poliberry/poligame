/**
 * Generate proper multi-size ICO file for Windows
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIco() {
  console.log('Generating icon.ico with multiple sizes...\n');
  
  const sizes = [256, 128, 64, 48, 32, 16];
  const images = [];
  
  // Read the source PNG
  const sourcePng = path.join(__dirname, '128x128@2x.png');
  
  for (const size of sizes) {
    const buffer = await sharp(sourcePng)
      .resize(size, size)
      .png()
      .toBuffer();
    
    images.push({
      width: size,
      height: size,
      buffer: buffer
    });
    
    console.log(`✓ Prepared ${size}x${size} image`);
  }
  
  // For Windows ICO, we need to create a proper multi-size ICO
  // Sharp doesn't directly support multi-size ICO, so we'll use a different approach
  // Let's use the largest size as the base and let Windows handle scaling
  const largest = images[0].buffer;
  
  // Create ICO with multiple sizes using a workaround
  // We'll embed just the 256x256 and 32x32 which Windows needs
  try {
    // Save the 256x256 as ICO (Windows will scale it)
    await sharp(images[0].buffer)
      .resize(256, 256)
      .toFile(path.join(__dirname, 'icon_temp_256.ico'));
    
    // Try using a proper ICO generator
    const toIco = require('to-ico');
    const buffers = [images[0].buffer, images[4].buffer]; // 256 and 32
    const icoBuffer = await toIco(buffers);
    
    fs.writeFileSync(path.join(__dirname, 'icon.ico'), icoBuffer);
    fs.unlinkSync(path.join(__dirname, 'icon_temp_256.ico')); // Clean up temp file
    
    console.log('\n✓ Generated icon.ico with multiple sizes (256, 32)');
  } catch (error) {
    console.error('Error generating ICO:', error.message);
    console.log('\nFallback: Using single-size ICO...');
    
    // Fallback: just use the largest PNG as ICO
    await sharp(images[0].buffer)
      .resize(256, 256)
      .toFile(path.join(__dirname, 'icon.ico'));
    
    console.log('⚠ Created single-size ICO. For better compatibility, install ImageMagick and run:');
    console.log('   magick 128x128@2x.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico');
  }
}

generateIco().catch(console.error);

