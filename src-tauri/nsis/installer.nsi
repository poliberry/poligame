; PoliGame NSIS Installer — v1.3.5
; Extends Tauri's default NSIS template to add optional component selection.
;
; Components:
;   [Required]  Discord RPC Helper  (poligame-rpc.exe)
;   [Optional]  Overdrive Mode      (poligame-overdrive.exe)  — checked by default
;   [Optional]  Game Overlay        (poligame-overlay.exe)    — checked by default
;
; This file is based on the Tauri v2 default NSIS template with the
; ComponentsPage inserted before the installation step.

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "WordFunc.nsh"

; ── Tauri-injected defines ───────────────────────────────────────────────────
; (These are set by the Tauri bundler at build time via /D flags)
!ifndef PRODUCTNAME
  !define PRODUCTNAME "PoliGame"
!endif
!ifndef VERSION
  !define VERSION "1.3.5"
!endif
!ifndef MANUFACTURER
  !define MANUFACTURER "poliberry"
!endif
!ifndef INSTALLMODE
  !define INSTALLMODE "perUserOrSystem"
!endif

; ── General ──────────────────────────────────────────────────────────────────
Name "${PRODUCTNAME} ${VERSION}"
OutFile "setup.exe"

!if "${INSTALLMODE}" == "perMachine"
  InstallDir "$PROGRAMFILES64\${PRODUCTNAME}"
!else
  InstallDir "$LOCALAPPDATA\${PRODUCTNAME}"
!endif

RequestExecutionLevel user

; ── UI ───────────────────────────────────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ── Component descriptions ───────────────────────────────────────────────────
LangString DESC_Core     ${LANG_ENGLISH} "Core application files (required)"
LangString DESC_Rpc      ${LANG_ENGLISH} "Discord Rich Presence — shows your current game and launcher status in Discord (required)"
LangString DESC_Overdrive ${LANG_ENGLISH} "Overdrive — fullscreen controller-friendly game launcher, optimised for big screens and gamepads"
LangString DESC_Overlay   ${LANG_ENGLISH} "Game Overlay — in-game overlay (Ctrl+Shift+F9) with game options, settings, and the Overdrive panel"

; ── Sections ─────────────────────────────────────────────────────────────────

Section "!PoliGame Core" SecCore
  SectionIn RO   ; required, cannot be deselected
  SetOutPath "$INSTDIR"

  ; Main application binary + frontend assets (injected by Tauri bundler)
  ; Tauri replaces this comment with File directives for the main bundle.
  {{tauri_files}}

  ; Write uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry: add/remove programs entry
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "DisplayName" "${PRODUCTNAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" \
    "Publisher" "${MANUFACTURER}"
SectionEnd

Section "Discord RPC Helper" SecRpc
  SectionIn RO   ; required
  SetOutPath "$INSTDIR"
  File "binaries\poligame-rpc.exe"
SectionEnd

Section "Overdrive Mode" SecOverdrive
  SetOutPath "$INSTDIR"
  File "binaries\poligame-overdrive.exe"
SectionEnd

Section "Game Overlay" SecOverlay
  SetOutPath "$INSTDIR"
  File "binaries\poligame-overlay.exe"
SectionEnd

; Register component descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore}      $(DESC_Core)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecRpc}       $(DESC_Rpc)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecOverdrive} $(DESC_Overdrive)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecOverlay}   $(DESC_Overlay)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ── Uninstall ─────────────────────────────────────────────────────────────────

Section "Uninstall"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$INSTDIR\poligame-rpc.exe"
  Delete "$INSTDIR\poligame-overdrive.exe"
  Delete "$INSTDIR\poligame-overlay.exe"
  ; Main app files removed by Tauri
  {{tauri_uninstall_files}}
  RMDir "$INSTDIR"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
SectionEnd

; ── Init: pre-check defaults ─────────────────────────────────────────────────

Function .onInit
  ; Overdrive and Overlay are checked by default
  SectionSetFlags ${SecOverdrive} ${SF_SELECTED}
  SectionSetFlags ${SecOverlay}   ${SF_SELECTED}
FunctionEnd
