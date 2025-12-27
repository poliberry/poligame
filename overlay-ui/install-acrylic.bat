@echo off
echo Installing electron-acrylic-window with Windows SDK detection...

REM Try to find Windows SDK
set "WINDOWSSDKDIR="
set "VCINSTALLDIR="

REM Check common Windows SDK locations
if exist "C:\Program Files (x86)\Windows Kits\10\Include" (
    for /f "tokens=*" %%i in ('dir /b /ad /o-n "C:\Program Files (x86)\Windows Kits\10\Include"') do (
        set "WINDOWSSDKDIR=C:\Program Files (x86)\Windows Kits\10"
        set "WINDOWSSDKVERSION=%%i"
        goto :found
    )
)

:found
if defined WINDOWSSDKDIR (
    echo Found Windows SDK at: %WINDOWSSDKDIR%
    echo SDK Version: %WINDOWSSDKVERSION%
    set "WINDOWSSDKDIR=%WINDOWSSDKDIR%"
)

REM Try to find Visual Studio
if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build" (
    set "VCINSTALLDIR=C:\Program Files\Microsoft Visual Studio\2022\Community\VC"
    goto :vs_found
)
if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build" (
    set "VCINSTALLDIR=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC"
    goto :vs_found
)
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build" (
    set "VCINSTALLDIR=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC"
    goto :vs_found
)

:vs_found
if defined VCINSTALLDIR (
    echo Found Visual Studio at: %VCINSTALLDIR%
)

REM Set npm config for node-gyp
if defined WINDOWSSDKDIR (
    npm config set msvs_version 2022
    echo Set msvs_version to 2022
)

echo.
echo Installing electron-acrylic-window...
npm install electron-acrylic-window --save

pause


