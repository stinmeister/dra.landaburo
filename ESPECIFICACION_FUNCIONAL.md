# Especificación Funcional — Sitio Dra. Landaburo (dralandaburo.com)
**Versión:** 2.0 · **Fecha:** 20/08/2026  
**Origen:** Auditoría QA + Estabilización DB + Requerimientos Fase 2 (Agustín + Antigravity)  
**Destinatario:** Equipo de desarrollo externo / Claude Code  
**Ambiente Staging:** [http://54.94.94.20:3000](http://54.94.94.20:3000)  
**Repositorio GitHub:** `https://github.com/stinmeister/dra.landaburo.git` (`master`)

---

## 📑 Índice de Requerimientos

| ID | Módulo / Título | Prioridad | Estado |
|---|---|---|---|
| **FS-019** | Navbar sin contraste garantizado | Alta | ✅ Resuelto en v1.0 |
| **FS-023** | Texto de debug en hero de tratamientos | Alta | ✅ Resuelto en v1.0 |
| **FS-024** | Acordeón FAQ corta respuestas | Alta | ✅ Resuelto en v1.0 |
| **FS-025** | Unificación de fuente única en estadísticas | Alta | ⏳ Pendiente |
| **FS-027** | Jerarquía visual de CTAs | Media | ✅ Resuelto en v1.0 |
| **FS-028** | Radio de borde en botones (`border-radius: 6px`) | Media | ✅ Resuelto en v1.0 |
| **FS-N01** | Input flotante huérfano en sidebar de tratamientos | Media | ⏳ Pendiente |
| **FS-N02** | Widget flotante de WhatsApp | Baja | ⏳ Pendiente |
| **FS-031** | **Gestión de Usuarios y Alta de Staff** | **Alta** | 🆕 **Nuevo (Fase 2)** |
| **FS-032** | **Navegación Dinámica en Dashboard por Rol** | **Alta** | 🆕 **Nuevo (Fase 2)** |
| **FS-033** | **Menú de Usuario Contextual en Header (Avatar)** | **Alta** | 🆕 **Nuevo (Fase 2)** |
| **FS-034** | **Gestión de Productos e Inventario (`/dashboard/productos`)** | **Alta** | 🆕 **Nuevo (Fase 2)** |
| **FS-035** | **CMS de Blog y Contenidos Dinámicos (`/dashboard/blog`)** | **Alta** | 🆕 **Nuevo (Fase 2)** |
| **FS-036** | **Fix de Autofill de Navegador y Contraste en Login** | **Media** | 🆕 **Nuevo (Fase 2)** |

---

## 🎨 Reglas de Marca y Diseño Inviolables

1. **Paleta Oficial:**
   * Negro texto/fondo: `#1C1C1C` (`var(--color-negro)`)
   * Gris medio: `#848484` (`var(--color-gris)`)
   * Gris claro: `#D2D3D3` (`var(--color-gris-claro)`)
   * Blanco: `#FFFFFF` (`var(--color-blanco)`)
   * Champagne (acento): `#C5A47E` (`var(--color-champagne)`)
   * Champagne oscuro (hover): `#A8875F` (`var(--color-champagne-dark)`)
2. **Terminología Médica:** NUNCA usar *"clientes"*; usar siempre **"pacientes"**.
3. **Ética y Tono:** CERO descuentos agresivos, CERO urgencia artificial, CERO promesas milagrosas.
4. **Sin Dark Mode Toggle:** El diseño es monocromático fijo.
5. **Estilos:** CSS Modules (`*.module.css`) exclusivamente. **NO usar Tailwind CSS**.

---

## 🆕 Detalle de Nuevos Requerimientos (Fase 2)

---

### FS-031: Módulo de Gestión de Usuarios y Alta de Staff
* **Prioridad:** Alta
* **Ruta:** `/dashboard/usuarios` (Protegida, solo rol `admin`).
* **Comportamiento esperado:**
  1. **Tabla de Usuarios:**
     * Columnas: Nombre completo, Email, Rol actual (Badge coloreado), Fecha de registro, Acciones.
     * Selector de Rol interactivo por fila: Dropdown con opciones `admin`, `medico`, `operativo`, `cosmetologa`, `paciente`. Al cambiar la opción, ejecuta un Server Action o endpoint que actualiza `public.profiles.role` en Supabase y refresca la vista.
     * Protección: Un usuario administrador no puede degradarse a sí mismo si es el único admin registrado.
  2. **Alta de Miembros del Equipo:**
     * Botón *"Nuevo Miembro del Equipo"* que abre un modal o formulario.
     * Campos: Nombre completo, Email, Contraseña temporal, Rol a asignar (`Médico`, `Operativo`, `Cosmetóloga`, `Admin`).
     * Utiliza la API de administración de Supabase (`supabase.auth.admin.createUser`) desde el servidor para crear el usuario sin requerir confirmación por email manual y crear su perfil automáticamente.
  3. **Restricción en Registro Público (`/registro`):**
     * El formulario público de `/registro` es **exclusivo para Pacientes**. No expone ningún selector de rol y guarda siempre `role = 'paciente'`.
* **Criterios de Aceptación:**
  * [ ] Solo usuarios con rol `admin` pueden acceder a `/dashboard/usuarios`.
  * [ ] El cambio de rol en la tabla impacta en tiempo real en Supabase `profiles`.
  * [ ] El alta de staff crea el usuario con su rol correspondiente en un solo paso.
  * [ ] El registro público en `/registro` nunca permite crear usuarios con rol diferente a `paciente`.

---

### FS-032: Navegación Dinámica en Dashboard por Rol
* **Prioridad:** Alta
* **Archivos:** `src/app/dashboard/layout.tsx`, `src/middleware.ts`.
* **Comportamiento esperado:**
  1. **Sidebar Contextual:**
     * Si el usuario es `admin`:
       * Muestra los enlaces: `Ejecutivo` (`/dashboard/ejecutivo`), `Operativo` (`/dashboard/operativo`), `Usuarios` (`/dashboard/usuarios`), `Productos` (`/dashboard/productos`), `Blog` (`/dashboard/blog`).
     * Si el usuario es `medico`, `operativo` o `cosmetologa`:
       * Muestra únicamente el enlace: `Operativo` (`/dashboard/operativo`). No ve ningún otro ítem en el menú.
     * Si el usuario es `paciente`:
       * No tiene acceso al layout del dashboard; es redirigido a `/portal/paciente`.
  2. **Protección de Rutas (Server-side & Middleware):**
     * Si un usuario con rol `medico` o `paciente` intenta ingresar manualmente a `/dashboard/ejecutivo`, `/dashboard/usuarios`, `/dashboard/productos` o `/dashboard/blog`, el servidor lo redirige inmediatamente a su vista autorizada o a `/` con código 403.
* **Criterios de Aceptación:**
  * [ ] Cada rol ve en el sidebar estrictamente los módulos permitidos.
  * [ ] El acceso por URL directa a rutas no autorizadas está bloqueado por el servidor.

---

### FS-033: Menú de Usuario Contextual en Header (`UserMenu.tsx`)
* **Prioridad:** Alta
* **Archivos:** `src/components/layout/UserMenu.tsx`, `UserMenu.module.css`.
* **Comportamiento esperado:**
  * Al hacer clic en el avatar del usuario conectado (círculo con inicial en el Header), el menú desplegable debe ser inteligente según su rol:
    * **Para rol `admin`:**
      1. Nombre completo + badge *"Administrador"*.
      2. Enlace 📊 *"Panel de Control"* → `/dashboard/ejecutivo`.
      3. Enlace 👤 *"Mi Portal (Paciente)"* → `/portal/paciente` (para consultar sus turnos o compras personales).
      4. Botón 🚪 *"Cerrar sesión"*.
    * **Para roles `medico` / `operativo` / `cosmetologa`:**
      1. Nombre completo + badge con su rol.
      2. Enlace 📋 *"Panel Operativo"* → `/dashboard/operativo`.
      3. Enlace 👤 *"Mi Portal (Paciente)"* → `/portal/paciente`.
      4. Botón 🚪 *"Cerrar sesión"*.
    * **Para rol `paciente`:**
      1. Nombre completo + badge *"Paciente"*.
      2. Enlace 🛍️ *"Mis Turnos y Compras"* → `/portal/paciente`.
      3. Botón 🚪 *"Cerrar sesión"*.
* **Criterios de Aceptación:**
  * [ ] El dropdown nunca muestra opciones rotas o ambiguas.
  * [ ] El Administrador tiene acceso directo en 1 clic al panel general.
  * [ ] El cierre de sesión limpia la sesión de Supabase y redirige a la Home.

---

### FS-034: Módulo de Gestión de Productos e Inventario
* **Prioridad:** Alta
* **Ruta:** `/dashboard/productos` (Protegida, solo rol `admin`).
* **Comportamiento esperado:**
  1. **Tabla de Catálogo e Inventario:**
     * Lista de productos de la tabla `public.products` con: Miniatura de foto, Nombre, Marca, Categoría, Precio ARS, Stock disponible, Switch de Activo/Pausado, Botón Editar.
     * Alerta visual: Filas con stock `< 5` unidades resaltadas con indicador de advertencia.
  2. **Creación y Edición de Producto:**
     * Formulario / Modal con los campos:
       * Nombre del producto.
       * Slug (generado automáticamente a partir del nombre).
       * Marca (`brand_type` o texto libre).
       * Categoría (Dropdown con: `Limpieza`, `Hidratación`, `Protección solar`, `Sérum`, `Contorno de ojos`, `Tratamiento específico`, `Post-tratamiento`).
       * Precio ARS (`price_ars`) y Precio Comparativo (`compare_price_ars`).
       * Descripción médica y modo de uso.
       * Stock inicial (`stock_quantity`).
       * Subida de imagen: Carga directa al bucket de Supabase Storage `products` o campo de URL de imagen.
  3. **Acciones Rápidas:**
     * Modificar stock directamente con botones `+` / `-` o campo editable en la tabla.
     * Toggle para activar/desactivar producto (si está inactivo, no aparece en `/tienda`).
* **Criterios de Aceptación:**
  * [ ] Crear un producto desde el dashboard hace que aparezca de inmediato en `/tienda`.
  * [ ] Editar precio o stock se refleja instantáneamente en la tienda y en el carrito.
  * [ ] Desactivar un producto lo oculta de la tienda pública sin borrarlo de la base de datos.

---

### FS-035: CMS de Blog y Publicación de Contenidos
* **Prioridad:** Alta
* **Rutas:** `/dashboard/blog` (Admin CMS), `/blog` (Listado público), `/blog/[slug]` (Artículo individual).
* **Comportamiento esperado:**
  1. **Base de Datos (Tabla `public.posts` en Supabase):**
     * Columnas: `id` (uuid), `slug` (text unique), `title` (text), `excerpt` (text), `content` (text/markdown), `cover_image_url` (text), `category` (text), `author_profile_id` (uuid FK profiles), `is_published` (boolean), `published_at` (timestamptz), `created_at` (timestamptz), `updated_at` (timestamptz).
  2. **Panel CMS (`/dashboard/blog`):**
     * Listado de artículos con título, autor, fecha, categoría y estado (Borrador / Publicado).
     * Editor de posts: Título, generación de slug, selector de categoría, resumen (excerpt), editor de contenido, subida de foto de portada y toggle *"Publicar / Guardar Borrador"*.
  3. **Vistas Públicas:**
     * `/blog`: Grilla editorial de artículos publicados con imagen de portada, fecha, categoría y tiempo estimado de lectura.
     * `/blog/[slug]`: Vista de lectura individual con estética premium, tipografía serif en títulos, fecha, firma de la Dra. Landaburo y CTA inferior para agendar consulta.
* **Criterios de Aceptación:**
  * [ ] Un post guardado como borrador NO es visible en `/blog`.
  * [ ] Un post publicado aparece inmediatamente en `/blog` y su ruta `/blog/[slug]` es accesible y optimizada para SEO con Server-Side Rendering (SSR).

---

### FS-036: Fix de Autofill de Navegador y Contraste en Login / Registro
* **Prioridad:** Media
* **Archivos:** `src/components/auth/LoginForm.module.css`, `RegisterForm.module.css`.
* **Comportamiento esperado:**
  1. **Autofill de Navegadores (Chrome, Safari, Edge):**
     * Aplicar las reglas CSS necesarias sobre pseudo-clases de autofill para evitar que el gestor de contraseñas pinte el fondo de blanco/celeste:
       ```css
       .input:-webkit-autofill,
       .input:-webkit-autofill:hover, 
       .input:-webkit-autofill:focus {
         -webkit-text-fill-color: var(--color-blanco) !important;
         -webkit-box-shadow: 0 0 0px 1000px #222 inset !important;
         transition: background-color 5000s ease-in-out 0s;
       }
       ```
  2. **Botón de Submit (`.submitBtn`):**
     * Fondo champagne `#C5A47E` sólido con texto negro `#1C1C1C` y `font-weight: 600`.
     * En estado `disabled` (cargando), mantener contraste legible con spinner o texto claro.
* **Criterios de Aceptación:**
  * [ ] Al autocompletar credenciales en Chrome, los campos mantienen texto blanco sobre fondo oscuro perfectamente legible.
  * [ ] El botón de envío nunca se funde con el fondo ni desaparece.

---

## 🛠️ Script de Base de Datos para el Blog (Ejecutar en Supabase)

```sql
-- Tabla de artículos de Blog
CREATE TABLE IF NOT EXISTS public.posts (
  id                 uuid        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text        NOT NULL UNIQUE,
  title              text        NOT NULL,
  excerpt            text        NOT NULL DEFAULT '',
  content            text        NOT NULL DEFAULT '',
  cover_image_url    text,
  category           text        NOT NULL DEFAULT 'Dermatología',
  author_profile_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_published       boolean     NOT NULL DEFAULT false,
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_published ON public.posts(is_published, published_at);
```
