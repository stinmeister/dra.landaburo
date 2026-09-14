# 02 · Technical Architecture — Consultorio Dra. Paula Landaburo

**Fecha:** 14/09/2026  
**Tecnología Base:** Next.js 16 (App Router) · React 19 · Supabase · TypeScript 5  
**Estado:** [VERIFICADO] en código fuente y arquitectura de compilación  

---

## 1. Visión General de la Arquitectura

La plataforma sigue una arquitectura basada en el **App Router de Next.js 16**, dividida en capas desacopladas con separación estricta entre Server Components (RSC), Client Components (RCC), Server Actions, Route Handlers (API) y Supabase Client/Admin:

```
┌─────────────────────────────────────────────────────────────┐
│                      NAVEGADOR / CLIENTE                     │
│  - React 19 Client Components ('use client')                │
│  - React Contexts (CartContext, ConsentContext)              │
│  - Eventos DOM & Tracking (GA4, Meta Pixel)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS Requests / Actions
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       MIDDLEWARE LAYER                      │
│  - src/middleware.ts                                        │
│  - Token Refresh (@supabase/ssr)                            │
│  - Route Protection (/dashboard/*, /portal/*)               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  NEXT.JS SERVER APPLICATION                 │
│                                                             │
│  ┌────────────────────────┐    ┌─────────────────────────┐  │
│  │ React Server Components│    │ Route Handlers (/api/*) │  │
│  │ (SSR/SSG, Metadata)    │    │ (REST, Ingest, Webhook) │  │
│  └───────────┬────────────┘    └────────────┬────────────┘  │
│              │                              │               │
│  ┌───────────▼────────────┐    ┌────────────▼────────────┐  │
│  │ Server Actions         │    │ lib/permissions.ts      │  │
│  │ ('use server')         │    │ (RBAC Evaluation)       │  │
│  └───────────┬────────────┘    └────────────┬────────────┘  │
│              │                              │               │
│              └──────────────┬───────────────┘               │
│                             ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ lib/supabase/admin.ts (Service Role Client)           │  │
│  │ lib/supabase/server.ts (User Session SSR Client)      │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │ Supabase REST / Postgres
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE / POSTGRES                   │
│  - PostgreSQL 15 (Tablas, Constraints, Triggers)            │
│  - Row Level Security (RLS) Policies                        │
│  - Storage Buckets (products)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Capas de la Aplicación

### A. Capa de Presentación (Frontend)
- **React Server Components (RSC):** Utilizados por defecto en todas las páginas (`page.tsx`) para realizar data-fetching directo en el servidor sin costo de JavaScript en el bundle del cliente.
- **Client Components (`use client`):** Limitados estrictamente a componentes interactivos que requieren estado local, hooks de React, eventos del navegador o APIs del DOM:
  * `src/components/tienda/ProductCard.tsx`, `AddToCartButton.tsx`, `CartIcon.tsx` (manejo de carrito).
  * `src/components/contacto/ContactForm.tsx` (envío interactivo con validación).
  * `src/components/ui/CookieBanner.tsx` (gestión de consentimiento y eventos).
  * `src/components/dashboard/ProductTable.tsx` (edición modal y drag & drop).
  * `src/app/tienda/gift-cards/GiftCardForm.tsx` (constructor de gift cards).

### B. Capa de Enrutamiento y Middleware
- **Archivo:** `src/middleware.ts`
- **Propósito:**
  1. Refrescar la sesión JWT de Supabase en cada request usando `@supabase/ssr`.
  2. Proteger las rutas con prefijo `/dashboard` y `/portal` redirigiendo a `/login?redirectTo=...` si el usuario es anónimo.
  3. Redirigir a `/` a usuarios autenticados que intenten ingresar a `/login` o `/registro`.
- **Matcher:** `/((?!_next/static|_next/image|favicon.ico|images).*)`

### C. Capa de Control de Acceso (RBAC & Permissions)
- **Archivo:** `src/lib/permissions.ts`
- **Modelo:** Dos tablas en base de datos:
  * `role_section_defaults`: define qué secciones ve cada rol por defecto.
  * `user_section_overrides`: permite otorgar o revocar permisos a usuarios específicos sin cambiar su rol.
- **Función Clave:** `assertSectionAccess(profileId, role, section)`
  * Ejecutada al inicio de cada `page.tsx` del dashboard.
  * Redirige a la primera sección permitida o a `/dashboard/sin-acceso` si el usuario no tiene permisos.

### D. Capa de Acceso a Datos (Supabase Clients)
El proyecto cuenta con 3 clientes Supabase especializados:
1. `src/lib/supabase/client.ts`: Cliente del navegador para componentes cliente (`createBrowserClient`).
2. `src/lib/supabase/server.ts`: Cliente de servidor contextual a las cookies del request (`createServerClient`).
3. `src/lib/supabase/admin.ts`: Cliente con permisos de superusuario (`SUPABASE_SERVICE_ROLE_KEY`). Se utiliza **únicamente** en Server Actions y Route Handlers para operaciones de sistema, ingestas y bypass controlado de RLS.

### E. Capa de Mutaciones (Server Actions)
Ubicadas en archivos `actions.ts` dentro de cada subdirectorio de `/dashboard`:
- `src/app/dashboard/productos/actions.ts`: `createProduct`, `updateProduct`, `toggleProduct`, `updateStock`, `uploadProductImage`.
- `src/app/dashboard/tratamientos/actions.ts`: `createTreatment`, `updateTreatment`, `toggleTreatment`.
- `src/app/dashboard/blog/actions.ts`: `savePost`, `deletePost`.
- `src/app/dashboard/campanas/actions.ts`: `createCampaign`, `updateCampaign`, `deleteCampaign`.
- `src/app/dashboard/usuarios/actions.ts`: `updateUserRole`, `toggleSectionPermission`.
- `src/app/dashboard/revision/actions.ts`: `resolveReviewItem`, `dismissReviewItem`.
- `src/app/dashboard/operativo/actions.ts`: `toggleTaskStatus`, `updateOperationalAssignments`.

### F. Capa de Integraciones y Route Handlers (APIs)
- Endpoints REST en `src/app/api/` encargados de recibir webhooks de MercadoPago, despachar emails de contacto vía Resend, procesar admisiones del kiosco, y recibir payloads de ingesta desde n8n/Google Sheets.

---

## 3. Estructura de Directorios del Repositorio

```
dra-landaburo/
├── infra/                  # Configuraciones de servidor
│   └── apache/             # VirtualHost Apache 2.4 HTTPS Proxy
├── public/                 # Assets estáticos servidos directamente
│   ├── images/             # Fotografías de tratamientos, catálogo Sulderm y branding
│   └── favicon.ico
├── scripts/                # Scripts de automatización y verificación
│   ├── copy-standalone-assets.js # Postbuild: copia public y static al bundle standalone
│   ├── deploy.ps1          # Script PowerShell de despliegue a AWS EC2
│   └── verify_cierre.cjs   # Script de auditoría de cierre mensual
├── src/
│   ├── app/                # Next.js 16 App Router (Rutas, Páginas, APIs)
│   │   ├── api/            # Route Handlers (Checkout, Contacto, Ingest, Kiosco)
│   │   ├── auth/           # Callback OAuth y confirmación de sesión
│   │   ├── blog/           # Listado y detalle público del blog
│   │   ├── consentimientos/# Formularios de consentimientos informados
│   │   ├── contacto/       # Página de contacto
│   │   ├── dashboard/      # Panel de control administrativo y operativo
│   │   ├── kiosco/         # Terminal de recepción presencial
│   │   ├── login/          # Inicio de sesión
│   │   ├── portal/         # Portal privado del paciente
│   │   ├── registro/       # Registro de nuevos usuarios
│   │   ├── sobre-mi/       # Biografía y trayectoria de la Dra. Landaburo
│   │   ├── tienda/         # E-commerce Sulderm y Gift Cards
│   │   ├── tratamientos/   # Catálogo y fichas técnicas de tratamientos
│   │   ├── globals.css     # Design tokens y variables CSS globales
│   │   ├── layout.tsx      # Root Layout (Fonts, Header, Footer, CookieBanner)
│   │   └── page.tsx        # Homepage principal
│   ├── components/         # Componentes React organizados por dominio
│   ├── contexts/           # React Context Providers (CartContext, ConsentContext)
│   ├── data/               # Modelos y datos locales (navigation, team, treatments)
│   ├── lib/                # Utilidades, servicios, permisos y Supabase SDK
│   └── middleware.ts       # Middleware de autenticación y ruteo
├── next.config.ts          # Configuración de Next.js (Standalone, Remote Images, Redirects)
├── package.json            # Dependencias y scripts
└── tsconfig.json           # Configuración de TypeScript
```

---

## 4. Flujo de Datos y Manejo de Estado

1. **Estado Global del Cliente:**
   - `CartContext.tsx`: Carrito de compras en memoria con persistencia automática en `localStorage` (`cart_items_v1`).
   - `ConsentContext.tsx`: Estado de consentimiento de cookies sincronizado entre `localStorage` y cookies HTTP (`cookie_consent`).
2. **Data-Fetching de Servidor:**
   - Realizado en componentes de servidor (`async function Page()`) directamente contra Supabase con `createClient()` o `createAdminClient()`.
   - Utiliza `revalidatePath()` en Server Actions para invalidar el caché de Next.js inmediatamente tras una mutación.
