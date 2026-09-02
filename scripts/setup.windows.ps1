$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Test-NeedNode {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $true }
  $major = [int]((node -p "process.versions.node.split('.')[0]").Trim())
  return $major -lt 20
}

if (Test-NeedNode) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Host "Node 20+ yok. winget ile kuruluyor..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
  } else {
    Write-Host "Node 20+ gerekli. winget yok."
    Write-Host "1) https://nodejs.org adresinden Node LTS kurun"
    Write-Host "2) Bu scripti tekrar çalıştırın"
    Start-Process "https://nodejs.org/"
    exit 1
  }
}

Write-Host "Bağımlılıklar kuruluyor..."
npm install
npm link
Write-Host "Kurulum sihirbazı başlıyor..."
air setup
