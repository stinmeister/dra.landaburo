#!/usr/bin/env bash
# ==============================================================================
# Despliegue seguro sin tiempo fuera de línea (FIX-156) — Dra. Paula Landaburo
# ==============================================================================
# Reglas que garantiza este script:
#   1. Avanza únicamente con `git pull --ff-only origin master` (jamás reset --hard).
#   2. Compila en un directorio separado (`/home/bitnami/dra-landaburo-build`) sin tocar ni
#      borrar `/opt/dra-landaburo/.next` mientras PM2 sigue atendiendo tráfico.
#   3. Si `npm run build` falla (o falta server.js / BUILD_ID), aborta con código != 0
#      dejando PM2 y el `.next` anterior intactos.
#   4. Solo tras un build válido intercambia `.next` -> `.next.prev` y activa el nuevo
#      build con `pm2 reload dra-landaburo --update-env`.
#   5. Verifica HTTP 200 en `/`, `/tienda` y `/tienda/carrito`; si alguno falla,
#      revierte automáticamente a `.next.prev` y recarga PM2.
# ==============================================================================

set -euo pipefail

APP_DIR="/opt/dra-landaburo"
BUILD_DIR="${DEPLOY_BUILD_DIR:-/home/bitnami/dra-landaburo-build}"
PM2_APP="dra-landaburo"
BASE_CHECK_URL="${DEPLOY_CHECK_URL:-http://127.0.0.1:3000}"

log() {
  printf '[deploy-safe %s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

log "1/7 Sincronizando código en ${APP_DIR} con git pull --ff-only..."
cd "${APP_DIR}"

PREV_HEAD="$(git rev-parse HEAD)"
PREV_LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"

git fetch origin master
git pull --ff-only origin master

NEW_HEAD="$(git rev-parse HEAD)"
NEW_LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
log "HEAD anterior: ${PREV_HEAD} -> HEAD nuevo: ${NEW_HEAD}"

if [[ "${PREV_LOCK_HASH}" != "${NEW_LOCK_HASH}" ]]; then
  log "2/7 package-lock.json cambió; ejecutando npm ci..."
  npm ci
else
  log "2/7 package-lock.json sin cambios; se reutiliza node_modules existente."
fi

log "3/7 Preparando directorio aislado de compilación ${BUILD_DIR}..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Copiar código fuente sin tocar .next activo ni duplicar espacio de node_modules/public
rsync -a --delete \
  --exclude='.git' \
  --exclude='.next' \
  --exclude='.next.prev' \
  --exclude='node_modules' \
  --exclude='public' \
  --exclude='logs' \
  "${APP_DIR}/" "${BUILD_DIR}/"

# Hardlinks instantáneos en el mismo filesystem (/dev/xvda1): 0 MB extra y sin symlinks externos
cp -al "${APP_DIR}/node_modules" "${BUILD_DIR}/node_modules"
cp -al "${APP_DIR}/public" "${BUILD_DIR}/public"

if [[ -f "${APP_DIR}/.env.local" ]]; then
  cp -p "${APP_DIR}/.env.local" "${BUILD_DIR}/.env.local"
fi

log "4/7 Ejecutando npm run build dentro de ${BUILD_DIR} (PM2 sigue sirviendo ${APP_DIR}/.next)..."
cd "${BUILD_DIR}"
if ! npm run build; then
  log "ERROR: Falló npm run build en ${BUILD_DIR}. PM2 y ${APP_DIR}/.next NO fueron tocados."
  rm -rf "${BUILD_DIR}"
  exit 1
fi

if [[ ! -f "${BUILD_DIR}/.next/BUILD_ID" ]] || [[ ! -f "${BUILD_DIR}/.next/standalone/server.js" ]]; then
  log "ERROR: El build terminó sin generar BUILD_ID o standalone/server.js. Abortando sin tocar PM2."
  rm -rf "${BUILD_DIR}"
  exit 1
fi

NEW_BUILD_ID="$(cat "${BUILD_DIR}/.next/BUILD_ID")"
log "Build exitoso (BUILD_ID=${NEW_BUILD_ID})."

log "5/7 Intercambiando directorios .next de forma atómica..."
rm -rf "${APP_DIR}/.next.prev"
if [[ -d "${APP_DIR}/.next" ]]; then
  mv "${APP_DIR}/.next" "${APP_DIR}/.next.prev"
fi
mv "${BUILD_DIR}/.next" "${APP_DIR}/.next"
rm -rf "${BUILD_DIR}"

log "6/7 Recargando proceso PM2 (${PM2_APP})..."
cd "${APP_DIR}"
pm2 reload "${PM2_APP}" --update-env

rollback() {
  log "ERROR en verificación HTTP post-deploy. Ejecutando rollback inmediato a .next.prev..."
  if [[ -d "${APP_DIR}/.next.prev" ]]; then
    rm -rf "${APP_DIR}/.next.failed"
    mv "${APP_DIR}/.next" "${APP_DIR}/.next.failed"
    mv "${APP_DIR}/.next.prev" "${APP_DIR}/.next"
    pm2 reload "${PM2_APP}" --update-env
    rm -rf "${APP_DIR}/.next.failed"
    log "Rollback completado; PM2 restaurado con la versión previa."
  fi
  exit 1
}

check_route() {
  local route="$1"
  local url="${BASE_CHECK_URL}${route}"
  local attempt=1
  local max_attempts=8
  local status="000"

  while [[ ${attempt} -le ${max_attempts} ]]; do
    status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${url}" || echo '000')"
    if [[ "${status}" == "200" ]]; then
      log "  ✓ GET ${route} -> HTTP ${status}"
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done

  log "  ✗ GET ${route} devolvió HTTP ${status} tras ${max_attempts} intentos."
  return 1
}

log "7/7 Verificando salud HTTP 200 en /, /tienda y /tienda/carrito..."
sleep 2
check_route "/" || rollback
check_route "/tienda" || rollback
check_route "/tienda/carrito" || rollback

# Liberar .next.prev tras confirmar que el nuevo release responde 200 en las 3 rutas críticas
rm -rf "${APP_DIR}/.next.prev"

log "Despliegue completado con éxito. HEAD=${NEW_HEAD}, BUILD_ID=${NEW_BUILD_ID}."
