# 08 · Security & Authentication Model

**Fecha:** 14/09/2026  
**Mecanismos:** Supabase Auth (JWT) · Row Level Security (RLS) · Section RBAC · Cookie Privacy  
**Estado:** [VERIFICADO] en código y políticas de Postgres  

---

## 1. Arquitectura de Autenticación

- **Proveedor:** Supabase Auth (GoTrue).
- **Mecanismo de Sesión:** Cookies HTTP-Only sincronizadas vía `@supabase/ssr`.
- **Gestión de Sesión en Servidor:** `src/middleware.ts` ejecuta `supabase.auth.getUser()` en cada petición para validar criptográficamente el JWT contra Supabase y refrescarlo si expiró.
- **Flujo de Callback:** `src/app/auth/callback/route.ts` intercambia el código de autorización temporal por una sesión persistente.

---

## 2. Modelo de Autorización (RBAC Granular)

El sistema combina dos niveles de autorización:

### Nivel 1: Rol de Usuario (`profiles.role`)
- `admin`: Control total de la plataforma y bypass de validaciones de sección.
- `medico`: Acceso a fichas clínicas, tratamientos, KPIs propios y blog.
- `operativo`: Acceso a tareas diarias, buscador de aranceles, inventario y admisiones.
- `cosmetologa`: Acceso a tratamientos de cabina, productos y tareas asignadas.
- `paciente`: Acceso exclusivo a `/portal/paciente`.

### Nivel 2: Control de Secciones (`src/lib/permissions.ts`)
Permite habilitar o deshabilitar secciones puntuales del dashboard (`ejecutivo`, `operativo`, `campanas`, `tratamientos`, `productos`, `usuarios`, `blog`, `revision`) mediante:
1. **Defaults por Rol:** Tabla `role_section_defaults` (32 reglas activas).
2. **Excepciones por Usuario:** Tabla `user_section_overrides` (permite otorgar acceso a una pantalla específica a un empleado sin cambiarle el rol general).

---

## 3. Políticas de Seguridad en Base de Datos (RLS)

Todas las 24 tablas tienen **Row Level Security (RLS) Habilitado**:

1. **Lectura Pública (`SELECT true`):** `treatments`, `products`, `posts` (solo con `is_published = true`).
2. **Datos de Pacientes (`patients`, `orders`, `gift_cards`):** Lectura permitida al propio paciente (`profile_id = auth.uid()`) y a personal con rol staff (`admin`, `medico`, `operativo`).
3. **Escritura Administrativa:** Tablas críticas (`treatments`, `products`, `role_section_defaults`, `app_settings`) exigen pertenencia al rol `admin` evaluada en Postgres (`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`).
4. **Separación de Clientes:**
   - `createClient()`: Cliente anónimo o con sesión de usuario (respeta RLS).
   - `createAdminClient()`: Cliente con `SUPABASE_SERVICE_ROLE_KEY` exclusivo para Server Actions verificadas y Route Handlers con secreto.

---

## 4. Privacidad de Pacientes y Consentimiento de Datos

1. **Hasheo de Direcciones IP:** El endpoint `/api/cookies/consent` nunca almacena direcciones IP en texto plano. Aplica una función hash unidireccional SHA-256 (`crypto.createHash('sha256').update(rawIp).digest('hex')`) para registrar la prueba de consentimiento sin recolectar PII (Personally Identifiable Information).
2. **Bloqueo Preventivo de Scripts de Terceros:** `src/lib/tracking.ts` bloquea de forma síncrona el disparo de Google Analytics 4 y Meta Pixel hasta que el paciente acepte explícitamente las categorías de cookies correspondientes.
3. **Rutas Excluidas de Tracking:** Las rutas internas (`/dashboard/*`, `/portal/*`, `/kiosco`) tienen el tracking totalmente deshabilitado por diseño.

---

## 5. Prevención de Vulnerabilidades Comunes

- **Inyección SQL:** Mitigada al 100% mediante el uso exclusivo de consultas parametrizadas a través del SDK de Supabase (PostgREST).
- **Cross-Site Scripting (XSS):** React 19 escapa por defecto todos los strings en JSX. El renderizado de Markdown en el blog (`MarkdownRenderer.tsx`) no utiliza `dangerouslySetInnerHTML` sin sanitización.
- **Cross-Site Request Forgery (CSRF):** Las Server Actions de Next.js incluyen validación intrínseca de tokens de origen (Origin/Host mismatch check).
- **Manipulación de Precios en Checkout:** El endpoint `/api/checkout/mercadopago` y `/api/gift-cards/checkout` descartan cualquier precio enviado desde el navegador y consultan directamente los valores oficiales en la base de datos de Supabase.
