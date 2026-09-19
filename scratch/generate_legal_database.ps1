[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$jsonPath = "C:\Users\PC\.gemini\antigravity\scratch\database_definitions.json"
$baseDir = "C:\Users\PC\.gemini\antigravity\scratch\legal_database"

Write-Host "Reading database definitions from $jsonPath ..."
$rawJson = Get-Content -Raw -Encoding UTF8 -Path $jsonPath
$data = $rawJson | ConvertFrom-Json

function Ensure-Dir($path) {
    if (-not (Test-Path $path)) {
        [System.IO.Directory]::CreateDirectory($path) | Out-Null
    }
}

function Save-Utf8File($path, $text) {
    $dir = [System.IO.Path]::GetDirectoryName($path)
    Ensure-Dir $dir
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $text, $utf8WithoutBom)
}

Ensure-Dir $baseDir

# 1. Root README.md
Write-Host "Writing root README.md ..."
Save-Utf8File (Join-Path $baseDir "README.md") $data.root_readme

# 2. Templates
Write-Host "Writing template files ..."
$tplDir = Join-Path $baseDir "_templates\system_template"
Ensure-Dir $tplDir
$docNames = $data.doc_filenames
Save-Utf8File (Join-Path $tplDir $docNames[0]) $data.templates.system_md
Save-Utf8File (Join-Path $tplDir $docNames[1]) $data.templates.exec_md
Save-Utf8File (Join-Path $tplDir $docNames[2]) $data.templates.amend_md
Save-Utf8File (Join-Path $tplDir $docNames[3]) $data.templates.judicial_md
Save-Utf8File (Join-Path $tplDir "metadata.json") $data.templates.metadata_json

# 3. Systems
$indexList = @()
$totalSystems = $data.systems.Count
Write-Host "Processing $totalSystems legal systems ..."

for ($i = 0; $i -lt $totalSystems; $i++) {
    $sys = $data.systems[$i]
    $categoryRel = $sys.category_path.Replace('/', '\')
    $sysDirName = $sys.system_dir
    $sysFullPath = Join-Path $baseDir (Join-Path $categoryRel $sysDirName)
    
    Ensure-Dir $sysFullPath
    Write-Host "[$($i+1)/$totalSystems] ID: $($sys.id) -> $sysFullPath"
    
    # Save 4 core docs
    Save-Utf8File (Join-Path $sysFullPath $docNames[0]) $sys.law_content
    Save-Utf8File (Join-Path $sysFullPath $docNames[1]) $sys.exec_content
    Save-Utf8File (Join-Path $sysFullPath $docNames[2]) $sys.amend_content
    Save-Utf8File (Join-Path $sysFullPath $docNames[3]) $sys.judicial_content
    
    # Save metadata.json
    $metaObj = [ordered]@{
        id = $sys.id
        name_ar = $sys.name_ar
        name_en = $sys.name_en
        category = $sys.category
        sub_category = $sys.sub_category
        royal_decree = $sys.royal_decree
        cabinet_resolution = $sys.cabinet_resolution
        issue_date_hijri = $sys.issue_date_hijri
        effective_date_hijri = $sys.effective_date_hijri
        status = $sys.status
        supervising_authority = $sys.supervising_authority
        relative_path = "$categoryRel\$sysDirName"
        tags = $sys.tags
    }
    
    $metaJson = $metaObj | ConvertTo-Json -Depth 5
    Save-Utf8File (Join-Path $sysFullPath "metadata.json") $metaJson
    
    $indexList += $metaObj
}

# 4. Master index.json
Write-Host "Writing master index.json ..."
$masterIndex = [ordered]@{
    platform = $data.platform
    database_name = $data.database_name
    version = $data.version
    created_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    total_systems_count = $indexList.Count
    categories = $data.categories
    systems = $indexList
}

$masterJsonText = $masterIndex | ConvertTo-Json -Depth 6
Save-Utf8File (Join-Path $baseDir "index.json") $masterJsonText

Write-Host "Done! Legal database constructed successfully with $($indexList.Count) systems."
