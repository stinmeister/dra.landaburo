# Deuda Técnica, Anomalías y Plan de Remediación

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14
Severidad Global de Deuda Técnica: MEDIA-BAJA (Arquitectura sólida, brechas de sincronización identificadas)

---

## 1. Inventario Priorizado de Deuda Técnica

A continuación se detallan las deudas técnicas y discrepancias reales identificadas durante la ingeniería inversa del sistema:

| ID | Área / Componente | Severidad | Descripción de la Deuda / Anomalía | Impacto | Recomendación de Remediación |
|---|---|---|---|---|---|
| **DEBT-01** | Base de Datos vs Código | **ALTA** | La tabla `treatments` en Supabase contiene 15 registros mientras que el archivo `src/data/treatments.ts` define 102 variantes. | Inconsistencia si el dashboard intenta editar tratamientos que no están en BD. | Ejecutar script de seed/sincronización que migre los 102 tratamientos de código a la tabla `treatments` con sus precios y categorías. |
| **DEBT-02** | Pipeline Financiero | **ALTA** | La tabla `payments` cuenta con 4 registros de prueba y no existe un pipeline automatizado activo desde Calu/Google Sheets hacia Supabase. | El dashboard ejecutivo de ingresos/egresos no refleja la facturación histórica real del consultorio. | Construir y activar el workflow en n8n que sincronice las planillas de facturación con Supabase. |
| **DEBT-03** | Tabla Legacy | **BAJA** | Existe la tabla `employee_tasks` en desuso tras la migración a `staff_tasks` y `recurring_task_rules`. | Confusión en el schema y consumo residual de espacio. | Deprecar y eliminar la tabla `employee_tasks` tras archivar cualquier dato histórico. |
| **DEBT-04** | Cobertura de Tests | **MEDIA** | No existen tests unitarios (Jest/Vitest) ni tests end-to-end (Playwright) para los flujos críticos de checkout y webhooks. | Riesgo de regresión en actualizaciones de dependencias o refactors. | Implementar suite de tests para el webhook de Mercado Pago, la verificación HMAC y el cálculo de precios server-side. |
| **DEBT-05** | Fallback de Tipos en API | **BAJA** | Algunos Route Handlers (`/api/ingest/*`) utilizan tipos genéricos `any` en la validación de payloads de entrada. | Pérdida de type-safety en tiempo de desarrollo. | Incorporar validación con esquemas Zod en todas las rutas de la API. |

---

## 2. Anomalías Arquitectónicas Menores

1. **Local Storage en Carrito:** Si un usuario inicia una compra en un dispositivo y cambia a otro, el carrito no se sincroniza. Para el volumen actual es adecuado, pero a futuro podría persistirse en sesión/base de datos para usuarios logueados.
2. **Bypass RLS en Ingestas:** Las rutas de ingesta de n8n utilizan `SUPABASE_SERVICE_ROLE_KEY`. Si bien es el estándar para procesos backend seguros, se recomienda mantener la rotación periódica del `INGEST_API_KEY`.
