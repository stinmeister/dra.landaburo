# 📑 Especificación Funcional — Sitio Dra. Landaburo (dralandaburo.com)

**Versión:** 1.0  
**Fecha:** 19/08/2026  
**Origen:** Backlog QA (Agustín + Claude) → Merge Antigravity → Validación en vivo (EC2: 54.94.94.20:3000)  
**Destinatario:** Equipo de desarrollo externo  
**Ambiente de Staging / QA:** [http://54.94.94.20:3000](http://54.94.94.20:3000)  
**Repositorio GitHub:** `https://github.com/stinmeister/dra.landaburo.git` (rama `master`)

---

## 📌 Nota de Proceso

Cada ticket incluye:
* Estado actual verificado empíricamente.
* Comportamiento esperado.
* Requerimientos funcionales y técnicos concretos.
* Criterios de aceptación verificables.

> **Nota:** Los tickets marcados como *"Verificado — sin acción"* se incluyen para dejar constancia de que fueron auditados y están correctos en el estado actual; no requieren desarrollo inmediato.

---

## 🧭 Índice de Especificaciones

| ID Especificación | ID Backlog | Título | Prioridad | Estado |
|---|---|---|---|---|
| [**FS-019**](#fs-019) | `TASK-019` | Navbar sin contraste garantizado | 🔴 Alta | Abierto / Bloqueante |
| [**FS-023**](#fs-023) | `TASK-023` | Texto de debug expuesto en hero de tratamiento | 🔴 Alta | Abierto |
| [**FS-024**](#fs-024) | `TASK-024` | Acordeón de FAQ corta el contenido (overflow) | 🔴 Alta | Abierto |
| [**FS-025**](#fs-025) | `TASK-025` | Estadísticas sin fuente única de verdad | 🔴 Alta | Abierto |
| [**FS-027**](#fs-027) | `TASK-027` | Jerarquía visual de CTAs (1 sólido principal por vista) | 🟡 Media | Abierto |
| [**FS-028**](#fs-028) | `TASK-028` | Radio de borde en botones (`border-radius: 6px`) | 🟡 Media | Abierto |
| [**FS-N01**](#fs-n01) | `TASK-029` | Elemento flotante mal posicionado sobre tarjeta de perfil | 🟡 Media | Abierto |
| [**FS-N02**](#fs-n02) | `TASK-030` | Confirmar alcance del widget de chat flotante | 🟢 Baja | A confirmar con Agustín |
| [**FS-026**](#fs-026) | `TASK-026` | Borde superior dispar en tarjetas de tratamiento | — | Verificado — sin acción |
| [**FS-020/021/022**](#fs-020-021-022) | `TASK-020/021/022` | Rutas no construidas (tienda, login, dashboards) | — | Verificado — sin acción |

---

<a name="fs-019"></a>
## 🔴 FS-019 — Navbar sin contraste garantizado
* **ID Backlog:** `TASK-019`
* **Prioridad:** Alta (bloquea navegación)
* **Categoría:** Funcionalidad / Frontend
* **Rutas afectadas confirmadas:** `/tratamientos` (estado inicial, antes de scroll), `/tratamientos/acido-hialuronico` (estado inicial). Afecta cualquier vista donde el fondo detrás del navbar sea claro sin overlay oscuro.

### 1. Estado Actual
El navbar usa texto de color claro (blanco) de forma fija, asumiendo que siempre habrá un fondo oscuro o un overlay detrás. Cuando el contenido bajo el navbar es claro (por ejemplo, el espacio en blanco antes de que cargue la imagen del hero, o el fondo blanco general de la página), el texto y el logo quedan invisibles. Solo permanece visible el borde del botón *"Agendar consulta"* (que tiene `border` pero no `background-color`).

### 2. Comportamiento Esperado
El navbar debe ser legible en el 100% de los estados posibles: al cargar cualquier página, en cualquier punto del scroll, y sobre cualquier tipo de contenido (imagen clara, imagen oscura, fondo de color sólido, fondo blanco).

### 3. Requerimientos Funcionales
1. El navbar debe tener un fondo propio garantizado — no depender del contenido de la página para tener contraste. Opciones válidas: fondo sólido siempre presente, o fondo con blur + opacidad suficiente (mínimo 85%) para garantizar contraste independientemente de lo que haya detrás.
2. El color del texto/logo del navbar debe mantener una relación de contraste mínima de 4.5:1 contra su propio fondo (estándar WCAG AA), no contra el contenido de la página.
3. El botón *"Agendar consulta"* en el navbar debe tener `background-color` visible en todos los estados (ver también FS-027, que además pide que sea el CTA sólido principal).
4. Este comportamiento debe verificarse en el estado inicial de carga (sin scroll) y en el estado con scroll, en las rutas principales: `/`, `/tratamientos`, `/tratamientos/[slug]` (las 10 páginas de tratamiento), `/sobre-mi`, `/contacto`, `/blog`.

### 4. Criterios de Aceptación
- [ ] El navbar es legible (texto y logo con contraste suficiente) al cargar cada una de las rutas listadas, sin necesidad de hacer scroll.
- [ ] El navbar permanece legible durante todo el scroll de la página, incluyendo transiciones entre secciones con fondos de distinto color.
- [ ] El botón *"Agendar consulta"* es visualmente distinguible (con relleno de color) en todos los estados.

---

<a name="fs-023"></a>
## 🔴 FS-023 — Texto de debug expuesto en hero de tratamiento
* **ID Backlog:** `TASK-023`
* **Prioridad:** Alta
* **Categoría:** Contenido / Frontend
* **Rutas afectadas confirmadas:** `/tratamientos/acido-hialuronico`. A verificar: las 10 páginas de tratamiento, ya que comparten la misma plantilla.

### 1. Estado Actual
Debajo del subtítulo del hero, en la página de detalle de tratamiento, se renderiza públicamente el texto `"Buscamos: [palabra]"` seguido de un cursor de edición visible (aparente efecto de tipeo/typewriter mal implementado, o un campo de brief interno de tono/emoción que no debería mostrarse al paciente final).

### 2. Comportamiento Esperado
El hero de cada página de tratamiento debe mostrar únicamente: categoría (ej. `"FACIAL"`), título del tratamiento, y la descripción/subtítulo médica destinada al público. Ningún campo de configuración interna, brief, o placeholder de desarrollo debe ser visible.

### 3. Requerimientos Funcionales
1. Localizar el componente/campo que genera el texto `"Buscamos: [x]"` en la plantilla de tratamiento (`src/app/tratamientos/[slug]/page.tsx` o `src/components/ui/Typewriter.tsx`).
2. Determinar si es: (a) un campo de CMS/mock que se está renderizando por error y debe ocultarse, o (b) un efecto de animación de texto (typewriter) mal configurado que quedó con datos de prueba — en cuyo caso remover el texto de prueba y dejar solo contenido aprobado.
3. Remover o corregir el elemento en la plantilla compartida, de forma que el fix aplique automáticamente a las 10 páginas de tratamiento.

### 4. Criterios de Aceptación
- [ ] Ninguna página de tratamiento muestra el texto `"Buscamos:"` ni ningún otro campo de brief/debug en el hero.
- [ ] Verificado visualmente en las 10 páginas de tratamiento, no solo en Ácido Hialurónico.

---

<a name="fs-024"></a>
## 🔴 FS-024 — Acordeón de FAQ corta el contenido
* **ID Backlog:** `TASK-024`
* **Prioridad:** Alta
* **Categoría:** Funcionalidad / Frontend
* **Rutas afectadas confirmadas:** `/tratamientos/acido-hialuronico`, sección *"Preguntas frecuentes"*. A verificar: las 10 páginas de tratamiento.

### 1. Estado Actual
Al desplegar cada pregunta del acordeón de FAQ, la respuesta se corta a mitad de oración (ejemplos observados: *"...En la consulta inicial la"*, *"...cremas anestésicas cuando resulta"*, *"...La Dra. Landaburo"*), con una línea subrayada visible debajo del texto cortado — indicio de que el contenedor no está expandiéndose a la altura real del contenido.

### 2. Comportamiento Esperado
Al hacer clic en cualquier pregunta del FAQ, la respuesta completa debe mostrarse sin truncarse, con el contenedor expandiéndose a la altura necesaria para mostrar todo el texto.

### 3. Requerimientos Funcionales
1. Revisar la implementación del acordeón (`TreatmentFAQ.tsx` y `TreatmentFAQ.module.css`): el problema se origina en un `max-height` fijo (en píxeles) en el estado abierto que no se ajusta a la longitud real de cada respuesta, o un `overflow: hidden` que no se remueve al expandir.
2. Reemplazar por una solución que se adapte al contenido real (ej. `grid-template-rows: 0fr` → `1fr` con transición en CSS Grid, que no requiere altura fija).
3. Verificar que la transición de apertura/cierre siga siendo suave (no debe perderse la animación al corregir el bug).

### 4. Criterios de Aceptación
- [ ] Todas las respuestas del FAQ se muestran completas al expandir cada pregunta, sin texto cortado ni líneas subrayadas residuales.
- [ ] Verificado en las 10 páginas de tratamiento.
- [ ] La animación de apertura/cierre del acordeón sigue funcionando de forma fluida.

---

<a name="fs-025"></a>
## 🔴 FS-025 — Estadísticas sin fuente única de verdad
* **ID Backlog:** `TASK-025`
* **Prioridad:** Alta (afecta credibilidad de marca)
* **Categoría:** Contenido / Arquitectura de datos
* **Rutas afectadas confirmadas:** `/` (Home) y `/sobre-mi` — ambas muestran el mismo bloque de 4 estadísticas (años de experiencia, pacientes acompañados, certificaciones, % enfoque humano) con valores distintos.

### 1. Estado Actual
Los valores difieren entre páginas y cambiaron entre rondas de verificación:
* **Ronda 1 (screenshots iniciales):** Home = `6+ / 537+ / 10+ / 67%` vs Sobre Mí = `10+ / 800+ / 15+ / 100%`.
* **Ronda 2 (auditoría en vivo, 19/08):** Home = `10+ / 800+ / 15+ / 100%` vs Sobre Mí = `9+ / 770+ / 14+ / 96%`.

### 2. Comportamiento Esperado
Los 4 valores (años cuidando la piel, pacientes acompañados, certificaciones, % enfoque humano) deben ser idénticos en cualquier página donde se muestren, y deben provenir de una única fuente de configuración.

### 3. Requerimientos Funcionales
1. Confirmar con la Dra. Landaburo / Agustín los valores reales y oficiales definitivos.
2. Centralizar estos 4 valores en un único lugar de configuración (`src/data/site-content.ts` o módulo dedicado) y hacer que todas las instancias del componente (`StatsCounter.tsx`) lean de esa misma fuente.
3. Eliminar cualquier valor hardcodeado duplicado en componentes individuales de página.
4. **Nota técnica:** El bloque de estadísticas tiene una animación de *conteo ascendente* (arranca en 0 y sube hasta el valor final al entrar en viewport). Esto es intencional y debe conservarse.

### 4. Criterios de Aceptación
- [ ] Los 4 valores del bloque de estadísticas son idénticos en `/` y `/sobre-mi` (y en cualquier otra página futura).
- [ ] Los valores provienen de una única fuente de configuración centralizada.
- [ ] Se documenta dónde se edita esta fuente única en el proyecto.

---

<a name="fs-027"></a>
## 🟡 FS-027 — Jerarquía visual de CTAs
* **ID Backlog:** `TASK-027`
* **Prioridad:** Media
* **Categoría:** Diseño / UX
* **Alcance:** Todo el sitio

### 1. Estado Actual
La mayoría de los botones de llamada a la acción, incluido *"Agendar consulta"* en el navbar, usan estilo outline (borde fino, sin relleno). No hay un único botón "sólido" que se destaque como la acción prioritaria de cada vista.

### 2. Comportamiento Esperado
En cada página, debe existir como máximo un botón con estilo sólido (relleno de color), reservado para la acción de conversión principal de esa vista. El resto de los CTAs deben usar estilo outline o ghost.

### 3. Requerimientos Funcionales
1. El botón *"Agendar consulta"* del navbar debe pasar a estilo sólido (fondo color champagne del sistema de diseño `--color-champagne: #C5A47E`, texto `#1C1C1C` o `#FFFFFF`) de forma consistente en todas las páginas.
2. Revisar el resto de páginas para identificar dónde hay más de un botón sólido compitiendo visualmente en la misma vista, y ajustar a la regla de "un sólido por vista".
3. Los botones ya sólidos que están correctamente implementados (ej. *"Agendá tu consulta"* al final de las páginas de tratamiento) se mantienen como están.

### 4. Criterios de Aceptación
- [ ] El botón *"Agendar consulta"* del navbar tiene fondo sólido en todas las páginas.
- [ ] En cada vista del sitio, hay como máximo un botón con estilo sólido visible en el viewport inicial.

---

<a name="fs-028"></a>
## 🟡 FS-028 — Radio de borde en botones
* **ID Backlog:** `TASK-028`
* **Prioridad:** Media
* **Categoría:** Diseño / UX
* **Alcance:** Todo el sitio

### 1. Estado Actual
Todos los botones (sólidos y outline) tienen esquinas completamente rectas (`0px` de radio).

### 2. Comportamiento Esperado
Los botones deben tener un radio de esquina suave, ni completamente recto ni tipo píldora — consistente con la identidad cálida/editorial de la marca (paleta crema/negro/champagne, tipografía serif).

### 3. Requerimientos Funcionales
1. Aplicar `border-radius: 6px` a todos los botones sólidos y outline del sitio, de forma consistente vía la clase/componente base `Button.module.css` (no por instancia individual).
2. **Nota de contexto:** Decisión validada con investigación de NN/g y Baymard Institute como refuerzo de identidad visual sin impacto adverso en conversión.

### 4. Criterios de Aceptación
- [ ] Todos los botones del sitio (sólidos y outline) tienen el mismo `border-radius: 6px` consistente.
- [ ] El cambio se aplica a nivel de componente/clase base en `Button.module.css`.

---

<a name="fs-n01"></a>
## 🟡 FS-N01 — Elemento flotante mal posicionado sobre tarjeta de perfil
* **ID Backlog:** `TASK-029`
* **Prioridad:** Media
* **Categoría:** Funcionalidad / Frontend
* **Ruta confirmada:** `/tratamientos/acido-hialuronico`, al hacer scroll hasta la sección de FAQ / tarjeta "Dra. Paula Landaburo" en la barra lateral.

### 1. Estado Actual
Aparece un recuadro vacío con borde, similar a un campo de input de formulario, superpuesto sobre la tarjeta de perfil de la doctora en la barra lateral derecha al hacer scroll.

### 2. Comportamiento Esperado
No debe haber ningún elemento flotante ni superpuesto sobre el contenido de la barra lateral en ningún punto del scroll.

### 3. Requerimientos Funcionales
1. Identificar el elemento en `src/app/tratamientos/[slug]/page.tsx` — verificar si es un componente con posicionamiento `fixed` o `sticky` con coordenadas mal calculadas o un elemento huérfano.
2. Corregir el posicionamiento o eliminar el elemento del DOM si carece de función activa.

### 4. Criterios de Aceptación
- [ ] No aparece ningún elemento flotante superpuesto sobre la tarjeta de perfil ni sobre otro contenido en ningún punto del scroll.

---

<a name="fs-n02"></a>
## 🟢 FS-N02 — Confirmar alcance del widget de chat flotante
* **ID Backlog:** `TASK-030`
* **Prioridad:** Baja (pendiente de definición con cliente)
* **Categoría:** Funcionalidad / UX
* **Alcance:** Visible en Home, Tratamientos, Sobre Mí.

### 1. Estado Actual
Hay un botón circular de chat (ícono de burbuja) flotando en la esquina inferior derecha.

### 2. Acción Requerida
1. Confirmar con Agustín el propósito y destino del widget (`wa.me/5491169684062`).
2. Una vez confirmado, ajustar espaciados responsive en `WhatsAppButton.module.css` para evitar solapamientos con botones cercanos (ej. botón *"Más sobre mí"*).

### 3. Criterios de Aceptación
- [ ] Confirmado con el cliente el propósito del widget antes de cambios mayores.
- [ ] Si se mantiene, su posición no interfiere visualmente con otros elementos interactivos.

---

<a name="fs-026"></a>
## ⚪ FS-026 — Borde superior dispar en tarjetas de tratamiento (Verificado — sin acción)
* **ID Backlog:** `TASK-026`
* **Estado:** En la auditoría en vivo del 19/08, las tarjetas visibles en `/tratamientos` se veían uniformes, sin borde superior diferenciado.
* **Acción requerida:** Ninguna en este momento. Confirmar antes de cierre formal con Agustín.

---

<a name="fs-020-021-022"></a>
## ⚪ FS-020 / FS-021 / FS-022 — Rutas no construidas (Verificado — sin acción)
* **ID Backlog:** `TASK-020`, `TASK-021`, `TASK-022`
* **Estado:** Verificado en vivo. Las siguientes rutas devuelven correctamente 404:
  - `/tienda`
  - `/login`, `/register`
  - `/dashboard/ejecutivo`, `/dashboard/operativo`, `/portal/paciente`
* **Acción requerida:** Ninguna. Se documenta como evidencia de que no hay funcionalidad expuesta a medias. Si en el futuro se planea desarrollar estas secciones, requerirán su propia especificación funcional separada.

---

## 📌 Guía Rápida para el Desarrollador Externo

1. **Orden de Prioridad:**
   `FS-019` → `FS-023` → `FS-024` → `FS-025` (Bugs de alta prioridad)  
   → `FS-N01` (`TASK-029`)  
   → `FS-027` → `FS-028` (Mejoras de diseño)  
   → `FS-N02` (`TASK-030`) (Definición pendiente).

2. **Plantilla Compartida:** Las 10 páginas de tratamientos (`/tratamientos/[slug]`) comparten `src/app/tratamientos/[slug]/page.tsx`. Cualquier cambio en `FS-023`, `FS-024` o `FS-N01` impacta a todas las rutas.
3. **Design System:** Paleta oficial: Negro `#1C1C1C`, Gris `#848484`, Gris Claro `#D2D3D3`, Blanco `#FFFFFF`, Champagne `#C5A47E`.
4. **Deploy a Staging:** Cada cambio pusheado a `master` se despliega en EC2 (`54.94.94.20:3000`) ejecutando el script `deploy.sh`.
