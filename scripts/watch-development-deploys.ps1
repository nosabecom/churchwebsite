[CmdletBinding()]
param(
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
$StackId = if ($env:SANITY_BLUEPRINT_STACK_ID) {
    $env:SANITY_BLUEPRINT_STACK_ID
} else {
    "ST-ggvrshfmum"
}
$FunctionName = "route-site-deploy"
$RepositoryRoot = Split-Path -Parent $PSScriptRoot

if ($Help) {
    @"
Watch the newsletter-routing Function in the Sanity development stack.

Usage:
  pnpm blueprint:logs:development:windows

The command supplies the required Blueprint project, dataset, and development
stack automatically. Press Ctrl+C to stop watching.
"@ | Write-Host
    exit 0
}

if ($Dataset -ne "development") {
    throw "Refusing to watch a non-development dataset: $Dataset"
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

Write-Host "Watching $FunctionName in $ProjectId.$Dataset. Press Ctrl+C to stop."

$PreviousProjectId = $env:SANITY_PROJECT_ID
$PreviousDataset = $env:SANITY_DATASET
try {
    $env:SANITY_PROJECT_ID = $ProjectId
    $env:SANITY_DATASET = $Dataset
    Push-Location $RepositoryRoot
    try {
        & npx --yes sanity@latest functions logs `
            $FunctionName `
            --stack $StackId `
            --watch `
            --utc
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    } finally {
        Pop-Location
    }
} finally {
    $env:SANITY_PROJECT_ID = $PreviousProjectId
    $env:SANITY_DATASET = $PreviousDataset
}
