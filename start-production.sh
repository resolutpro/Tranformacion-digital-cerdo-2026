#!/bin/bash
echo "[BUILD] Building frontend for production deployment..."
npm run build
echo "[BUILD] Build completed successfully"
echo "[START] Starting production server..."
NODE_ENV=production node dist/index.js
