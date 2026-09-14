# 05 · Feature State Matrix — Consultorio Dra. Paula Landaburo

**Fecha:** 14/09/2026  
**Criterio de Evaluación:** [VERIFICADO] Capa por Capa (UI, Backend, Base de Datos, API, Integración, QA)  

---

## 1. Matriz de Estados por Funcionalidad

| Feature ID | Nombre de la Funcionalidad | Estado General | UI | Backend | DB | API | Integración | QA / Verificación |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **FEAT-001** | Catálogo Tratamientos Médicos | **Fully Implemented** | ✅ | ✅ | ✅ | N/A | N/A | Compilado SSG (49 rutas) |
| **FEAT-002** | Formulario Contacto & Leads | **Fully Implemented** | ✅ | ✅ | ✅ | ✅ | ✅ | Resend + Supabase Leads |
| **FEAT-003** | Cookie Consent Persistente | **Fully Implemented** | ✅ | ✅ | ✅ | ✅ | ✅ | 12 meses / SHA-256 IP |
| **FEAT-004** | Catálogo Dermocosmética | **Fully Implemented** | ✅ | ✅ | ✅ | N/A | N/A | 31 productos Sulderm en DB |
| **FEAT-005** | Carrito de Compras (Local) | **Fully Implemented** | ✅ | ✅ | N/A | N/A | N/A | Persistencia en localStorage |
| **FEAT-006** | Checkout MercadoPago | **Partially Implemented** | ✅ | ✅ | ✅ | ✅ | ⚠️ | Requiere MP_ACCESS_TOKEN prod |
| **FEAT-007** | Gift Cards Constructor | **Fully Implemented** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 90 días validez / Filtro médico |
| **FEAT-008** | Canje Gift Cards Operativo | **Fully Implemented** | ✅ | ✅ | ✅ | ✅ | N/A | Lookup & Redeem verificados |
| **FEAT-009** | Kiosco de Admisión Presencial| **Fully Implemented** | ✅ | ✅ | ✅ | ✅ | N/A | Check-in en kiosk_admissions |
| **FEAT-010** | Consentimientos Médicos | **Fully Implemented** | ✅ | ✅ | ✅ | N/A | N/A | Firma en Canvas interactivo |
| **FEAT-011** | RBAC & Permisos por Sección | **Fully Implemented** | ✅ | ✅ | ✅ | N/A | N/A | 32 defaults + 2 overrides en DB |
| **FEAT-012** | Tareas Automáticas del Staff | **Fully Implemented** | ✅ | ✅ | ✅ | ✅ | N/A | Motor idempotente en tasks-gen |
| **FEAT-013** | Drag & Drop Fotos Productos | **Fully Implemented** | ✅ | ✅ | ✅ | N/A | ✅ | Supabase Storage bucket 'products' |
| **FEAT-014** | Mesa de Control de Ingesta | **Fully Implemented** | ✅ | ✅ | ✅ | N/A | N/A | 12 registros en ingest_review |
| **FEAT-015** | CMS Blog & Artículos Médicos | **Fully Implemented** | ✅ | ✅ | ✅ | ✅ | N/A | Markdown / Borradores clínicos |
| **FEAT-016** | Dashboard Financiero (KPIs) | **Partially Implemented** | ✅ | ✅ | ✅ | N/A | ⚠️ | UI lista / DB payments vacía |
| **FEAT-017** | Monitoreo Campañas Pauta | **Fully Implemented** | ✅ | ✅ | ✅ | ✅ | N/A | Ingest API & Widget listos |
| **FEAT-018** | Sincronización n8n Calu/Sheets| **Partially Implemented** | N/A | ✅ | ✅ | ✅ | ⚠️ | Workflows n8n inactivos en cloud |
| **FEAT-019** | Portal del Paciente | **Fully Implemented** | ✅ | ✅ | ✅ | N/A | N/A | Historial de órdenes y cards |
| **FEAT-020** | Tracking GA4 & Meta Pixel | **Fully Implemented** | ✅ | ✅ | N/A | N/A | ✅ | Bloqueo por falta de consent |

---

## 2. Convenciones de Estados en la Matriz

- **✅ (Verificado / Completo):** Código existente, probado y enlazado con la base de datos o API correspondiente.
- **⚠️ (Pendiente de Configuración Externa):** El código está terminado, pero requiere que se complete una credencial de terceros (ej. Token de MercadoPago de producción o activación de webhook en n8n Cloud).
- **N/A (No Aplica):** La funcionalidad no requiere esa capa específica (ej. el carrito de cliente no requiere base de datos hasta el checkout).
