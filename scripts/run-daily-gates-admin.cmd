@echo off
setlocal EnableExtensions

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"

set "LOGDIR=%ROOT%\data\backups\ops-logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%I"
set "LOGFILE=%LOGDIR%\ops-gates-daily-admin-%TS%.log"

echo [%DATE% %TIME%] Starting ops:gates:daily:admin > "%LOGFILE%"
pushd "%ROOT%"
call npm.cmd run ops:logs:prune >> "%LOGFILE%" 2>&1
call npm.cmd run ops:gates:daily:admin >> "%LOGFILE%" 2>&1
set "EXITCODE=%ERRORLEVEL%"
call npm.cmd run ops:readiness:daily >> "%LOGFILE%" 2>&1
if "%EXITCODE%"=="0" set "EXITCODE=%ERRORLEVEL%"
call powershell -NoProfile -ExecutionPolicy Bypass -File scripts\notify-daily-gates-result.ps1 -ExitCode %EXITCODE% -LogFile "%LOGFILE%" >> "%LOGFILE%" 2>&1
popd

echo [%DATE% %TIME%] Completed with exit code %EXITCODE% >> "%LOGFILE%"
echo Log file: %LOGFILE% >> "%LOGFILE%"

exit /b %EXITCODE%
