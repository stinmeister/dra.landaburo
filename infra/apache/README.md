# Configuración de Apache Reverse Proxy (Next.js en AWS EC2 Bitnami)

Este directorio documenta la configuración del proxy inverso de Apache httpd para `dralandaburo.com`.

---

## Archivo de Producción en EC2
- **Ruta en el servidor:** `/opt/bitnami/apache/conf/vhosts/wordpress-https-vhost.conf`
  *(Nota: Conserva el nombre `wordpress-https-vhost.conf` por convención de la imagen AMI base de Bitnami).*
- **Copia de referencia en el repositorio:** `infra/apache/vhost-https.conf`

---

## ¿Qué hacen las directivas de `ProxyPass`?

```apache
ProxyPass / http://127.0.0.1:3000/ retry=0 timeout=60 keepalive=On
ProxyPassReverse / http://127.0.0.1:3000/
```

1. **`retry=0` (Crítico contra errores 503 intermitentes):**
   - **Problema que resuelve:** Por defecto, `mod_proxy` de Apache aplica `retry=60`. Cuando un usuario navega rápido, el router de Next.js envía peticiones paralelas de prefetch RSC (`?_rsc=...`). Si el usuario cambia de página antes de que termine el prefetch, el navegador cancela o aborta el stream HTTP/2. Apache detecta el socket abortado y asume que el backend upstream (Next.js) falló, marcando al worker en **"estado de error" durante 60 segundos**. Durante ese minuto, cualquier otra petición legítima entrante recibía inmediatamente un **`503 Service Unavailable`**, a pesar de que Next.js y PM2 seguían 100% operativos.
   - **Efecto:** Con `retry=0`, Apache nunca deshabilita el worker ante un cierre de conexión y atiende inmediatamente las peticiones subsiguientes.

2. **`timeout=60`:**
   - Establece un límite de 60 segundos de espera para la respuesta del servidor upstream antes de cortar la conexión por inactividad.

3. **`keepalive=On`:**
   - Mantiene sockets TCP activos entre Apache y el backend local Node.js (`127.0.0.1:3000`), evitando el overhead de handshake en ráfagas de navegación.

---

## ¿Y el VirtualHost HTTP (puerto 80)?
- **Archivo:** `/opt/bitnami/apache/conf/vhosts/wordpress-vhost.conf`
- **Comportamiento:** **No proxyea al backend**. Únicamente gestiona la excepción para renovación de certificados Let's Encrypt (`/.well-known !`) y redirige el 100% del tráfico a HTTPS mediante una regla `RewriteRule ^/(.*) https://%{SERVER_NAME}/$1 [R=301,L]`. No requiere ni utiliza parámetros de proxy.

---

## Procedimiento para reponer la configuración

Si se crea una nueva instancia EC2 desde una AMI o se actualiza la configuración de Apache de Bitnami:

1. Editar o reemplazar el vhost HTTPS:
   ```bash
   sudo nano /opt/bitnami/apache/conf/vhosts/wordpress-https-vhost.conf
   ```
   *(Asegurarse de que `ProxyPass / http://127.0.0.1:3000/` incluya `retry=0 timeout=60 keepalive=On`).*

2. Verificar sintaxis:
   ```bash
   sudo /opt/bitnami/apache/bin/httpd -t
   # Debe responder: Syntax OK
   ```

3. Recargar Apache sin caída de servicio (graceful reload):
   ```bash
   sudo /opt/bitnami/apache/bin/httpd -k graceful
   ```
