# 🚀 Prompt Maestro de Instrucciones y Handoff v2.0 — Claude Code
**Proyecto:** Reconstrucción Web Oficial — Dra. Paula Landaburo (Medicina Estética & Dermatología)  
**Sitio:** `dralandaburo.com`  
**Ambiente Staging:** [http://54.94.94.20:3000](http://54.94.94.20:3000)  
**Repositorio GitHub:** `https://github.com/stinmeister/dra.landaburo.git` (rama `master`)

---

## 🎯 Tu Rol y Objetivo

Sos **Claude Code**, el agente de desarrollo principal a cargo de este proyecto. Tu misión en esta fase es:
1. **Implementar los nuevos paneles de administración y control por rol:**
   * **FS-031:** Módulo de Gestión de Usuarios y Alta de Staff en `/dashboard/usuarios` (y forzar `/registro` exclusivo para Pacientes).
   * **FS-032:** Navegación dinámica y Sidebar en Dashboard condicional según rol (`Admin` vs `Staff` vs `Paciente`).
   * **FS-033:** Menú contextual en el Header (`UserMenu.tsx`) con accesos directos por rol.
   * **FS-034:** Módulo de Gestión de Productos e Inventario en `/dashboard/productos`.
   * **FS-035:** CMS de Blog en `/dashboard/blog` y conexión de páginas públicas `/blog` y `/blog/[slug]`.
   * **FS-036:** Fix de autofill en inputs y contraste en botones de Login/Registro.
2. **Resolver los tickets menores pendientes de Fase 1:**
   * **FS-025:** Unificar estadísticas en `src/data/site-content.ts` para Home y `/sobre-mi`.
   * **FS-N01:** Limpiar elemento flotante huérfano en sidebar de tratamientos.
   * **FS-N02:** Ajustar espaciado responsive del botón flotante de WhatsApp.

---

## 📚 Documentación Técnica en el Repositorio

Hacé `git pull origin master` y consultá estos archivos antes de codificar:
1. **`ESPECIFICACION_FUNCIONAL.md` (v2.0):** Requerimientos técnicos y criterios de aceptación completos de todos los tickets.
2. **`esquema_base_de_datos_supabase.md`:** Modelo de datos de Supabase.
3. **`HANDOFF.md`:** Arquitectura del proyecto y protocolos de build.

---

## 🎨 Reglas de Marca Inviolables
* **Paleta Oficial:** Negro `#1C1C1C` (`var(--color-negro)`), Gris `#848484`, Gris claro `#D2D3D3`, Blanco `#FFFFFF`, Champagne `#C5A47E` (`var(--color-champagne)`), Champagne oscuro `#A8875F`.
* **Terminología:** NUNCA "clientes" ni "usuarios" → siempre **"pacientes"**.
* **Ética Médica:** CERO descuentos agresivos, CERO urgencia artificial, CERO promesas milagrosas.
* **Sin dark mode toggle** (identidad fija).
* **Estilos:** CSS Modules (`*.module.css`) + variables en `src/app/globals.css`. **NO usar Tailwind CSS**.
* **Iconos:** `lucide-react` (⚠️ **Importante:** verificar que el icono exista; no importar `Instagram` de lucide, usar SVG inline).

---

## 📋 Plan de Desarrollo Detallado (Fase 2)

### 1. 👥 FS-031: Gestión de Usuarios (`/dashboard/usuarios`)
* Crear `src/app/dashboard/usuarios/page.tsx` y `page.module.css`.
* Tabla con: Nombre, Email, Fecha de creación y Selector de Rol (`admin`, `medico`, `operativo`, `cosmetologa`, `paciente`).
* Al cambiar el rol en el selector, ejecutar un Server Action que actualice `public.profiles.role`.
* Modal / Formulario para crear miembros del staff usando `supabase.auth.admin.createUser` desde Server Action.
* Asegurar que `/registro` público solo permita registrar usuarios con rol `paciente`.

### 2. 🛡️ FS-032: Navegación Dinámica en Dashboard
* Modificar `src/app/dashboard/layout.tsx` para que obtenga el rol del usuario conectado desde `profiles`.
* Si `role === 'admin'`: mostrar enlaces `Ejecutivo`, `Operativo`, `Usuarios`, `Productos`, `Blog`.
* Si `role === 'medico' | 'operativo' | 'cosmetologa'`: mostrar únicamente `Operativo`.
* Si `role === 'paciente'`: redirigir a `/portal/paciente`.
* Proteger subrutas en Server Components para rechazar accesos directos no autorizados con `redirect('/')`.

### 3. 🔄 FS-033: Menú de Usuario Contextual en Header
* Modificar `src/components/layout/UserMenu.tsx`:
  * Si es `admin`: Mostrar *"Panel de Control"* (`/dashboard/ejecutivo`) + *"Mi Portal (Paciente)"* (`/portal/paciente`) + *"Cerrar sesión"*.
  * Si es `medico`/`operativo`: Mostrar *"Panel Operativo"* (`/dashboard/operativo`) + *"Mi Portal (Paciente)"* (`/portal/paciente`) + *"Cerrar sesión"*.
  * Si es `paciente`: Mostrar *"Mis Turnos y Compras"* (`/portal/paciente`) + *"Cerrar sesión"*.

### 4. 🛍️ FS-034: Gestión de Productos (`/dashboard/productos`)
* Crear `src/app/dashboard/productos/page.tsx` y `page.module.css`.
* Grilla/tabla de productos con imagen, nombre, marca, categoría, precio ARS, stock y toggle Activo/Inactivo.
* Formulario de alta/edición de producto: subida de imagen, campos de precio, descripción y stock.
* Modificación rápida de stock desde la tabla.

### 5. ✍️ FS-035: CMS de Blog (`/dashboard/blog` + `/blog` dinámico)
* Crear `src/app/dashboard/blog/page.tsx` (listado y editor de artículos).
* Tabla `public.posts` en Supabase (`id`, `slug`, `title`, `excerpt`, `content`, `cover_image_url`, `category`, `is_published`, `published_at`).
* Conectar `src/app/blog/page.tsx` para listar posts publicados desde Supabase.
* Conectar `src/app/blog/[slug]/page.tsx` para renderizar el artículo completo con SSR y metadata SEO.

### 6. 🎨 FS-036: Fix Autofill y Contraste en Login
* Modificar `src/components/auth/LoginForm.module.css` y `RegisterForm.module.css` agregando:
  ```css
  .input:-webkit-autofill,
  .input:-webkit-autofill:hover, 
  .input:-webkit-autofill:focus {
    -webkit-text-fill-color: var(--color-blanco) !important;
    -webkit-box-shadow: 0 0 0px 1000px #222 inset !important;
    transition: background-color 5000s ease-in-out 0s;
  }
  ```
* Asegurar que `.submitBtn` tenga contraste champagne sólido permanente con texto legible en cualquier estado.

---

## ⚠️ Reglas Obligatorias de Entrega
1. Ejecutar `npm run build` localmente y verificar que termine con **0 errores** antes de cada commit.
2. Hacer commits atómicos claros (ej: `feat(users): add /dashboard/usuarios staff management (FS-031)`).
3. Pushear a `origin master` (`https://github.com/stinmeister/dra.landaburo.git`).
