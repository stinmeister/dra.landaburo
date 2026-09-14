# Estado Actual del Sistema y Fotografía de Producción

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14
Entorno: AWS EC2 Bitnami Linux (Producción) / Repositorio Local (Desarrollo)

---

## 1. Fotografía de Versiones y Runtime

- **Framework:** Next.js 16.2.11 (React 19.2.4, React DOM 19.2.4)
- **Compilador:** Next.js Turbopack / TypeScript 5
- **Runtime de Producción:** Node.js 20+ / PM2 (`dra-landaburo`)
- **Web Server / Proxy:** Apache 2.4 con Let's Encrypt SSL
- **Base de Datos Cloud:** Supabase PostgreSQL 15 Managed Cloud
- **Modo de Empaquetado:** Standalone Output (`output: 'standalone'`)

---

## 2. Métricas de Datos Reales en Base de Datos (Auditoría SQL Directa)

| Tabla | Registros Verificados | Estado Operativo |
|---|---|---|
| `patients` | **924** | Pacientes cargados (DNI, nombre, historial) |
| `products` | **31** | Línea completa de Skincare Sulderm activa |
| `treatments` | **15** (en BD) / **102** (en código) | Catálogo base funcional en web |
| `profiles` | **6** | Usuarios staff (médica, cosmiatra, secretarias, admin) |
| `role_section_defaults` | **32** | Matriz base de permisos RBAC |
| `user_section_overrides` | **2** | Excepciones individuales de permisos |
| `posts` | **2** | Artículos de blog publicados |
| `cookie_consents` | **18** | Consentimientos auditados con hash SHA-256 |
| `leads` | **6** | Consultas recibidas vía formulario |
| `ingest_review` | **12** | Registros en cola de revisión |
| `staff_tasks` | **3** | Tareas operativas de hoy |
| `recurring_task_rules` | **3** | Reglas de tareas recurrentes activas |
| `payments` | **4** | Transacciones de prueba registradas |
| `orders` | **0** | Listo para órdenes reales de tienda |
| `gift_cards` | **0** | Listo para emisión y canje |
| `kiosk_admissions` | **0** | Listo para check-in en sala de espera |
| `app_settings` | **1** | Configuración general y secretos |

---

## 3. Estado de Funcionalidades Principales

- ✅ **Sitio Web Público:** Landing page, bio de la Dra. Landaburo, equipo, testimonios de Google, páginas de tratamientos y formulario de contacto operativos al 100%.
- ✅ **Tienda Online (E-Commerce):** Catálogo Sulderm, carrito con persistencia en localStorage y checkout verificado en servidor con Mercado Pago.
- ✅ **Gift Cards Digitales & Físicas:** Configurador de regalos para Cosmiatría y montos en pesos, emisión de código `DL-XXXX-XXXX` y validación en recepción.
- ✅ **Kiosco de Sala de Espera (`/kiosco`):** Check-in simplificado por DNI para agilizar la recepción de pacientes.
- ✅ **Panel Administrativo (`/dashboard`):** Control de acceso por roles (RBAC) de 8 secciones, gestión de tareas diarias del staff, blog y tratamientos.
- 🟡 **Pipeline Financiero n8n:** Estructura de base de datos lista; workflow de sincronización masiva desde hojas de cálculo en construcción.
