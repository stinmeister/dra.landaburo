# 01 · System Overview — Consultorio Dra. Paula Landaburo

**Proyecto:** Plataforma Web Integral, E-commerce Dermocosmético y Sistema de Gestión Médica  
**Dominio de Producción:** `https://dralandaburo.com` / `https://www.dralandaburo.com`  
**Fecha de Generación:** 14/09/2026  
**Estado:** [VERIFICADO] en código y base de datos de producción  

---

## 1. Propósito y Problema de Negocio

El sistema es la plataforma digital integral del consultorio médico de la **Dra. Paula Landaburo** (Dermatología & Medicina Estética de Precisión), ubicado en Leandro N. Alem 45, Gualeguaychú, Entre Ríos, Argentina.

### Problemas que Resuelve:
1. **Reemplazo de Plataforma WordPress Legacy:** Migración completa desde una instalación WordPress/WooCommerce monolítica hacia una arquitectura moderna, desacoplada y de alto rendimiento basada en Next.js 16 y Supabase.
2. **E-commerce de Dermocosmética Médica:** Venta directa online del catálogo exclusivo de 31 productos de la línea **Sulderm**, con carrito de compras en cliente y pasarela de pago MercadoPago.
3. **Gift Cards Médicas y de Cosmiatría:** Emisión, compra online con tarjeta/dinero en cuenta, verificación de código (`DL-XXXX-XXXX`) y canje presencial de tarjetas de regalo combinables (tratamientos de cosmiatría, productos y saldo libre con vigencia de 90 días).
4. **Admisión Presencial Digital (Kiosco):** Terminal de autogestión presencial en sala de espera (`/kiosco`) para check-in de pacientes y actualización de datos de contacto.
5. **Consentimientos Médicos Informados:** Gestión digital y firma interactiva de consentimientos de procedimientos médicos y cosmiátricos (`/consentimientos`).
6. **Panel de Gestión Operativa y Ejecutiva:** Dashboard administrativo con control de acceso granular por sección (`permissions.ts`) para visualización de KPIs de facturación, comisiones profesionales, alertas de reposición de stock, tareas automáticas del staff y sincronización de datos de pacientes.

---

## 2. Usuarios del Sistema y Roles

El sistema implementa un modelo de Control de Acceso Basado en Roles (RBAC) con 5 roles principales extendidos en la tabla `profiles`:

| Rol (`profiles.role`) | Usuario Objetivo | Secciones Permitidas por Defecto | Nivel de Acceso |
| :--- | :--- | :--- | :--- |
| `admin` | Agustín Landaburo / Dra. Paula Landaburo | Todas las secciones (Ejecutivo, Operativo, Campañas, Tratamientos, Productos, Usuarios, Blog, Revisión) | Total e irrestricto (Bypass RLS y Server Actions) |
| `medico` | Médicos especialistas del consultorio | Ejecutivo (lectura propia), Operativo, Tratamientos, Blog | Gestión clínica y consulta de aranceles |
| `operativo` | Personal de recepción y staff (Ceci, Laura) | Operativo, Tratamientos, Productos (stock), Revisión | Tareas diarias, buscador de aranceles, control de stock y admisiones |
| `cosmetologa` | Especialista en Cosmiatría (Mercedes Pasquet) | Operativo, Tratamientos, Productos | Tratamientos cosmiátricos, productos y tareas de cabina |
| `paciente` | Pacientes registrados en la web | `/portal/paciente` | Acceso a sus pedidos, gift cards y consentimientos |

---

## 3. Arquitectura General del Sistema

```mermaid
flowchart TD
    subgraph Cliente ["Cliente / Navegador"]
        WebPublica["Web Pública (Home, Tratamientos, Tienda, Blog, Contacto)"]
        TiendaCart["Carrito & Checkout MercadoPago"]
        KioscoUI["Kiosco de Admisión (/kiosco)"]
        ConsentUI["Consentimientos Digitales (/consentimientos)"]
        DashboardUI["Dashboard Staff & Admin (/dashboard/*)"]
        PortalPaciente["Portal del Paciente (/portal/paciente)"]
    end

    subgraph CDN_Proxy ["Infraestructura & Proxy"]
        Apache["Apache 2.4 (Reverse Proxy + Let's Encrypt SSL)"]
        PM2["PM2 Process Manager (Node.js runtime)"]
    end

    subgraph AppLayer ["Next.js 16 App Router (Standalone)"]
        Middleware["middleware.ts (Auth session refresh & route guard)"]
        RSC["React Server Components (SSR / SSG)"]
        ServerActions["Server Actions (Mutaciones autenticadas con RBAC)"]
        APIRoutes["Route Handlers (/api/*)"]
        PermsLayer["lib/permissions.ts (Control granular por sección)"]
    end

    subgraph Backend ["Supabase BaaS (AWS us-east-1)"]
        SupaAuth["Supabase Auth (JWT, GoTrue)"]
        PostgreSQL[("PostgreSQL 15 (Tablas, Constraints, RLS, Triggers)")]
        SupaStorage["Supabase Storage (Bucket 'products')"]
    end

    subgraph ExternalServices ["Servicios Externos"]
        MP["MercadoPago API (Checkout Pro & Webhooks)"]
        Resend["Resend API (Transaccional de Contacto)"]
        n8n["n8n Cloud (Pipelines de Ingesta & Alertas)"]
        MetaGA4["Meta Pixel + Google Analytics 4 (Con Consentimiento)"]
    end

    Cliente -->|HTTPS:443| Apache
    Apache -->|HTTP:3000| PM2
    PM2 --> AppLayer
    AppLayer -->|@supabase/ssr / admin client| Backend
    APIRoutes -->|REST / Webhooks| ExternalServices
    ServerActions -->|Service Role / Admin| PostgreSQL
```

---

## 4. Stack Tecnológico [VERIFICADO]

- **Core Framework:** Next.js `16.2.11` (Turbopack, App Router, React Server Components, Standalone Build).
- **Librería de UI:** React `19.2.4`, React DOM `19.2.4`.
- **Lenguaje:** TypeScript `5.x` (configuración estricta en `tsconfig.json`).
- **Base de Datos & Auth:** Supabase PostgreSQL (`@supabase/supabase-js 2.110.8`, `@supabase/ssr 0.12.4`).
- **Estilos & Diseño:** CSS Modules puros (`.module.css`) con tokens CSS nativos globales (`globals.css`), tipografía serif (*Playfair Display*) y sans-serif (*IBM Plex Sans*). Sin Tailwind CSS.
- **Iconografía:** `lucide-react 1.26.0`.
- **Linter & Formato:** ESLint `9.x` con `eslint-config-next`.
- **Runtime de Servidor:** Node.js v20/v22 en AWS EC2 (Bitnami Linux).

---

## 5. Módulos Principales del Sistema

1. **Módulo Institucional & Médico:**
   - Home con Hero editorial, filosofía médica, grilla de especialidades, biografía médica, testimonios verificados y equipo.
   - Catálogo institucional de Tratamientos (`/tratamientos` y `/tratamientos/[slug]`). Oculta precios al público general por directiva médica estética.
   - Sobre Mí (`/sobre-mi`) y Contacto (`/contacto`) con formulario conectado a Resend y leads en Supabase.
2. **Módulo E-commerce (Dermocosmética Sulderm):**
   - Catálogo interactivo de 31 productos con filtro por categorías y ordenamiento dinámico.
   - Carrito de compras persistente en `localStorage` (`CartContext.tsx`).
   - Checkout automatizado vía MercadoPago (`/api/checkout/mercadopago`).
3. **Módulo Gift Cards Combinables:**
   - Constructor interactivo (`/tienda/gift-cards`) que permite combinar tratamientos de Cosmiatría, productos de skincare y saldo libre.
   - Emisión con código único (`DL-XXXX-XXXX`), dedicatoria personalizada, 90 días de validez y checkout MercadoPago.
   - Validación y canje operativo desde el panel (`/dashboard/operativo/gift-cards`).
4. **Módulo Kiosco de Admisión Presencial:**
   - Pantalla táctil de recepción (`/kiosco`) para check-in de pacientes con DNI/nombre y actualización de datos de contacto.
5. **Módulo Consentimientos Médicos:**
   - Formularios de consentimiento informado con firma en pantalla (`/consentimientos`).
6. **Módulo CMS Blog:**
   - Publicación y renderizado de artículos médicos en Markdown (`/blog`, `/blog/[slug]`) con soporte para borradores y revisiones clínicas.
7. **Módulo Dashboard de Gestión (8 Secciones):**
   - `/dashboard/ejecutivo`: KPIs de facturación ARS/USD y comisiones del equipo.
   - `/dashboard/operativo`: Tareas del día generadas automáticamente, alertas de stock bajo y buscador rápido de 102 tratamientos.
   - `/dashboard/campanas`: Monitoreo de ROI, CAC y métricas de pauta publicitaria.
   - `/dashboard/tratamientos`: ABM de tratamientos y aranceles internos.
   - `/dashboard/productos`: ABM de dermocosmética con Drag & Drop a Supabase Storage y ajuste de stock.
   - `/dashboard/usuarios`: Gestión de roles y asignación de permisos por sección.
   - `/dashboard/blog`: CMS de redacción y publicación de artículos.
   - `/dashboard/revision`: Mesa de control de registros de pacientes/pagos marcados para revisión manual.

---

## 6. Estado Actual de Implementación (Resumen Ejecutivo)

| Componente / Módulo | Estado | Evidencia |
| :--- | :--- | :--- |
| **Sitio Público & SEO** | [VERIFICADO] Fully Implemented | 49 rutas compilando limpiamente en Next.js 16, metadata dinámica, Schema.org JSON-LD |
| **Catálogo Dermocosmética** | [VERIFICADO] Fully Implemented | 31 productos Sulderm en DB, carrito y modal de edición funcional |
| **Gift Cards Combinables** | [VERIFICADO] Fully Implemented | Restricción clínica aplicada (solo Cosmiatría + Productos + Monto Libre), 90 días validez |
| **Kiosco de Admisión** | [VERIFICADO] Fully Implemented | Endpoint `/api/kiosco/admision` y pantalla dedicada sin header/footer |
| **Sistema de Permisos (RBAC)** | [VERIFICADO] Fully Implemented | `permissions.ts` con defaults por rol y overrides por usuario |
| **Cookie Consent (GDPR/APDP)** | [VERIFICADO] Fully Implemented | 12 meses validez, persistencia en `cookie_consents` con IP hasheada SHA-256 |
| **Formulario de Contacto** | [VERIFICADO] Fully Implemented | Resend API + Fallback logging + Notificación n8n |
| **Pagos MercadoPago (E-commerce)** | [PARCIAL] Backend Ready | Endpoints y webhooks creados; pendiente asignación de access token productivo en DB |
| **Ingesta Automatizada Calu/Sheets** | [PARCIAL] Ingest APIs Ready | Endpoints `/api/ingest/*` y tabla `ingest_review` activos; workflows n8n en desarrollo |
| **Facturación Real en Dashboard** | [PARCIAL] UI Ready / DB Empty | Tablas `payments` y `orders` creadas con datos de prueba/históricos |

---

## 7. Principales Riesgos y Dependencias Críticas

1. **Credenciales MercadoPago en Producción:** El flujo de checkout requiere que `MP_ACCESS_TOKEN` esté configurado en el servidor para generar preferencias de cobro reales.
2. **Verificación DNS del Dominio en Resend:** Los correos de contacto requieren que los registros SPF/DKIM de `dralandaburo.com` estén validados en Resend para evitar el remitente fallback de pruebas (`onboarding@resend.dev`).
3. **Pipeline n8n de Ingesta:** La sincronización automática de cobros desde Calu / Google Sheets depende de la activación de los workflows correspondientes en n8n Cloud.
