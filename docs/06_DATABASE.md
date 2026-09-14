# 06 · Database Documentation — Supabase / PostgreSQL

**Proyecto:** dralandaburo.com  
**Motor:** PostgreSQL 15 (Supabase Managed Instance: `mdletvbgwzbpenzevurr.supabase.co`)  
**Fecha de Auditoría:** 14/09/2026  
**Estado:** [VERIFICADO] Auditado contra la base de datos real en producción  

---

## 1. Resumen de Tablas y Filas Reales

| Tabla | Filas Reales | Propósito Principal | Estado en Producción |
| :--- | :---: | :--- | :--- |
| `profiles` | **6** | Extensión de `auth.users` con RBAC (`admin`, `medico`, `operativo`, `cosmetologa`, `paciente`). | [VERIFICADO] Activa |
| `patients` | **924** | Fichas clínicas de pacientes (nombre, DNI, teléfono, email, segmento RFM, notas). | [VERIFICADO] Activa |
| `treatments` | **15** | Catálogo de tratamientos con aranceles internos y tasa de comisión. | [VERIFICADO] Activa |
| `products` | **31** | Catálogo de dermocosmética Sulderm (precios, stock, categoría, imagen). | [VERIFICADO] Activa |
| `orders` | **0** | Órdenes de compra generadas desde el e-commerce. | [VERIFICADO] Activa (Estructura lista) |
| `order_items` | **0** | Detalle de productos por orden de compra. | [VERIFICADO] Activa (Estructura lista) |
| `gift_cards` | **0** | Tarjetas de regalo emitidas con código único, saldo y vencimiento. | [VERIFICADO] Activa (Estructura lista) |
| `gift_card_items` | **0** | Ítems combinables asignados a cada gift card. | [VERIFICADO] Activa |
| `appointments` | **0** | Agenda de turnos médicos y cosmiátricos. | [VERIFICADO] Activa |
| `payments` | **4** | Registro financiero de cobros y comisiones profesionales. | [VERIFICADO] Activa |
| `staff_tasks` | **3** | Tareas operativas asignadas al personal con fecha límite y estado. | [VERIFICADO] Activa |
| `recurring_task_rules`| **3** | Reglas de recurrencia para generación automática de tareas. | [VERIFICADO] Activa |
| `clinic_closed_days` | **0** | Días feriados / no laborables del consultorio. | [VERIFICADO] Activa |
| `cookie_consents` | **18** | Registro de auditoría de consentimiento de cookies con IP hasheada (SHA-256). | [VERIFICADO] Activa |
| `posts` | **2** | Artículos del blog médico (CMS) con soporte de Markdown y estados. | [VERIFICADO] Activa |
| `kiosk_admissions` | **0** | Registro de check-in presencial de pacientes en la terminal de recepción. | [VERIFICADO] Activa |
| `ingest_review` | **12** | Mesa de control de registros de pacientes y pagos observados. | [VERIFICADO] Activa |
| `ad_campaigns` | **0** | Registro de campañas publicitarias (Meta Ads / Google Ads). | [VERIFICADO] Activa |
| `role_section_defaults`| **32** | Matriz de permisos por defecto (8 secciones $	imes$ 4 roles de staff). | [VERIFICADO] Activa |
| `user_section_overrides`| **2** | Excepciones puntuales de permisos otorgadas a usuarios específicos. | [VERIFICADO] Activa |
| `app_settings` | **1** | Configuración general y responsables operativos por defecto. | [VERIFICADO] Activa |
| `leads` | **6** | Consultas recibidas desde el formulario web de contacto. | [VERIFICADO] Activa |
| `product_batches` | **0** | Lotes y fechas de vencimiento de productos dermocosméticos. | [VERIFICADO] Activa |
| `employee_tasks` | **0** | Tabla legacy reemplazada por `staff_tasks` (marcada para deprecación). | [VERIFICADO] Deprecada |

---

## 2. Diagrama Entidad-Relación (DER Textual)

```
       ┌────────────────────────┐
       │       auth.users       │ (Supabase Auth)
       └───────────┬────────────┘
                   │ 1:1
                   ▼
       ┌────────────────────────┐         1:N         ┌───────────────────────────┐
       │        profiles        ├────────────────────►│  user_section_overrides   │
       └─────┬───────────┬──────┘                     └───────────────────────────┘
             │           │
         1:N │           │ 1:N
             ▼           ▼
┌─────────────────┐ ┌────────────────────────┐
│    patients     │ │      staff_tasks       │◄──┐
└────────┬────────┘ └────────────────────────┘   │ 1:N
         │                                       │
     1:N │                               ┌───────┴───────────────┐
         ▼                               │ recurring_task_rules  │
┌─────────────────┐                      └───────────────────────┘
│  appointments   │
└────────┬────────┘
         │
     1:N │
         ▼
┌─────────────────┐                      ┌───────────────────────┐
│    payments     │                      │      treatments       │
└─────────────────┘                      └───────────┬───────────┘
                                                     │ 1:N
┌─────────────────┐         1:N          ┌───────────▼───────────┐
│     orders      ├─────────────────────►│      order_items      │
└─────────────────┘                      └───────────▲───────────┘
                                                     │ 1:N
┌─────────────────┐         1:N          ┌───────────┴───────────┐
│   gift_cards    ├─────────────────────►│       products        │
└────────┬────────┘                      └───────────────────────┘
         │ 1:N
         ▼
┌─────────────────┐
│ gift_card_items │
└─────────────────┘
```

---

## 3. Especificación Detallada de Tablas Críticas

### A. Tabla `profiles` (RBAC Core)
- **Columnas:**
  * `id` (`uuid`, PK $ightarrow$ `auth.users.id`, ON DELETE CASCADE).
  * `email` (`text`, UNIQUE, NOT NULL).
  * `full_name` (`text`, NOT NULL).
  * `phone` (`text`, NULL).
  * `role` (`text`, NOT NULL, DEFAULT `'paciente'`, CHECK `role IN ('admin', 'medico', 'operativo', 'cosmetologa', 'paciente')`).
  * `created_at`, `updated_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **Triggers:**
  * `on_auth_user_created`: inserta automáticamente en `profiles` al registrarse en `auth.users`.
  * `profiles_updated_at`: actualiza el timestamp en cada modificación.
- **RLS Policies:**
  * `profiles_select_own_or_admin`: SELECT para el propio usuario (`auth.uid() = id`) o rol `admin`.
  * `profiles_update_own_or_admin`: UPDATE para el propio usuario o rol `admin`.

### B. Tabla `patients` (Ficha Médica y RFM)
- **Columnas:**
  * `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`).
  * `profile_id` (`uuid`, FK $ightarrow$ `profiles.id`, NULLABLE).
  * `full_name` (`text`, NOT NULL).
  * `dni` (`text`, UNIQUE, NULLABLE).
  * `phone` (`text`, NOT NULL).
  * `email` (`text`, NULLABLE).
  * `rfm_segment` (`text`, DEFAULT `'Nuevo'`, CHECK `rfm_segment IN ('Activos', 'En Riesgo', 'No Perder', 'Nuevo', 'Inactivo')`).
  * `notes` (`text`, NULLABLE).
  * `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **RLS Policies:**
  * Staff (`admin`, `medico`, `operativo`) acceso total.
  * Pacientes autenticados solo pueden leer su propio registro (`auth.uid() = profile_id`).

### C. Tabla `products` (Catálogo Dermocosmético)
- **Columnas:**
  * `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`).
  * `name` (`text`, NOT NULL).
  * `slug` (`text`, UNIQUE, NOT NULL).
  * `category` (`text`, NOT NULL).
  * `brand_type` (`text`, DEFAULT `'Sulderm'`).
  * `price_ars` (`numeric(12,2)`, NOT NULL).
  * `compare_price_ars` (`numeric(12,2)`, NULLABLE).
  * `stock_quantity` (`integer`, NOT NULL, DEFAULT 0).
  * `min_stock_alert` (`integer`, NOT NULL, DEFAULT 5).
  * `image_url` (`text`, NULLABLE).
  * `description` (`text`, NULLABLE).
  * `is_active` (`boolean`, NOT NULL, DEFAULT true).
  * `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
- **RLS Policies:**
  * Lectura pública (`SELECT true`).
  * Escritura restringida a `admin`, `operativo`, `cosmetologa`.

### D. Tabla `gift_cards` y `gift_card_items`
- **`gift_cards`:**
  * `id` (`uuid`, PK), `code` (`text`, UNIQUE, ej. `DL-8K49-P2MX`).
  * `amount_ars` (`numeric(12,2)`), `remaining_balance_ars` (`numeric(12,2)`).
  * `delivery_method` (`text`, CHECK `delivery_method IN ('digital', 'fisica')`).
  * `status` (`text`, CHECK `status IN ('pending_payment', 'active', 'redeemed', 'expired')`).
  * `expiration_date` (`timestamptz`, NOT NULL — 90 días corridos).
  * `sender_name`, `sender_email`, `recipient_name`, `dedication`.
- **`gift_card_items`:**
  * `id` (`uuid`, PK), `gift_card_id` (`uuid`, FK $ightarrow$ `gift_cards.id` ON DELETE CASCADE).
  * `item_type` (`text`, CHECK `item_type IN ('treatment', 'product', 'custom_amount')`).
  * `treatment_id` (`uuid`, FK $ightarrow$ `treatments.id`, NULLABLE).
  * `product_id` (`uuid`, FK $ightarrow$ `products.id`, NULLABLE).
  * `custom_amount_ars` (`numeric(12,2)`, NULLABLE).
  * `unit_price_ars` (`numeric(12,2)`, NOT NULL), `quantity` (`integer`, NOT NULL).
  * `subtotal_ars` (`numeric(12,2)`, NOT NULL), `item_title` (`text`, NOT NULL).

### E. Tabla `cookie_consents` (Privacidad y GDPR)
- **Columnas:**
  * `id` (`uuid`, PK), `ip_hash` (`text`, NOT NULL — SHA-256).
  * `analytics_accepted` (`boolean`, NOT NULL, DEFAULT false).
  * `marketing_accepted` (`boolean`, NOT NULL, DEFAULT false).
  * `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`).
