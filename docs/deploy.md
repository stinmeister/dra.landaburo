# Procedimiento de Despliegue Seguro (`FIX-156`)

Este documento define el único procedimiento autorizado para actualizar la aplicación en producción (`bitnami@54.94.94.20`, `/opt/dra-landaburo`).

## Reglas inquebrantables (`FIX-156`)

1. **Historia lineal hacia adelante en `master`:**
   - Prohibido ejecutar `git rebase`, `git commit --amend` sobre commits publicados, `--fixup` con `--autosquash`, `git push --force` o `git push --force-with-lease`.
   - Cualquier corrección se publica en un **commit nuevo** hacia adelante.
2. **Prohibido `git reset --hard` en el EC2:**
   - El servidor avanza únicamente mediante `git pull --ff-only origin master`.
3. **Prohibido borrar `/opt/dra-landaburo/.next` antes de tener el nuevo build listo:**
   - PM2 ejecuta `/opt/dra-landaburo/.next/standalone/server.js`. Si se borra `.next` durante la compilación o si el build falla, el sitio queda sin archivos.
   - La compilación se realiza siempre en un directorio aislado (`/opt/dra-landaburo-build`) y solo se intercambia al finalizar con éxito.
4. **Fuentes tipográficas locales:**
   - `Playfair Display` e `IBM Plex Sans` están versionadas en `src/fonts/*.woff2` con `next/font/local`, eliminando la dependencia de red contra Google Fonts durante el build.

---

## Ejecución del despliegue

Una vez que los commits fueron verificados localmente (`npm test` / `npm run build`) y enviados con `git push origin master`:

```bash
ssh -i ~/.ssh/antigravity_dralandaburo bitnami@54.94.94.20 \
  "cd /opt/dra-landaburo && git pull --ff-only origin master && bash scripts/deploy-safe.sh"
```

---

## Qué hace `scripts/deploy-safe.sh` paso a paso

1. **`git pull --ff-only origin master`** en `/opt/dra-landaburo`. Si hubiera divergencia local, aborta inmediatamente sin tocar el proceso activo.
2. **Dependencias condicionales:** compara el hash `SHA-256` de `package-lock.json` antes y después del `pull`; solo corre `npm ci` si hubo cambios.
3. **Directorio de compilación aislado (`/opt/dra-landaburo-build`):**
   - Sincroniza el código fuente con `rsync` excluyendo `.next`, `.git`, `node_modules` y `public`.
   - Vincula `node_modules` y `public` mediante hardlinks locales (`cp -al`), ocupando `0 MB` adicionales en disco y evitando symlinks fuera del árbol de `output: 'standalone'`.
   - Copia `.env.local` al directorio de compilación.
4. **Compilación aislada (`npm run build` + `postbuild`):**
   - Ejecuta `next build` y `scripts/copy-standalone-assets.js` dentro de `/opt/dra-landaburo-build` mientras PM2 continúa sirviendo `/opt/dra-landaburo/.next`.
   - Verifica que existan `.next/BUILD_ID` y `.next/standalone/server.js`.
   - **Si falla cualquier paso:** elimina `/opt/dra-landaburo-build` y termina con `exit 1`. PM2 no se reinicia ni pierde archivos.
5. **Intercambio atómico (`swap`):**
   - Mueve `/opt/dra-landaburo/.next` a `/opt/dra-landaburo/.next.prev` y mueve `/opt/dra-landaburo-build/.next` a `/opt/dra-landaburo/.next`.
6. **Recarga de PM2:**
   - Ejecuta `pm2 reload dra-landaburo --update-env` únicamente después de que el nuevo `.next` ya está en su lugar.
7. **Verificación HTTP post-deploy y rollback automático:**
   - Comprueba que `/`, `/tienda` y `/tienda/carrito` respondan `HTTP 200` (localmente en `http://127.0.0.1:3000`, y recomendable validar también vía `https://www.dralandaburo.com`).
   - Si cualquiera de las tres rutas no devuelve `200`, restaura automáticamente `.next.prev` y recarga PM2.
