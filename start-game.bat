@echo off
setlocal

rem Always run from the folder that contains this batch file.
cd /d "%~dp0"

if not exist "package.json" (
  echo [ERROR] package.json was not found next to this batch file.
  echo Put start-game.bat in the game project folder and try again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo [ERROR] Game dependencies are missing.
  echo Run the project setup once, then start this batch again.
  pause
  exit /b 1
)

set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"

rem Codex Desktop's bundled Node.js is used when Node.js is not installed globally.
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE_EXE (
  echo [ERROR] Node.js was not found.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

echo Starting Trade Game...
echo The browser will open automatically. Close this window to stop the server.
"%NODE_EXE%" "node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 3000 --open

endlocal
