param(
    [string]$Remote = "origin"
)

$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
Push-Location $projectRoot

try {
    git add docs/PROJECT_CONTEXT.md docs/NOW.md docs/SESSION_NOTES.md
    git add -A

    $branch = git rev-parse --abbrev-ref HEAD
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $commitMessage = "Session notes update - $timestamp"

    $changes = git status --porcelain
    if (-not [string]::IsNullOrWhiteSpace($changes)) {
        git commit -m "$commitMessage"
    } else {
        Write-Host "No changes to commit." -ForegroundColor Yellow
    }

    git push $Remote $branch
    Write-Host "Pushed branch '$branch' to $Remote." -ForegroundColor Green
}
finally {
    Pop-Location
}
