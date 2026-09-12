$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Test-NeedNode {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $true }
  $major = [int]((node -p "process.versions.node.split('.')[0]").Trim())
  return $major -lt 20
}

function Ask-Yes {
  param([string]$Prompt, [bool]$Default = $true)
  $hint = if ($Default) { "E/h" } else { "e/H" }
  $ans = Read-Host "$Prompt [$hint]"
  if ([string]::IsNullOrWhiteSpace($ans)) { return $Default }
  $ans = $ans.Trim().ToLower()
  return @("e", "y", "evet") -contains $ans
}

if (Test-NeedNode) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget -and (Ask-Yes "Node 20+ yok. winget ile kurayım mı?" $true)) {
    Write-Host "Node 20+ winget ile kuruluyor..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
  } else {
    Write-Host "Node 20+ gerekli."
    if (-not $winget) {
      Write-Host "winget yok. App Installer / winget kurun, sonra: winget install -e --id OpenJS.NodeJS.LTS"
    } else {
      Write-Host "Manuel: winget install -e --id OpenJS.NodeJS.LTS"
    }
    if (Ask-Yes "Node LTS sayfasını tarayıcıda açayım mı?" $false) {
      Start-Process "https://nodejs.org/"
    }
    exit 1
  }
}

if (Test-NeedNode) {
  Write-Host "Node hâlâ 20+ değil. Yeni bir terminal açıp scripti tekrar çalıştırın."
  exit 1
}

Write-Host "Bağımlılıklar kuruluyor..."
npm install
npm link
Write-Host "Kurulum sihirbazı başlıyor..."
air setup
