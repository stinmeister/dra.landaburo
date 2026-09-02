# Documentación Completa de Arquitectura — Dra. Landaburo (dralandaburo.com)

**Fecha de última auditoría:** 2 de Septiembre de 2026  
**Dominio de producción:** `https://www.dralandaburo.com` / `https://dralandaburo.com`  
**Hosting:** AWS EC2 Bitnami (`54.94.94.20`, sa-east-1, Instance ID: `i-0c3cb2b0ff16d224b`)  
**Base de Datos & Auth:** Supabase PostgreSQL (`mdletvbgwzbpenzevurr.supabase.co`)  
**Motor de Automatizaciones:** n8n Cloud (`arbol.app.n8n.cloud`)  

---

## PARTE 0 — Prerequisito: Diagnóstico y Resolución `employee_tasks` vs `staff_tasks`

### 1. Estado en el Código Fuente (Grep Real)
Se auditó todo el árbol de `/src` buscando referencias a ambas tablas:

```bash
# Evidencia: Búsqueda de tablas en el código fuente
$ Get-ChildItem -Path "src" -Recurse -Filter "*.ts*" | Select-String -Pattern "employee_tasks|staff_tasks"

src\app\api\tasks\today\route.ts:38:    .from('staff_tasks')
src\app\api\tasks\today\route.ts:82:    .from('staff_tasks')
src\app\api\webhook\mercadopago\route.ts:145: await supabase.from('staff_tasks').insert({
src\app\dashboard\operativo\actions.ts:26:   .from('staff_tasks')
src\app\dashboard\operativo\page.tsx:73:     .from('staff_tasks')
```

* **`/dashboard/operativo/page.tsx`**: Consulta exclusivamente `staff_tasks`.
* **`/dashboard/operativo/actions.ts`**: Actualiza el estado en `staff_tasks`.
* **`/api/tasks/today/route.ts`**: Lee y genera tareas del día en `staff_tasks`.
* **`/api/webhook/mercadopago/route.ts`**: Crea tareas físicas en `staff_tasks`.
* **`employee_tasks`**: Tiene **0 referencias activas** en la aplicación Next.js.

### 2. Estado en Base de Datos (Supabase)
```json
// Evidencia de conteo en Supabase (API REST con SERVICE_ROLE_KEY)
{
  "employee_tasks": { "filas": 0, "columnas": 10 },
  "staff_tasks":    { "filas": 0, "columnas": 12 }
}
```

### 3. Comparativa de Esquema y Recomendación Técnica
* **`employee_tasks`**: Esquema plano básico (`id, assigned_to_profile, assigned_by_profile, title, description, due_date, priority, status, created_at, updated_at`). No tiene soporte para tareas automáticas por reglas ni entidades relacionadas.
* **`staff_tasks`**: Esquema desacoplado (`id, rule_id, assigned_profile_id, task_type, title, description, due_date, related_entity_type, related_entity_id, status, completed_at, created_at`). Posee Foreign Key con `recurring_task_rules.id` y soporta asociación polimórfica a entidades (`gift_card`, `patient`, `order`).

> **Recomendación Técnica:** Mantener **`staff_tasks` como la tabla definitiva y canónica**. La tabla `employee_tasks` queda formalmente marcada como **deprecada / obsoleta** lista para ser eliminada (`DROP TABLE employee_tasks`) en la próxima migración de limpieza de base de datos.

---

## PARTE 1 — Inventario Técnico Real

### 1.1 Tablas de Supabase (Esquema `public`)
Query real sobre la API de PostgREST / OpenAPI de Supabase con `SELECT COUNT(*)` exacto:

| # | Tabla | Filas Reales | Columnas | Claves Foráneas (FK) Confirmadas |
|---|---|---|---|---|
| 1 | `patients` | **306** | 11 | `profile_id -> profiles.id` |
| 2 | `products` | **31** | 13 | *(Ninguna)* |
| 3 | `profiles` | **6** | 8 | *(Ninguna — extiende `auth.users`)* |
| 4 | `kiosk_admissions` | **1** | 14 | *(Ninguna)* |
| 5 | `treatments` | **0** | 12 | *(Ninguna)* |
| 6 | `gift_cards` | **0** | 21 | `purchaser_patient_id -> patients.id`<br>`redeemed_by -> profiles.id`<br>`treatment_id -> treatments.id`<br>`product_id -> products.id`<br>`physical_prepared_by -> profiles.id` |
| 7 | `orders` | **0** | 17 | `patient_id -> patients.id` |
| 8 | `order_items` | **0** | 7 | `order_id -> orders.id`<br>`product_id -> products.id` |
| 9 | `payments` | **0** | 11 | `appointment_id -> appointments.id`<br>`order_id -> orders.id`<br>`patient_id -> patients.id`<br>`professional_profile_id -> profiles.id` |
| 10 | `appointments` | **0** | 8 | `patient_id -> patients.id`<br>`treatment_id -> treatments.id`<br>`professional_profile_id -> profiles.id` |
| 11 | `staff_tasks` | **0** | 12 | `rule_id -> recurring_task_rules.id`<br>`assigned_profile_id -> profiles.id` |
| 12 | `employee_tasks` | **0** | 10 | `assigned_to_profile -> profiles.id`<br>`assigned_by_profile -> profiles.id` *(Deprecada)* |
| 13 | `recurring_task_rules`| **0** | 7 | `assigned_profile_id -> profiles.id` |
| 14 | `product_batches` | **0** | 6 | `product_id -> products.id` |
| 15 | `articles` | **0** | 22 | *(Ninguna)* |
| 16 | `posts` | **0** | 12 | `author_id -> profiles.id` |
| 17 | `inventory_items` | **0** | 8 | `updated_by -> profiles.id` |
| 18 | `cookie_consents` | **0** | 5 | *(Ninguna)* |
| 19 | `clinic_closed_days` | **0** | 4 | *(Ninguna)* |

#### Detalle de los 6 Usuarios Registrados en `profiles`:
```
┌────────────────────────────────┬─────────────────────────────┬───────────────┐
│ Email                          │ Nombre Completo             │ Rol           │
├────────────────────────────────┼─────────────────────────────┼───────────────┤
│ agustinlandaburo@gmail.com     │ Agustin Roberto Landaburo   │ admin         │
│ dra.landaburo@gmail.com        │ Paula Natalia Landaburo     │ admin         │
│ ceciliamorel2@gmail.com        │ Cecilia Morel               │ operativo     │
│ lauradzuryk@gmail.com          │ maria laura dzuryk          │ operativo     │
│ mechipasquet.95@gmail.com      │ Mercedes Pasquet            │ cosmetologa   │
│ agustinlandaburo@hotmail.com   │ Agustin Landaburo           │ paciente      │
└────────────────────────────────┴─────────────────────────────┴───────────────┘
```

---

### 1.2 Rutas del Sitio (Next.js 16 App Router)
Resultado de auditoría en vivo con peticiones HTTP reales al servidor en producción:

| Ruta | Método | Tipo | HTTP Status | Comportamiento Verificado |
|---|---|---|---|---|
| `/` | `GET` | Página Pública | `200 OK` | Renderiza Home, Hero, Categorías, Bio, Testimonios, CTA Gift Cards |
| `/tratamientos` | `GET` | Página Pública | `200 OK` | Renderiza catálogo de tratamientos |
| `/tratamientos/[slug]` | `GET` | Página Pública | `200 OK` | Renderiza detalle (ej. `/tratamientos/toxina-botulinica`) |
| `/tienda` | `GET` | Página Pública | `200 OK` | Renderiza 31 cremas Sulderm, filtros dinámicos y banner Gift Cards |
| `/tienda/[slug]` | `GET` | Página Pública | `200 OK` | Renderiza detalle de producto (ej. `/tienda/agua-micelar-3-en-1`) |
| `/tienda/carrito` | `GET` | Página Pública | `200 OK` | Carrito con estado cliente (Context) |
| `/tienda/gift-cards` | `GET` | Página Pública | `200 OK` | Configurador de Gift Cards con selector de productos Sulderm |
| `/tienda/pago/exito` | `GET` | Página Pública | `200 OK` | Página de confirmación post-checkout |
| `/tienda/pago/fallo` | `GET` | Página Pública | `200 OK` | Página de error en pago |
| `/tienda/pago/pendiente`| `GET` | Página Pública | `200 OK` | Página de pago pendiente |
| `/blog` | `GET` | Página Pública | `200 OK` | Blog y artículos |
| `/contacto` | `GET` | Página Pública | `200 OK` | Formulario de contacto y datos de consultorio |
| `/sobre-mi` | `GET` | Página Pública | `200 OK` | Perfil y filosofía médica de la Dra. Landaburo |
| `/consentimientos` | `GET` | Página Pública | `200 OK` | Información y consentimientos informados |
| `/kiosco` | `GET` | Página Pública | `200 OK` | Formulario de autoadmisión para tablet en sala de espera |
| `/login` | `GET` | Página Pública | `200 OK` | Login con Supabase Auth |
| `/registro` | `GET` | Página Pública | `200 OK` | Registro de nuevos usuarios |
| `/portal/paciente` | `GET` | Protegida (Auth) | `307 Redirect`| Redirige a `/login?redirectTo=/portal/paciente` |
| `/dashboard/ejecutivo` | `GET` | Protegida (Auth) | `307 Redirect`| Redirige a `/login?redirectTo=/dashboard/ejecutivo` |
| `/dashboard/operativo` | `GET` | Protegida (Auth) | `307 Redirect`| Redirige a `/login?redirectTo=/dashboard/operativo` |
| `/dashboard/operativo/gift-cards` | `GET` | Protegida (Auth) | `307 Redirect`| Redirige a `/login?redirectTo=/dashboard/operativo/gift-cards` |
| `/dashboard/productos` | `GET` | Protegida (Auth) | `307 Redirect`| Redirige a `/login?redirectTo=/dashboard/productos` |
| `/dashboard/usuarios` | `GET` | Protegida (Auth) | `307 Redirect`| Redirige a `/login?redirectTo=/dashboard/usuarios` |
| `/dashboard/blog` | `GET` | Protegida (Auth) | `307 Redirect`| Redirige a `/login?redirectTo=/dashboard/blog` |
| `/dashboard/blog/nuevo` | `GET` | Protegida (Auth) | `307 Redirect`| Redirige a `/login?redirectTo=/dashboard/blog/nuevo` |
| `/api/tasks/today` | `GET` | API Route | `401 Unauthorized` | Requiere sesión activa |
| `/api/admin/fix-trigger` | `GET` | API Route | `401 Unauthorized` | Endpoint administrativo |
| `/api/contacto` | `POST` | API Route | `400/500` | Procesa envío de formulario de contacto |
| `/api/checkout/mercadopago` | `POST` | API Route | `400 Bad Request` | Endpoint de creación de preferencia de pago |
| `/api/gift-cards/checkout` | `POST` | API Route | `400 Bad Request` | Endpoint de compra de Gift Cards |
| `/api/gift-cards/lookup` | `POST` | API Route | `400/405` | Consulta de código de Gift Card |
| `/api/gift-cards/redeem` | `POST` | API Route | `401 Unauthorized` | Canje de Gift Card (solo rol operativo/admin) |
| `/api/kiosco/admision` | `POST` | API Route | `200/500` | Inserción de admisión en `kiosk_admissions` |
| `/api/webhook/mercadopago`| `POST` | API Route | `400/200` | Webhook de confirmación de pago |
| `/api/blog/ingest` | `POST` | API Route | `401 Unauthorized` | Ingesta de artículos vía secret token |

---

### 1.3 Workflows de n8n (Instancia Cloud `arbol.app.n8n.cloud`)
Consultado directamente vía n8n API:

| ID | Nombre | Estado (`active`) | Nodos | Función |
|---|---|---|---|---|
| `pW8F2GHYnWLoAU75` | **WF-02 Patient Sync — Supabase** | ✅ `true` | 12 | Sincronización de Base Unificada (Drive / Cron 8 AM / Webhook) con upsert a `patients` |
| `JjKayRucnzy1mjzv` | **WF-01 Calu Sync** | ✅ `true` | 7 | Pipeline de extracción de agendas y turnos de Calu |
| `oqNSSRYlMy3ytERX` | **WF-06 Lead Intelligence** | ✅ `true` | 14 | Enriquecimiento y categorización de consultas entrantes |
| `PNrNHtmPMpwTh6sr` | **WF-04 Birthday — Saludos Automáticos** | ❌ `false` | 8 | Saludos de cumpleaños automáticos por WhatsApp (inactivo por falta de WABA) |
| `4rS60VfG1wqpi1O7` | **WF-07 Alertas Operativas** | ❌ `false` | 7 | Alertas de stock y recordatorios internos |
| `GJugNNL2C1ks2BmB` | **WF-03 Campaign Generator** | ❌ `false` | 14 | Generador de campañas de recontacto |
| `RBoSi3G74KwzHJAt` | **WF-06 Lead Verification** | ❌ `false` | 2 | Verificación rápida de teléfonos |

---

### 1.4 Variables de Entorno e Integraciones Externas

```
┌──────────────────────────────┬─────────────────────────┬────────────────────────────────────────────────────────┐
│ Servicio / Integración       │ Variable / Recurso      │ Estado Real de Configuración                           │
├──────────────────────────────┼─────────────────────────┼────────────────────────────────────────────────────────┤
│ Supabase DB & Auth           │ NEXT_PUBLIC_SUPABASE_URL│ ✅ ACTIVO (mdletvbgwzbpenzevurr.supabase.co)            │
│ Supabase Service Role        │ SUPABASE_SERVICE_ROLE_KEY│ ✅ ACTIVO                                              │
│ Blog Sync Secret             │ BLOG_SYNC_SECRET        │ ✅ ACTIVO (dl-blog-sync-secret-2026)                   │
│ Mercado Pago Checkout        │ MP_ACCESS_TOKEN         │ ❌ PENDIENTE (No configurado en .env ni app_settings)  │
│ Mercado Pago Webhook         │ MP_WEBHOOK_SECRET       │ ❌ PENDIENTE                                           │
│ WhatsApp Business API        │ WHATSAPP_API_TOKEN      │ ❌ PENDIENTE (Solo link directo wa.me en frontend)     │
│ Google Drive OAuth (n8n)     │ OAuth2 Credentials      │ ✅ ACTIVO en n8n Cloud (WF-02)                          │
│ Certificado SSL              │ Let's Encrypt           │ ✅ ACTIVO (Válido dralandaburo.com / www hasta Nov 26)  │
└──────────────────────────────┴─────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## PARTE 2 — Diagrama de Arquitectura General

```mermaid
flowchart TB
    subgraph CLIENTS["🌐 Capa de Clientes & Navegación"]
        Browser["💻 Navegador Web (Desktop / Mobile)"]
        Tablet["📱 Tablet Consultorio (Modo Kiosco /kiosco)"]
        WhatsAppUser["💬 Paciente vía WhatsApp (wa.me)"]
    end

    subgraph HOSTING["☁️ AWS EC2 (54.94.94.20 - sa-east-1)"]
        Apache["🛡️ Apache 2.4 (Reverse Proxy + Let's Encrypt SSL)"]
        
        subgraph NEXTJS["⚡ Next.js 16 (App Router + Turbopack) [Port 3000 - PM2]"]
            subgraph PUBLIC_ROUTES["Páginas Públicas"]
                Home["/ (Home + Gift Cards CTA)"]
                Tratamientos["/tratamientos & /[slug]"]
                Tienda["/tienda & /[slug] (31 Sulderm)"]
                GiftCardsFront["/tienda/gift-cards"]
                Kiosco["/kiosco"]
                AuthPages["/login & /registro"]
            end

            subgraph PROTECTED_ROUTES["Dashboards (Auth Guard - 307 Redirect)"]
                DashEjecutivo["/dashboard/ejecutivo (Admin)"]
                DashOperativo["/dashboard/operativo (Ceci)"]
                DashGiftCards["/dashboard/operativo/gift-cards"]
                DashUsuarios["/dashboard/usuarios (Admin)"]
                PortalPaciente["/portal/paciente"]
            end

            subgraph API_ROUTES["API Endpoints"]
                APIKiosco["/api/kiosco/admision"]
                APITasks["/api/tasks/today"]
                APIGiftLookup["/api/gift-cards/lookup"]
                APIGiftRedeem["/api/gift-cards/redeem"]
                APIMPCheckout["/api/checkout/mercadopago [Sin Config]"]
                APIMPWebhook["/api/webhook/mercadopago"]
            end
        end
    end

    subgraph SUPABASE["🗄️ Supabase Cloud (PostgreSQL 15 + GoTrue Auth)"]
        AuthModule["🔐 Supabase Auth (JWT + Cookies)"]
        DB_Patients[("patients (306 filas)")]
        DB_Products[("products (31 Sulderm)")]
        DB_Profiles[("profiles (6 usuarios)")]
        DB_StaffTasks[("staff_tasks (0 filas)")]
        DB_GiftCards[("gift_cards (0 filas)")]
        DB_Kiosk[("kiosk_admissions (1 fila)")]
        DB_Orders[("orders & order_items")]
    end

    subgraph AUTOMATIONS["🤖 n8n Cloud (arbol.app.n8n.cloud)"]
        WF02["WF-02 Patient Sync (ACTIVO)\nGoogle Drive -> Supabase patients"]
        WF01["WF-01 Calu Sync (ACTIVO)"]
        WF06["WF-06 Lead Intelligence (ACTIVO)"]
        WF04["WF-04 Birthday (INACTIVO - Sin WABA)"]
    end

    subgraph EXTERNAL["🔌 Servicios Externos"]
        GDrive["📁 Google Drive (Planilla Pacientes)"]
        MP_API["💳 Mercado Pago API (PENDIENTE DE CREDENCIALES)"]
        WABA["📲 WhatsApp Business Cloud API (PENDIENTE)"]
    end

    %% Conexiones Clientes
    Browser -->|HTTPS 443| Apache
    Tablet -->|HTTPS 443 /kiosco| Apache
    WhatsAppUser -->|wa.me Link| WABA

    %% Conexiones Apache
    Apache -->|ProxyPass http://127.0.0.1:3000| NEXTJS

    %% Conexiones Next.js a Supabase
    PUBLIC_ROUTES -->|REST / PostgREST| SUPABASE
    PROTECTED_ROUTES -->|SSR createClient() + Auth Check| AuthModule
    PROTECTED_ROUTES -->|Queries| SUPABASE
    API_ROUTES -->|Service Role Client| SUPABASE

    %% Conexiones n8n
    GDrive -->|Polling 15 min / Webhook| WF02
    WF02 -->|Batch Upsert on_conflict=phone| DB_Patients
    WF04 -.->|Blocked| WABA

    %% Conexiones Pasarelas
    APIMPCheckout -.->|Falla: Sin Access Token| MP_API
    MP_API -.->|Webhook POST| APIMPWebhook
```

---

## PARTE 3 — DER (Diagrama Entidad-Relación)

Todas las claves primarias (PK) y claves foráneas (FK) corresponden a las restricciones reales validadas en la base de datos:

```mermaid
erDiagram
    profiles ||--o{ patients : "profile_id"
    profiles ||--o{ staff_tasks : "assigned_profile_id"
    profiles ||--o{ gift_cards : "redeemed_by"
    profiles ||--o{ gift_cards : "physical_prepared_by"
    profiles ||--o{ appointments : "professional_profile_id"
    profiles ||--o{ payments : "professional_profile_id"
    profiles ||--o{ posts : "author_id"
    profiles ||--o{ inventory_items : "updated_by"
    profiles ||--o{ recurring_task_rules : "assigned_profile_id"
    profiles ||--o{ employee_tasks : "assigned_to_profile"

    patients ||--o{ appointments : "patient_id"
    patients ||--o{ orders : "patient_id"
    patients ||--o{ payments : "patient_id"
    patients ||--o{ gift_cards : "purchaser_patient_id"

    treatments ||--o{ appointments : "treatment_id"
    treatments ||--o{ gift_cards : "treatment_id"

    products ||--o{ order_items : "product_id"
    products ||--o{ gift_cards : "product_id"
    products ||--o{ product_batches : "product_id"

    orders ||--o{ order_items : "order_id"
    orders ||--o{ payments : "order_id"

    recurring_task_rules ||--o{ staff_tasks : "rule_id"
    appointments ||--o{ payments : "appointment_id"

    profiles {
        uuid id PK
        text email
        text full_name
        text role
        text phone
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }

    patients {
        uuid id PK
        text full_name
        text phone
        text email
        text dni
        text rfm_segment
        date birthdate
        text notes
        uuid profile_id FK
        timestamptz synced_at
        timestamptz created_at
    }

    products {
        uuid id PK
        text name
        text slug
        text description
        text brand_type
        numeric price_ars
        numeric compare_price_ars
        text image_url
        text_array images
        text category
        integer stock_quantity
        boolean is_active
        timestamptz created_at
    }

    treatments {
        uuid id PK
        text slug
        text title
        text category
        text description
        numeric price_ars
        numeric price_usd
        integer duration_minutes
        text professional_role
        numeric commission_rate
        boolean is_active
        timestamptz created_at
    }

    staff_tasks {
        uuid id PK
        uuid rule_id FK
        uuid assigned_profile_id FK
        text task_type
        text title
        text description
        date due_date
        text related_entity_type
        uuid related_entity_id
        text status
        timestamptz completed_at
        timestamptz created_at
    }

    gift_cards {
        uuid id PK
        text code
        uuid purchaser_patient_id FK
        numeric amount_ars
        numeric remaining_balance_ars
        text status
        date expiration_date
        text sender_name
        text sender_email
        text recipient_name
        text dedication
        text delivery_method
        text mp_payment_id
        uuid redeemed_by FK
        timestamptz redeemed_at
        text redemption_notes
        uuid treatment_id FK
        uuid product_id FK
        timestamptz physical_prepared_at
        uuid physical_prepared_by FK
        timestamptz created_at
    }

    orders {
        uuid id PK
        text order_number
        text customer_name
        text customer_email
        text customer_phone
        text customer_address
        uuid patient_id FK
        numeric total_ars
        text payment_status
        text mp_payment_id
        text mp_preference_id
        text payment_method
        timestamptz created_at
        timestamptz updated_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        integer quantity
        numeric unit_price_ars
        text product_name
        numeric subtotal_ars
    }

    kiosk_admissions {
        uuid id PK
        text full_name
        text dni
        text email
        text phone
        date birth_date
        text city
        text attribution_channel
        text referral_name
        text_array interests
        text medical_notes
        jsonb device_info
        text status
        timestamptz created_at
    }

    recurring_task_rules {
        uuid id PK
        uuid assigned_profile_id FK
        text title
        text description
        text recurrence_type
        boolean is_active
        timestamptz created_at
    }

    appointments {
        uuid id PK
        uuid patient_id FK
        uuid treatment_id FK
        uuid professional_profile_id FK
        timestamptz appointment_date
        text status
        text notes
        timestamptz created_at
    }

    payments {
        uuid id PK
        uuid appointment_id FK
        uuid order_id FK
        uuid patient_id FK
        uuid professional_profile_id FK
        numeric amount_ars
        numeric amount_usd
        text currency
        text payment_method
        numeric commission_amount_ars
        timestamptz payment_date
    }

    product_batches {
        uuid id PK
        uuid product_id FK
        text batch_number
        date expiration_date
        integer quantity
        timestamptz created_at
    }

    employee_tasks {
        uuid id PK
        uuid assigned_to_profile FK
        uuid assigned_by_profile FK
        text title
        text description
        date due_date
        text priority
        text status
        timestamptz created_at
        timestamptz updated_at
    }

    articles {
        uuid id PK
        text slug
        text title
        text subtitle
        text category
        text author_name
        text content_markdown
        jsonb sections
        jsonb faqs
        boolean is_published
        timestamptz published_at
        timestamptz created_at
        timestamptz updated_at
    }

    posts {
        uuid id PK
        text slug
        text title
        text excerpt
        text content
        text cover_image_url
        text category
        boolean is_published
        timestamptz published_at
        uuid author_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    inventory_items {
        uuid id PK
        text name
        text category
        numeric quantity
        text unit
        numeric min_threshold
        uuid updated_by FK
        timestamptz updated_at
    }

    cookie_consents {
        uuid id PK
        text ip_hash
        boolean analytics_accepted
        boolean marketing_accepted
        timestamptz created_at
    }

    clinic_closed_days {
        uuid id PK
        date closed_date
        text motivo
        timestamptz created_at
    }
```

---

## PARTE 4 — User Journeys

### 4.1 Paciente Comprando un Producto en la Tienda
```mermaid
sequenceDiagram
    autonumber
    actor Paciente as 👤 Paciente
    participant Web as 🌐 Tienda (/tienda)
    participant Cart as 🛒 Carrito (/tienda/carrito)
    participant API as ⚙️ /api/checkout/mercadopago
    participant MP as 💳 Mercado Pago API
    participant DB as 🗄️ Supabase (orders)

    Paciente->>Web: Navega /tienda y filtra por categoría
    Web-->>Paciente: Renderiza 31 productos Sulderm con precio e imagen
    Paciente->>Web: Clic en "Agregar al carrito"
    Web->>Cart: Actualiza CartContext en localStorage
    Paciente->>Cart: Ingresa datos (Nombre, Email, Teléfono, Dirección)
    Paciente->>Cart: Clic en "Pagar con Mercado Pago"
    Cart->>API: POST con items + datos de comprador
    
    rect rgb(255, 230, 230)
        Note over API,MP: ⚠️ PUNTO DE QUIEBRE ACTUAL (DEUDA TÉCNICA)
        API->>API: Intenta inicializar MercadoPago Client
        API-->>Cart: HTTP 500 / Error "Mercado Pago access token not configured"
        Cart-->>Paciente: Mensaje de error en pantalla
    end

    Note over API,DB: Flujo esperado una vez configuradas las credenciales:
    API->>MP: preferences.create({...})
    MP-->>API: Retorna { id: pref_id, init_point: "https://mercadopago.com/..." }
    API->>DB: INSERT into orders (payment_status: 'pending')
    API-->>Cart: Redirección al init_point de Mercado Pago
    Paciente->>MP: Completa el pago
    MP->>API: Webhook notification
    API->>DB: UPDATE orders SET payment_status = 'paid'
```

---

### 4.2 Paciente Comprando una Gift Card
```mermaid
sequenceDiagram
    autonumber
    actor Comprador as 🎁 Comprador
    participant Page as 📱 /tienda/gift-cards
    participant Form as 📝 GiftCardForm
    participant API as ⚙️ /api/gift-cards/checkout
    participant DB as 🗄️ Supabase
    participant Staff as 👩‍💼 Cecilia (Consultorio)

    Comprador->>Page: Ingresa desde Home o Banner de Tienda
    Page-->>Comprador: Renderiza catálogo de productos Sulderm elegibles
    Comprador->>Form: Selecciona producto o monto personalizado
    Comprador->>Form: Elige modalidad (Digital por Email vs Tarjeta Física)
    Comprador->>Form: Ingresa De / Para / Dedicatoria personalizada
    Comprador->>API: POST /api/gift-cards/checkout
    
    rect rgb(255, 235, 235)
        Note over API: Requiere MP_ACCESS_TOKEN para generar el cobro
    end

    Note over API,DB: Al confirmarse el pago (vía Webhook MP):
    API->>DB: INSERT into gift_cards (code: 'GC-XXXX-XXXX', status: 'active')
    
    alt Modalidad Digital
        API->>Comprador: Envía email automático con el voucher y dedicatoria
    else Modalidad Física (Retiro en Consultorio)
        API->>DB: INSERT into staff_tasks (title: 'Preparar Gift Card Física', related_entity_type: 'gift_card')
        Staff->>DB: Visualiza tarea en /dashboard/operativo
        Staff->>DB: Marca tarea completada y entrega la tarjeta física
    end
```

---

### 4.3 Cecilia usando el Dashboard Operativo en su Día a Día
```mermaid
sequenceDiagram
    autonumber
    actor Ceci as 👩‍💼 Cecilia (Rol: operativo)
    participant Auth as 🔐 /login
    participant Dash as 📋 /dashboard/operativo
    participant API as ⚙️ /api/tasks/today & actions
    participant DB as 🗄️ Supabase

    Ceci->>Auth: Ingresa email (ceciliamorel2@gmail.com) y password
    Auth->>DB: Verifica credenciales en auth.users y rol en profiles
    Auth-->>Ceci: Setea cookie de sesión y redirige a /dashboard/operativo
    
    Ceci->>Dash: Abre panel de control diario
    Dash->>API: Consulta tareas del día (staff_tasks)
    API->>DB: SELECT * FROM staff_tasks WHERE due_date <= TODAY AND status != 'completed'
    DB-->>Dash: Retorna lista de tareas operativas
    Dash-->>Ceci: Muestra tareas: Cumpleaños, Seguimientos, Gift Cards Físicas
    
    Ceci->>Dash: Clic en checkbox de tarea completada
    Dash->>API: toggleTaskStatus(taskId, 'completed')
    API->>DB: UPDATE staff_tasks SET status = 'completed', completed_at = NOW()
    DB-->>Dash: UI actualiza estado en tiempo real

    Ceci->>Dash: Consulta "Buscador de Tratamientos" para responder dudas de pacientes
    Dash-->>Ceci: Muestra indicaciones, cuidados y contraindicaciones
```

---

### 4.4 Administrador Gestionando Roles y Usuarios
```mermaid
sequenceDiagram
    autonumber
    actor Admin as 👨‍⚕️ Administrador (Agustín / Paula)
    participant Auth as 🔐 /login
    participant DashUsers as 👥 /dashboard/usuarios
    participant DB as 🗄️ Supabase (profiles)

    Admin->>Auth: Inicia sesión con cuenta admin (dra.landaburo@gmail.com)
    Auth->>DB: Valida rol == 'admin'
    Auth-->>Admin: Redirige a /dashboard/usuarios
    
    DashUsers->>DB: SELECT id, email, full_name, role, phone FROM profiles
    DB-->>DashUsers: Retorna los 6 usuarios
    DashUsers-->>Admin: Renderiza tabla con selector de rol (admin, operativo, cosmetologa, paciente)
    
    Admin->>DashUsers: Modifica el rol de un colaborador
    DashUsers->>DB: UPDATE profiles SET role = $new_role WHERE id = $user_id
    DB-->>DashUsers: Confirmación de actualización
    DashUsers-->>Admin: Notificación de éxito en pantalla
```

---

## PARTE 5 — Estado y Deuda Técnica

Matriz de estado verificada empíricamente contra la infraestructura activa:

```
┌────────────────────────────────────────────────────────┬───────────────────┬────────────────────────────────────────────────────────┐
│ Componente / Módulo                                    │ Estado            │ Detalle y Evidencia Real                               │
├────────────────────────────────────────────────────────┼───────────────────┼────────────────────────────────────────────────────────┤
│ Dominio Público & Certificado SSL                      │ ✅ COMPLETO       │ dralandaburo.com / www sirviendo Next.js (Let's Encrypt)│
│ Catálogo Sulderm en Tienda                             │ ✅ COMPLETO       │ 31 productos reales en Supabase con precios e imágenes │
│ Redirecciones 301 URLs WordPress                       │ ✅ COMPLETO       │ next.config.ts redirige posts con fecha a tratamientos │
│ Autenticación & Control de Acceso por Roles            │ ✅ COMPLETO       │ 307 Redirect en dashboards, 6 perfiles categorizados   │
│ Kiosco de Admisión en Consultorio (/kiosco)            │ ✅ COMPLETO       │ Formulario de sala de espera guardando en DB           │
│ Configuración de Mercado Pago                          │ ⚠️ CONSTRUIDO     │ Código listo (/api/checkout), falta Access Token y Webhook│
│ WhatsApp Business API                                  │ ⚠️ PARCIAL        │ Botón wa.me activo; falta WABA Cloud API para auto-msgs│
│ Sincronización de Pacientes Base Unificada (n8n WF-02) │ ⚠️ ACTIVO / AUDIT │ WF-02 activo (306 pacientes), parser normalizado       │
│ Tabla de Tratamientos en Supabase                      │ ⚠️ PENDIENTE      │ treatments tiene 0 filas; catálogo está en treatments.ts│
│ Depuración de Tabla Antigua employee_tasks             │ ⚠️ PENDIENTE      │ staff_tasks es la activa; employee_tasks lista para drop│
└────────────────────────────────────────────────────────┴───────────────────┴────────────────────────────────────────────────────────┘
```
