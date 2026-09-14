# Base de Conocimiento y Documentación Técnica Integral — dralandaburo.com

**Versión del Sistema:** 1.0.0 (Next.js 16.2.11 + Turbopack + Supabase PostgreSQL)  
**Fecha de Publicación:** 14 de Septiembre de 2026  
**Auditoría y Validación:** 100% Verificado contra el código fuente, base de datos de producción e infraestructura real.

---

## 📖 Mapa de la Documentación (24 Documentos)

La documentación se organiza en 24 volúmenes estructurados para ofrecer cobertura exhaustiva a desarrolladores, arquitectos, administradores y dirección médica:

### 🏛️ Visión General, Arquitectura y Rutas
1. [**01. Visión General del Sistema**](./01_SYSTEM_OVERVIEW.md): Resumen ejecutivo, propósito médico-comercial, capacidades clave y stack tecnológico.
2. [**02. Arquitectura Técnica**](./02_TECHNICAL_ARCHITECTURE.md): Diagramas de capas (Frontend, Backend, Servicios Externos), flujo de datos y renderizado RSC.
3. [**03. Rutas y Arquitectura de Información**](./03_ROUTES_AND_INFORMATION_ARCHITECTURE.md): Mapa completo de las 49 rutas públicas, protegidas, kiosco y API endpoints.
4. [**04. Inventario Funcional**](./04_FUNCTIONAL_INVENTORY.md): Desglose de las 7 áreas funcionales (Web, Tienda, Gift Cards, Kiosco, Dashboard, Blog, Tracking).
5. [**05. Matriz de Estados de Funcionalidades**](./05_FEATURE_STATE_MATRIX.md): Tabla de estado de madurez operativa de cada funcionalidad del sistema.

### 🗄️ Datos, API, Seguridad y Experiencia de Usuario
6. [**06. Base de Datos y Modelado**](./06_DATABASE.md): Auditoría de 23 tablas en Supabase, conteos exactos de registros, llaves foráneas y tipos ENUM.
7. [**07. Documentación de API**](./07_API_DOCUMENTATION.md): Especificación técnica de los 13 Route Handlers de Next.js, payloads, auth y webhooks.
8. [**08. Seguridad, Autenticación y RBAC**](./08_SECURITY.md): Modelo de permisos de dos niveles, políticas RLS, validación HMAC y auditoría de cookies.
9. [**09. Recorridos de Usuario (User Journeys)**](./09_USER_JOURNEYS.md): Diagramas de secuencia y flujos paso a paso para pacientes, staff y administradores.
10. [**10. Sistema de Diseño UX/UI**](./10_UX_UI.md): Paleta de colores champagne/monocromática, tipografía Playfair/IBM Plex, CSS Modules y responsive design.

### 🧩 Componentes, Comercio, Integraciones e Infraestructura
11. [**11. Inventario de Componentes**](./11_COMPONENT_INVENTORY.md): Catálogo exhaustivo de los 39 componentes de React, props, estado e interactividad.
12. [**12. Pagos, Comercio y Gift Cards**](./12_PAYMENTS_AND_COMMERCE.md): Flujo de checkout con Mercado Pago, carrito, emisión de códigos `DL-XXXX-XXXX` y canjes.
13. [**13. Integraciones y Servicios Externos**](./13_INTEGRATIONS.md): Supabase, Mercado Pago, Resend, n8n, Meta Pixel, Google Analytics 4 y Google Maps.
14. [**14. Infraestructura y Despliegue**](./14_INFRASTRUCTURE.md): Servidor AWS EC2 (Bitnami Linux), Apache 2.4 reverse proxy, PM2 y pipeline PowerShell.
15. [**15. Configuración y Variables de Entorno**](./15_CONFIGURATION.md): Matriz de 14 variables de entorno públicas/privadas y parámetros dinámicos en base de datos.

### ⚙️ Estados, Contenido, SEO, Rendimiento y Deuda Técnica
16. [**16. Modelo de Estados y Manejo de Errores**](./16_ERROR_AND_STATE_MODEL.md): Máquinas de estado de órdenes, gift cards, tareas y admisiones, códigos HTTP y fallbacks.
17. [**17. Modelo de Contenido y Copybook**](./17_CONTENT_MODEL.md): Catálogo de tratamientos médicos, línea Skincare Sulderm y reglas lingüísticas oficiales.
18. [**18. SEO, Metadatos y Accesibilidad**](./18_SEO_ACCESSIBILITY.md): Schemas JSON-LD (MedicalBusiness, Physician), metadatos dinámicos, sitemap y WCAG AA.
19. [**19. Rendimiento y Métricas Web**](./19_PERFORMANCE.md): Optimización Turbopack, Standalone container, WebP/AVIF y zero-runtime CSS.
20. [**20. Deuda Técnica y Plan de Remediación**](./20_TECHNICAL_DEBT.md): Priorización de discrepancias encontradas, sincronización de BD y testing.

### 📸 Estado Actual, Glosario y Cobertura
21. [**21. Estado Actual del Sistema**](./21_CURRENT_STATE.md): Fotografía en tiempo real de producción, versiones y métricas de registros en base de datos.
22. [**22. Glosario Técnico y Clínico**](./22_GLOSSARY.md): Definiciones precisas de términos de ingeniería web y conceptos de medicina estética.
23. [**23. Índice Maestro (Este Archivo)**](./README.md): Guía de lectura y punto de entrada central.
24. [**24. Matriz de Cobertura de Documentación**](./DOCUMENTATION_COVERAGE.md): Mapeo 1:1 entre elementos físicos del código y su documentación correspondiente.

---

## 🧭 Guías de Lectura por Rol

- **👨‍💻 Desarrollador Frontend:** Iniciar por [11. Componentes](./11_COMPONENT_INVENTORY.md), [10. UX/UI](./10_UX_UI.md), [03. Rutas](./03_ROUTES_AND_INFORMATION_ARCHITECTURE.md) y [12. Comercio](./12_PAYMENTS_AND_COMMERCE.md).
- **🔧 Desarrollador Backend & Datos:** Iniciar por [06. Base de Datos](./06_DATABASE.md), [07. API](./07_API_DOCUMENTATION.md), [08. Seguridad](./08_SECURITY.md) y [13. Integraciones](./13_INTEGRATIONS.md).
- **🚀 DevOps & SysAdmin:** Iniciar por [14. Infraestructura](./14_INFRASTRUCTURE.md), [15. Configuración](./15_CONFIGURATION.md) y [21. Estado Actual](./21_CURRENT_STATE.md).
- **👩‍⚕️ Dirección Médica & Producto:** Iniciar por [01. Visión General](./01_SYSTEM_OVERVIEW.md), [04. Inventario Funcional](./04_FUNCTIONAL_INVENTORY.md) y [17. Contenido & Copybook](./17_CONTENT_MODEL.md).
