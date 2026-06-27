################################################################################
# Mundial Edge — Sync inicial (fixtures → odds → predictions)
# Uso: clic derecho → "Ejecutar con PowerShell"
################################################################################

$ErrorActionPreference = "Continue"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$secret = "ae49004597d170da78241991d42f2ae45e8e6dcca02949584c3a07a633ecb7de"
$baseUrl = "http://localhost:3000"

Write-Host "`n=== MUNDIAL EDGE — SYNC LIVE ===" -ForegroundColor Cyan

# ── 1. Verificar si el servidor ya está corriendo ──────────────────────────
function Test-Server {
    try {
        $r = Invoke-WebRequest -Uri "$baseUrl/api/sync/fixtures" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        return $r.StatusCode -lt 500
    } catch { return $false }
}

$serverRunning = Test-Server

if (-not $serverRunning) {
    Write-Host "`n[1/4] Iniciando servidor de desarrollo..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k cd /d `"$projectDir`" && npm run dev" `
        -WindowStyle Normal

    Write-Host "      Esperando que Next.js arranque (hasta 60 seg)..."
    $retries = 0
    while (-not (Test-Server) -and $retries -lt 30) {
        Start-Sleep -Seconds 2
        $retries++
        Write-Host "      ... ($($retries * 2)s)" -NoNewline
    }
    Write-Host ""
    if (-not (Test-Server)) {
        Write-Host "[ERROR] El servidor no respondió. Verifica que 'npm run dev' arrancó bien." -ForegroundColor Red
        Read-Host "`nPresiona Enter para cerrar"
        exit 1
    }
    Write-Host "      Servidor listo en $baseUrl" -ForegroundColor Green
} else {
    Write-Host "`n[1/4] Servidor ya activo en $baseUrl" -ForegroundColor Green
}

# ── Función de sync ────────────────────────────────────────────────────────
function Invoke-Sync($job) {
    Write-Host "`n=== Sync: $job ===" -ForegroundColor Cyan
    try {
        $r = Invoke-WebRequest -Uri "$baseUrl/api/sync/$job`?secret=$secret" `
            -UseBasicParsing -TimeoutSec 90
        $json = $r.Content | ConvertFrom-Json
        Write-Host "  Status : $($json.status)" -ForegroundColor $(if ($json.status -eq 'success') {'Green'} else {'Red'})
        Write-Host "  Records: $($json.records)"
        Write-Host "  Message: $($json.message)"
        return $json.status -eq 'success'
    } catch {
        Write-Host "  [ERROR] $_" -ForegroundColor Red
        return $false
    }
}

# ── 2–4. Ejecutar los 3 jobs ────────────────────────────────────────────────
Write-Host "`n[2/4] Sincronizando fixtures y equipos..."
$ok1 = Invoke-Sync "fixtures"

Write-Host "`n[3/4] Sincronizando cuotas..."
$ok2 = Invoke-Sync "odds"

Write-Host "`n[4/4] Calculando predicciones y edges..."
$ok3 = Invoke-Sync "predictions"

# ── Resultado final ─────────────────────────────────────────────────────────
Write-Host "`n============================================" -ForegroundColor Cyan
if ($ok1 -and $ok2 -and $ok3) {
    Write-Host "  SYNC COMPLETO — datos reales en Supabase" -ForegroundColor Green
} elseif ($ok1) {
    Write-Host "  SYNC PARCIAL — fixtures OK, revisar odds/predictions" -ForegroundColor Yellow
} else {
    Write-Host "  SYNC FALLIDO — revisa los errores de arriba" -ForegroundColor Red
}
Write-Host "============================================`n" -ForegroundColor Cyan

Read-Host "Presiona Enter para cerrar"
