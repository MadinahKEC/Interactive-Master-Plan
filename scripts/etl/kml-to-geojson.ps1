<#
  KEC GIS Platform — ETL: KMZ -> GeoJSON
  ---------------------------------------------------------------------------
  Reads the Google Earth KMZ (a zip containing doc.kml), parses every Placemark
  (plot / بلوت), extracts its attributes and polygon geometry, and writes a
  clean GeoJSON FeatureCollection to data/plots.geojson.

  This is the single source of truth the whole platform is seeded from.
  Idempotent: safe to re-run. Requires only Windows PowerShell (no Node/Python).

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts/etl/kml-to-geojson.ps1 `
        -Kmz "C:\Users\shamdan\Desktop\GIS KEC.kmz" `
        -Out ".\data\plots.geojson"
#>
[CmdletBinding()]
param(
  [string]$Kmz = "C:\Users\shamdan\Desktop\GIS KEC.kmz",
  [string]$Out = ".\data\plots.geojson"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Decode-Html([string]$s) {
  if ($null -eq $s) { return $null }
  $s = $s -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"' -replace '&#39;', "'"
  return $s.Trim()
}

# --- Sector lookup from the plot-code prefix (N/S/C/E/W) ------------------
$SectorMap = @{ 'N' = 'North'; 'S' = 'South'; 'C' = 'Central'; 'E' = 'East'; 'W' = 'West' }

Write-Host "Reading KMZ: $Kmz"
if (-not (Test-Path $Kmz)) { throw "KMZ not found: $Kmz" }

# --- Read doc.kml out of the KMZ zip -------------------------------------
$zip = [System.IO.Compression.ZipFile]::OpenRead($Kmz)
try {
  $entry = $zip.Entries | Where-Object { $_.FullName -like '*.kml' } | Select-Object -First 1
  if (-not $entry) { throw "No .kml entry inside KMZ" }
  $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
  $kml = $reader.ReadToEnd()
  $reader.Dispose()
} finally {
  $zip.Dispose()
}

Write-Host ("KML length: {0:N0} chars" -f $kml.Length)

# --- Split into Placemark blocks -----------------------------------------
$pmRegex = [regex]'(?s)<Placemark\b.*?</Placemark>'
$placemarks = $pmRegex.Matches($kml)
Write-Host ("Placemarks found: {0}" -f $placemarks.Count)

# Helper: pull a labelled value out of the description HTML table
function Get-Field([string]$block, [string]$label) {
  $m = [regex]::Match($block, "<td>\s*$([regex]::Escape($label))\s*</td>\s*<td[^>]*>(.*?)</td>", 'Singleline')
  if ($m.Success) { return (Decode-Html $m.Groups[1].Value) }
  return $null
}
function To-Num($v) {
  if ($null -eq $v -or $v -eq '') { return $null }
  $d = 0.0
  if ([double]::TryParse($v, [ref]$d)) { return $d }
  return $null
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('{"type":"FeatureCollection","name":"KEC_plots","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},"features":[')

$count = 0
$landUseSet = @{}
foreach ($pm in $placemarks) {
  $block = $pm.Value

  # name = first <name> in the placemark
  $nameM = [regex]::Match($block, '<name>(.*?)</name>', 'Singleline')
  $name  = if ($nameM.Success) { Decode-Html $nameM.Groups[1].Value } else { $null }
  if (-not $name) { continue }

  $landUse  = Get-Field $block 'Land Use'
  $gfa      = To-Num (Get-Field $block 'GFA')
  $area     = To-Num (Get-Field $block 'Area')
  $floors   = To-Num (Get-Field $block 'Floors')
  $height   = To-Num (Get-Field $block 'Height')
  $coverage = To-Num (Get-Field $block 'Coverage')
  $far      = To-Num (Get-Field $block 'FAR')

  $styleM   = [regex]::Match($block, '<styleUrl>#(.*?)</styleUrl>')
  $style    = if ($styleM.Success) { $styleM.Groups[1].Value } else { $null }

  $prefix   = ($name.Substring(0,1)).ToUpper()
  $sector   = if ($SectorMap.ContainsKey($prefix)) { $SectorMap[$prefix] } else { 'Other' }

  if ($landUse) { $landUseSet[$landUse] = $true }

  # --- geometry: every <coordinates> block becomes one ring --------------
  $coordMatches = [regex]::Matches($block, '(?s)<coordinates>(.*?)</coordinates>')
  $rings = New-Object System.Collections.ArrayList
  foreach ($cm in $coordMatches) {
    $raw = $cm.Groups[1].Value.Trim()
    if ($raw -eq '') { continue }
    $pts = New-Object System.Collections.ArrayList
    foreach ($triple in ($raw -split '\s+')) {
      if ($triple -eq '') { continue }
      $parts = $triple -split ','
      if ($parts.Count -lt 2) { continue }
      $lon = [double]$parts[0]; $lat = [double]$parts[1]
      [void]$pts.Add(('[{0},{1}]' -f $lon, $lat))
    }
    if ($pts.Count -ge 4) { [void]$rings.Add('[' + ($pts -join ',') + ']') }
  }
  if ($rings.Count -eq 0) { continue }

  if ($rings.Count -eq 1) {
    $geom = '{"type":"Polygon","coordinates":[' + $rings[0] + ']}'
  } else {
    # MultiPolygon: each ring is its own single-ring polygon
    $polys = @()
    foreach ($r in $rings) { $polys += ('[' + $r + ']') }
    $geom = '{"type":"MultiPolygon","coordinates":[' + ($polys -join ',') + ']}'
  }

  # --- properties (JSON) -------------------------------------------------
  function J($v) { if ($null -eq $v) { 'null' } else { '"' + ($v -replace '\\','\\' -replace '"','\"') + '"' } }
  function N($v) { if ($null -eq $v) { 'null' } else { [string]([double]$v) } }

  $props = '{' +
    '"code":' + (J $name) + ',' +
    '"name":' + (J $name) + ',' +
    '"land_use":' + (J $landUse) + ',' +
    '"sector":' + (J $sector) + ',' +
    '"gfa":' + (N $gfa) + ',' +
    '"area":' + (N $area) + ',' +
    '"floors":' + (N $floors) + ',' +
    '"height":' + (N $height) + ',' +
    '"coverage":' + (N $coverage) + ',' +
    '"far":' + (N $far) + ',' +
    '"style":' + (J $style) +
  '}'

  if ($count -gt 0) { [void]$sb.Append(',') }
  [void]$sb.Append('{"type":"Feature","properties":' + $props + ',"geometry":' + $geom + '}')
  $count++
}

[void]$sb.Append(']}')

$outDir = Split-Path -Parent $Out
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
[System.IO.File]::WriteAllText($Out, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host ("Features written : {0}" -f $count)
Write-Host ("Land-use classes : {0}" -f $landUseSet.Count)
Write-Host ("Output           : {0}" -f (Resolve-Path $Out))
Write-Host ("File size        : {0:N0} bytes" -f (Get-Item $Out).Length)
