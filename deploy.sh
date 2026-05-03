#!/bin/bash

# Supabase Manager CI/CD Script
# This script builds the frontend and triggers the VPS deployment

echo "🚀 Starting Deployment Pipeline..."

# 1. Build Frontend
echo "📦 Building Frontend..."
cd frontend
npm install
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi
cd ..

# 2. Run Deployment Script
echo "🌐 Uploading to VPS..."
node deploy_to_vps.js

if [ $? -eq 0 ]; then
    echo "✅ Deployment Successful!"
else
    echo "❌ Deployment Failed!"
    exit 1
fi
