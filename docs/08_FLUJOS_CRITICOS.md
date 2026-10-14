# 08 · Flujos Críticos del Sistema (Sequence Diagrams)

**Proyecto:** `dralandaburo.com`  
**Fecha de Verificación:** 14 de Octubre de 2026  
**Circuitos Documentados:** 6 Flujos Críticos de Software e Integración  
**Estado:** ✅ 100% Verificado contra código fuente, Route Handlers y triggers de PostgreSQL.

---

## 1. Circuito de Compra Online y Cobro con Mercado Pago

Flujo completo de checkout, webhook con deduplicación por clave única y disparo de integraciones.

```mermaid
sequenceDiagram
    autonumber
    actor Paciente as Paciente (Navegador)
    participant NextApi as Next.js API (/api/checkout/mp)
    participant DB as PostgreSQL (Supabase)
    participant MP as Mercado Pago API
    participant Webhook as Next.js API (/api/webhook/mp)
    participant Resend as Resend Mail API
    participant CAPI as Meta Conversions API

    Paciente->>NextApi: POST /api/checkout/mercadopago {items, buyer}
    NextApi->>DB: Consultar store_config (checkout_enabled)
    alt checkout_enabled == false
        NextApi-->>Paciente: HTTP 403 Forbidden ("Compras online pausadas")
    else checkout_enabled == true
        NextApi->>DB: Validar stock_quantity de cada producto
        NextApi->>MP: Crear Preferencia de Pago (Preference API)
        MP-->>NextApi: {preference_id, init_point}
        NextApi->>DB: Crear fila en orders (payment_status='pending')
        NextApi->>DB: Insertar filas en order_items
        NextApi-->>Paciente: {init_point} (Redirección a pasarela MP)
    end

    Note over Paciente,MP: El paciente abona con tarjeta de crédito/débito en Mercado Pago
    MP->>Webhook: POST /api/webhook/mercadopago {type: 'payment', data: {id}}
    
    Webhook->>DB: INSERT INTO mp_webhook_events (event_id, payment_id)
    alt Error 23505 (Unique violation en event_id)
        Webhook-->>MP: HTTP 200 OK (Evento duplicado descartado por idempotencia)
    else Evento nuevo
        Webhook->>MP: GET /v1/payments/{id} (Consultar estado real)
        MP-->>Webhook: {status: 'approved', transaction_amount, ...}
        
        Webhook->>DB: UPDATE orders SET payment_status='approved', mp_payment_id
        Webhook->>DB: INSERT INTO stock_movements (movement_type='venta_online', delta=-qty)
        Webhook->>DB: UPDATE products SET stock_quantity = stock_quantity - qty
        
        par Notificaciones y Tracking
            Webhook->>Resend: Enviar confirmación por email al comprador y al staff
            Webhook->>CAPI: POST Graph API (Evento 'Purchase' con meta_capi_event_id)
            CAPI-->>DB: UPDATE orders SET meta_capi_status='sent'
        end
        Webhook-->>MP: HTTP 200 OK
    end
```

---

## 2. Circuito de Movimiento de Stock e Inventario

Garantiza la trazabilidad del inventario y la restricción `ON DELETE RESTRICT`.

```mermaid
sequenceDiagram
    autonumber
    actor Operador as Operador / Personal
    participant ClientUI as Panel (/dashboard/productos/movimientos)
    participant Action as Server Action (registrarMovimiento)
    participant DB as PostgreSQL (Supabase)

    Operador->>ClientUI: Selecciona producto, tipo de movimiento y cantidad
    ClientUI->>Action: Invocación de Server Action con sesión autenticada
    Action->>DB: Validar sesión y rol en profiles (operativo, medico, admin)
    
    Action->>DB: SELECT stock_quantity FROM products WHERE id = product_id
    DB-->>Action: stock_actual (ej: 10)
    
    Note over Action: Calcula stock_after = stock_actual + delta
    
    critical Transacción de Inventario
        Action->>DB: INSERT INTO stock_movements (product_id, movement_type, quantity_delta, stock_before, stock_after, created_by)
        Action->>DB: UPDATE products SET stock_quantity = stock_after WHERE id = product_id
    end
    
    DB-->>Action: Confirmación de actualización
    Action-->>ClientUI: Revalidación de ruta /dashboard/productos/movimientos
    ClientUI-->>Operador: Notificación visual de éxito con nuevo stock reflejado
```

---

## 3. Circuito de Autenticación, Middleware y RBAC de Dos Niveles

Verificación estricta de sesión y filtrado dinámico de navegación.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Navegador del Usuario
    participant Middleware as src/middleware.ts
    participant GoTrue as Supabase Auth (GoTrue)
    participant Layout as src/app/dashboard/layout.tsx
    participant Perms as src/lib/permissions.ts
    participant DB as PostgreSQL (Supabase)

    Usuario->>Middleware: GET /dashboard/productos
    Middleware->>GoTrue: supabase.auth.getUser() (Valida JWT en cookies)
    
    alt Sesión Inválida o Inexistente
        GoTrue-->>Middleware: user = null
        Middleware-->>Usuario: HTTP 307 Redirect a /login?redirectTo=/dashboard/productos
    else Sesión Válida
        GoTrue-->>Middleware: user = { id, email } (Cookies refrescadas)
        Middleware->>Layout: Pasa control con cookies actualizadas
        
        Layout->>DB: SELECT role FROM profiles WHERE id = user.id
        DB-->>Layout: role (ej: 'operativo')
        
        alt role == 'paciente'
            Layout-->>Usuario: HTTP 307 Redirect a /portal/paciente
        else role in STAFF_ROLES
            Layout->>Perms: getUserSections(user.id, 'operativo')
            Perms->>DB: SELECT section, allowed FROM role_section_defaults WHERE role='operativo'
            Perms->>DB: SELECT section, allowed FROM user_section_overrides WHERE profile_id=user.id
            Note over Perms: Aplica excepciones sobre defaults
            Perms-->>Layout: allowedSections = ['operativo', 'cierre-diario', 'productos', ...]
            
            alt Sección solicitada ('productos') está en allowedSections
                Layout-->>Usuario: Renderiza DashboardLayout + Vista de Productos
            else Sección denegada por RBAC
                Layout-->>Usuario: HTTP 307 Redirect a /dashboard/sin-acceso
            end
        end
    end
```

---

## 4. Circuito de Ingesta Asíncrona de n8n y Cola de Revisión

Procesamiento de datos clínicos y contables externos con tolerancia a fallas.

```mermaid
sequenceDiagram
    autonumber
    participant N8n as n8n Automation Engine
    participant IngestApi as Next.js API (/api/ingest/payments)
    participant DB as PostgreSQL (Supabase)
    actor Operador as Operador en /dashboard/revision

    N8n->>IngestApi: POST /api/ingest/payments (Header: Bearer INGEST_SYNC_SECRET)
    
    alt Token Inválido o Ausente
        IngestApi-->>N8n: HTTP 401 Unauthorized
    else Token Válido
        Note over IngestApi: Valida estructura y consistencia del payload
        
        alt Datos Consistentes (Paciente existe, monto válido, fecha clara)
            IngestApi->>DB: INSERT INTO payments (patient_id, amount_ars, payment_method, ...)
            IngestApi-->>N8n: HTTP 200 OK {success: true, payment_id}
        else Inconsistencia Detectada (Paciente huérfano, datos incompletos)
            IngestApi->>DB: INSERT INTO ingest_review (source, record_identifier, reason, payload, status='pending')
            IngestApi-->>N8n: HTTP 202 Accepted {queued_for_review: true}
        end
    end

    Note over DB,Operador: Los registros pendientes se acumulan en ingest_review (344 en DB)
    Operador->>DB: Consulta /dashboard/revision
    Operador->>DB: Asocia paciente correcto o corrige monto
    DB->>DB: INSERT INTO payments (...)
    DB->>DB: UPDATE ingest_review SET status='resolved', resolved_by=user.id
```

---

## 5. Circuito de Borrado con Auditoría Inmutable

Protección de datos históricos mediante snapshot JSONB y bloqueo por triggers.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador
    participant UI as Dashboard (/dashboard/productos)
    participant Action as Server Action (eliminarProducto)
    participant DB as PostgreSQL (Supabase)
    participant Trigger as Trigger trg_deletion_audit_no_*

    Admin->>UI: Solicita eliminar producto "Crema X" ingresando motivo
    UI->>Action: Invocar Server Action con id y reason
    Action->>DB: Validar rol 'admin'
    
    Action->>DB: SELECT * FROM products WHERE id = product_id
    DB-->>Action: Fila completa del producto
    
    critical Borrado Seguro con Auditoría
        Action->>DB: INSERT INTO deletion_audit (actor_id, actor_name, action='eliminado', entity_type='producto', entity_id, entity_name, reason, snapshot)
        Action->>DB: DELETE FROM products WHERE id = product_id
    end
    
    DB-->>Action: Confirmación de borrado
    Action-->>UI: Producto removido de la vista

    Note over DB,Trigger: Intento malicioso de alterar o borrar la auditoría
    Admin-xTrigger: UPDATE / DELETE FROM deletion_audit WHERE id = ...
    Trigger-->>Admin: RAISE EXCEPTION 'deletion_audit es inmutable: no se puede modificar ni borrar'
```

---

## 6. Circuito de Contacto Web Anónimo y Rate Limiting

Protección anti-spam y desacople de privilegios en el formulario público.

```mermaid
sequenceDiagram
    autonumber
    actor Visitante as Visitante Web Anónimo
    participant ContactoApi as Next.js API (/api/contacto)
    participant DB as PostgreSQL (Supabase)
    participant AnonClient as Supabase Anon Client

    Visitante->>ContactoApi: POST /api/contacto {full_name, email, phone, message}
    
    Note over ContactoApi: Obtiene IP del cliente (x-forwarded-for)
    ContactoApi->>DB: Consultar / Actualizar tabla rate_limits (key='contacto:IP')
    
    alt Límite Excedido (> 5 solicitudes en 15 minutos)
        ContactoApi-->>Visitante: HTTP 429 Too Many Requests ("Demasiadas consultas, intentá más tarde")
    else Dentro de la cuota
        ContactoApi->>AnonClient: sbAnon.from('leads').insert({full_name, email, phone, notes, status: 'nuevo'})
        
        Note over AnonClient,DB: PostgreSQL evalúa política RLS "Permitir inserción de leads a usuarios anónimos"
        
        alt RLS Válida (full_name NOT NULL, email NOT NULL, status='nuevo')
            DB-->>AnonClient: Inserción Exitosa
            ContactoApi-->>Visitante: HTTP 200 OK ("Mensaje recibido correctamente")
        else RLS Denegada (Payload alterado o status diferente)
            DB-->>ContactoApi: Error 42501 (RLS violation)
            ContactoApi-->>Visitante: HTTP 400 Bad Request ("Datos inválidos")
        end
    end
```
