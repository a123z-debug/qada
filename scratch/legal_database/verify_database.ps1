[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "C:\Users\PC\.gemini\antigravity\scratch\legal_database"
$indexPath = Join-Path $baseDir "index.json"
$readmePath = Join-Path $baseDir "README.md"
$tplDir = Join-Path $baseDir "_templates\system_template"

Write-Host "=================================================="
Write-Host "    Osool Al-Qada - Legal Database Verification   "
Write-Host "=================================================="

$passCount = 0
$failCount = 0

function Assert-Condition($condition, $message) {
    if ($condition) {
        Write-Host "[PASS] $message" -ForegroundColor Green
        $script:passCount++
    } else {
        Write-Host "[FAIL] $message" -ForegroundColor Red
        $script:failCount++
    }
}

# 1. Check Root Documents
Assert-Condition (Test-Path $readmePath) "Root README.md exists"
Assert-Condition (Test-Path $indexPath) "Master index.json exists"

# 2. Check Templates
Assert-Condition (Test-Path $tplDir) "Templates directory exists"
$tplFiles = Get-ChildItem -Path $tplDir
Assert-Condition ($tplFiles.Count -eq 5) "Templates directory contains 5 files (Found: $($tplFiles.Count))"

# 3. Parse and Validate index.json
$indexData = Get-Content -Raw -Encoding UTF8 -Path $indexPath | ConvertFrom-Json
Assert-Condition ($null -ne $indexData) "index.json is valid JSON"
Assert-Condition ($indexData.systems.Count -ge 20) "Total systems registered: $($indexData.systems.Count)"

# 4. Check Categories and Subsystems
$adminCount = 0
$generalCount = 0
$penalCount = 0

foreach ($sys in $indexData.systems) {
    $sysPath = Join-Path $baseDir $sys.relative_path
    $exists = Test-Path $sysPath
    Assert-Condition $exists "System directory exists: $($sys.name_ar)"
    
    if ($exists) {
        $files = Get-ChildItem -Path $sysPath
        Assert-Condition ($files.Count -eq 5) "System $($sys.id) contains exactly 5 standard files (Found: $($files.Count))"
        
        # Test metadata.json
        $metaPath = Join-Path $sysPath "metadata.json"
        $metaJson = Get-Content -Raw -Encoding UTF8 -Path $metaPath | ConvertFrom-Json
        Assert-Condition ($metaJson.id -eq $sys.id) "Metadata id matches for $($sys.id)"
    }
    
    if ($sys.relative_path -like "01_*") { $adminCount++ }
    if ($sys.relative_path -like "02_*") { $generalCount++ }
    if ($sys.relative_path -like "03_*") { $penalCount++ }
}

Write-Host "--------------------------------------------------"
Write-Host "Administrative Systems (إدارية): $adminCount"
Write-Host "General Systems (عامة):          $generalCount"
Write-Host "Penal Systems (جزائية):          $penalCount"
Write-Host "--------------------------------------------------"
Write-Host "Verification Summary: PASS=$passCount, FAIL=$failCount"
Write-Host "=================================================="

if ($failCount -eq 0) {
    Write-Host "ALL CHECKS PASSED SUCCESSFULLY!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SOME CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
