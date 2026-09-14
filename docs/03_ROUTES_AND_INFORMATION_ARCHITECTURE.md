# 03 · Routes & Information Architecture — Consultorio Dra. Paula Landaburo

**Fecha:** 14/09/2026  
**Total Rutas Detectadas:** 49 rutas (Páginas estáticas, dinámicas y API Route Handlers)  
**Estado:** [VERIFICADO] en compilación real de Next.js 16  

---

## 1. Inventario Completo de Rutas

### A. Rutas Públicas (Institucionales y Comerciales)

| URL | Archivo Responsable | Tipo | Acceso | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | Estática (SSG) | Público | Homepage: Hero, Especialidades, Bio, Estadísticas, Testimonios, Equipo y CTA Gift Cards. |
| `/tratamientos` | `src/app/tratamientos/page.tsx` | Estática (SSG) | Público | Listado general de tratamientos médicos y estéticos (precios ocultos al público). |
| `/tratamientos/[slug]` | `src/app/tratamientos/[slug]/page.tsx` | Dinámica (SSG con `generateStaticParams`) | Público | Ficha técnica detallada de cada tratamiento (11 slugs pre-generados). |
| `/sobre-mi` | `src/app/sobre-mi/page.tsx` | Estática (SSG) | Público | Trayectoria profesional, formación académica y filosofía médica de la Dra. Landaburo. |
| `/contacto` | `src/app/contacto/page.tsx` | Estática (SSG) | Público | Formulario de consulta médica, mapa interactivo y datos de ubicación en Gualeguaychú. |
| `/tienda` | `src/app/tienda/page.tsx` | Dinámica (SSR) | Público | Catálogo interactivo de 31 productos dermocosméticos Sulderm con filtro por categoría. |
| `/tienda/[slug]` | `src/app/tienda/[slug]/page.tsx` | Dinámica (SSR) | Público | Detalle de producto, modo de uso, componentes activos y botón "Agregar al carrito". |
| `/tienda/carrito` | `src/app/tienda/carrito/page.tsx` | Estática (SSG) | Público | Carrito de compras con resumen de ítems, cálculo de total e inicio de checkout. |
| `/tienda/gift-cards` | `src/app/tienda/gift-cards/page.tsx` | Dinámica (SSR) | Público | Constructor interactivo de Gift Cards combinables (Cosmiatría + Productos + Monto Libre). |
| `/tienda/pago/exito` | `src/app/tienda/pago/exito/page.tsx` | Estática (SSG) | Público | Pantalla de confirmación de pago aprobado por MercadoPago con descarga de voucher. |
| `/tienda/pago/pendiente`| `src/app/tienda/pago/pendiente/page.tsx` | Estática (SSG) | Público | Pantalla informativa de pago pendiente de acreditación en MercadoPago. |
| `/tienda/pago/fallo` | `src/app/tienda/pago/fallo/page.tsx` | Estática (SSG) | Público | Pantalla informativa de rechazo de pago con botón para reintentar. |
| `/blog` | `src/app/blog/page.tsx` | Dinámica (SSR) | Público | Listado de artículos médicos publicados con filtro por categorías. |
| `/blog/[slug]` | `src/app/blog/[slug]/page.tsx` | Dinámica (SSR) | Público | Lectura de artículo médico con renderizado de Markdown enriquecido. |
| `/blog/preview/[slug]` | `src/app/blog/preview/[slug]/page.tsx`| Dinámica (SSR) | Admin | Previsualización de artículos en estado borrador o pendiente de revisión médica. |

---

### B. Rutas de Autenticación y Pacientes

| URL | Archivo Responsable | Tipo | Acceso | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | `src/app/login/page.tsx` | Estática (SSG) | Anónimo | Inicio de sesión con Email y Contraseña (Supabase Auth). |
| `/registro` | `src/app/registro/page.tsx` | Estática (SSG) | Anónimo | Registro de pacientes con creación automática de perfil en `profiles`. |
| `/auth/callback` | `src/app/auth/callback/route.ts` | API Route Handler | Público | Callback de intercambio de código auth para establecimiento de cookies de sesión. |
| `/portal/paciente` | `src/app/portal/paciente/page.tsx` | Dinámica (SSR) | Paciente Autenticado | Panel privado del paciente con historial de pedidos, gift cards y consentimientos. |
| `/kiosco` | `src/app/kiosco/page.tsx` | Estática (SSG) | Público / Terminal | Interfaz táctil de recepción presencial para check-in de turnos y actualización de datos. |
| `/consentimientos` | `src/app/consentimientos/page.tsx` | Estática (SSG) | Público / Paciente | Formularios interactivos de consentimiento informado con firma digital en pantalla. |

---

### C. Rutas del Dashboard Administrativo y Operativo (`/dashboard/*`)

Todas estas rutas están protegidas por `middleware.ts` (requieren sesión activa) y por `permissions.ts` (requieren permisos explícitos para la sección):

| URL | Archivo Responsable | Acceso RBAC | Propósito |
| :--- | :--- | :--- | :--- |
| `/dashboard/ejecutivo` | `src/app/dashboard/ejecutivo/page.tsx` | `admin`, `medico` | KPIs financieros: Facturación ARS/USD, Comisiones Dra. y Mercedes, Selector mensual. |
| `/dashboard/operativo` | `src/app/dashboard/operativo/page.tsx` | `admin`, `medico`, `operativo`, `cosmetologa` | Gestión diaria: Tareas del día automáticas, Alertas de stock crítico y Buscador de aranceles. |
| `/dashboard/operativo/gift-cards` | `src/app/dashboard/operativo/gift-cards/page.tsx` | `admin`, `operativo` | Validador y canje presencial de códigos Gift Card (`DL-XXXX-XXXX`). |
| `/dashboard/campanas` | `src/app/dashboard/campanas/page.tsx` | `admin`, override | Monitoreo de pauta publicitaria (Meta Ads / Google Ads), Inversión, Leads, Citas y CAC. |
| `/dashboard/tratamientos`| `src/app/dashboard/tratamientos/page.tsx`| `admin`, `medico`, `operativo`, `cosmetologa` | Catálogo interno de tratamientos médicos con edición de aranceles y comisiones. |
| `/dashboard/productos` | `src/app/dashboard/productos/page.tsx` | `admin`, `operativo`, `cosmetologa` | Inventario dermocosmético: ABM de productos, ajuste rápido de stock y carga de fotos. |
| `/dashboard/usuarios` | `src/app/dashboard/usuarios/page.tsx` | `admin` | Administración de usuarios, asignación de roles y matriz de permisos por sección. |
| `/dashboard/blog` | `src/app/dashboard/blog/page.tsx` | `admin`, `medico` | CMS de artículos: tabla de publicaciones, estados (borrador/publicado) y métricas. |
| `/dashboard/blog/nuevo` | `src/app/dashboard/blog/nuevo/page.tsx` | `admin`, `medico` | Editor de nuevo artículo con soporte para Markdown y subida de portada. |
| `/dashboard/blog/[id]` | `src/app/dashboard/blog/[id]/page.tsx` | `admin`, `medico` | Edición de artículo existente y cambio de estado editorial. |
| `/dashboard/revision` | `src/app/dashboard/revision/page.tsx` | `admin`, `operativo` | Mesa de control de registros de pacientes y pagos observados para resolución manual. |
| `/dashboard/sin-acceso` | `src/app/dashboard/sin-acceso/page.tsx` | Autenticado | Pantalla informativa para usuarios sin permisos en el dashboard. |

---

### D. Rutas API (Route Handlers — `src/app/api/*`)

| Endpoint | Método | Autenticación | Propósito |
| :--- | :--- | :--- | :--- |
| `/api/checkout/mercadopago` | POST | Pública / Carrito | Genera preferencia de pago en MercadoPago para compras del e-commerce. |
| `/api/gift-cards/checkout` | POST | Pública / GiftCard | Valida ítems server-side y genera preferencia de pago para Gift Cards. |
| `/api/gift-cards/lookup` | GET | Staff / Admin | Consulta saldo, estado y validez de un código `DL-XXXX-XXXX`. |
| `/api/gift-cards/redeem` | POST | Staff / Admin | Aplica el canje total o parcial de una Gift Card. |
| `/api/webhook/mercadopago` | POST | Webhook Signature | Recibe notificaciones de pago de MercadoPago y actualiza órdenes/gift cards. |
| `/api/contacto` | POST | Pública | Procesa mensajes de contacto, guarda en DB y envía email vía Resend. |
| `/api/cookies/consent` | POST | Pública | Registra auditoría de consentimiento con IP hasheada y emite cookie HTTP. |
| `/api/kiosco/admision` | POST | Terminal / Kiosco | Registra check-in presencial de pacientes en `kiosk_admissions`. |
| `/api/tasks/today` | GET | Cron / n8n | Dispara la generación diaria de tareas automáticas y retorna las del día. |
| `/api/ingest/patients` | POST | `Bearer INGEST_SECRET` | Ingesta masiva de pacientes desde Google Sheets / Calu. |
| `/api/ingest/payments` | POST | `Bearer INGEST_SECRET` | Ingesta de pagos históricos y comisiones con validación estricta. |
| `/api/ingest/campaigns` | POST | `Bearer INGEST_SECRET` | Ingesta de métricas de campañas publicitarias. |
| `/api/blog/ingest` | POST | `Bearer BLOG_SYNC_SECRET` | Ingesta o sincronización externa de artículos de blog. |

---

## 2. Mapa de Redirecciones Legacy (WordPress) [VERIFICADO]

Configuradas en `next.config.ts` con código HTTP 308 (Permanent Redirect):
- Tratamientos WordPress con fecha: `/:year/:month/:day/toxina-botulinica` $ightarrow$ `/tratamientos/toxina-botulinica`.
- Posts genéricos de WordPress: `/:year/:month/:day/:slug` $ightarrow$ `/blog`.
- Páginas estáticas antiguas: `/about-us` $ightarrow$ `/sobre-mi`, `/contacts` $ightarrow$ `/contacto`, `/shop` $ightarrow$ `/tienda`, `/cart` $ightarrow$ `/tienda/carrito`, `/checkout` $ightarrow$ `/tienda/carrito`.
