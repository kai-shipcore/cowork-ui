[CmdletBinding()]
param(
  [string]$RemoteServer = '144.24.40.252',
  [string]$RemoteUser = 'coverland',
  [string]$Branch = 'main',
  [string]$PublicUrl = 'http://144.24.40.252',
  [string]$IdentityFile = '',
  [switch]$SkipInstall,
  [switch]$SkipPull,
  [switch]$AllowDirty
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory)]
    [string]$Command,
    [Parameter(Mandatory)]
    [string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Command"
  }
}

if ($RemoteServer -notmatch '^[a-zA-Z0-9.-]+$') {
  throw 'RemoteServer contains unsupported characters.'
}
if ($RemoteUser -notmatch '^[a-z_][a-z0-9_-]*$') {
  throw 'RemoteUser contains unsupported characters.'
}

$userProfilePath = [Environment]::GetFolderPath('UserProfile')
if ([string]::IsNullOrWhiteSpace($IdentityFile)) {
  $IdentityFile = Join-Path $userProfilePath '.ssh\coverland_workbench_deploy'
}
$IdentityFile = [System.IO.Path]::GetFullPath($IdentityFile)

if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) {
  throw "SSH private key was not found: $IdentityFile"
}

foreach ($requiredCommand in @('git', 'pnpm', 'ssh', 'scp')) {
  if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
    throw "Required command was not found: $requiredCommand"
  }
}

$sshArguments = @(
  '-i', $IdentityFile,
  '-o', 'BatchMode=yes',
  '-o', 'IdentitiesOnly=yes',
  '-o', 'StrictHostKeyChecking=yes',
  '-o', 'ConnectTimeout=15'
)
$remoteTarget = "${RemoteUser}@${RemoteServer}"

Push-Location $PSScriptRoot
try {
  $currentBranch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not determine the current Git branch.'
  }
  if ($currentBranch -ne $Branch) {
    throw "Current branch is '$currentBranch'. Switch to '$Branch' before deploying."
  }

  # The deployment helper itself does not affect the frontend build output.
  $worktreeChanges = @(& git status --porcelain -- . ':(exclude)deploy.ps1')
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect the Git worktree.'
  }
  if ($worktreeChanges.Count -gt 0 -and -not $AllowDirty) {
    throw 'The Git worktree has uncommitted changes. Commit them or pass -AllowDirty intentionally.'
  }

  if (-not $SkipPull) {
    Invoke-NativeCommand -Command 'git' -Arguments @('pull', '--ff-only', 'origin', $Branch)
  }
  if (-not $SkipInstall) {
    Invoke-NativeCommand -Command 'pnpm' -Arguments @('install', '--frozen-lockfile')
  }
  Invoke-NativeCommand -Command 'pnpm' -Arguments @('build')

  $shortCommit = (& git rev-parse --short HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $shortCommit -notmatch '^[0-9a-f]+$') {
    throw 'Could not determine a valid Git commit ID.'
  }

  $dirtySuffix = if ($worktreeChanges.Count -gt 0) { '-dirty' } else { '' }
  $releaseId = "$(Get-Date -Format 'yyyyMMddHHmmss')-${shortCommit}${dirtySuffix}"
  if ($releaseId -notmatch '^[0-9]{14}-[0-9a-f]+(-dirty)?$') {
    throw 'Generated release ID is invalid.'
  }

  $distPath = Join-Path $PSScriptRoot 'frontend\dist'
  $indexPath = Join-Path $distPath 'index.html'
  if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
    throw "Build output was not found: $indexPath"
  }

  $stagingPath = "/home/${RemoteUser}/deploy-staging/${releaseId}"
  $deploymentRoot = '/var/www/coverland-workbench'
  $releasePath = "${deploymentRoot}/releases/${releaseId}"

  Write-Host "Uploading release $releaseId..."
  $prepareCommand = "set -eu; test ! -e '${stagingPath}'; mkdir -p '${stagingPath}'"
  Invoke-NativeCommand -Command 'ssh' -Arguments ($sshArguments + @($remoteTarget, $prepareCommand))

  $distContents = Join-Path $distPath '.'
  Invoke-NativeCommand -Command 'scp' -Arguments ($sshArguments + @('-r', $distContents, "${remoteTarget}:${stagingPath}/"))

  $activateCommand = @"
set -eu
test -f '${stagingPath}/index.html'
test ! -e '${releasePath}'
mkdir -p '${releasePath}'
cp -a '${stagingPath}/.' '${releasePath}/'
test -f '${releasePath}/index.html'
ln -sfn '${releasePath}' '${deploymentRoot}/current.next'
mv -Tf '${deploymentRoot}/current.next' '${deploymentRoot}/current'
case '${stagingPath}' in
  '/home/${RemoteUser}/deploy-staging/'*) rm -r -- '${stagingPath}' ;;
  *) exit 20 ;;
esac
printf 'ACTIVE_RELEASE=%s\n' '${releaseId}'
"@
  Invoke-NativeCommand -Command 'ssh' -Arguments ($sshArguments + @($remoteTarget, $activateCommand))

  $rootResponse = Invoke-WebRequest -Uri "$($PublicUrl.TrimEnd('/'))/" -UseBasicParsing -TimeoutSec 20
  $galleryResponse = Invoke-WebRequest -Uri "$($PublicUrl.TrimEnd('/'))/component-gallery" -UseBasicParsing -TimeoutSec 20
  if ($rootResponse.StatusCode -ne 200 -or $galleryResponse.StatusCode -ne 200) {
    throw "Deployment verification failed: root=$($rootResponse.StatusCode), gallery=$($galleryResponse.StatusCode)"
  }

  Write-Host "Deployment complete: $releaseId"
  Write-Host "Root: $($PublicUrl.TrimEnd('/'))/"
  Write-Host "Gallery: $($PublicUrl.TrimEnd('/'))/component-gallery"
}
finally {
  Pop-Location
}
