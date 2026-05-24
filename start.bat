@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ============================================================
rem  birskins  -  one-click local launcher
rem ------------------------------------------------------------
rem  1. Checks prerequisites
rem  2. Starts PostgreSQL via docker compose
rem  3. Creates backend\.env and frontend\.env.local if missing
rem  4. Installs dependencies (first run only)
rem  5. Applies DB schema and seeds the CS2 skin catalog
rem  6. Launches backend and frontend in their own windows
rem  7. Opens the storefront in the default browser
rem ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   birskins local launcher
echo ============================================================
echo.

rem -- Pick package manager: prefer pnpm, fall back to npm --
set "PM="
where pnpm >nul 2>nul && set "PM=pnpm"
if not defined PM where npm >nul 2>nul && set "PM=npm"
if not defined PM goto :no_pm

echo [info] Using package manager: %PM%

where docker >nul 2>nul
if errorlevel 1 goto :no_docker

where node >nul 2>nul
if errorlevel 1 goto :no_node

echo.
echo [1/7] Starting PostgreSQL...
docker compose up -d db
if errorlevel 1 goto :fail_db

echo.
echo [2/7] Preparing backend\.env ...
if exist "backend\.env" goto :have_backend_env

copy /y "backend\.env.example" "backend\.env" >nul
rem Generate a random SESSION_SECRET and substitute it in - all done inside
rem a single PowerShell call to avoid cmd quoting issues with the bracket
rem and apostrophe characters PowerShell uses.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$bytes = New-Object byte[] 32; (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); $secret = [Convert]::ToBase64String($bytes); (Get-Content 'backend\.env') -replace 'change-me-to-a-long-random-string-at-least-32-chars', $secret | Set-Content -NoNewline 'backend\.env'"
if errorlevel 1 goto :fail_env
echo [info] Created backend\.env with a generated SESSION_SECRET.
echo [WARN] STEAM_API_KEY is still a placeholder.
echo        Steam login will not work until you set it in backend\.env
echo        Get a key from https://steamcommunity.com/dev/apikey
goto :env_backend_done
:have_backend_env
echo [info] backend\.env already exists, leaving it alone.
:env_backend_done

echo.
echo [3/7] Preparing frontend\.env.local ...
if exist "frontend\.env.local" goto :have_frontend_env
copy /y "frontend\.env.example" "frontend\.env.local" >nul
echo [info] Created frontend\.env.local.
goto :env_frontend_done
:have_frontend_env
echo [info] frontend\.env.local already exists, leaving it alone.
:env_frontend_done

echo.
echo [4/7] Installing backend dependencies (first run only)...
pushd backend
if exist "node_modules" goto :backend_install_done
call %PM% install
if errorlevel 1 goto :fail_install_backend
:backend_install_done
popd

echo.
echo [5/7] Installing frontend dependencies (first run only)...
pushd frontend
if exist "node_modules" goto :frontend_install_done
call %PM% install
if errorlevel 1 goto :fail_install_frontend
:frontend_install_done
popd

echo.
echo [info] Waiting for PostgreSQL to accept connections...
set /a TRIES=0
:waitdb
docker compose exec -T db pg_isready -U birskins >nul 2>nul
if not errorlevel 1 goto :dbready
set /a TRIES+=1
if %TRIES% GEQ 30 goto :fail_dbwait
timeout /t 1 /nobreak >nul
goto :waitdb
:dbready
echo [info] PostgreSQL is ready.

echo.
echo [6/7] Applying database schema and seeding CS2 skins...
pushd backend
if exist ".seeded" goto :seed_skip
call %PM% run db:generate
rem db:generate may legitimately produce no new migration on re-run; ignore its exit code.
call %PM% run db:push
if errorlevel 1 goto :fail_push
call %PM% run seed
if errorlevel 1 goto :fail_seed
echo done > .seeded
echo [info] Database initialised and seeded.
goto :seed_done
:seed_skip
echo [info] .seeded marker found, skipping migrate/seed.
echo        Delete backend\.seeded to re-run.
:seed_done
popd

echo.
echo [7/7] Launching backend and frontend in new windows...
start "birskins-backend"  cmd /k "cd /d %~dp0backend && %PM% run dev"
start "birskins-frontend" cmd /k "cd /d %~dp0frontend && %PM% run dev"

echo.
echo [info] Waiting a few seconds for the dev servers to boot...
timeout /t 6 /nobreak >nul

echo [info] Opening http://localhost:3000 in your browser ...
start "" "http://localhost:3000"

echo.
echo ============================================================
echo   birskins is running.
echo     frontend : http://localhost:3000
echo     backend  : http://localhost:4000   health: /health
echo.
echo   Close the two new terminal windows to stop the dev servers.
echo   To stop PostgreSQL run: docker compose down   (or stop.bat)
echo ============================================================
echo.
pause
goto :eof

rem ------------------------------------------------------------
rem  Error handlers
rem ------------------------------------------------------------
:no_pm
echo [ERROR] Neither pnpm nor npm was found in PATH.
echo         Install Node.js 18+ from https://nodejs.org/ and re-run.
pause
exit /b 1

:no_docker
echo [ERROR] Docker is not in PATH. Install Docker Desktop and re-run.
echo         https://www.docker.com/products/docker-desktop/
pause
exit /b 1

:no_node
echo [ERROR] Node.js is not in PATH. Install Node.js 18+ from https://nodejs.org/
pause
exit /b 1

:fail_db
echo [ERROR] Failed to start PostgreSQL via docker compose.
pause
exit /b 1

:fail_env
echo [ERROR] PowerShell failed while preparing backend\.env.
pause
exit /b 1

:fail_install_backend
popd
echo [ERROR] Backend dependency install failed.
pause
exit /b 1

:fail_install_frontend
popd
echo [ERROR] Frontend dependency install failed.
pause
exit /b 1

:fail_dbwait
echo [ERROR] PostgreSQL did not become ready within 30 seconds.
pause
exit /b 1

:fail_push
popd
echo [ERROR] Database push failed. Is DATABASE_URL correct in backend\.env?
pause
exit /b 1

:fail_seed
popd
echo [ERROR] Seeding the ByMykel skin catalog failed.
pause
exit /b 1
