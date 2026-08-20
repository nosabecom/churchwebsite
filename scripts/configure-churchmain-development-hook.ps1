[CmdletBinding()]
param(
    [switch]$Yes,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$FunctionName = "route-site-deploy"
$HookKey = "CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL"
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
$StackId = if ($env:SANITY_BLUEPRINT_STACK_ID) {
    $env:SANITY_BLUEPRINT_STACK_ID
} else {
    "ST-ggvrshfmum"
}
$RepositoryRoot = Split-Path -Parent $PSScriptRoot

if ($Help) {
    @"
Configure the Church Main Vercel deploy hook on the Sanity development Function.

Usage:
  pnpm blueprint:configure:churchmain:windows

The script prompts for the hook as a secure string. Alternatively, set
CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL before running it. The secret is sent directly
to Sanity and is never written to the repository.
"@ | Write-Host
    exit 0
}

if ($Dataset -ne "development") {
    throw "Refusing to configure a non-development dataset: $Dataset"
}
if ($ProjectId -notmatch "^[a-z0-9]+$") {
    throw "SANITY_PROJECT_ID is not a valid project ID."
}
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw "npx is required but was not found."
}
if (-not (Test-Path (Join-Path $RepositoryRoot "sanity.blueprint.ts"))) {
    throw "Could not find sanity.blueprint.ts beside this script's repository."
}

$HookUrl = $env:CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL
if (-not $HookUrl) {
    $SecureHook = Read-Host "Church Main Vercel deploy hook URL" -AsSecureString
    $HookPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureHook)
    try {
        $HookUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($HookPointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($HookPointer)
    }
}

if ($HookUrl -notmatch "^https://api\.vercel\.com/v1/integrations/deploy/[^/?]+/[^/?]+(\?.*)?$") {
    throw "The supplied value is not a valid Vercel deploy-hook URL."
}

Write-Host "Target project: $ProjectId"
Write-Host "Target dataset: $Dataset"
Write-Host "Target stack:   $StackId"
Write-Host "Function key:   $HookKey"

if (-not $Yes) {
    $Confirmation = Read-Host "Install this secret in the development Function? [y/N]"
    if ($Confirmation -notmatch "^[Yy]$") {
        Write-Host "No changes were made."
        exit 0
    }
}

$PreviousProjectId = $env:SANITY_PROJECT_ID
$PreviousDataset = $env:SANITY_DATASET
try {
    $env:SANITY_PROJECT_ID = $ProjectId
    $env:SANITY_DATASET = $Dataset
    Push-Location $RepositoryRoot
    try {
        & npx --yes sanity@latest functions env add `
            $FunctionName `
            $HookKey `
            $HookUrl `
            --stack $StackId
        if ($LASTEXITCODE -ne 0) {
            throw "Sanity failed to configure the Function environment."
        }

        Write-Host ""
        Write-Host "Configured Function environment keys (values remain hidden):"
        & npx --yes sanity@latest functions env list $FunctionName --stack $StackId
        if ($LASTEXITCODE -ne 0) {
            throw "Sanity failed to list the Function environment keys."
        }
    } finally {
        Pop-Location
    }
} finally {
    $env:SANITY_PROJECT_ID = $PreviousProjectId
    $env:SANITY_DATASET = $PreviousDataset
    $HookUrl = $null
    $SecureHook = $null
}
