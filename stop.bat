@echo off
rem Stop the PostgreSQL container started by start.bat.
rem The backend and frontend dev servers run in their own windows -
rem close those windows (or press Ctrl+C inside them) to stop them.

cd /d "%~dp0"
echo Stopping PostgreSQL container...
docker compose down
echo Done.
pause
