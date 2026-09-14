# 04 · Functional Inventory — Consultorio Dra. Paula Landaburo

**Fecha:** 14/09/2026  
**Criterio de Clasificación:** [VERIFICADO] en código fuente y base de datos real.  
**Estados Permitidos:** `IMPLEMENTED`, `PARTIAL`, `MOCK`, `BROKEN`, `NOT_IMPLEMENTED`, `UNKNOWN`.  

---

## 1. Inventario Detallado de Funcionalidades

### MÓDULO 1: INSTITUCIONAL & TRATAMIENTOS

#### FEAT-001: Catálogo Público de Tratamientos Médicos
- **Módulo:** Institucional
- **Descripción:** Visualización de fichas médicas de tratamientos con información clínica, indicaciones, beneficios y cuidados posteriores. Los precios monetarios están explícitamente omitidos para el público general por directiva médica.
- **Usuario:** Visitante / Paciente
- **Precondiciones:** Ninguna.
- **Trigger:** Navegación a `/tratamientos` o `/tratamientos/[slug]`.
- **Flujo:** El servidor pre-genera estáticamente las páginas de tratamientos desde `src/data/treatments.ts`. El usuario visualiza la ficha y puede hacer clic en "Agendá tu consulta" para ir al formulario de contacto o WhatsApp.
- **Resultado Esperado:** Ficha médica cargada en <100ms con rich snippets para SEO.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/app/tratamientos/page.tsx`, `src/app/tratamientos/[slug]/page.tsx`, `src/data/treatments.ts`.

#### FEAT-002: Formulario de Contacto y Captación de Leads
- **Módulo:** Institucional / Contacto
- **Descripción:** Captura de consultas de pacientes interesados en tratamientos, con validación de campos obligatorios, despacho transaccional por email vía Resend y guardado de lead en Supabase.
- **Usuario:** Visitante / Paciente
- **Precondiciones:** Completar Nombre, Email y Mensaje.
- **Trigger:** Clic en "Enviar mensaje" en `/contacto`.
- **Flujo:** Envío POST a `/api/contacto`. La API guarda en tabla `leads` (con service role), notifica a n8n si hay webhook activo, y despacha email con template HTML a la dirección médica.
- **Resultado Esperado:** Mensaje de éxito en pantalla y correo entregado.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/components/contacto/ContactForm.tsx`, `src/app/api/contacto/route.ts`.

#### FEAT-003: Banner de Consentimiento de Cookies (GDPR/APDP)
- **Módulo:** Seguridad / Privacidad
- **Descripción:** Banner flotante que solicita consentimiento para cookies esenciales, analítica (GA4) y marketing (Meta Pixel), persistiendo la decisión 12 meses.
- **Usuario:** Visitante
- **Precondiciones:** Primera visita o consentimiento expirado.
- **Trigger:** Carga de cualquier página pública.
- **Flujo:** `ConsentContext.tsx` verifica `localStorage` y `document.cookie`. Si no existe, muestra el banner. Al elegir "Aceptar todas" o "Solo necesarias", guarda en cookie con dominio `.dralandaburo.com` y envía POST a `/api/cookies/consent` para auditoría con IP hasheada en SHA-256.
- **Resultado Esperado:** Persistencia total sin reapariciones molestas.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/components/ui/CookieBanner.tsx`, `src/contexts/ConsentContext.tsx`, `src/app/api/cookies/consent/route.ts`.

---

### MÓDULO 2: E-COMMERCE DERMOCOSMÉTICA (SULDERM)

#### FEAT-004: Catálogo y Filtro de Productos Skincare
- **Módulo:** Tienda
- **Descripción:** Grilla de 31 productos Sulderm categorizados (Limpieza, Hidratación, Protección Solar, Antiage, Corporales, etc.) con buscador en vivo y badge de stock.
- **Usuario:** Visitante / Paciente
- **Precondiciones:** Productos cargados en tabla `products`.
- **Trigger:** Navegación a `/tienda`.
- **Flujo:** Lectura directa en servidor desde Supabase. En cliente, el usuario puede filtrar por categoría mediante tabs dinámicos.
- **Resultado Esperado:** Renderizado fluido de productos con precio ARS formateado.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/app/tienda/page.tsx`, `src/components/tienda/ProductCard.tsx`.

#### FEAT-005: Carrito de Compras en Cliente
- **Módulo:** Tienda / Carrito
- **Descripción:** Carrito de compras con persistencia local en `localStorage`, soporte para agregar, restar, eliminar productos y cálculo instantáneo del total.
- **Usuario:** Visitante / Paciente
- **Precondiciones:** Producto activo con stock > 0.
- **Trigger:** Clic en "Agregar al carrito" en tarjeta o detalle de producto.
- **Flujo:** `CartContext.tsx` actualiza el estado en memoria y sincroniza en `localStorage` (`cart_items_v1`). El header actualiza el contador del carrito (`CartIcon.tsx`).
- **Resultado Esperado:** Carrito persistente entre recargas y navegación.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/contexts/CartContext.tsx`, `src/app/tienda/carrito/page.tsx`.

#### FEAT-006: Checkout MercadoPago para E-commerce
- **Módulo:** Tienda / Checkout
- **Descripción:** Generación de orden de compra y redirección a pasarela segura de MercadoPago.
- **Usuario:** Paciente comprador
- **Precondiciones:** Carrito con al menos 1 ítem y credenciales de contacto completas.
- **Trigger:** Clic en "Iniciar Pago" en `/tienda/carrito`.
- **Flujo:** POST a `/api/checkout/mercadopago`. La API valida precios contra la base de datos (seguridad server-side), crea registro en `orders` y `order_items` con estado `pending`, genera preferencia en MercadoPago y retorna el `init_point` para redirección.
- **Resultado Esperado:** Redirección al checkout de MercadoPago.
- **Estado Actual:** `PARTIAL` (Código completo, requiere `MP_ACCESS_TOKEN` de producción).
- **Evidencia:** `src/app/api/checkout/mercadopago/route.ts`, `src/app/api/webhook/mercadopago/route.ts`.

---

### MÓDULO 3: GIFT CARDS COMBINABLES

#### FEAT-007: Constructor de Gift Cards Multiproducto
- **Módulo:** Tienda / Gift Cards
- **Descripción:** Interfaz interactiva que permite armar tarjetas de regalo personalizadas combinando tratamientos de Cosmiatría (Mercedes Pasquet), productos Sulderm y saldo libre en pesos ($ ARS).
- **Usuario:** Comprador
- **Precondiciones:** Ninguna.
- **Trigger:** Navegación a `/tienda/gift-cards`.
- **Flujo:** El usuario selecciona ítems o ingresa monto libre ($ge $10.000$). Completa datos de remitente, agasajado, dedicatoria (máx 200 caracteres) y modalidad de entrega (Digital o Física para retiro en consultorio). Visualiza preview en vivo.
- **Resultado Esperado:** Generación de Gift Card con código `DL-XXXX-XXXX` y vigencia de 90 días.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/app/tienda/gift-cards/page.tsx`, `src/app/tienda/gift-cards/GiftCardForm.tsx`, `src/app/api/gift-cards/checkout/route.ts`.

#### FEAT-008: Validador y Canje Operativo de Gift Cards
- **Módulo:** Dashboard / Operativo
- **Descripción:** Interfaz administrativa para que el staff verifique el saldo y aplique el canje de una Gift Card presencialmente en consultorio.
- **Usuario:** Staff (`admin`, `operativo`)
- **Precondiciones:** Código alfanumérico `DL-XXXX-XXXX` provisto por el paciente.
- **Trigger:** Búsqueda en `/dashboard/operativo/gift-cards`.
- **Flujo:** Consulta a `/api/gift-cards/lookup`. Muestra estado (`active`, `redeemed`, `expired`), saldo disponible, fecha de vencimiento y dedicatoria. Al confirmar, ejecuta POST a `/api/gift-cards/redeem`.
- **Resultado Esperado:** Saldo debitado o tarjeta marcada como canjeada.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/app/dashboard/operativo/gift-cards/page.tsx`, `src/app/api/gift-cards/lookup/route.ts`, `src/app/api/gift-cards/redeem/route.ts`.

---

### MÓDULO 4: KIOSCO & CONSENTIMIENTOS

#### FEAT-009: Kiosco de Admisión Presencial (Check-in)
- **Módulo:** Kiosco
- **Descripción:** Terminal táctil en sala de espera para check-in rápido de pacientes con DNI o Nombre y actualización de teléfono/email.
- **Usuario:** Paciente en sala de espera
- **Precondiciones:** Terminal en pantalla completa en `/kiosco`.
- **Trigger:** Paciente ingresa DNI o Nombre y presiona "Confirmar Llegada".
- **Flujo:** POST a `/api/kiosco/admision`. El backend registra el evento en `kiosk_admissions` y vincula/actualiza la ficha en `patients`.
- **Resultado Esperado:** Pantalla de bienvenida personalizada y notificación en panel operativo.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/app/kiosco/page.tsx`, `src/app/api/kiosco/admision/route.ts`.

#### FEAT-010: Consentimientos Médicos Digitales
- **Módulo:** Legal / Médico
- **Descripción:** Visualización de términos médicos de procedimientos y captura de firma digital en canvas táctil.
- **Usuario:** Paciente / Staff
- **Trigger:** Navegación a `/consentimientos`.
- **Resultado Esperado:** Firma digitalizada y almacenada.
- **Estado Actual:** `IMPLEMENTED` (UI y captura de firma funcionales).
- **Evidencia:** `src/app/consentimientos/page.tsx`.

---

### MÓDULO 5: DASHBOARD DE GESTIÓN (OPERATIVO & EJECUTIVO)

#### FEAT-011: Matriz de Control de Acceso Granular por Sección
- **Módulo:** Dashboard / Seguridad
- **Descripción:** Sistema de permisos que evalúa qué secciones del dashboard puede ver cada usuario combinando defaults del rol y excepciones específicas.
- **Usuario:** Administrador (`admin`)
- **Trigger:** Configuración en `/dashboard/usuarios`.
- **Flujo:** Server Action `toggleSectionPermission` actualiza `user_section_overrides`. El layout y las páginas evalúan `permissions.ts` en cada request.
- **Resultado Esperado:** Menú lateral y rutas adaptadas exactamente al perfil del usuario.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/lib/permissions.ts`, `src/app/dashboard/usuarios/page.tsx`.

#### FEAT-012: Generador Automático de Tareas del Staff
- **Módulo:** Dashboard / Operativo
- **Descripción:** Motor de reglas que genera automáticamente tareas diarias para el personal (control de stock los viernes, cierre de mes el último día hábil, saludos de cumpleaños).
- **Usuario:** Staff (`operativo`, `cosmetologa`)
- **Flujo:** `tasks-generator.ts` evalúa `recurring_task_rules`, verifica días no laborables en `clinic_closed_days` y genera tareas en `staff_tasks` de forma idempotente.
- **Resultado Esperado:** Lista de tareas del día visible en `/dashboard/operativo`.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/lib/tasks-generator.ts`, `src/app/dashboard/operativo/page.tsx`.

#### FEAT-013: Alertas de Stock Bajo y Carga de Fotos Drag & Drop
- **Módulo:** Dashboard / Productos
- **Descripción:** Alerta visual de insumos con $le 5$ unidades en panel operativo y modal de edición de productos con subida de imágenes a Supabase Storage vía Drag & Drop.
- **Usuario:** Staff / Admin
- **Flujo:** En `/dashboard/productos`, el modal permite arrastrar fotos (`.png`, `.jpg`, `.webp`). La Server Action `uploadProductImage` sube el archivo al bucket `products` y asigna la URL pública.
- **Resultado Esperado:** Foto actualizada en catálogo y tienda.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/app/dashboard/productos/ProductTable.tsx`, `src/app/dashboard/productos/actions.ts`.

#### FEAT-014: Mesa de Control de Ingesta y Revisión Manual
- **Módulo:** Dashboard / Revisión
- **Descripción:** Interfaz para auditar y resolver discrepancias en registros de pacientes y pagos provenientes de pipelines automáticos.
- **Usuario:** Staff / Admin
- **Trigger:** Navegación a `/dashboard/revision`.
- **Flujo:** Lee registros en estado `pending` de `ingest_review`. Permite resolver (`resolveReviewItem`) o descartar (`dismissReviewItem`) con notas de auditoría.
- **Resultado Esperado:** Trazabilidad completa de datos clínicos y financieros.
- **Estado Actual:** `IMPLEMENTED`
- **Evidencia:** `src/lib/ingest-review.ts`, `src/app/dashboard/revision/page.tsx`.
