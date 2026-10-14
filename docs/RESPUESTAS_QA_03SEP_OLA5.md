> [!WARNING]
> **DOCUMENTO HISTÓRICO SUPERADO (14/09/2026):**  
> Este documento ha sido reemplazado y consolidado en el nuevo cuerpo documental oficial del 14/10/2026.  
> Para consultar la documentación vigente y verificada contra el código vivo y la base de datos de producción (34 tablas, 5 RPCs, 10 usuarios), dirigirse a [**00_INDICE.md**](./00_INDICE.md).

---

# Respuestas al QA Pendiente del 03/09 (Ola 5 — FIX-076 a FIX-079)

**Proyecto:** `dralandaburo.com`  
**Fecha:** 10/10/2026  
**Relevamiento realizado por:** Antigravity (IA) para Agustín Landaburo  

---

## FIX-076 · `/consentimientos` responde 200. ¿Tiene contenido real o es un placeholder?

- **Estado:** Identificado como **maqueta estática preliminar con botones mudos**.
- **Evidencia en código:**
  - Archivo: `src/app/consentimientos/page.tsx` (creado en commit `9c4f244` del 02/09/2026).
  - Contenido: Muestra 5 tarjetas informativas basadas en un array hardcodeado `consents` (`CI-01` Botox, `CI-02` Rellenos, `CI-03` Bioestimuladores, `CI-04` PRP/Capilar, `CI-05` Cosmiatría).
  - Interactividad: Los botones de acción `<button className={styles.btnSecondary}><ExternalLink size={14} /> Leer Online</button>` y `<button className={styles.btnPrimary}><Download size={14} /> Descargar PDF</button>` son elementos `<button>` nativos sin manejadores `onClick`, sin links `<a>` y sin endpoints ni archivos PDF asociados en el servidor.
  - Datos sensibles/maqueta: Mantiene impreso en el JSX `Dra. Paula Landaburo — M.P. 11.439` en cada tarjeta (matrícula retirada del footer en Ola 0).
- **Conclusión:** No es un módulo funcional con firma digital ni descarga de documentos. Es un placeholder informativo maquetado con botones no operativos.

---

## FIX-077 · `/api/blog/ingest` + `BLOG_SYNC_SECRET` activo. ¿Qué hace, quién lo llama, y es seguro que esté expuesto?

- **Estado:** Relevado y **verificado como seguro**.
- **Evidencia en código:**
  - Archivo: `src/app/api/blog/ingest/route.ts`.
  - Qué hace: Recibe un payload JSON vía `POST` y ejecuta un `upsert` en la tabla `posts` de Supabase sobre la clave única `slug`. Si la operación es exitosa, llama a `revalidatePath('/blog')` y `revalidatePath('/blog/[slug]')` para invalidar la caché de Next.js y publicar el artículo inmediatamente.
  - Quién lo llama: Diseñado para ingesta remota desatendida desde herramientas externas de redacción/CMS o workflows de n8n.
  - Seguridad: Requiere obligatoriamente autenticación mediante cabecera HTTP:
    ```typescript
    const authHeader = req.headers.get('authorization');
    const secret = process.env.BLOG_SYNC_SECRET;
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    ```
    Si no se envía el token o no coincide con `BLOG_SYNC_SECRET`, rechaza de inmediato con `401 Unauthorized` sin consultar la base de datos ni exponer datos.

---

## FIX-078 · Dos workflows de n8n llamados "WF-06" (Lead Intelligence activo / Lead Verification inactivo, ids distintos). ¿Qué se ve desde el lado del código?

- **Estado:** Relevado desde la superficie de integración Next.js.
- **Evidencia en código:**
  - Archivo: `src/app/api/contacto/route.ts` (línea 58).
  - Integración: El backend de Next.js solo despacha a una única URL parametrizada:
    ```typescript
    const n8nWebhookUrl = process.env.N8N_CONTACT_WEBHOOK_URL;
    ```
  - Contenido del evento:
    ```json
    {
      "event": "contact_form_submission",
      "name": "...",
      "email": "...",
      "phone": "...",
      "treatment": "...",
      "message": "...",
      "timestamp": "..."
    }
    ```
- **Conclusión:** En la aplicación web existe **un único punto de salida desacoplado** vía `N8N_CONTACT_WEBHOOK_URL`. La coexistencia de dos workflows ("Lead Intelligence" y "Lead Verification") es un asunto puramente interno de la instancia de n8n. En producción, la variable de entorno del servidor Bitnami apunta al webhook activo ("Lead Intelligence").

---

## FIX-079 · `/registro` de auto-registro de pacientes. ¿Es intencional que exista? ¿Qué rol asigna?

- **Estado:** Relevado a nivel de UI, rutas y base de datos.
- **Evidencia en código y base de datos:**
  - Archivos: `src/app/registro/page.tsx` y `src/components/auth/RegisterForm.tsx`.
  - Rol asignado: Asigna **estrictamente el rol `'paciente'`**. La función trigger de PostgreSQL en Supabase (`public.handle_new_user()`) fuerza el rol de forma inmutable:
    ```sql
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'paciente');
    ```
    No existe ninguna posibilidad de que un usuario creado desde `/registro` obtenga rol `'admin'`, `'medico'` u `'operativo'`.
  - Intencionalidad y exposición:
    - Diseñado originalmente para el acceso de pacientes al portal `/portal/paciente`.
    - No está indexado en buscadores (`robots: { index: false }`).
    - No está enlazado en el navbar principal ni en el footer (el header sólo ofrece "Portal Pacientes" que apunta a `/login`).
