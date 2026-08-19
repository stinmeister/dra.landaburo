# Backlog de Tareas — Dra. Landaburo

---

### TASK-001 — Header tripartito: Logo izquierda, Menú centrado, CTA y Carrito derecha
- Fuente: Screenshot Homepage
- Categoría: Diseño/UX
- Qué pidió Agustín: "De aca me interesa menu centrado arriba, logo a la izquierda, CTA mas carrito a la derecha."
- Qué muestra la referencia: Header superior distribuido en 3 bloques claros: marca/logo a la izquierda, enlaces de navegación centrados y botones de acción (CTA + icono de carrito de compras) a la derecha.
- Cómo se aplicaría acá: Reestructurar el componente Header.tsx en un grid de 3 columnas (1fr auto 1fr) con el logo alineado a la izquierda, la lista de navegación centrada horizontalmente y el grupo CTA ("Agendar consulta") junto al icono del carrito de e-commerce alineados a la derecha.
- Chequeo de marca: OK
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-002 — Hero principal con fotografía destacada de la Dra. Paula Landaburo y Ticker de Tratamientos
- Fuente: Screenshot Homepage + Mockup aprobado (hero-mockup.html) / Research UX (T-08)
- Categoría: Diseño/UX
- Qué pidió Agustín: "Hero con la cara de la doctora, utilizar la misma imagen. Actualizar el hero de la homepage manteniendo el sistema visual actual (paleta crema/negro/champagne, tipografía serif) con foto de expresión humana cálida, ticker/listado horizontal de tratamientos en el borde inferior con scroll continuo sutil, y formato full-bleed."
- Qué muestra la referencia: Sección Hero full-bleed con fotografía portrait cálida de la Dra. Landaburo (o paciente con expresión natural), tipografía serif elegante con bajada y botón de acción, y en la base un ticker interactivo continuo con la lista de tratamientos (Toxina Botulínica, Ácido Hialurónico, Nordlys, etc.).
- Cómo se aplicaría acá: Actualizar `src/components/home/Hero.tsx` y `Hero.module.css`: (1) Estructura full-bleed responsive cuidando la altura en mobile para no empujar contenido fuera del primer scroll. (2) Integrar fotografía de alta calidad con expresión cálida y natural. (3) Agregar ticker horizontal infinito en la base del hero con scroll continuo sutil que liste los tratamientos con enlace directo a sus páginas. (4) CTA principal visible y alineado a la nueva jerarquía. Ver estructura en `hero-mockup.html`.
- Chequeo de marca: OK — Paleta oficial (#1C1C1C, #848484, #D2D3D3, #FFFFFF, #C5A47E).
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Alta
- Estado: Nuevo

---

### TASK-003 — Micro-interacciones interactivas en la Home
- Fuente: Idea propia
- Categoría: Funcionalidad
- Qué pidió Agustín: "Cosas interactivas, acepto propuestas, pero me gustaria que algo sea interactivo"
- Qué muestra la referencia: Módulos visuales en la home susceptibles de comportamiento interactivo.
- Cómo se aplicaría acá: Implementar componentes interactivos sutiles: 1) Comparador interactivo Antes/Después con slider de arrastre, 2) Selector interactivo "¿Qué te gustaría tratar?" por zona del rostro/cuerpo con feedback visual inmediato.
- Chequeo de marca: OK
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Media
- Estado: Nuevo

---

### TASK-004 — Carrusel infinito de marcas / partners / tecnologías
- Fuente: Screenshot Homepage
- Categoría: Contenido/Comunicación
- Qué pidió Agustín: "banner tipo carroucel con partners"
- Qué muestra la referencia: Franja horizontal con logotipos de marcas y socios estratégicos.
- Cómo se aplicaría acá: Crear un carrusel de movimiento continuo (marquee) que muestre los logos de laboratorios dermocosméticos y tecnologías médicas aliadas (Sulderm, Nordlys, etc.) en tono monocromático.
- Chequeo de marca: OK
- Prioridad sugerida: Bajo
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-005 — Sección de presentación de la Dra. con infografía de pilares
- Fuente: Screenshot Homepage
- Categoría: Contenido/Comunicación
- Qué pidió Agustín: "Seccion sobre la Dra. y banner con infografia"
- Qué muestra la referencia: Módulo de biografía acompañado de tarjetas informativas/infografía estructurada.
- Cómo se aplicaría acá: Construir la sección sobre la Dra. Landaburo integrando una infografía visual interactiva que desglose sus 4 pilares de atención (Diagnóstico integral, Armonía natural, Tecnología médica, Acompañamiento).
- Chequeo de marca: OK
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Media
- Estado: Nuevo

---

### TASK-006 — Sección "Últimas Novedades" con enlaces al Blog
- Fuente: Screenshot Homepage
- Categoría: Contenido/Comunicación
- Qué pidió Agustín: "Seccion Novedades con link a blogs"
- Qué muestra la referencia: Grilla de 3 artículos destacados con imagen, categoría y título con enlace a la lectura completa.
- Cómo se aplicaría acá: Crear la sección en la Home que renderice automáticamente las últimas 3 publicaciones de divulgación médica del blog con enlace directo a la entrada correspondiente.
- Chequeo de marca: OK
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-007 — Carrusel de publicaciones de Instagram (@dra_landaburo)
- Fuente: Screenshot Homepage
- Categoría: Funcionalidad
- Qué pidió Agustín: "Carrousel con imagenes de instagram"
- Qué muestra la referencia: Tira pre-footer con grilla horizontal de fotografías del canal social de Instagram.
- Cómo se aplicaría acá: Integrar un carrusel interactivo en el pre-footer que muestre las últimas imágenes de la cuenta @dra_landaburo con enlace directo a cada publicación en Instagram.
- Chequeo de marca: OK
- Prioridad sugerida: Bajo
- Complejidad técnica estimada: Media
- Estado: Nuevo

---

### TASK-008 — Hero destacado en página individual de Tratamiento
- Fuente: Screenshot Detalle Tratamiento
- Categoría: Diseño/UX
- Qué pidió Agustín: "Hero con imagen llamativa"
- Qué muestra la referencia: Cabecera de tratamiento con fotografía primer plano de procedimiento médico y título en tipografía serif blanca superpuesta.
- Cómo se aplicaría acá: Diseñar la cabecera dinámica de /tratamientos/[slug] con fotografía HD de fondo contextual al tratamiento, gradiente oscuro y tipografía serif elegante con bajada descriptiva.
- Chequeo de marca: OK
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-009 — Sidebar en tratamiento con perfil académico y respaldos científicos
- Fuente: Screenshot Detalle Tratamiento
- Categoría: Contenido/Comunicación
- Qué pidió Agustín: "Side bar con link para ver informacion academica de la doctora, tipo Linkedin o researchs"
- Qué muestra la referencia: Columna lateral flotante con tarjeta del profesional, foto, descripción breve y botones de enlace a perfil social/profesional.
- Cómo se aplicaría acá: Implementar una barra lateral en el detalle del tratamiento con minibiografía de la Dra. Landaburo, botón directo a su LinkedIn profesional y enlaces a investigaciones/papers científicos que respaldan el tratamiento.
- Chequeo de marca: OK
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-010 — Animación de texto tipeado solo (Typewriter) en títulos
- Fuente: Idea propia
- Categoría: Diseño/UX
- Qué pidió Agustín: "Algo interactivo como el texto que se escribe solo ( acepto sugerencias )"
- Qué muestra la referencia: Área de contenido dinámico en detalle de tratamiento.
- Cómo se aplicaría acá: Agregar un componente dinámico con efecto "escribiéndose solo" (Typewriter) para alternar preguntas o palabras clave en las cabeceras de tratamientos (ej. "Buscamos: armonía natural | frescura | definición").
- Chequeo de marca: OK
- Prioridad sugerida: Bajo
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-011 — Acordeón interactivo de Preguntas Frecuentes (FAQ) en Tratamientos
- Fuente: Screenshot Detalle Tratamiento
- Categoría: Funcionalidad
- Qué pidió Agustín: "Preguntas y respuestas interactivas. Focalizamos en las preguntas principales"
- Qué muestra la referencia: Módulo "¿Qué es y cómo trabajamos?" y bloques de información desplegable.
- Cómo se aplicaría acá: Crear un componente de Acordeón FAQ accesible e interactivo en cada tratamiento, permitiendo desplegar la respuesta al hacer clic en las dudas principales (duración, cuidados, aplicación).
- Chequeo de marca: OK
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-012 — Botón flotante de WhatsApp en Champagne con icono lineal fino
- Fuente: Screenshot Icono WhatsApp
- Categoría: Diseño/UX
- Qué pidió Agustín: "Disinto color pero icono fino para cta whatsapp"
- Qué muestra la referencia: Botón circular flotante en tono beige/champagne neutro con un icono de teléfono en burbuja de diálogo en trazo fino blanco.
- Cómo se aplicaría acá: Modificar el botón flotante de WhatsApp en WhatsAppButton.tsx para usar el fondo Champagne #C5A47E en lugar del verde brillante estándar, incorporando un icono minimalista de línea fina.
- Chequeo de marca: OK
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-013 — Banner de Cookies y captura de analítica
- Fuente: Idea propia
- Categoría: Funcionalidad
- Qué pidió Agustín: "Agrgegar cookies para capturar datos de los que visitan"
- Qué muestra la referencia: Banner de consentimiento de cookies y scripts de analítica.
- Cómo se aplicaría acá: Implementar banner de consentimiento de cookies en el footer e integrar los tags de medición (Google Analytics 4 y Meta Pixel) respetando el consentimiento del paciente.
- Chequeo de marca: OK
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-014 — Selector multilingüe de idiomas (Español, Inglés, Portugués)
- Fuente: Idea propia
- Categoría: Funcionalidad
- Qué pidió Agustín: "Agregar opciones de idioma ( espanol, ingles, portugues )"
- Qué muestra la referencia: Selector de idioma en interfaz web.
- Cómo se aplicaría acá: Integrar i18n en Next.js (App Router) y agregar un selector de idioma sutil en el header para alternar la interfaz entre Español, Inglés y Portugués.
- Chequeo de marca: OK
- Prioridad sugerida: Bajo
- Complejidad técnica estimada: Media
- Estado: Nuevo

---

### TASK-015 — Sección "Instalaciones y Consultorio" (Facilidades)
- Fuente: Idea propia
- Categoría: Contenido/Comunicación
- Qué pidió Agustín: "agregar seccion facilidades ( donde vamos a mostrar el consultorio )"
- Qué muestra la referencia: Recorrido de instalaciones de una clínica.
- Cómo se aplicaría acá: Crear una sección/página dedicada ("El Consultorio / Instalaciones") con recorrido fotográfico real del espacio, sala de recepción y consultorios para generar confianza previa a la visita.
- Chequeo de marca: OK
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-016 — Sección "Tecnología y Aparatología Médica"
- Fuente: Idea propia
- Categoría: Contenido/Comunicación
- Qué pidió Agustín: "agregar seccion aparatologia ( donde vamos a mostrar los aparatos )"
- Qué muestra la referencia: Catálogo de equipamiento médico.
- Cómo se aplicaría acá: Crear una sección interactiva para exhibir la aparatología médica del consultorio (Nordlys, Radiofrecuencia, Láser), explicando qué función cumple cada equipo con enfoque científico y sin promesas garantizadas.
- Chequeo de marca: OK
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-017 — Opción de compra de Gift Cards / Tarjetas de Regalo
- Fuente: Idea propia
- Categoría: Funcionalidad
- Qué pidió Agustín: "agregar opcion de giftcard"
- Qué muestra la referencia: Venta de tarjetas de regalo online.
- Cómo se aplicaría acá: Añadir al módulo de tienda/e-commerce la opción de adquirir "Gift Cards" digitales (con montos personalizables o voucher de tratamiento) para regalar a otros pacientes.
- Chequeo de marca: PENDIENTE DE DECISIÓN DE MARCA (¿Encaja la venta de gift cards con el posicionamiento de clínica médica?)
- Prioridad sugerida: Bajo
- Complejidad técnica estimada: Media
- Estado: Nuevo

---

### TASK-018 — Optimización de arquitectura para SEO, GEO, AEO y LLMO
- Fuente: Idea propia
- Categoría: Funcionalidad
- Qué pidió Agustín: "agregar estrucutra para mejorar performance de SEO - GEO - AEO - LLMO"
- Qué muestra la referencia: Estructuración de datos y metadatos SEO/IA.
- Cómo se aplicaría acá: Configurar metadatos dinámicos, esquemas estructurados Schema.org (MedicalClinic, Physician, FAQPage, Product), marcado semántico HTML5, datos de geolocalización (Gualeguaychú, Entre Ríos) y sitemap optimizado para buscadores y motores de respuestas de IA.
- Chequeo de marca: OK
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Media
- Estado: Nuevo

---

### TASK-019 — BUG: Navbar invisible en páginas con fondo blanco (letras blancas sobre blanco)
- Fuente: Bug detectado en inspección visual — Screenshots de /tratamientos y páginas individuales de tratamiento (Ácido Hialurónico) — 19/08/2026 (T-01)
- Categoría: Diseño/UX / Funcionalidad
- Qué pidió Agustín: "Arreglar el menu (navbar) cuando salimos de la home, no se ve porque son letras blancas sobre fondo blanco. La solución creo que es poner letras oscuras, siguiendo el design system. El navbar renderiza con texto blanco sobre fondo blanco/transparente, dejándolo completamente ilegible. Solo se distingue el borde fino del botón Agendar consulta."
- Qué muestra la referencia: [VERIFICADO] Screenshots de /tratamientos y /tratamientos/acido-hialuronico: el header es invisible — barra blanca/transparente donde logo y enlaces no contrastan. Solo se aprecia el borde fino del botón outline "Agendar consulta". [VERIFICADO] Header.tsx define `darkHeroPages = ['/', '/tratamientos']` — clasifica /tratamientos como página de hero oscuro y renderiza texto blanco. Al scrollear o en páginas internas con fondo claro, el navbar queda blanco con texto blanco encima.
- Cómo se aplicaría acá: Corregir lógica en `Header.tsx` y `Header.module.css`. Regla universal: (1) Cuando `scrolled === true`, el fondo del header es blanco sólido, por lo tanto el texto y logo DEBEN forzarse a `--color-negro: #1C1C1C` en TODAS las páginas. (2) Cuando `scrolled === false`, únicamente se muestra texto blanco si la página actual tiene un hero oscuro en el primer viewport (ej. Home). En páginas con fondo claro inicial (/contacto, /sobre-mi, /blog, /tienda), el texto debe ser oscuro desde el primer frame. (3) Criterio de aceptación: Contraste y legibilidad 100% garantizados en todas las páginas del sitio, tanto en viewport inicial como con scroll.
- Chequeo de marca: OK — Paleta define `--color-negro: #1C1C1C` como color de texto sobre fondos claros.
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-020 — GAP: E-commerce / Tienda — Página 404, ruta no existe
- Fuente: Bug detectado en inspección visual — Screenshot de /tienda (19/08/2026)
- Categoría: Funcionalidad
- Qué pidió Agustín: "No anda el e-commerce, fijarse por qué y revisar la especificación funcional que existía para saber si falló la documentación o el desarrollo."
- Qué muestra la referencia: [VERIFICADO] http://54.94.94.20:3000/tienda devuelve 404 "This page could not be found." [VERIFICADO] Rutas existentes en EC2: solo /, /blog, /contacto, /sobre-mi, /tratamientos, /tratamientos/[slug]. No hay src/app/tienda/. [INFERIDO] El header contiene un link "Tienda" que apunta a una ruta inexistente. [INFERIDO] El equipo externo no implementó esta ruta.
- Cómo se aplicaría acá: Crear `src/app/tienda/page.tsx` y `src/app/tienda/page.module.css`. Incluye: (1) Grid de productos dermocosméticos con imagen, nombre, descripción corta, precio en ARS y botón "Agregar". (2) Crear `src/data/products.ts` con catálogo de 24 productos (slugs, nombres, precios, imágenes desde /public/images/products/). (3) Estado de carrito con React Context o Zustand persistido en localStorage. (4) Icono de carrito en header derecho con badge de cantidad. (5) Página de carrito `/tienda/carrito/page.tsx` con resumen y botón de checkout. (6) Integración MercadoPago Checkout Pro — Sandbox para pruebas con MP_ACCESS_TOKEN en .env.local. (7) Webhook en `src/app/api/webhook/mercadopago/route.ts` que actualice estado en Supabase tabla `orders`. Sin descuentos ni urgencia artificial. Siempre "pacientes", nunca "clientes".
- Chequeo de marca: OK — Venta de dermocosmética coherente con posicionamiento médico. Sin descuentos ni urgencia artificial.
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Alta
- Estado: Nuevo

---

### TASK-021 — GAP: Sistema de autenticación y login — No existe en el proyecto
- Fuente: Scope original no implementado — reportado por Agustín (19/08/2026)
- Categoría: Funcionalidad
- Qué pidió Agustín: "No tengo ningún botón para conectarme, no sé si falló la docu o el desarrollo."
- Qué muestra la referencia: [VERIFICADO] No existen rutas de auth: sin src/app/login/, src/app/auth/ ni src/app/signup/. [VERIFICADO] Sin botón de login en el header actual. [VERIFICADO] @supabase/supabase-js está instalado y credenciales en .env.local pero ningún componente las usa para auth. [INFERIDO] El equipo externo no implementó este módulo.
- Cómo se aplicaría acá: (1) Crear src/lib/supabase.ts con cliente browser (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY). (2) Crear src/lib/supabase-server.ts con cliente server (SUPABASE_SERVICE_ROLE_KEY). (3) Crear src/app/login/page.tsx con formulario email + contraseña, link "¿Olvidaste tu contraseña?" y link a registro. (4) Crear src/app/register/page.tsx para nuevos pacientes (rol por defecto: paciente). (5) Crear src/middleware.ts que proteja /dashboard/* y /portal/* redirigiendo a /login sin sesión activa. (6) Agregar botón "Ingresar" en header derecho visible sin sesión; con sesión mostrar iniciales del usuario con dropdown (Mi perfil / Cerrar sesión). (7) Post-login redirigir según profiles.role: admin → /dashboard/ejecutivo, medico/operativo → /dashboard/operativo, paciente → /portal/paciente. Migraciones SQL en supabase/migrations/. Esquema de tablas documentado en esquema_base_de_datos_supabase.md.
- Chequeo de marca: OK — Login es funcionalidad interna, no afecta identidad visual pública.
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Alta
- Estado: Nuevo

---

### TASK-022 — GAP: Dashboards Ejecutivo, Operativo y Portal Paciente — No implementados
- Fuente: Scope original no implementado — reportado por Agustín (19/08/2026)
- Categoría: Funcionalidad
- Qué pidió Agustín: "No hay dashboard, no sé si no está o no se puede acceder."
- Qué muestra la referencia: [VERIFICADO] No existen rutas de dashboard: sin src/app/dashboard/ ni src/app/portal/. [INFERIDO] No es problema de acceso — las rutas no existen. Prerequisito: TASK-021 (autenticación) debe estar completo antes de implementar los dashboards.
- Cómo se aplicaría acá: Implementar tres áreas privadas diferenciadas por rol. **Dashboard Ejecutivo (/dashboard/ejecutivo) — solo rol admin:** (a) Panel financiero: facturación ARS/USD, desglose por medio de pago, evolución mensual desde tabla payments. Usar Recharts o Tremor para gráficos. (b) Comisiones: ingresos Dra. Landaburo vs Mercedes (30% cosmetología) filtrando por professional_profile_id. (c) Inventario: stock actual (products.stock_quantity), alertas cuando stock_quantity < min_stock_alert, lotes con vencimiento próximo (product_batches). (d) KPIs de pacientes: distribución por rfm_segment de tabla patients. **Dashboard Operativo (/dashboard/operativo) — roles admin, medico, operativo:** (a) Tareas del día asignadas al usuario autenticado desde employee_tasks, con checkbox para completar. (b) Buscador de 102 tratamientos con filtro por categoría y profesional. (c) Guías operativas en formato de lectura (Guía Doris, Ceci, Laura). **Portal Paciente (/portal/paciente) — solo rol paciente:** historial de turnos (appointments), compras (orders), gift cards activas (gift_cards). Todas las consultas deben usar cliente Supabase con RLS activo (anon key, no service role). Diseño: fondo blanco, texto #1C1C1C, acento champagne #C5A47E. Sin dark mode toggle.
- Chequeo de marca: OK — Dashboards internos siguiendo paleta del design system.
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Alta
- Estado: Nuevo

---

### TASK-023 — BUG: Texto de placeholder/debug visible en hero de tratamientos ("Buscamos: confianza")
- Fuente: Screenshot de página de tratamiento (Ácido Hialurónico) — 19/08/2026 (T-02)
- Categoría: Contenido/Comunicación
- Qué pidió Agustín: "Debajo del subtítulo del hero, en la página de detalle de tratamiento, aparece el texto 'Buscamos: confianza' con el cursor de edición visible — parece un campo de CMS (brief interno de tono/emoción) que quedó expuesto en el frontend en lugar de ocultarse."
- Qué muestra la referencia: En la cabecera de la página individual de Ácido Hialurónico se observa el texto `Buscamos: confianza` con un cursor parpadeante o de edición activo, lo que denota un componente Typewriter o string de debug/placeholder renderizado públicamente.
- Cómo se aplicaría acá: Auditar la plantilla `src/app/tratamientos/[slug]/page.tsx` y el componente `Typewriter.tsx`. Remover cualquier campo de placeholder, debug o texto de brief interno en todas las páginas de tratamiento (las 10 páginas comparten plantilla). Asegurar que únicamente se rendericen títulos, bajadas y descripciones médicas aprobadas.
- Chequeo de marca: OK — Eliminar texto de debug protege la seriedad y elegancia médica de la clínica.
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-024 — BUG: Acordeón de FAQ corta el texto de las respuestas (overflow/max-height)
- Fuente: Screenshot de página de tratamiento (Ácido Hialurónico) — 19/08/2026 (T-03)
- Categoría: Funcionalidad / Diseño-UX
- Qué pidió Agustín: "En el acordeón de 'Preguntas frecuentes', cada respuesta se corta a mitad de oración (ej. '...En la consulta inicial la', '...cremas anestésicas cuando resulta') con una línea subrayada debajo, como si el contenedor no colapsara/expandiera correctamente."
- Qué muestra la referencia: Las respuestas desplegadas en el módulo FAQ de tratamientos aparecen truncadas horizontal o verticalmente por un contenedor con `max-height` restrictivo o `overflow: hidden` mal calculado, impidiendo leer el texto médico completo.
- Cómo se aplicaría acá: Corregir `src/components/tratamientos/TreatmentFAQ.tsx` y `TreatmentFAQ.module.css`. Eliminar `max-height` fijos o usar `grid-template-rows: 1fr` / auto-height dinámico para que el contenido desplegado se expanda al 100% de la altura de su texto sin truncar, garantizando que funcione en las 10 páginas de tratamientos y en todos los viewports (desktop, tablet, mobile).
- Chequeo de marca: OK — Claridad informativa total para el paciente.
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Media
- Estado: Nuevo

---

### TASK-025 — BUG/CONTENIDO: Estadísticas inconsistentes entre Home y Sobre Mí
- Fuente: Screenshots de Home y Sobre Mí — 19/08/2026 (T-04)
- Categoría: Contenido/Comunicación
- Qué pidió Agustín: "El bloque de estadísticas muestra números distintos en cada página: Home: 6+ años / 537+ pacientes / 10+ certificaciones / 67% enfoque humano vs Sobre Mí: 10+ años / 800+ pacientes / 15+ certificaciones / 100% enfoque humano. Definir los números reales y que sean idénticos en todas las páginas."
- Qué muestra la referencia: Inconsistencia entre los contadores numéricos de `StatsCounter` en la Home y la página `/sobre-mi`, afectando la credibilidad institucional.
- Cómo se aplicaría acá: Centralizar los datos de estadísticas en `src/data/site-content.ts` (o archivo dedicado) como única fuente de verdad consumida por `StatsCounter.tsx` en Home y `/sobre-mi`. Confirmar con Agustín / Dra. Landaburo el set de datos real (ej: 10+ Años cuidando la piel, 800+ Pacientes acompañados, 15+ Certificaciones, 100% Enfoque humano) y asegurar que nunca más existan valores hardcodeados divergentes.
- Chequeo de marca: OK — Datos precisos y sin falsas promesas.
- Prioridad sugerida: Alto
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-026 — BUG/DISEÑO: Tarjetas de tratamiento con borde superior inconsistente en /tratamientos
- Fuente: Screenshot de listado de Tratamientos — 19/08/2026 (T-05)
- Categoría: Diseño/UX
- Qué pidió Agustín: "De las 9 tarjetas en el grid de 'Tratamientos', dos ('Ácido Hialurónico' y 'Biostimuladores de Colágeno') tienen un borde superior color terracota que las otras 7 no tienen. Definir si es intencional o bug."
- Qué muestra la referencia: El catálogo de `/tratamientos` presenta 2 tarjetas con borde superior decorativo terracota/champagne y 7 sin él, generando un aspecto visual dispar.
- Cómo se aplicaría acá: Auditar `src/app/tratamientos/page.tsx` y `page.module.css`. Si Agustín/diseño decide destacar tratamientos populares, normalizar la lógica con una propiedad formal en `treatments.ts` (`isFeatured?: boolean`) y una etiqueta visible ("Destacado") con estilo uniforme; de lo contrario, remover la clase condicional para que las 10 tarjetas compartan exactamente el mismo diseño base.
- Chequeo de marca: OK — Consistencia visual en el catálogo.
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Baja
- Estado: Nuevo

---

### TASK-027 — MEJORA UX: Jerarquía visual de botones (1 CTA sólido principal por vista + Navbar sólido)
- Fuente: Análisis general de todas las páginas — 19/08/2026 (T-06)
- Categoría: Diseño/UX
- Qué pidió Agustín: "Actualmente casi todos los CTA usan estilo outline, compitiendo en peso visual entre sí. Definir un solo botón sólido (relleno color champagne/terracota) por vista para la acción prioritaria, y el resto en estilo outline. El CTA 'Agendar consulta' del navbar debería pasar a sólido de forma consistente en todo el sitio."
- Qué muestra la referencia: Ausencia de jerarquía visual entre acciones primarias y secundarias en las diferentes vistas.
- Cómo se aplicaría acá: Actualizar `src/components/ui/Button.tsx` y los módulos de layout/páginas: (1) Establecer el botón "Agendar consulta" en el Navbar con variante sólida (fondo `--color-champagne: #C5A47E`, texto `#1C1C1C` o `#FFFFFF`) en todo el sitio. (2) En cada pantalla/sección, garantizar que como máximo exista un único botón sólido en el primer viewport para guiar la conversión principal, dejando las opciones complementarias como `secondary` (outline) o `ghost`.
- Chequeo de marca: OK — Uso exclusivo de paleta oficial (#C5A47E, #1C1C1C, #FFFFFF).
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Media
- Estado: Nuevo

---

### TASK-028 — DISEÑO: Radio de redondeo suave en botones (`border-radius: 6px`)
- Fuente: Decisión de diseño / Research NN/g — 19/08/2026 (T-07)
- Categoría: Diseño/UX
- Qué pidió Agustín: "Los botones actuales tienen esquinas completamente rectas. Cambiar a un radio suave (6px aprox.) — ni completamente recto ni tipo píldora — para alinear con la identidad cálida/editorial de la marca sin perder la formalidad clínica."
- Qué muestra la referencia: Botones con esquinas vivas en 90° que lucen excesivamente rígidos frente a la tipografía serif y las curvas sutiles del diseño editorial.
- Cómo se aplicaría acá: Modificar `src/components/ui/Button.module.css` (y los estilos de botones en Header, Hero, Footer, Tarjetas) aplicando `border-radius: 6px` a todas las variantes de botones del sitio.
- Chequeo de marca: OK — Alineado con identidad cálida y profesional de la Dra. Landaburo.
- Prioridad sugerida: Medio
- Complejidad técnica estimada: Baja
- Estado: Nuevo

