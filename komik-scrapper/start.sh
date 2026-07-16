#!/bin/bash

echo "======================================="
echo "   Memulai Komiknesia Scrapper UI..."
echo "======================================="

# Cek apakah Node.js sudah terinstal
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js tidak terdeteksi! Silakan instal Node.js terlebih dahulu."
    exit 1
fi

# Cek apakah dependencies root sudah terinstal
if [ ! -d "node_modules" ]; then
    echo "Menginstal dependencies server lokal..."
    npm install
fi

# Cek apakah dependencies UI sudah terinstal
if [ ! -d "ui/node_modules" ]; then
    echo "Menginstal dependencies UI..."
    cd ui
    npm install
    cd ..
fi

echo "Menjalankan aplikasi..."
# Menjalankan server dan UI secara bersamaan
npm run dev
