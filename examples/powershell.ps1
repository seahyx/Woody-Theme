#Requires -Version 7.2
# powershell.ps1: sawmill batch grading report for the fictional Woody Lumber Yard, used to preview the Woody theme's PowerShell highlighting.
# Demonstrates: #Requires, comment-based help, an advanced function with [CmdletBinding()] and validated params, begin/process/end, a class and an enum, pipelines, hashtables and [pscustomobject], splatting, here-strings with $() subexpressions, -match and $Matches, switch -Regex, try/catch/finally, Write-Verbose, $PSScriptRoot and the -f format operator.

using namespace System.Collections.Generic

Set-StrictMode -Version Latest

enum PlankGrade {
    Prime = 1
    Select = 2
    Common = 3
    Reject = 99
}

class Plank {
    [string] $Id
    [string] $Species
    [double] $LengthM
    [double] $MoisturePct
    [int] $KnotCount
    hidden [datetime] $GradedAt

    Plank([string] $id, [string] $species, [double] $lengthM) {
        $this.Id = $id
        $this.Species = $species
        $this.LengthM = $lengthM
        $this.GradedAt = [datetime]::UtcNow
    }

    # Grading rules: wet boards are always rejected; otherwise knots decide.
    [PlankGrade] GetGrade() {
        if ($this.MoisturePct -gt 20.0) {
            return [PlankGrade]::Reject
        }
        if ($this.KnotCount -eq 0) {
            return [PlankGrade]::Prime
        }
        elseif ($this.KnotCount -le 3) {
            return [PlankGrade]::Select
        }
        return [PlankGrade]::Common
    }

    [string] ToString() {
        return '{0} ({1}, {2:N2} m) -> {3}' -f $this.Id, $this.Species, $this.LengthM, $this.GetGrade()
    }

    static [Plank] Parse([string] $line) {
        $parts = $line -split ','
        $plank = [Plank]::new($parts[0].Trim(), $parts[1].Trim(), [double]$parts[2])
        $plank.MoisturePct = [double]$parts[3]
        $plank.KnotCount = [int]$parts[4]
        return $plank
    }
}

function Get-BatchReport {
    <#
    .SYNOPSIS
        Grades every plank in one or more sawmill batch files.

    .DESCRIPTION
        Reads CSV batch exports (id, species, length, moisture, knots), grades each plank with the Woody rules and emits one summary object per batch. Batch IDs must look like SM-2026-OK.

    .PARAMETER Path
        One or more batch CSV files. Accepts pipeline input from Get-ChildItem.

    .PARAMETER Species
        Only grade planks of this species.

    .PARAMETER MinLength
        Ignore offcuts shorter than this many metres.

    .EXAMPLE
        Get-ChildItem .\batches -Filter *.csv | Get-BatchReport -Species Oak -Verbose

    .EXAMPLE
        Get-BatchReport -Path .\SM-2026-OK.csv -MinLength 1.5 | Format-Table
    #>
    [CmdletBinding()]
    [OutputType([pscustomobject])]
    param(
        [Parameter(Mandatory, ValueFromPipeline, ValueFromPipelineByPropertyName)]
        [Alias('FullName')]
        [string[]] $Path,

        [ValidateSet('Oak', 'Pine', 'Birch', 'Fir')]
        [string] $Species,

        [ValidateRange(0.1, 12.0)]
        [double] $MinLength = 0.5,

        [switch] $IncludeRejects
    )

    begin {
        $latin = @{
            Oak   = 'Quercus robur'
            Pine  = 'Pinus sylvestris'
            Birch = 'Betula pendula'
            Fir   = 'Pseudotsuga menziesii'
        }
        $seen = [List[string]]::new()
        Write-Verbose "Grading from $PSScriptRoot with minimum length $MinLength m"
    }

    process {
        foreach ($file in $Path) {
            $name = [System.IO.Path]::GetFileNameWithoutExtension($file)

            # Batch IDs encode the year and a two-letter species code.
            if ($name -notmatch '^SM-(?<year>\d{4})-(?<code>[A-Z]{2})$') {
                Write-Warning "Skipping '$name': not a batch file."
                continue
            }
            $year = [int]$Matches.year
            $code = $Matches['code']

            $planks = [List[Plank]]::new()
            $reader = $null
            try {
                $reader = [System.IO.StreamReader]::new($file)
                while ($null -ne ($line = $reader.ReadLine())) {
                    switch -Regex ($line) {
                        '^\s*(#|$)' { continue }
                        '^id,' { continue }
                        default { $planks.Add([Plank]::Parse($line)) }
                    }
                }
            }
            catch [System.IO.FileNotFoundException] {
                Write-Error -Message "Batch file missing: $file" -Category ObjectNotFound
                continue
            }
            catch {
                throw "Failed to parse ${file}: $($_.Exception.Message)"
            }
            finally {
                if ($reader) { $reader.Dispose() }
            }

            $graded = $planks |
                Where-Object { $_.LengthM -ge $MinLength -and (-not $Species -or $_.Species -eq $latin[$Species]) } |
                Where-Object { $IncludeRejects -or $_.GetGrade() -ne [PlankGrade]::Reject } |
                Sort-Object -Property @{ Expression = { $_.GetGrade() } }, LengthM -Descending |
                Select-Object Id, Species, LengthM, @{ Name = 'Grade'; Expression = { $_.GetGrade() } }

            $seen.Add($name)
            [pscustomobject]@{
                PSTypeName = 'Woody.BatchReport'
                Batch      = $name
                Year       = $year
                Code       = $code
                Planks     = @($graded).Count
                VolumeM3   = [math]::Round(($graded | Measure-Object -Property LengthM -Sum).Sum * 0.025, 3)
                Prime      = @($graded | Where-Object Grade -EQ ([PlankGrade]::Prime)).Count
            }
        }
    }

    end {
        Write-Verbose ('Processed {0} batch(es): {1}' -f $seen.Count, ($seen -join ', '))
    }
}

# --- Script body -------------------------------------------------------------

$reportParams = @{
    Species        = 'Oak'
    MinLength      = 1.2
    IncludeRejects = $true
    Verbose        = $VerbosePreference -eq 'Continue'
}

$reports = Get-ChildItem -Path (Join-Path $PSScriptRoot 'batches') -Filter 'SM-*.csv' -File -ErrorAction SilentlyContinue |
    Get-BatchReport @reportParams

$total = ($reports | Measure-Object -Property VolumeM3 -Sum).Sum
$generated = Get-Date -Format 'yyyy-MM-dd HH:mm'

$summary = @"
Woody Lumber Yard: grading summary
Generated: $generated by $env:USERNAME
Batches:   $($reports.Count)
Volume:    $('{0:N3}' -f $total) m`u{00B3}
Top batch: $(($reports | Sort-Object VolumeM3 -Descending | Select-Object -First 1).Batch)
"@

$footer = @'
Grades: Prime (no knots) > Select (<= 3 knots) > Common > Reject (moisture > 20%).
Literal text: $notAVariable and $(not a subexpression) stay as typed.
'@

Write-Output $summary, $footer
$reports | Export-Csv -Path "$PSScriptRoot\report-$(Get-Date -Format yyyyMMdd).csv" -NoTypeInformation -Encoding utf8
