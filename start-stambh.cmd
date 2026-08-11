@echo off
cd /d C:\Stambh
"C:\Program Files\nodejs\node.exe" "C:\Stambh\node_modules\tsx\dist\cli.mjs" "C:\Stambh\server\index.ts" >> "C:\Stambh\stambh.log" 2>&1