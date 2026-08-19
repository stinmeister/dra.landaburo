# 🚀 Prompt Maestro de Instrucciones y Handoff — Claude Code
**Proyecto:** Reconstrucción Web Oficial — Dra. Paula Landaburo (Medicina Estética & Dermatología)  
**Sitio:** `dralandaburo.com`  
**Ambiente Staging:** [http://54.94.94.20:3000](http://54.94.94.20:3000)  
**Repositorio GitHub:** `https://github.com/stinmeister/dra.landaburo.git` (rama `master`)

---

## 🎯 Tu Rol y Objetivo

Sos **Claude Code**, el agente de desarrollo principal de este proyecto. Tu misión es:
1. **Corregir con máxima prioridad los bugs críticos y de diseño** identificados durante la auditoría QA en vivo.
2. **Implementar los módulos del alcance original que quedaron pendientes** (E-commerce / Tienda, Autenticación de Usuarios y Dashboards / Portales por Rol).
3. **Mantener la integridad del build y de la identidad de marca** en cada commit.

---

## 📚 Documentación Técnica Disponible en el Repo

Antes de escribir código, leé estos archivos clave ya presentes en la raíz del repositorio:
1. **`ESPECIFICACION_FUNCIONAL.md` (v1.0):** Especificación detallada de requerimientos, comportamiento esperado y criterios de aceptación para los tickets `FS-019` a `FS-N02`.
2. **`HANDOFF.md`:** Arquitectura del proyecto, stack, convenciones y protocolo de despliegue.
3. **`esquema_base_de_datos_supabase.md`:** Blueprint del modelo de datos de Supabase (tablas `profiles`, `patients`, `products`, `orders`, `payments`, `appointments`, `employee_tasks`, etc.).
4. **`tasks.md`:** Backlog consolidado de tickets.

---

## 🎨 Reglas Inviolables de Marca y Diseño

Cualquier componente, vista o estilo que generes DEBE cumplir estrictamente:
* **Paleta Oficial (Monocromática + Champagne):**
  * Negro texto/fondo: `#1C1C1C` (`var(--color-negro)`)
  * Gris medio: `#848484` (`var(--color-gris)`)
  * Gris claro: `#D2D3D3` (`var(--color-gris-claro)`)
  * Blanco: `#FFFFFF` (`var(--color-blanco)`)
  * Champagne (acento): `#C5A47E` (`var(--color-champagne)`)
* **Terminología Médica:** NUNCA usar *"clientes"* ni *"usuarios"*; usar siempre **"pacientes"**.
* **Ética y Tono:** CERO descuentos, CERO urgencia artificial (sin countdowns ni cupones), CERO promesas de resultados milagrosos.
* **Sin Dark Mode Toggle:** El sitio es monocromático fijo.

---

## 🛠️ Stack Tecnológico y Reglas de Código

* **Framework:** Next.js `16.2.11` (App Router con Turbopack y React 19).
* **Estilos:** CSS Modules (`*.module.css`) + variables en `src/app/globals.css`. **NO usar Tailwind CSS**.
* **Iconos:** `lucide-react` (⚠️ **Importante:** verificar que el icono exista en la versión instalada antes de importar; el icono `Instagram` no existe en esta versión, usar SVG inline o alternativas).
* **Base de Datos & Auth:** `@supabase/supabase-js` (credenciales disponibles en `.env.local`).
* **Verificación:** SIEMPRE ejecutar `npm run build` localmente antes de hacer push para asegurar que no hay errores de TypeScript o Turbopack.

---

## 📋 Plan de Trabajo por Fases (Roadmap de Ejecución)

### 🔴 FASE 1: Bugs Críticos de Frontend y Maquetación (Prioridad Inmediata)

1. **FS-019 — Navbar sin contraste / invisible sobre fondo claro:**
   * **Archivo:** `src/components/layout/Header.tsx` y `Header.module.css`.
   * **Problema:** En `/tratamientos` y páginas de tratamiento, el navbar renderiza letras blancas sobre fondo claro.
   * **Fix:** Asegurar que el header tenga un fondo propio garantizado con blur opaco (`backdrop-filter: blur(12px)`, `background: rgba(255,255,255,0.92)`) al scrollear o en páginas claras, forzando texto y logo a `#1C1C1C`. Solo usar texto blanco cuando `scrolled === false` sobre heroes oscuros comprobados.
2. **FS-023 — Eliminar texto de debug en hero de tratamientos:**
   * **Archivo:** `src/app/tratamientos/[slug]/page.tsx` y `src/components/ui/Typewriter.tsx`.
   * **Problema:** Aparece el texto `"Buscamos: confianza"` con cursor de edición en el hero.
   * **Fix:** Remover este texto de placeholder de la plantilla para que las 10 páginas de tratamientos muestren solo información médica aprobada.
3. **FS-024 — Acordeón de FAQ corta respuestas a la mitad:**
   * **Archivo:** `src/components/tratamientos/TreatmentFAQ.tsx` y `TreatmentFAQ.module.css`.
   * **Problema:** Al expandir una pregunta, la respuesta se trunca por `max-height` fijo o `overflow: hidden`.
   * **Fix:** Utilizar `grid-template-rows: 0fr` → `1fr` o auto-height fluido para que la respuesta se despliegue al 100% de su contenido con transición suave.
4. **FS-N01 — Elemento fantasma/input flotando sobre el sidebar:**
   * **Archivo:** `src/app/tratamientos/[slug]/page.tsx`.
   * **Problema:** En `/tratamientos/acido-hialuronico`, al scrollear al FAQ, aparece un recuadro vacío sobre la tarjeta de la doctora.
   * **Fix:** Auditar posicionamiento `sticky`/`fixed` y limpiar elementos huérfanos del DOM.
5. **FS-025 — Unificar Estadísticas en Fuente Única:**
   * **Archivo:** `src/data/site-content.ts` y `src/components/home/StatsCounter.tsx`.
   * **Fix:** Centralizar los 4 valores oficiales (`10+` Años cuidando la piel, `800+` Pacientes acompañados, `15+` Certificaciones, `100%` Enfoque humano) y consumirlos idénticos en Home y `/sobre-mi`.

---

### 🟡 FASE 2: Ajustes de Diseño y Consistencia Visual

1. **FS-027 — Jerarquía de CTAs:**
   * **Archivo:** `src/components/layout/Header.tsx`, `Header.module.css`, `src/components/ui/Button.tsx`.
   * **Fix:** El botón *"Agendar consulta"* del navbar debe tener fondo sólido champagne (`#C5A47E`) con texto `#1C1C1C` o `#FFFFFF` en todo el sitio. En cada vista, máximo 1 botón sólido en el viewport inicial.
2. **FS-028 — Esquinas redondeadas en botones (`border-radius: 6px`):**
   * **Archivo:** `src/components/ui/Button.module.css` (y botones en Header, Footer, Hero, Tarjetas).
   * **Fix:** Aplicar `border-radius: 6px` a todas las variantes de botones.
3. **FS-N02 — Widget flotante de WhatsApp:**
   * **Archivo:** `src/components/layout/WhatsAppButton.module.css`.
   * **Fix:** Ajustar `bottom`/`right` seguro y z-index para evitar solapamientos con botones al pie.

---

### 🟢 FASE 3: Módulos Pendientes del Alcance Original

1. **E-commerce / Tienda Dermocosmética (`/tienda`):**
   * **Archivos a crear:**
     * `src/data/products.ts` (catálogo de los 24 productos dermocosméticos con nombre, slug, precio en ARS, descripción e imagen).
     * `src/app/tienda/page.tsx` y `page.module.css` (grilla de productos con filtro por categoría y botón *"Agregar al carrito"*).
     * `src/context/CartContext.tsx` o Zustand (estado global del carrito persistido en `localStorage`).
     * `src/app/tienda/carrito/page.tsx` (resumen de pedido y botón de checkout).
     * Integración con **MercadoPago Checkout Pro** (Sandbox para pruebas) y webhook en `src/app/api/webhook/mercadopago/route.ts` para registrar pedidos en Supabase tabla `orders`.
     * Badge numérico de items en el ícono del carrito en el header.
2. **Sistema de Autenticación & Control de Acceso (Supabase Auth):**
   * **Archivos a crear:**
     * `src/lib/supabase.ts` (cliente browser con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
     * `src/lib/supabase-server.ts` (cliente server).
     * `src/app/login/page.tsx` (formulario de inicio de sesión con email y contraseña).
     * `src/app/register/page.tsx` (registro de pacientes con rol por defecto `paciente`).
     * `src/middleware.ts` (protección de rutas `/dashboard/*` y `/portal/*` redirigiendo a `/login` si no hay sesión).
     * Botón *"Ingresar"* en el header derecho (muestra iniciales/avatar + dropdown *"Mi Perfil"* / *"Cerrar sesión"* si está autenticado).
3. **Dashboards y Portales Privados por Rol:**
   * **Dashboard Ejecutivo (`/dashboard/ejecutivo` — solo rol `admin`):** Métricas financieras (facturación ARS/USD desde tabla `payments`), comisiones Dra. vs Mercedes (30%), stock de productos con alertas `< 5 un.`, KPIs de pacientes RFM.
   * **Dashboard Operativo (`/dashboard/operativo` — roles `admin`, `medico`, `operativo`):** Tareas del día asignadas (`employee_tasks`), buscador de tratamientos, manuales de equipo.
   * **Portal Paciente (`/portal/paciente` — rol `paciente`):** Historial de turnos (`appointments`), compras de productos y gift cards activas.

---

## 🚀 Flujo de Trabajo y Entrega

1. **Pull inicial:** `git pull origin master` para asegurarte de tener la última versión.
2. **Desarrollo por rama o directo en master con commits atómicos:**
   * Ej: `fix(navbar): guarantee background blur and contrast on light pages (FS-019)`
   * Ej: `feat(shop): implement /tienda catalog and cart context (FS-020)`
3. **Compilación limpia:** `npm run build` debe dar código de salida `0` con 0 errores.
4. **Push a GitHub:** `git push origin master`.
5. **Aviso:** Una vez pusheado, notificar para que Antigravity o el pipeline ejecute `deploy.sh` en el servidor EC2.
