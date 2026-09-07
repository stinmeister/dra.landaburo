# scripts/deploy.ps1
# Script de despliegue automatizado con verificación de estado y control de fallos

$ErrorActionPreference = "Stop"

Write-Host "
=== 1. Verificando estado local ===" -ForegroundColor Cyan
$localStatus = git status --porcelain
if ($localStatus) {
    Write-Error "Hay cambios locales sin commitear. Realice commit antes de desplegar."
    exit 1
}

Write-Host "
=== 2. Verificando estado en servidor remoto (EC2) ===" -ForegroundColor Cyan
$sshKey = "$env:USERPROFILE\.ssh\ec2_landaburo.pem"
$remoteDirty = ssh -i $sshKey bitnami@54.94.94.20 "cd /opt/dra-landaburo && git status --porcelain"
if ($remoteDirty) {
    Write-Error "El servidor remoto tiene cambios locales no guardados. Abortando deploy para evitar pérdida de datos:
$remoteDirty"
    exit 1
}

Write-Host "
=== 3. Compilando localmente para verificar TypeScript y Assets ===" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "El build local falló. Abortando despliegue."
    exit 1
}

Write-Host "
=== 4. Enviando commits a Producción (EC2) ===" -ForegroundColor Cyan
git push production master
if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo al enviar commits a EC2."
    exit 1
}

Write-Host "
=== 5. Compilando y reiniciando PM2 en Servidor ===" -ForegroundColor Cyan
ssh -i $sshKey bitnami@54.94.94.20 "cd /opt/dra-landaburo && npm run build && pm2 restart dra-landaburo"

Write-Host "
=== 6. Verificación de salud en vivo ===" -ForegroundColor Green
$health = curl.exe -I -s https://www.dralandaburo.com/ | Select-String "HTTP/"
Write-Host "Respuesta de Producción: $health"
Write-Host "
🎉 Despliegue completado con éxito." -ForegroundColor Green
