param(
    [string]$Entrada = (Join-Path $PSScriptRoot 'BICICLETERO 2026.xlsx'),
    [string]$SalidaJson = (Join-Path $PSScriptRoot 'bicicleteros.json'),
    [string]$SalidaJs = (Join-Path $PSScriptRoot 'bicicleteros-data.js')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipText {
    param(
        [System.IO.Compression.ZipArchive]$Zip,
        [string]$Nombre
    )

    $entry = $Zip.GetEntry($Nombre)
    if ($null -eq $entry) {
        throw ('No se encontró ' + $Nombre + ' dentro del archivo XLSX.')
    }

    $reader = [System.IO.StreamReader]::new($entry.Open())
    try {
        return $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }
}

function Normalize-Text {
    param([AllowNull()][object]$Valor)

    if ($null -eq $Valor) { return '' }
    return ([string]$Valor -replace '\s+', ' ').Trim()
}

function Normalize-Identifier {
    param([AllowNull()][object]$Valor)

    $text = Normalize-Text $Valor
    if ($text -match '^(-?\d+)\.0+$') {
        return $Matches[1]
    }
    return $text
}

$resolvedInput = (Resolve-Path -LiteralPath $Entrada).Path
$imagesDirectory = Join-Path $PSScriptRoot 'images'
$zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedInput)

try {
    [xml]$sharedStringsXml = Get-ZipText -Zip $zip -Nombre 'xl/sharedStrings.xml'
    [xml]$sheetXml = Get-ZipText -Zip $zip -Nombre 'xl/worksheets/sheet1.xml'

    $sharedStrings = @()
    foreach ($item in $sharedStringsXml.sst.si) {
        $parts = @($item.SelectNodes('.//*[local-name()=''t'']') | ForEach-Object { $_.InnerText })
        $sharedStrings += ($parts -join '')
    }

    $records = @()
    foreach ($row in $sheetXml.worksheet.sheetData.row) {
        $rowNumber = [int]$row.GetAttribute('r')
        if ($rowNumber -eq 1) { continue }

        $values = @{}
        foreach ($cell in $row.c) {
            $column = ([string]$cell.GetAttribute('r') -replace '\d', '')
            $type = [string]$cell.GetAttribute('t')
            $valueNode = $cell.SelectSingleNode('./*[local-name()=''v'']')
            $value = if ($null -eq $valueNode) { '' } else { [string]$valueNode.InnerText }

            if ($type -eq 's' -and $value -ne '') {
                $value = $sharedStrings[[int]$value]
            }
            elseif ($type -eq 'b') {
                $value = if ([int]$value -eq 1) { 'true' } else { 'false' }
            }
            elseif ($type -eq 'inlineStr') {
                $inlineNode = $cell.SelectSingleNode('.//*[local-name()=''t'']')
                $value = if ($null -eq $inlineNode) { '' } else { [string]$inlineNode.InnerText }
            }

            $values[$column] = $value
        }

        $id = Normalize-Identifier $values['A']
        if ([string]::IsNullOrWhiteSpace($id)) { continue }

        $imageFileName = ($id -replace '\.', '-') + '.jpeg'
        $localImagePath = Join-Path $imagesDirectory $imageFileName
        $hasPhoto = Test-Path -LiteralPath $localImagePath -PathType Leaf
        $imageUrl = if ($hasPhoto) {
            './images/' + $imageFileName
        }
        else {
            './images/bicicleta-default.svg'
        }

        $checkValue = (Normalize-Text $values['G']).ToLowerInvariant()

        $records += [pscustomobject][ordered]@{
            id          = $id
            zona        = Normalize-Text $values['B']
            dpto        = Normalize-Identifier $values['C']
            nombre      = Normalize-Text $values['D']
            marca       = Normalize-Text $values['E']
            color       = Normalize-Text $values['F']
            estado      = $checkValue -in @('true', '1', 'si', 'sí', 'x')
            imagen      = if ($hasPhoto) { $imageFileName } else { 'bicicleta-default.svg' }
            imageUrl    = $imageUrl
            hasPhoto    = $hasPhoto
            observacion = Normalize-Text $values['I']
        }
    }

    $sourceFile = Get-Item -LiteralPath $resolvedInput
    $payload = [pscustomobject][ordered]@{
        schemaVersion = 3
        origen        = $sourceFile.Name
        actualizado   = $sourceFile.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss')
        total         = $records.Count
        registros     = $records
    }

    $json = $payload | ConvertTo-Json -Depth 6
    $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($SalidaJson, $json + [Environment]::NewLine, $utf8WithoutBom)
    [System.IO.File]::WriteAllText(
        $SalidaJs,
        'window.BICICLETEROS_DATA = ' + $json + ';' + [Environment]::NewLine,
        $utf8WithoutBom
    )

    $localImageCount = @($records | Where-Object hasPhoto).Count
    $defaultImageCount = $records.Count - $localImageCount
    Write-Host ('OK: ' + $records.Count + ' registros exportados.')
    Write-Host ('Fotografías locales: ' + $localImageCount)
    Write-Host ('Imágenes predeterminadas: ' + $defaultImageCount)
    Write-Host ('JSON: ' + $SalidaJson)
    Write-Host ('JS:   ' + $SalidaJs)
}
finally {
    $zip.Dispose()
}
