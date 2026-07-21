/**
 * Generate PoliGame icons using @resvg/resvg-js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('PoliGame Icon Generator');
console.log('======================\n');

const svgPath = path.join(__dirname, 'icon.svg');

try {
  // Read SVG file
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  console.log('Generating icons from SVG...\n');
  
  // Generate 32x32
  const png32 = resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: 32,
    },
  });
  fs.writeFileSync(path.join(__dirname, '32x32.png'), png32.asPng());
  console.log('✓ Generated 32x32.png');
  
  // Generate 128x128
  const png128 = resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: 128,
    },
  });
  fs.writeFileSync(path.join(__dirname, '128x128.png'), png128.asPng());
  console.log('✓ Generated 128x128.png');
  
  // Generate 256x256 (128x128@2x)
  const png256 = resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: 256,
    },
  });
  fs.writeFileSync(path.join(__dirname, '128x128@2x.png'), png256.asPng());
  console.log('✓ Generated 128x128@2x.png');
  
  // For ICO, we'll create a simple one using the 256x256 PNG
  // Note: Creating a proper multi-size ICO requires additional tools
  // For now, we'll create a basic ICO using the 256x256 image
  console.log('\n✓ PNG icons generated successfully!');
  console.log('\nNote: For a proper multi-size .ico file, use:');
  console.log('   - ImageMagick: magick 128x128@2x.png icon.ico');
  console.log('   - Or online: https://convertio.co/png-ico/');
  
} catch (error) {
  console.error('Error:', error.message);
  console.error('\nMake sure @resvg/resvg-js is installed:');
  console.error('npm install --save-dev @resvg/resvg-js');
  process.exit(1);
}

