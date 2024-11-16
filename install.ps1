$ErrorActionPreference = "Stop"

$CONFIG = "config/install.conf.yaml"
$trimmed_args = $args[0..($args.Length - 1)]
if ($args.Length -gt 0) {
    $CONFIG = "config/" + $args[0] + ".conf.yaml"
    $trimmed_args = if ($args.Length -gt 1) {
        $args[1..($args.Length - 1)]
    } else {
        @()
    }
}
$DOTBOT_DIR = "dotbot"

$DOTBOT_BIN = "bin/dotbot"
$BASEDIR = $PSScriptRoot

Set-Location $BASEDIR
git submodule sync --quiet --recursive
git submodule update --init --recursive

foreach ($PYTHON in ('python', 'python3')) {
    # Python redirects to Microsoft Store in Windows 10 when not installed
    if (& { $ErrorActionPreference = "SilentlyContinue"
            ![string]::IsNullOrEmpty((&$PYTHON -V))
            $ErrorActionPreference = "Stop" }) {
        &$PYTHON $(Join-Path $BASEDIR -ChildPath $DOTBOT_DIR | Join-Path -ChildPath $DOTBOT_BIN) -d $BASEDIR --plugin-dir dotbot-brew --plugin-dir dotbot-crossplatform -c $CONFIG $trimmed_args
        return
    }
}
Write-Error "Error: Cannot find Python."
