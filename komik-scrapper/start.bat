@echo off
cd /d "%~dp0"
echo =======================================
echo    Memulai Komiknesia Scrapper UI...
echo =======================================

:: Cek apakah Node.js sudah terinstal
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak terdeteksi! Silakan instal Node.js terlebih dahulu.
    pause
    exit /b
)

:: Cek apakah dependencies root sudah terinstal
if not exist "node_modules\" (
    echo Menginstal dependencies server lokal...
    call npm install
)

:: Cek apakah dependencies UI sudah terinstal
if not exist "ui\node_modules\" (
    echo Menginstal dependencies UI...
    cd ui
    call npm install
    cd ..
)

echo Menjalankan aplikasi...
:: Menjalankan server dan UI secara bersamaan
call npm run dev

pause
