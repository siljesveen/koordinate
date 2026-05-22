# Engangs oppsett for lokal utvikling mot samme Supabase som Vercel.
# Kjør:  powershell -ExecutionPolicy Bypass -File scripts/setup-local.ps1

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KOordinate – lokal utvikling" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "Opprettet .env.local fra mal." -ForegroundColor Green
} else {
    Write-Host ".env.local finnes allerede." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Neste steg:" -ForegroundColor Cyan
Write-Host "  1. Apne .env.local og lim inn NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY"
Write-Host "     (hent fra Vercel -> Settings -> Environment Variables, eller Supabase -> API)"
Write-Host "  2. npm install"
Write-Host "  3. npm run dev"
Write-Host "  4. Apne http://localhost:3000 og logg inn med SAMME bruker som pa Vercel"
Write-Host ""
Write-Host "Ingen ting pushes til GitHub med dette scriptet." -ForegroundColor DarkGray
Write-Host ""
