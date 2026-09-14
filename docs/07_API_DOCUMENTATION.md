# 07 · API Documentation — Route Handlers

**Fecha:** 14/09/2026  
**Total Endpoints:** 13 Route Handlers en `src/app/api/`  
**Estado:** [VERIFICADO] en código fuente y compilación de rutas  

---

## 1. Catálogo Completo de APIs

### 1. Checkout E-commerce MercadoPago
- **Ruta:** `POST /api/checkout/mercadopago`
- **Autenticación:** Pública (Valida ítems y precios contra base de datos en servidor).
- **Request Body:**
  ```json
  {
    "items": [{ "id": "uuid-producto", "quantity": 2 }],
    "payer": { "name": "María Gómez", "email": "maria@ejemplo.com", "phone": "1198765432" }
  }
  ```
- **Respuesta (200 OK):** `{ "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=..." }`
- **Tablas Afectadas:** `orders`, `order_items` (crea orden en estado `pending`).
- **Seguridad:** Recalcula subtotales y total sumando precios de la tabla `products` (evita manipulación de precio en cliente).

---

### 2. Checkout Gift Cards Combinables
- **Ruta:** `POST /api/gift-cards/checkout`
- **Autenticación:** Pública.
- **Request Body:**
  ```json
  {
    "items": [
      { "item_type": "treatment", "treatment_id": "uuid-tratamiento-cosmetologia", "quantity": 1 },
      { "item_type": "product", "product_id": "uuid-producto-sulderm", "quantity": 1 },
      { "item_type": "custom_amount", "custom_amount_ars": 50000, "quantity": 1 }
    ],
    "sender_name": "Juan Pérez",
    "sender_email": "juan@ejemplo.com",
    "recipient_name": "Laura",
    "dedication": "¡Feliz cumpleaños! Que disfrutes tu sesión de cuidado.",
    "delivery_method": "digital"
  }
  ```
- **Respuesta (200 OK):** `{ "init_point": "https://www.mercadopago.com.ar/checkout/..." }`
- **Tablas Afectadas:** `gift_cards`, `gift_card_items` (genera código `DL-XXXX-XXXX` con validez de 90 días).

---

### 3. Consulta de Gift Card (Lookup)
- **Ruta:** `GET /api/gift-cards/lookup?code=DL-XXXX-XXXX`
- **Autenticación:** Staff / Admin (`admin`, `operativo`, `medico`, `cosmetologa`).
- **Respuesta (200 OK):**
  ```json
  {
    "valid": true,
    "card": {
      "id": "uuid",
      "code": "DL-8K49-P2MX",
      "amount_ars": 65000,
      "remaining_balance_ars": 65000,
      "status": "active",
      "expiration_date": "2026-12-05T00:00:00.000Z",
      "recipient_name": "Laura",
      "dedication": "..."
    }
  }
  ```

---

### 4. Canje de Gift Card (Redeem)
- **Ruta:** `POST /api/gift-cards/redeem`
- **Autenticación:** Staff / Admin.
- **Request Body:** `{ "code": "DL-8K49-P2MX", "amount_to_redeem": 35000 }`
- **Respuesta (200 OK):** `{ "success": true, "new_balance": 30000, "status": "active" }`
- **Tablas Afectadas:** `gift_cards` (actualiza `remaining_balance_ars`, si queda en 0 cambia a `redeemed`).

---

### 5. Webhook MercadoPago
- **Ruta:** `POST /api/webhook/mercadopago`
- **Autenticación:** Validación de firma de webhook (`x-signature` o `MP_WEBHOOK_SECRET`).
- **Trigger:** MercadoPago notifica eventos de pago (`payment.created`, `payment.updated`).
- **Lógica:** Consulta a la API de MercadoPago para verificar estado (`approved`), localiza la orden o gift card asociada vía `external_reference` y actualiza el estado a `approved` o `active`.

---

### 6. Formulario de Contacto
- **Ruta:** `POST /api/contacto`
- **Autenticación:** Pública con sanitización de inputs.
- **Request Body:** `{ "name": "...", "email": "...", "phone": "...", "treatment": "...", "message": "..." }`
- **Servicios:** Despacha email transaccional vía Resend API y guarda registro en tabla `leads`.

---

### 7. Consentimiento de Cookies
- **Ruta:** `POST /api/cookies/consent`
- **Autenticación:** Pública.
- **Lógica:** Hashea la IP en SHA-256 para preservar la privacidad del paciente, inserta en `cookie_consents` con service-role y devuelve el encabezado HTTP `Set-Cookie` con duración de 365 días en el dominio `.dralandaburo.com`.

---

### 8. Kiosco de Admisión Presencial
- **Ruta:** `POST /api/kiosco/admision`
- **Autenticación:** Terminal de sala de espera.
- **Request Body:** `{ "dni": "12345678", "full_name": "...", "phone": "...", "email": "..." }`
- **Tablas Afectadas:** `kiosk_admissions`, actualiza teléfono/email en `patients`.

---

### 9. Generación de Tareas Diarias
- **Ruta:** `GET /api/tasks/today`
- **Autenticación:** Cronjob / Token de autorización.
- **Lógica:** Ejecuta `ensureDailyRecurringTasks(todayAR)` y retorna las tareas del día.

---

### 10. Ingesta de Pacientes (Google Sheets / Calu)
- **Ruta:** `POST /api/ingest/patients`
- **Autenticación:** Header `Authorization: Bearer INGEST_SECRET`.
- **Lógica:** Ingesta masiva de pacientes, normalización de teléfonos, cálculo de RFM y registro de discrepancias en `ingest_review`.

---

### 11. Ingesta de Pagos y Comisiones
- **Ruta:** `POST /api/ingest/payments`
- **Autenticación:** Header `Authorization: Bearer INGEST_SECRET`.
- **Lógica:** Ingesta de cobros, cálculo de comisiones (Mercedes 30%, Dra. 70%) y resolución de pacientes.

---

### 12. Ingesta de Campañas Publicitarias
- **Ruta:** `POST /api/ingest/campaigns`
- **Autenticación:** Header `Authorization: Bearer INGEST_SECRET`.
- **Tablas Afectadas:** `ad_campaigns`.

---

### 13. Ingesta de Artículos de Blog
- **Ruta:** `POST /api/blog/ingest`
- **Autenticación:** Header `Authorization: Bearer BLOG_SYNC_SECRET`.
- **Tablas Afectadas:** `posts`.
