$TerminalConfig = "C:\Users\Micah\AppData\Local\Packages\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\LocalState\"
$OnedrivePath = "C:\Users\Micah\OneDrive\TerminalPrefs"

# Remove old folder
Remove-Item -Path $TerminalConfig -Force -Recurse

# Symlink to onedrive folder
New-Item -ItemType SymbolicLink -Path $TerminalConfig -Target $OnedrivePath