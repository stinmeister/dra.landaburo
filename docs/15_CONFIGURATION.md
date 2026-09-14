# Configuración y Variables de Entorno

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14
Total de Variables Identificadas: 14 variables de entorno y parámetros de configuración

---

## 1. Clasificación de Variables de Entorno

Las variables de configuración de la plataforma se dividen en dos categorías estrictas:
1. **Variables Públicas (`NEXT_PUBLIC_*`):** Incrustadas en el bundle de JavaScript del navegador durante el build. Nunca deben contener credenciales maestras.
2. **Variables Privadas de Servidor:** Accesibles únicamente por Node.js en Server Components, Route Handlers y scripts del servidor.

---

## 2. Matriz de Variables de Entorno

| Variable | Ámbito | Propósito | Requerida | Estado de Verificación |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser & Server | URL del proyecto Supabase (`https://[id].supabase.co`) | SÍ | [VERIFICADO] |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser & Server | Clave pública anónima de Supabase para consultas RLS | SÍ | [VERIFICADO] |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | Clave maestra de servicio Supabase (bypasea RLS) | SÍ | [VERIFICADO] |
| `NEXT_PUBLIC_SITE_URL` | Browser & Server | URL canónica del sitio web (`https://dralandaburo.com`) | SÍ | [VERIFICADO] |
| `INGEST_API_KEY` | Server Only | Token secreto Bearer para autorizar webhooks e ingestas | SÍ | [VERIFICADO] |
| `RESEND_API_KEY` | Server Only | Token de API para envío de emails transaccionales | SÍ | [VERIFICADO] |
| `MP_ACCESS_TOKEN` | Server Only / DB | Token de producción/sandbox de Mercado Pago | SÍ | [VERIFICADO] |
| `MP_WEBHOOK_SECRET` | Server Only / DB | Secreto para verificación de firmas HMAC en webhooks MP | SÍ | [VERIFICADO] |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Browser Only | ID de medición de Google Analytics 4 (`G-XXXXXXXXXX`) | NO (Opcional) | [VERIFICADO] |
| `NEXT_PUBLIC_META_PIXEL_ID` | Browser Only | ID del Pixel de Meta / Facebook (`XXXXXXXXXXXXXXX`) | NO (Opcional) | [VERIFICADO] |
| `NODE_ENV` | Runtime | Entorno de ejecución (`production` / `development`) | SÍ | [VERIFICADO] |
| `PORT` | Runtime | Puerto local donde escucha el servidor Next.js (`3000`) | SÍ | [VERIFICADO] |

---

## 3. Configuración Dinámica en Base de Datos (`app_settings`)

Ciertas configuraciones críticas se leen en tiempo de ejecución desde la tabla `app_settings` en Supabase para permitir cambios inmediatos sin requerir un nuevo build o deploy:

- `mp_access_token`: Token de Mercado Pago (permite rotación de credenciales en caliente).
- `mp_webhook_secret`: Clave secreta para validación de firma HMAC de pagos.
- `consultorio_email`: Correo institucional de destino para leads y avisos de recepción.
- `kiosk_pin`: Código PIN de desbloqueo para la terminal de admisión en sala de espera.
