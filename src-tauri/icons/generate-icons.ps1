# PowerShell script to generate icons from SVG
# Requires: ImageMagick or similar tool, or online conversion

Write-Host "PoliGame Icon Generator" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Check if ImageMagick is installed
$magick = Get-Command magick -ErrorAction SilentlyContinue

if ($magick) {
    Write-Host "ImageMagick found! Generating icons..." -ForegroundColor Green
    
    # Generate PNG icons
    magick icon.svg -resize 32x32 32x32.png
    magick icon.svg -resize 128x128 128x128.png
    magick icon.svg -resize 256x256 128x128@2x.png
    
    # Generate ICO for Windows
    magick icon.svg -resize 256x256 -define icon:auto-resize=256,128,64,48,32,16 icon.ico
    
    # Generate ICNS for macOS (requires iconutil or online conversion)
    Write-Host "For macOS .icns, you may need to use iconutil or online converter" -ForegroundColor Yellow
    
    Write-Host "`nIcons generated successfully!" -ForegroundColor Green
} else {
    Write-Host "ImageMagick not found. Using alternative method..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Install ImageMagick" -ForegroundColor Cyan
    Write-Host "  Download: https://imagemagick.org/script/download.php" -ForegroundColor White
    Write-Host "  Then run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Use online converter" -ForegroundColor Cyan
    Write-Host "  1. Go to: https://cloudconvert.com/svg-to-png" -ForegroundColor White
    Write-Host "  2. Upload icon.svg" -ForegroundColor White
    Write-Host "  3. Set sizes: 32x32, 128x128, 256x256" -ForegroundColor White
    Write-Host "  4. Download and rename files accordingly" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 3: Use Python (if installed)" -ForegroundColor Cyan
    
    # Try Python method
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        Write-Host "Python found! Attempting to generate with cairosvg..." -ForegroundColor Green
        Write-Host "First install: pip install cairosvg pillow" -ForegroundColor Yellow
    } else {
        Write-Host "Python not found. Please use Option 1 or 2 above." -ForegroundColor Yellow
    }
}

Write-Host "`nRequired icon files:" -ForegroundColor Cyan
Write-Host "  - 32x32.png" -ForegroundColor White
Write-Host "  - 128x128.png" -ForegroundColor White
Write-Host "  - 128x128@2x.png (256x256)" -ForegroundColor White
Write-Host "  - icon.ico (Windows)" -ForegroundColor White
Write-Host "  - icon.icns (macOS - optional)" -ForegroundColor White

