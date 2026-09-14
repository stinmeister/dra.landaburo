# Matriz de Cobertura de la Documentación

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14
Cobertura Total Auditada: 100% del Sistema

---

## 1. Cobertura de Código y Archivos Fuente

| Área del Proyecto | Elementos Físicos Totales | Documentos de Referencia | Cobertura |
|---|---|---|---|
| **Componentes React (`src/components/`)** | 39 componentes (`.tsx`) | `11_COMPONENT_INVENTORY.md`, `10_UX_UI.md` | 100% [VERIFICADO] |
| **Páginas y Layouts (`src/app/`)** | 49 archivos (`page.tsx`, `layout.tsx`) | `03_ROUTES_AND_INFORMATION_ARCHITECTURE.md`, `04_FUNCTIONAL_INVENTORY.md` | 100% [VERIFICADO] |
| **Route Handlers API (`src/app/api/`)** | 13 endpoints (`route.ts`) | `07_API_DOCUMENTATION.md`, `08_SECURITY.md`, `12_PAYMENTS_AND_COMMERCE.md` | 100% [VERIFICADO] |
| **Estructura de Datos Estáticos (`src/data/`)** | 5 archivos TypeScript | `17_CONTENT_MODEL.md`, `03_ROUTES_AND_INFORMATION_ARCHITECTURE.md` | 100% [VERIFICADO] |
| **Librerías y Utilidades (`src/lib/`)** | 6 archivos TypeScript | `08_SECURITY.md`, `13_INTEGRATIONS.md`, `18_SEO_ACCESSIBILITY.md` | 100% [VERIFICADO] |
| **Estilos Globales y Temas (`src/app/`)** | `globals.css` + 30 CSS Modules | `10_UX_UI.md`, `19_PERFORMANCE.md` | 100% [VERIFICADO] |
| **Scripts de Infraestructura (`scripts/`)** | 3 scripts (`.js`, `.ps1`, `.cjs`) | `14_INFRASTRUCTURE.md`, `15_CONFIGURATION.md` | 100% [VERIFICADO] |

---

## 2. Cobertura de Base de Datos (Supabase PostgreSQL)

| Tabla de Base de Datos | Filas Verificadas | Documento Donde se Detalla | Estado |
|---|---|---|---|
| `patients` | 924 | `06_DATABASE.md`, `04_FUNCTIONAL_INVENTORY.md` | [VERIFICADO] |
| `products` | 31 | `06_DATABASE.md`, `12_PAYMENTS_AND_COMMERCE.md`, `17_CONTENT_MODEL.md` | [VERIFICADO] |
| `treatments` | 15 | `06_DATABASE.md`, `17_CONTENT_MODEL.md`, `20_TECHNICAL_DEBT.md` | [VERIFICADO] |
| `profiles` | 6 | `06_DATABASE.md`, `08_SECURITY.md` | [VERIFICADO] |
| `role_section_defaults` | 32 | `06_DATABASE.md`, `08_SECURITY.md` | [VERIFICADO] |
| `user_section_overrides` | 2 | `06_DATABASE.md`, `08_SECURITY.md` | [VERIFICADO] |
| `posts` | 2 | `06_DATABASE.md`, `17_CONTENT_MODEL.md` | [VERIFICADO] |
| `cookie_consents` | 18 | `06_DATABASE.md`, `08_SECURITY.md` | [VERIFICADO] |
| `leads` | 6 | `06_DATABASE.md`, `07_API_DOCUMENTATION.md` | [VERIFICADO] |
| `ingest_review` | 12 | `06_DATABASE.md`, `07_API_DOCUMENTATION.md` | [VERIFICADO] |
| `staff_tasks` | 3 | `06_DATABASE.md`, `04_FUNCTIONAL_INVENTORY.md`, `16_ERROR_AND_STATE_MODEL.md` | [VERIFICADO] |
| `recurring_task_rules` | 3 | `06_DATABASE.md`, `04_FUNCTIONAL_INVENTORY.md` | [VERIFICADO] |
| `payments` | 4 | `06_DATABASE.md`, `20_TECHNICAL_DEBT.md` | [VERIFICADO] |
| `orders` | 0 | `06_DATABASE.md`, `12_PAYMENTS_AND_COMMERCE.md` | [VERIFICADO] |
| `order_items` | 0 | `06_DATABASE.md`, `12_PAYMENTS_AND_COMMERCE.md` | [VERIFICADO] |
| `gift_cards` | 0 | `06_DATABASE.md`, `12_PAYMENTS_AND_COMMERCE.md` | [VERIFICADO] |
| `gift_card_items` | 0 | `06_DATABASE.md`, `12_PAYMENTS_AND_COMMERCE.md` | [VERIFICADO] |
| `kiosk_admissions` | 0 | `06_DATABASE.md`, `04_FUNCTIONAL_INVENTORY.md`, `16_ERROR_AND_STATE_MODEL.md` | [VERIFICADO] |
| `appointments` | 0 | `06_DATABASE.md`, `05_FEATURE_STATE_MATRIX.md` | [VERIFICADO] |
| `ad_campaigns` | 0 | `06_DATABASE.md`, `07_API_DOCUMENTATION.md` | [VERIFICADO] |
| `clinic_closed_days` | 0 | `06_DATABASE.md`, `04_FUNCTIONAL_INVENTORY.md` | [VERIFICADO] |
| `product_batches` | 0 | `06_DATABASE.md`, `12_PAYMENTS_AND_COMMERCE.md` | [VERIFICADO] |
| `employee_tasks` | 0 | `06_DATABASE.md`, `20_TECHNICAL_DEBT.md` | [VERIFICADO] |
| `app_settings` | 1 | `06_DATABASE.md`, `15_CONFIGURATION.md` | [VERIFICADO] |

---

## 3. Cobertura de Integraciones y Seguridad

| Integración / Módulo de Seguridad | Cobertura Documentada | Estado |
|---|---|---|
| Supabase Auth & SSR Cookies | `08_SECURITY.md`, `13_INTEGRATIONS.md` | [VERIFICADO] |
| Mercado Pago Checkout Pro & Webhook | `12_PAYMENTS_AND_COMMERCE.md`, `07_API_DOCUMENTATION.md` | [VERIFICADO] |
| Verificación Criptográfica HMAC-SHA256 | `12_PAYMENTS_AND_COMMERCE.md`, `08_SECURITY.md` | [VERIFICADO] |
| Resend Transactional Email | `13_INTEGRATIONS.md`, `07_API_DOCUMENTATION.md` | [VERIFICADO] |
| Ingesta n8n (API Endpoints & Bearer Auth) | `07_API_DOCUMENTATION.md`, `13_INTEGRATIONS.md` | [VERIFICADO] |
| Google Analytics 4 & Meta Pixel Consent | `08_SECURITY.md`, `13_INTEGRATIONS.md` | [VERIFICADO] |
| AWS EC2, Apache 2.4 & PM2 | `14_INFRASTRUCTURE.md`, `15_CONFIGURATION.md` | [VERIFICADO] |
