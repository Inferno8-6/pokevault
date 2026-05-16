@echo off
title PokeVault - Lanceur
color 0E

echo.
echo  ============================================
echo   PokeVault - Plateforme Cartes Pokemon
echo  ============================================
echo.

:: Verifier Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installe !
    echo Telechargez-le sur https://nodejs.org
    pause
    exit /b
)

:: Verifier pnpm
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Installation de pnpm...
    npm install -g pnpm
)

:: Aller dans le dossier du projet
cd /d "%~dp0"

:: Verifier .env
if not exist .env (
    echo [ERREUR] Fichier .env manquant !
    echo Copiez .env.example vers .env et remplissez les valeurs.
    pause
    exit /b
)

echo [1/3] Verification des dependances...
pnpm install --frozen-lockfile >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    pnpm install
)

echo [2/3] Lancement du dashboard web (port 3001)...
set NODE_OPTIONS=--no-experimental-webstorage
start "PokeVault - Dashboard" cmd /k "cd /d %~dp0apps\web && set NODE_OPTIONS=--no-experimental-webstorage && npx next dev --port 3001"

echo [3/3] Lancement du bot Discord...
start "PokeVault - Bot Discord" cmd /k "cd /d %~dp0 && pnpm --filter @pokemon/bot dev"

:: Attendre que le serveur soit pret
timeout /t 5 /nobreak >nul

echo.
echo  ============================================
echo   PokeVault est pret !
echo  ============================================
echo.
echo   Dashboard : http://localhost:3001
echo   Bot Discord : PokeVault#9742
echo.
echo   [!] Gardez les fenetres CMD ouvertes
echo   [!] Pour arreter : fermez les fenetres CMD
echo.

:: Ouvrir le navigateur
start http://localhost:3001

pause
