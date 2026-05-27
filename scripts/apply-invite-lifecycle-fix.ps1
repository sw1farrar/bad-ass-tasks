# =====================================================
# Bad Ass Tasks - Invite & Membership Lifecycle Fix
# =====================================================
# This script applies the critical database migration
# required for the world-class invite/membership system.
#
# It enables:
# - Reliable realtime DELETE delivery (no more lingering banners)
# - Symmetric permissions (either side can revoke/decline/exit)
# - Atomic SECURITY DEFINER RPCs for all terminating actions
# - Self-service "Leave team" functionality
#
# Usage:
#   1. Make sure you have run `supabase link` (or set SUPABASE_DB_URL)
#   2. Run this script from the project root in PowerShell:
#        .\scripts\apply-invite-lifecycle-fix.ps1
#
# Requirements:
#   - Supabase CLI (recommended)   OR
#   - psql in your PATH            OR
#   - Manual run via Supabase SQL Editor
# =====================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Bad Ass Tasks - Membership Lifecycle Migration ===" -ForegroundColor Cyan
Write-Host ""

$SqlFile = "supabase/fix-invite-lifecycle-rls-and-rpcs.sql"

if (-not (Test-Path $SqlFile)) {
    Write-Host "ERROR: Could not find $SqlFile" -ForegroundColor Red
    Write-Host "Please run this script from the project root." -ForegroundColor Red
    exit 1
}

# Try Supabase CLI first (best experience)
$supabase = Get-Command supabase -ErrorAction SilentlyContinue

if ($supabase) {
    Write-Host "Supabase CLI detected. Attempting to execute migration..." -ForegroundColor Green
    Write-Host ""

    try {
        & supabase db execute --file $SqlFile
        Write-Host ""
        Write-Host "Migration applied successfully via Supabase CLI." -ForegroundColor Green
        Write-Host "You can now test the full invite lifecycle flows." -ForegroundColor Green
        exit 0
    }
    catch {
        Write-Host "Supabase CLI execution failed." -ForegroundColor Yellow
        Write-Host "Falling back to manual instructions..." -ForegroundColor Yellow
    }
}

# Fallback: Check for psql
$psql = Get-Command psql -ErrorAction SilentlyContinue

if ($psql -and $env:SUPABASE_DB_URL) {
    Write-Host "psql detected with SUPABASE_DB_URL environment variable." -ForegroundColor Green
    Write-Host "Executing SQL via psql..." -ForegroundColor Green
    Write-Host ""

    try {
        Get-Content $SqlFile | & psql $env:SUPABASE_DB_URL
        Write-Host ""
        Write-Host "Migration applied successfully via psql." -ForegroundColor Green
        exit 0
    }
    catch {
        Write-Host "psql execution failed." -ForegroundColor Red
    }
}

# Final fallback - give clear manual instructions
Write-Host ""
Write-Host "Could not auto-apply the migration automatically." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please apply the migration manually using one of these methods:" -ForegroundColor White
Write-Host ""
Write-Host "RECOMMENDED (Easiest):" -ForegroundColor Cyan
Write-Host "  1. Go to your Supabase Dashboard" -ForegroundColor White
Write-Host "  2. Open the SQL Editor" -ForegroundColor White
Write-Host "  3. Copy the entire contents of:" -ForegroundColor White
Write-Host "     $SqlFile" -ForegroundColor Yellow
Write-Host "  4. Paste and click Run" -ForegroundColor White
Write-Host ""
Write-Host "Alternative (Supabase CLI):" -ForegroundColor Cyan
Write-Host "  supabase db execute --file $SqlFile" -ForegroundColor White
Write-Host ""
Write-Host "Alternative (Direct psql):" -ForegroundColor Cyan
Write-Host "  Get your connection string from Dashboard > Database > Connect" -ForegroundColor White
Write-Host "  Then run:" -ForegroundColor White
Write-Host "  psql 'your-connection-string' -f $SqlFile" -ForegroundColor White
Write-Host ""
Write-Host "After running the migration, restart your dev server and test the flows." -ForegroundColor Green
Write-Host ""

exit 0