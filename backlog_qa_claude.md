# 📋 Protocolo de QA y Backlog Consolidado — Dra. Landaburo (dralandaburo.com)

**URL del entorno en vivo (EC2):** [http://54.94.94.20:3000](http://54.94.94.20:3000)  
**Fecha de consolidación:** 19/08/2026  
**Destinatario:** Claude (Navegación en Chrome / QA Auditor)  
**Objetivo:** Auditar la web en vivo, verificar el estado de cada ticket pendiente, constatar bugs/gaps y reportar nuevos hallazgos.

---

## 🧭 Mapeo de Tickets: Nuevos vs Ya Existentes (Revisión Agustín + Claude)

| ID Original | Título | Mapeo en Backlog | Estado de Detección | Acción Tomada |
|---|---|---|---|---|
| **T-01** | Navbar invisible en páginas con fondo blanco | **TASK-019** | ⚠️ **YA EXISTÍA** | Enriquecido con screenshot de Ácido Hialurónico y criterio de aceptación universal. |
| **T-02** | Texto de placeholder/debug en hero ("Buscamos: confianza") | **TASK-023** | 🆕 **NUEVO** | Creado como BUG de Contenido/Comunicación. |
| **T-03** | Acordeón FAQ corta texto de respuestas (overflow) | **TASK-024** | 🆕 **NUEVO** | Creado como BUG de Funcionalidad/UX sobre feature TASK-011. |
| **T-04** | Estadísticas inconsistentes entre Home y Sobre Mí | **TASK-025** | 🆕 **NUEVO** | Creado como BUG de Contenido/Comunicación. |
| **T-05** | Tarjetas de tratamiento con borde superior inconsistente | **TASK-026** | 🆕 **NUEVO** | Creado como BUG/DISEÑO de Catálogo. |
| **T-06** | Jerarquía de botones (1 CTA sólido principal por vista + Navbar) | **TASK-027** | 🆕 **NUEVO** | Creado como MEJORA de UX/Diseño. |
| **T-07** | Redondeo de esquinas en botones (`border-radius: 6px`) | **TASK-028** | 🆕 **NUEVO** | Creado como MEJORA de Diseño. |
| **T-08** | Rediseño Hero Home (Mockup, foto humana, ticker continuo) | **TASK-002** | ⚠️ **YA EXISTÍA** | Enriquecido con especificación de `hero-mockup.html`, ticker y full-bleed. |

---

## 🔴 SECCIÓN 1: BUGS Y GAPS CRÍTICOS (Prioridad Alta)

### TASK-019 — BUG: Navbar invisible en páginas con fondo blanco (letras blancas sobre blanco)
* **URL para verificar:** [http://54.94.94.20:3000/tratamientos](http://54.94.94.20:3000/tratamientos), [http://54.94.94.20:3000/tratamientos/acido-hialuronico](http://54.94.94.20:3000/tratamientos/acido-hialuronico), [http://54.94.94.20:3000/contacto](http://54.94.94.20:3000/contacto)
* **Categoría:** Diseño/UX / Funcionalidad
* **Problema en vivo:** El header renderiza texto blanco sobre fondo blanco/transparente. Solo se distingue el borde fino del botón outline "Agendar consulta".
* **Especificación funcional:**
  1. Si `scrolled === true`, forzar `color: #1C1C1C` y logo oscuro en TODAS las páginas sin excepción.
  2. Si `scrolled === false`, texto blanco ÚNICAMENTE si la página tiene hero oscuro en el primer viewport (Home). En páginas con fondo claro inicial (/contacto, /sobre-mi, /blog, /tienda), texto oscuro desde el inicio.
* **Criterio de aceptación:** Navbar 100% legible y con contraste suficiente en todos los estados y páginas.

### TASK-020 — GAP: E-commerce / Tienda — Página 404, ruta no existe
* **URL para verificar:** [http://54.94.94.20:3000/tienda](http://54.94.94.20:3000/tienda)
* **Categoría:** Funcionalidad
* **Problema en vivo:** Al hacer clic en "Tienda" en el menú o ingresar a `/tienda`, devuelve error 404 "This page could not be found."
* **Especificación funcional:**
  1. Crear `src/app/tienda/page.tsx` con catálogo de 24 productos dermocosméticos.
  2. Carrito de compras accesible desde el icono del header con badge numérico persistido en localStorage.
  3. Checkout con MercadoPago Sandbox (`/tienda/carrito/page.tsx`).
  4. Webhook en `src/app/api/webhook/mercadopago/route.ts` para persistir pedidos en tabla `orders` de Supabase.
* **Regla de marca:** Siempre "pacientes", nunca "clientes". Cero descuentos, cero urgencia artificial.

### TASK-021 — GAP: Sistema de autenticación y login — No existe en el proyecto
* **URL para verificar:** [http://54.94.94.20:3000/login](http://54.94.94.20:3000/login)
* **Categoría:** Funcionalidad
* **Problema en vivo:** No existe botón de login en el header ni rutas de autenticación (`/login`, `/register`).
* **Especificación funcional:**
  1. Implementar Supabase Auth con cliente browser y server.
  2. Formularios de Login y Registro (`/login`, `/register`).
  3. Botón "Ingresar" en header derecho; al autenticar, mostrar avatar con menú desplegable (Mi Perfil / Cerrar sesión).
  4. Redirección automática post-login por rol: `admin` → `/dashboard/ejecutivo`, `medico`/`operativo` → `/dashboard/operativo`, `paciente` → `/portal/paciente`.
  5. `middleware.ts` para proteger rutas privadas.

### TASK-022 — GAP: Dashboards Ejecutivo, Operativo y Portal Paciente — No implementados
* **URL para verificar:** [http://54.94.94.20:3000/dashboard/ejecutivo](http://54.94.94.20:3000/dashboard/ejecutivo), [http://54.94.94.20:3000/dashboard/operativo](http://54.94.94.20:3000/dashboard/operativo), [http://54.94.94.20:3000/portal/paciente](http://54.94.94.20:3000/portal/paciente)
* **Categoría:** Funcionalidad
* **Problema en vivo:** Rutas inexistentes (404). Prerequisito: TASK-021.
* **Especificación funcional:**
  1. **Dashboard Ejecutivo (`/dashboard/ejecutivo`):** Facturación ARS/USD (tabla `payments`), comisiones Dra. vs Mercedes (30%), stock de productos con alertas `< 5 un.` (tabla `products`), KPIs pacientes RFM.
  2. **Dashboard Operativo (`/dashboard/operativo`):** Tareas del día (`employee_tasks`), buscador de los 102 tratamientos, guías de personal (Doris, Ceci, Laura).
  3. **Portal Paciente (`/portal/paciente`):** Historial de turnos, compras de productos, gift cards activas.

### TASK-023 — BUG: Texto de placeholder/debug en hero de tratamientos ("Buscamos: confianza")
* **URL para verificar:** [http://54.94.94.20:3000/tratamientos/acido-hialuronico](http://54.94.94.20:3000/tratamientos/acido-hialuronico) (y los otros 9 tratamientos)
* **Categoría:** Contenido/Comunicación
* **Problema en vivo:** En la cabecera debajo del subtítulo aparece `Buscamos: confianza` con cursor de edición.
* **Especificación funcional:** Auditar `src/app/tratamientos/[slug]/page.tsx` y `Typewriter.tsx`; eliminar cualquier string de debug/placeholder interno en las 10 páginas de tratamientos.
* **Criterio de aceptación:** Solo texto médico aprobado visible públicamente.

### TASK-024 — BUG: Acordeón de FAQ corta el texto de las respuestas (overflow)
* **URL para verificar:** [http://54.94.94.20:3000/tratamientos/acido-hialuronico](http://54.94.94.20:3000/tratamientos/acido-hialuronico) (sección FAQ)
* **Categoría:** Funcionalidad / Diseño-UX
* **Problema en vivo:** Al desplegar preguntas frecuentes, las respuestas se truncan a mitad de oración con líneas subrayadas.
* **Especificación funcional:** Corregir `TreatmentFAQ.tsx` y `TreatmentFAQ.module.css` removiendo `max-height` estático y asegurando expansión fluida (`grid-template-rows: 1fr` o auto-height) en las 10 páginas de tratamientos.
* **Criterio de aceptación:** Respuestas 100% legibles y completas al abrir cada acordeón.

### TASK-025 — BUG/CONTENIDO: Estadísticas inconsistentes entre Home y Sobre Mí
* **URL para verificar:** [http://54.94.94.20:3000/](http://54.94.94.20:3000/) vs [http://54.94.94.20:3000/sobre-mi](http://54.94.94.20:3000/sobre-mi)
* **Categoría:** Contenido/Comunicación
* **Problema en vivo:**
  - Home: 6+ años / 537+ pacientes / 10+ certificaciones / 67% enfoque humano
  - Sobre Mí: 10+ años / 800+ pacientes / 15+ certificaciones / 100% enfoque humano
* **Especificación funcional:** Unificar en `src/data/site-content.ts` las cifras oficiales confirmadas con la Dra. Landaburo (ej. 10+ Años, 800+ Pacientes, 15+ Certificaciones, 100% Enfoque humano) y consumirlas desde el componente compartido `StatsCounter.tsx`.

---

## 🟡 SECCIÓN 2: MEJORAS DE DISEÑO, UX Y CONTENIDO (Prioridad Media)

### TASK-001 — Header tripartito: Logo izquierda, Menú centrado, CTA y Carrito derecha
* **URL para verificar:** [http://54.94.94.20:3000/](http://54.94.94.20:3000/)
* **Estado:** Parcialmente implementado por el equipo externo. Requiere ajustar alineación grid (1fr auto 1fr), carrito e integración con botón login.

### TASK-002 — Hero principal con foto de la Dra. Paula Landaburo y Ticker de Tratamientos
* **URL para verificar:** [http://54.94.94.20:3000/](http://54.94.94.20:3000/)
* **Especificación funcional:** Full-bleed, imagen cálida y natural de la Dra. Landaburo, tipografía serif editorial, botón CTA sólido destacado y ticker continuo inferior con listado horizontal de tratamientos (`hero-mockup.html`).

### TASK-026 — BUG/DISEÑO: Tarjetas de tratamiento con borde superior inconsistente en /tratamientos
* **URL para verificar:** [http://54.94.94.20:3000/tratamientos](http://54.94.94.20:3000/tratamientos)
* **Problema en vivo:** En el grid de 9-10 tarjetas, 2 tienen borde superior terracota/champagne y el resto no.
* **Especificación funcional:** Normalizar el grid. Si hay tratamientos destacados, incorporar etiqueta visual "Destacado" homogénea; de lo contrario, remover la disparidad de bordes.

### TASK-027 — MEJORA UX: Jerarquía visual de botones (1 CTA sólido principal por vista + Navbar sólido)
* **URL para verificar:** Todo el sitio
* **Especificación funcional:** Botón "Agendar consulta" del Navbar pasa a estilo sólido (fondo champagne `#C5A47E`, texto `#1C1C1C`). En cada página, máximo 1 botón sólido visible en el viewport inicial. Acciones secundarias en outline o ghost.

### TASK-028 — DISEÑO: Radio de redondeo suave en botones (`border-radius: 6px`)
* **URL para verificar:** Todo el sitio
* **Especificación funcional:** Aplicar `border-radius: 6px` consistente a todos los botones e inputs interactivos en `Button.module.css` y módulos asociados.

### TASK-003 — Micro-interacciones interactivas en la Home
* **Especificación:** Slider comparativo Antes/Después y selector interactivo "¿Qué te gustaría tratar?" por zona facial/corporal.

### TASK-004 — Carrusel infinito de marcas / partners / tecnologías
* **URL para verificar:** [http://54.94.94.20:3000/](http://54.94.94.20:3000/) (sección partners)
* **Estado:** Componente `PartnersMarquee.tsx` creado. Verificar renderizado y velocidad de scroll.

### TASK-005 — Sección de presentación de la Dra. con infografía de pilares
* **URL para verificar:** [http://54.94.94.20:3000/sobre-mi](http://54.94.94.20:3000/sobre-mi)
* **Especificación:** 4 pilares de atención médica estructurados visualmente con iconografía fina.

### TASK-006 — Sección "Últimas Novedades" con enlaces al Blog
* **URL para verificar:** [http://54.94.94.20:3000/](http://54.94.94.20:3000/) y [http://54.94.94.20:3000/blog](http://54.94.94.20:3000/blog)
* **Especificación:** Grilla de 3 artículos médicos con enlaces directos a las entradas del blog.

### TASK-007 — Carrusel de publicaciones de Instagram (@dra_landaburo)
* **URL para verificar:** [http://54.94.94.20:3000/](http://54.94.94.20:3000/) (pre-footer)
* **Especificación:** Tira de fotos de Instagram con enlace directo al perfil @dra_landaburo.

### TASK-008 — Hero destacado en página individual de Tratamiento
* **URL para verificar:** [http://54.94.94.20:3000/tratamientos/[slug]](http://54.94.94.20:3000/tratamientos/acido-hialuronico)
* **Estado:** Parcialmente implementado. Ajustar contraste y padding responsive.

### TASK-009 — Sidebar en tratamiento con perfil académico y respaldos científicos
* **URL para verificar:** [http://54.94.94.20:3000/tratamientos/[slug]](http://54.94.94.20:3000/tratamientos/toxina-botulinica)
* **Estado:** Componente presente. Verificar enlaces a LinkedIn y papers científicos.

### TASK-010 — Animación de texto tipeado (Typewriter)
* **Estado:** Componente implementado. Asegurar que solo anime frases médicas aprobadas (ver TASK-023).

### TASK-011 — Acordeón interactivo de Preguntas Frecuentes (FAQ) en Tratamientos
* **URL para verificar:** [http://54.94.94.20:3000/tratamientos/[slug]](http://54.94.94.20:3000/tratamientos/acido-hialuronico)
* **Estado:** Implementado con bug de overflow reportado en TASK-024.

### TASK-012 — Botón flotante de WhatsApp en Champagne con icono lineal fino
* **URL para verificar:** [http://54.94.94.20:3000/](http://54.94.94.20:3000/)
* **Estado:** Implementado en champagne. Verificar visibilidad en scroll y enlace a `wa.me/5491169684062`.

### TASK-013 — Banner de Cookies y analítica
* **URL para verificar:** [http://54.94.94.20:3000/](http://54.94.94.20:3000/)
* **Estado:** Componente `CookieBanner.tsx` agregado. Verificar persistencia de aceptación.

### TASK-014 — Selector multilingüe de idiomas (Español, Inglés, Portugués)
* **Categoría:** Funcionalidad
* **Prioridad:** Bajo
* **Especificación:** i18n en Next.js App Router con selector discreto en header.

### TASK-015 — Sección "Instalaciones y Consultorio" (Facilidades)
* **Categoría:** Contenido/Comunicación
* **Prioridad:** Medio
* **Especificación:** Galería fotográfica real de recepción y consultorios en Leandro N. Alem 45, Gualeguaychú.

### TASK-016 — Sección "Tecnología y Aparatología Médica"
* **Categoría:** Contenido/Comunicación
* **Prioridad:** Medio
* **Especificación:** Fichas de aparatología (Nordlys, etc.) con enfoque clínico y sin promesas garantizadas.

### TASK-017 — Opción de compra de Gift Cards / Tarjetas de Regalo
* **Categoría:** Funcionalidad
* **Prioridad:** Bajo
* **Estado:** Pendiente de confirmación de marca con Agustín.

### TASK-018 — Optimización de arquitectura para SEO, GEO, AEO y LLMO
* **Categoría:** Funcionalidad
* **Prioridad:** Alto
* **Especificación:** Schema.org (`MedicalClinic`, `Physician`, `FAQPage`), sitemap dinámico, metadatos enriquecidos y geolocalización en Gualeguaychú, Entre Ríos.

---

## 🔍 Checklist de Auditoría para Claude en Chrome

1. **Rutas a recorrer:**
   - `/` (Home)
   - `/tratamientos` (Catálogo general)
   - `/tratamientos/toxina-botulinica`
   - `/tratamientos/acido-hialuronico`
   - `/tratamientos/nordlys`
   - `/sobre-mi`
   - `/contacto`
   - `/blog`
   - `/tienda` (comprobar 404)
   - `/login` (comprobar 404)
   - `/dashboard/ejecutivo` (comprobar 404)

2. **Puntos de control clave:**
   - [ ] ¿El navbar se lee perfectamente en fondo blanco al scrollear en `/tratamientos` y páginas de tratamiento? (**TASK-019**)
   - [ ] ¿Desapareció el texto `Buscamos: confianza` con cursor en los heroes de tratamiento? (**TASK-023**)
   - [ ] ¿Al abrir cada pregunta del FAQ el texto se lee completo sin cortarse? (**TASK-024**)
   - [ ] ¿Las estadísticas de la Home coinciden exactamente con las de `/sobre-mi`? (**TASK-025**)
   - [ ] ¿Todas las tarjetas de `/tratamientos` tienen bordes homogéneos? (**TASK-026**)
   - [ ] ¿El botón "Agendar consulta" del header es sólido y destaca como acción principal? (**TASK-027**)
   - [ ] ¿Los botones tienen esquinas suavizadas con `border-radius: 6px`? (**TASK-028**)
   - [ ] ¿Hay algún otro error en consola, enlace roto o problema de maquetación no registrado? (Si encuentras alguno, regístralo siguiendo el formato estándar de 9 campos).
