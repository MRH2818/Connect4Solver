# Usage: In PowerShell, run this script to start a local web server for the webapp.
# Example: .\run.ps1           # starts at default port 8000
#          .\run.ps1 -p 8080  # starts at port 8080
param(
    [int]$p = 8000
)
Write-Host "Main at:"
Write-Host "http://localhost:$p/index.html"

python -m http.server $p

