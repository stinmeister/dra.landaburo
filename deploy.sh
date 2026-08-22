#!/bin/bash
set -e
cd /opt/dra-landaburo
echo '=== Installing dependencies ==='
npm ci --silent
echo '=== Building ==='
npm run build
echo '=== Copying static files ==='
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
echo '=== Restarting PM2 ==='
pm2 restart dra-landaburo
echo '=== Deploy complete ==='
