# Installing Windows SDK for electron-acrylic-window

If you want the native Windows acrylic effect, you need to install the Windows SDK.

## Option 1: Install Windows SDK via Visual Studio Installer

1. Open **Visual Studio Installer**
2. Click **Modify** on your Visual Studio 2022 Build Tools installation
3. Go to **Individual components** tab
4. Search for "Windows SDK"
5. Install the latest Windows 10/11 SDK (e.g., "Windows 11 SDK" or "Windows 10 SDK (10.0.22621.0)")
6. Click **Modify** to install

## Option 2: Install Windows SDK Standalone

1. Download Windows SDK from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
2. Install the latest Windows 10/11 SDK
3. Restart your terminal/command prompt
4. Run `npm install` again in the overlay-ui directory

## Option 3: Use CSS Backdrop Filter (Current Setup)

The current setup uses CSS `backdrop-blur` which works without native compilation. This is already configured and will work immediately.

To use native acrylic later:
1. Install Windows SDK (Option 1 or 2)
2. Run: `npm install electron-acrylic-window` in the overlay-ui directory
3. The code will automatically detect and use it


