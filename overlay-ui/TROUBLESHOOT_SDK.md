# Troubleshooting Windows SDK Detection

If npm/node-gyp can't find your Windows SDK, try these solutions:

## Solution 1: Set Environment Variables Manually

Open PowerShell as Administrator and run:

```powershell
$env:WINDOWSSDKDIR = "C:\Program Files (x86)\Windows Kits\10"
$env:VCINSTALLDIR = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC"
npm config set msvs_version 2022
npm install electron-acrylic-window --save
```

## Solution 2: Use the Provided Scripts

Run one of these scripts in the `overlay-ui` directory:

**PowerShell (Recommended):**
```powershell
.\install-acrylic.ps1
```

**Batch file:**
```cmd
install-acrylic.bat
```

## Solution 3: Use Visual Studio Developer Command Prompt

1. Open "Developer Command Prompt for VS 2022" (search in Start menu)
2. Navigate to the overlay-ui directory
3. Run: `npm install electron-acrylic-window --save`

## Solution 4: Check SDK Installation

Verify your SDK is installed:

```powershell
# Check if SDK exists
Test-Path "C:\Program Files (x86)\Windows Kits\10\Include"

# List installed SDK versions
Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\Include" -Directory
```

## Solution 5: Reinstall Windows SDK

If the SDK isn't found:

1. Open Visual Studio Installer
2. Modify your installation
3. Under "Individual components", search for "Windows SDK"
4. Install the latest Windows 10/11 SDK
5. Restart your terminal and try again

## Solution 6: Use npm config

Set npm to use Visual Studio 2022:

```cmd
npm config set msvs_version 2022
npm install electron-acrylic-window --save
```

## Solution 7: Install via Visual Studio Installer

Make sure you have:
- Visual Studio 2022 Build Tools (or Community/Professional)
- "Desktop development with C++" workload
- Latest Windows 10/11 SDK component

Then restart your terminal and try installing again.


