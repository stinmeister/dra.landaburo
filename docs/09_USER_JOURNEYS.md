# 09 · User Journeys — Flujos de Usuario

**Fecha:** 14/09/2026  
**Estado:** [VERIFICADO] Reconstrucción de journeys de extremo a extremo  

---

## 1. Mapeo de Flujos Principales

### Journey 1: Descubrimiento y Solicitud de Consulta Médica
- **Actor:** Paciente potencial / Visitante.
- **Trigger:** Ingreso a la web desde búsqueda orgánica o pauta en redes.
- **Pasos:**
  1. Ingreso a `/` $ightarrow$ Lectura del Hero, especialidades y biografía de la Dra. Landaburo.
  2. Navegación a `/tratamientos` $ightarrow$ Selección de tratamiento (ej. *Toxina Botulínica* o *Nordlys*).
  3. Lectura de ficha técnica en `/tratamientos/[slug]` $ightarrow$ Clic en "Agendá tu consulta".
  4. Redirección a `/contacto` $ightarrow$ Completa Nombre, Email, Teléfono y Mensaje.
  5. Envío de formulario $ightarrow$ Notificación en pantalla, email enviado vía Resend y lead registrado en Supabase.
- **Resultado:** Lead captado con tratamiento de interés asociado.

---

### Journey 2: Compra de Dermocosmética en E-commerce
- **Actor:** Paciente / Comprador online.
- **Trigger:** Interés en reponer cremas o productos post-tratamiento.
- **Pasos:**
  1. Ingreso a `/tienda` $ightarrow$ Filtro por categoría (ej. *Protección Solar* o *Sérums*).
  2. Clic en producto $ightarrow$ Lectura de detalles en `/tienda/[slug]`.
  3. Clic en "Agregar al carrito" $ightarrow$ El icono del carrito en el Header se actualiza.
  4. Ingreso a `/tienda/carrito` $ightarrow$ Ajuste de cantidades y clic en "Iniciar Pago".
  5. Redirección a pasarela de MercadoPago $ightarrow$ Selección de medio de pago (Tarjeta / Dinero en cuenta).
  6. Finalización del pago $ightarrow$ Redirección a `/tienda/pago/exito` con número de orden.
- **Resultado:** Orden registrada en estado `approved` y confirmación en pantalla.

---

### Journey 3: Armado y Compra de Gift Card Combinable
- **Actor:** Comprador de regalo.
- **Trigger:** Búsqueda de regalo personalizado para una amiga o familiar.
- **Pasos:**
  1. Clic en "Gift Card" en el Header o navegación a `/tienda/gift-cards`.
  2. Selección de ítems: Elige un tratamiento de Cosmiatría (ej. *Peeling Químico & Renovación Celular*), suma una *Espuma 3 en 1* y agrega $$20.000$ de saldo libre.
  3. Completado de datos: Nombre del remitente, email, nombre del agasajado y dedicatoria personal.
  4. Selección de entrega: Digital (por email) o Física (voucher de lujo para retirar en consultorio).
  5. Clic en "Comprar Gift Card" $ightarrow$ Generación de código `DL-XXXX-XXXX` y redirección a MercadoPago.
  6. Acreditación $ightarrow$ Gift Card queda activa por 90 días corridos.
- **Resultado:** Tarjeta de regalo emitida y lista para ser canjeada.

---

### Journey 4: Check-in Presencial en Kiosco de Recepción
- **Actor:** Paciente que ingresa al consultorio físico.
- **Trigger:** Arribo a sala de espera en Leandro N. Alem 45.
- **Pasos:**
  1. Paciente se acerca a la terminal táctil en `/kiosco`.
  2. Ingresa su DNI o Nombre en pantalla completa.
  3. Confirma o actualiza su número de teléfono celular y correo electrónico.
  4. Presiona "Confirmar Llegada".
  5. Pantalla muestra mensaje de bienvenida: "¡Gracias María! Tomá asiento, la Dra. Landaburo te llamará a la brevedad."
- **Resultado:** Recepción notificada de la llegada del paciente sin requerir interacción manual.

---

### Journey 5: Gestión Operativa Diaria del Staff (Ceci / Laura)
- **Actor:** Recepcionista / Asistente.
- **Trigger:** Inicio de jornada laboral a las 10:00 hs.
- **Pasos:**
  1. Ingreso a `/login` $ightarrow$ Autenticación con credenciales operativas.
  2. Redirección automática a `/dashboard/operativo`.
  3. Visualización de "Tareas del Día" (ej. *Control de stock de cremas*, *Descarga de Calu*).
  4. Revisión de la tarjeta "Control de Stock & Insumos" $ightarrow$ Identificación de productos con $le 5$ unidades.
  5. Paciente consulta precio de un tratamiento complejo $ightarrow$ Staff usa el "Buscador de Tratamientos" para filtrar al instante entre los 102 aranceles disponibles.
  6. Paciente presenta una Gift Card física $ightarrow$ Staff ingresa a `/dashboard/operativo/gift-cards`, escribe el código, verifica el saldo y aplica el canje.
- **Resultado:** Tareas operativas ejecutadas y trazabilidad registrada en base de datos.
