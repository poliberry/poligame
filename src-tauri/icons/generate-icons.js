/**
 * Simple icon generator for PoliGame
 * Requires: npm install sharp (or use online converter)
 */

const fs = require('fs');
const path = require('path');

console.log('PoliGame Icon Generator');
console.log('======================\n');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
  console.log('Sharp found! Generating icons from SVG...\n');
  
  const svgPath = path.join(__dirname, 'icon.svg');
  
  // Generate PNG icons
  async function generateIcons() {
    try {
      // 32x32
      await sharp(svgPath)
        .resize(32, 32)
        .png()
        .toFile('32x32.png');
      console.log('✓ Generated 32x32.png');
      
      // 128x128
      await sharp(svgPath)
        .resize(128, 128)
        .png()
        .toFile('128x128.png');
      console.log('✓ Generated 128x128.png');
      
      // 256x256 (128x128@2x)
      await sharp(svgPath)
        .resize(256, 256)
        .png()
        .toFile('128x128@2x.png');
      console.log('✓ Generated 128x128@2x.png');
      
      // ICO (Windows) - sharp doesn't support ICO directly, so we'll create a simple one
      // For proper ICO, use online converter or ImageMagick
      console.log('\n⚠ ICO file generation requires ImageMagick or online converter');
      console.log('   Use: https://convertio.co/png-ico/');
      console.log('   Or: magick icon.svg -resize 256x256 icon.ico\n');
      
      console.log('✓ PNG icons generated successfully!');
    } catch (error) {
      console.error('Error generating icons:', error.message);
    }
  }
  
  generateIcons();
  
} catch (e) {
  console.log('Sharp not found. Installing...');
  console.log('Run: npm install sharp\n');
  console.log('Or use one of these methods:\n');
  console.log('1. Python script (if Python installed):');
  console.log('   pip install cairosvg pillow');
  console.log('   python generate-icons.py\n');
  console.log('2. PowerShell script (if ImageMagick installed):');
  console.log('   powershell -ExecutionPolicy Bypass -File generate-icons.ps1\n');
  console.log('3. Online converter:');
  console.log('   https://cloudconvert.com/svg-to-png');
  console.log('   Upload icon.svg and convert at sizes: 32, 128, 256\n');
}

