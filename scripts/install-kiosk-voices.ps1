# Installs Windows text-to-speech voices for the kiosk's international
# languages. Run ONCE per kiosk PC, as Administrator, during setup.
#
#   powershell -ExecutionPolicy Bypass -File scripts\install-kiosk-voices.ps1
#
# The Queuing System picks up new voices automatically — no rebuild, no config.
#
# NOTE: Windows ships no Filipino TTS voice, and none exists for Romblomanon,
# Asi, or Onhan. Those four are served by pre-recorded clips instead — see
# public/audio/README.md. This script covers the tourist languages only.

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'

# Language codes matching the kiosk's international language set.
$languages = @(
    @{ Code = 'ko-KR'; Name = 'Korean'  },
    @{ Code = 'zh-CN'; Name = 'Chinese (Simplified)' },
    @{ Code = 'ja-JP'; Name = 'Japanese' },
    @{ Code = 'de-DE'; Name = 'German'   },
    @{ Code = 'fr-FR'; Name = 'French'   },
    @{ Code = 'es-ES'; Name = 'Spanish'  }
)

Write-Host "Checking installed speech capabilities..." -ForegroundColor Cyan

$available = Get-WindowsCapability -Online -Name 'Language.Speech*'
if (-not $available) {
    Write-Warning "Could not enumerate speech capabilities. Is this Windows 10/11?"
    exit 1
}

foreach ($lang in $languages) {
    $cap = $available | Where-Object { $_.Name -like "Language.Speech~~~$($lang.Code)~*" }

    if (-not $cap) {
        Write-Host ("  {0,-22} not offered by this Windows build" -f $lang.Name) -ForegroundColor DarkYellow
        continue
    }

    if ($cap.State -eq 'Installed') {
        Write-Host ("  {0,-22} already installed" -f $lang.Name) -ForegroundColor Green
        continue
    }

    Write-Host ("  {0,-22} installing..." -f $lang.Name) -ForegroundColor Yellow
    try {
        Add-WindowsCapability -Online -Name $cap.Name | Out-Null
        Write-Host ("  {0,-22} done" -f $lang.Name) -ForegroundColor Green
    } catch {
        Write-Warning ("  {0}: {1}" -f $lang.Name, $_.Exception.Message)
    }
}

# Report the OneCore voices, NOT the System.Speech/SAPI list. The kiosk reads
# aloud through Chromium's Web Speech API, which enumerates OneCore — the two
# lists genuinely differ (a test machine showed 2 under SAPI, 3 under OneCore),
# so checking SAPI here would report the wrong thing.
Write-Host "`nVoices now visible to the kiosk:" -ForegroundColor Cyan
$oneCore = 'HKLM:\SOFTWARE\Microsoft\Speech_OneCore\Voices\Tokens'
if (Test-Path $oneCore) {
    Get-ChildItem $oneCore | ForEach-Object {
        Write-Host ("  {0}" -f (Get-ItemProperty $_.PSPath).'(default)')
    }
} else {
    Write-Warning "  OneCore voice registry not found."
}

Write-Host "`nReboot recommended so newly added voices register." -ForegroundColor Cyan
