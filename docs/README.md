# Base de Conocimiento y Documentación Técnica Oficial — dralandaburo.com

**Versión del Sistema:** 2.0.0 (Next.js 16 App Router + Supabase PostgreSQL 15 + AWS EC2)  
**Fecha de Publicación Oficial:** 14 de Octubre de 2026  
**Último Commit Desplegado:** `5ca414d`  
**Host de Producción:** AWS EC2 Bitnami (`54.94.94.20`) · Dominio: `https://dralandaburo.com`  
**Auditoría y Validación:** ✅ 100% Verificado contra el código fuente, base de datos viva e infraestructura en producción.

---

> [!IMPORTANT]
> **Nueva Documentación Oficial (14/10/2026):**
> Este repositorio cuenta con un nuevo cuerpo documental consolidado de **16 volúmenes numerados (`00_INDICE.md` a `15_ESTADO_Y_DEUDA.md`)**, verificado minuciosamente contra la realidad de la base de datos (34 tablas, 5 RPCs, 10 usuarios) y el código de Next.js 16. Los documentos antiguos (fechados el 14/09/2026) se conservan exclusivamente con fines de archivo histórico y han sido formalmente superados.
>
> 🧭 **Para comenzar a leer, dirigirse a:** [**00_INDICE.md — Índice Maestro y Guía de Navegación**](./00_INDICE.md)

---

## 📚 Cuerpo Documental Oficial (16 Volúmenes)

### 🏛️ Fundamentos, Arquitectura y Datos
* [**00. Índice Maestro y Guía de Navegación**](./00_INDICE.md): Mapas de lectura según objetivo (entender, QA, operar, desarrollar) y tabla de absorción histórica.
* [**01. Visión General, Propósito y Alcance**](./01_VISION_Y_ALCANCE.md): Propósito clínico-comercial, audiencias, qué resuelve y qué deliberadamente NO hace el sistema.
* [**02. Arquitectura Técnica y de Despliegue**](./02_ARQUITECTURA.md): Diagramas de despliegue y componentes, trampa del standalone con doble `.env.local`, cache de PostgREST y ADRs.
* [**03. Modelo de Datos y Esquema Relacional**](./03_MODELO_DE_DATOS.md): Diagramas ER por dominio, auditoría de las 34 tablas, columnas, índices, RLS, triggers y 5 RPCs.

### ⚙️ Funcionalidad, Roles y Dinámica de Estados
* [**04. Mapa Funcional y Matriz de Capacidades**](./04_MAPA_FUNCIONAL.md): Mindmap jerárquico, catálogo de 39 rutas y matriz de los 5 estados de capacidad.
* [**05. Roles, Permisos y Control de Acceso (RBAC)**](./05_ROLES_Y_PERMISOS.md): RBAC de dos niveles (`role_section_defaults` + `user_section_overrides`) y 4 líneas defensivas de guards.
* [**06. Recorridos de Usuario (User Journeys) y Personas**](./06_USER_JOURNEYS.md): Los 8 perfiles del consultorio, puntos de dolor y recorridos ciegos nunca ocurridos.
* [**07. Procesos Operativos de Consultorio**](./07_PROCESOS_OPERATIVOS.md): Diagramas de actividad de apertura, atención, cobro, cierre diario de caja y arqueo de inventario.
* [**08. Flujos Críticos del Sistema (Sequence Diagrams)**](./08_FLUJOS_CRITICOS.md): Diagramas de secuencia de compra online, movimientos de stock, auth/RBAC, n8n, borrado y contacto.
* [**09. Máquinas de Estado y Ciclos de Vida**](./09_MAQUINAS_DE_ESTADO.md): State diagrams con CHECKs reales para pedidos, tareas, gift cards, leads, stock y Meta CAPI.

### 🎨 Diseño, Servicios Externos, Seguridad y Operación
* [**10. Sistema de Diseño UX/UI, Componentes y Patrones**](./10_UX_UI_Y_PATRONES.md): Tokens champagne, tipografías, CSS Modules, catálogo de 46 componentes y accesibilidad (a11y).
* [**11. Integraciones y Servicios Externos**](./11_INTEGRACIONES.md): Mercado Pago, Resend Mail, n8n Automation, Meta Conversions API (CAPI), Google Analytics 4 y Storage.
* [**12. Modelo de Seguridad, Políticas RLS y Protección**](./12_SEGURIDAD.md): Modelo STRIDE, RLS tabla por tabla, aislamiento de secretos y corrección de fugas históricas.
* [**13. Manual de Operación, Despliegue y Mantenimiento**](./13_OPERACION_Y_DESPLIEGUE.md): Manual paso a paso en EC2, PM2 zero-downtime, verificación anti-fallbacks y regla de oro DDL.
* [**14. Glosario Integral de Términos**](./14_GLOSARIO.md): Definiciones rigurosas de términos médicos/clínicos, operativos/comerciales y técnicos de software.
* [**15. Estado de Situación, Deuda Técnica y Backlog**](./15_ESTADO_Y_DEUDA.md): Fotografía de producción al 14/10, tareas del backlog Notion (`FIX-0XX`), bloqueos y deuda técnica.

---

## 🧭 Guías Rápidas de Lectura por Rol

- **👨‍💻 Desarrollador Nuevo / Agente IA:** Iniciar por [01. Visión y Alcance](./01_VISION_Y_ALCANCE.md), [02. Arquitectura](./02_ARQUITECTURA.md), [04. Mapa Funcional](./04_MAPA_FUNCIONAL.md) y [14. Glosario](./14_GLOSARIO.md).
- **🧪 QA & Auditoría Técnica:** Iniciar por [04. Mapa Funcional](./04_MAPA_FUNCIONAL.md), [08. Flujos Críticos](./08_FLUJOS_CRITICOS.md), [09. Máquinas de Estado](./09_MAQUINAS_DE_ESTADO.md) y [15. Estado y Deuda](./15_ESTADO_Y_DEUDA.md).
- **🏥 Operación de Consultorio y Mostrador:** Iniciar por [05. Roles y Permisos](./05_ROLES_Y_PERMISOS.md), [06. User Journeys](./06_USER_JOURNEYS.md) y [07. Procesos Operativos](./07_PROCESOS_OPERATIVOS.md).
- **🚀 DevOps & Despliegues:** Iniciar por [02. Arquitectura](./02_ARQUITECTURA.md), [03. Modelo de Datos](./03_MODELO_DE_DATOS.md), [12. Seguridad](./12_SEGURIDAD.md) y [13. Operación y Despliegue](./13_OPERACION_Y_DESPLIEGUE.md).

---

## 📜 Archivos Históricos Conservados (Superados)

Para consultar el estado de la documentación previa a la ronda del 14/10/2026, los archivos originales se encuentran disponibles con encabezados de advertencia histórica:
- `01_SYSTEM_OVERVIEW.md` · `02_TECHNICAL_ARCHITECTURE.md` · `03_ROUTES_AND_INFORMATION_ARCHITECTURE.md` · `04_FUNCTIONAL_INVENTORY.md` · `05_FEATURE_STATE_MATRIX.md` · `06_DATABASE.md` · `07_API_DOCUMENTATION.md` · `08_SECURITY.md` · `09_USER_JOURNEYS.md` · `10_UX_UI.md` · `11_COMPONENT_INVENTORY.md` · `12_PAYMENTS_AND_COMMERCE.md` · `13_INTEGRATIONS.md` · `14_INFRASTRUCTURE.md` · `15_CONFIGURATION.md` · `16_ERROR_AND_STATE_MODEL.md` · `17_CONTENT_MODEL.md` · `18_SEO_ACCESSIBILITY.md` · `19_PERFORMANCE.md` · `20_TECHNICAL_DEBT.md` · `21_CURRENT_STATE.md` · `22_GLOSSARY.md` · `DOCUMENTATION_COVERAGE.md` · `RESPUESTAS_QA_03SEP_OLA5.md`.
