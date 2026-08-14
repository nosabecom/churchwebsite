[CmdletBinding()]
param(
    [ValidateRange(2, 60)]
    [int]$IntervalSeconds = 3,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectId = if ($env:SANITY_PROJECT_ID) {
    $env:SANITY_PROJECT_ID
} elseif ($env:SANITY_STUDIO_PROJECT_ID) {
    $env:SANITY_STUDIO_PROJECT_ID
} else {
    "qd5xjyx2"
}
$Dataset = if ($env:SANITY_DATASET) {
    $env:SANITY_DATASET
} elseif ($env:SANITY_STUDIO_DATASET) {
    $env:SANITY_STUDIO_DATASET
} else {
    "development"
}

if ($Help) {
    @"
Watch Church Main's durable deployment state in the Sanity development dataset.

Usage:
  pnpm blueprint:watch:development:windows
  .\scripts\watch-development-deploys.ps1 -IntervalSeconds 5

This polls Content Lake instead of Sanity's streaming-log socket, which can exit
unexpectedly on Windows. Press Ctrl+C to stop watching.
"@ | Write-Host
    exit 0
}

if ($Dataset -ne "development") {
    throw "Refusing to watch a non-development dataset: $Dataset"
}
if ($ProjectId -notmatch "^[a-z0-9]+$") {
    throw "SANITY_PROJECT_ID is not a valid project ID."
}

$Query = '*[_id == "deploy.state-churchMain"][0]{_rev,status,lastOperation,lastDocumentId,lastTriggeredAt,lastSucceededAt,failedAt,lastError,responseStatus}'
$EncodedQuery = [Uri]::EscapeDataString($Query)
$QueryUrl = "https://${ProjectId}.api.sanity.io/v2026-08-14/data/query/${Dataset}?query=${EncodedQuery}"
$LastSnapshot = $null

function Get-StateValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$State,
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$Fallback = "-"
    )

    $Property = $State.PSObject.Properties[$Name]
    if ($null -eq $Property -or $null -eq $Property.Value -or $Property.Value -eq "") {
        return $Fallback
    }
    return $Property.Value
}

Write-Host "Watching Church Main deployment state in $ProjectId.$Dataset every $IntervalSeconds seconds."
Write-Host "Press Ctrl+C to stop."

while ($true) {
    try {
        $Response = Invoke-RestMethod `
            -Uri $QueryUrl `
            -Method Get `
            -TimeoutSec 15 `
            -Headers @{ "User-Agent" = "churchwebsite-development-deploy-watcher" }
        $State = $Response.result
        $Snapshot = if ($null -eq $State) {
            "<none>"
        } else {
            $State | ConvertTo-Json -Compress -Depth 4
        }

        if ($Snapshot -ne $LastSnapshot) {
            $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            if ($null -eq $State) {
                Write-Host "[$Timestamp] No Church Main deployment has run yet. Publish an issue to test it."
            } else {
                $Status = Get-StateValue -State $State -Name "status"
                $Operation = Get-StateValue -State $State -Name "lastOperation"
                $DocumentId = Get-StateValue -State $State -Name "lastDocumentId"
                $ResponseStatus = Get-StateValue -State $State -Name "responseStatus"
                Write-Host "[$Timestamp] status=$Status operation=$Operation document=$DocumentId hookHttp=$ResponseStatus"

                $LastError = Get-StateValue -State $State -Name "lastError" -Fallback ""
                if ($LastError) {
                    Write-Warning $LastError
                }
            }
            $LastSnapshot = $Snapshot
        }
    } catch {
        $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Warning "[$Timestamp] Could not read deployment state; retrying: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $IntervalSeconds
}
