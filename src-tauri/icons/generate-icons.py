#!/usr/bin/env python3
"""
Generate PoliGame app icons from SVG
Requires: pip install cairosvg pillow
"""

try:
    import cairosvg
    from PIL import Image
    import io
    import os
except ImportError:
    print("Required packages not installed!")
    print("Install with: pip install cairosvg pillow")
    exit(1)

def generate_icon(size, output_path):
    """Generate PNG icon from SVG at specified size"""
    svg_path = "icon.svg"
    
    # Convert SVG to PNG
    png_data = cairosvg.svg2png(url=svg_path, output_width=size, output_height=size)
    
    # Save PNG
    with open(output_path, 'wb') as f:
        f.write(png_data)
    
    print(f"Generated {output_path} ({size}x{size})")

def generate_ico():
    """Generate ICO file with multiple sizes"""
    sizes = [256, 128, 64, 48, 32, 16]
    images = []
    
    svg_path = "icon.svg"
    
    for size in sizes:
        png_data = cairosvg.svg2png(url=svg_path, output_width=size, output_height=size)
        img = Image.open(io.BytesIO(png_data))
        images.append(img)
    
    # Save as ICO
    images[0].save("icon.ico", format='ICO', sizes=[(s, s) for s in sizes])
    print(f"Generated icon.ico with sizes: {', '.join(map(str, sizes))}")

def main():
    print("PoliGame Icon Generator")
    print("======================\n")
    
    # Generate PNG icons
    generate_icon(32, "32x32.png")
    generate_icon(128, "128x128.png")
    generate_icon(256, "128x128@2x.png")
    
    # Generate ICO
    generate_ico()
    
    print("\n✓ All icons generated successfully!")
    print("\nNote: For macOS .icns file, you may need to use iconutil or online converter")

if __name__ == "__main__":
    main()

