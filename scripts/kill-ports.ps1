# Kill any processes holding ports 3000 or 5000 with full process tree (/T flag)
# Next.js uses port 3000; GameHub WS server (server/src/index.ts) uses process.env.PORT || 5000
$pids = (Get-NetTCPConnection -LocalPort 3000,5000 -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
foreach ($p in $pids) {
    Write-Host "Killing PID $p (tree)..."
    & taskkill /F /T /PID $p 2>$null
}
Start-Sleep 4
Write-Host "Ports 3000 and 5000 cleared."
