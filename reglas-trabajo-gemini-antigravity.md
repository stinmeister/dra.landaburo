# Reglas de Trabajo — Gemini / Antigravity en el proyecto Dra. Landaburo

**Pegar esto como instrucción persistente (no como mensaje suelto) — aplica a TODO trabajo futuro, no solo al backlog de screenshots.**

Encontramos varios problemas en el último backlog que generaste y necesito que no se repitan. Estas son las reglas fijas de acá en adelante:

## 1. Notion — dónde escribir y dónde NUNCA escribir

- Vas a trabajar sobre el workspace de Notion de **Dra. Landaburo** únicamente. Nunca escribas ni crees páginas en ningún otro workspace ("Grow OS", "Grow Consultoría" o similar) — aunque tengas acceso técnico, no es tu workspace de trabajo.
- **Nunca edites ni le agregues contenido a los documentos "00 README AI" o "01 AI Operating System"** en ningún workspace. Son documentos de gobernanza que yo (Agustín) y Claude gestionamos — no vos.
- Todo lo que crees sobre el proyecto web va como página hija de **🌐 Reconstrucción Web — dralandaburo.com**, nunca suelto en la raíz del workspace ni en otra sección.
- Antes de crear una página nueva, buscá si ya existe una para ese tema y actualizá esa en vez de crear una duplicada.

## 2. Formato de ticket — obligatorio, sin excepciones

Todo ítem de backlog necesita estos 9 campos, siempre completos:

```
### TASK-{número correlativo} — {título corto}
- Fuente: {sitio/screenshot de origen, o "idea propia" si no vino de una referencia}
- Categoría: Diseño/UX | Contenido/Comunicación | Funcionalidad
- Qué pidió Agustín: {su comentario textual, no tu interpretación}
- Qué muestra la referencia: {descripción objetiva, sin opinión}
- Cómo se aplicaría acá: {tu propuesta concreta}
- Chequeo de marca: OK / NO APLICA POR REGLA DE MARCA ({qué regla, si aplica})
- Prioridad sugerida: Alto/Medio/Bajo (aclaración: la defino yo en la revisión, no vos)
- Complejidad técnica estimada: Alta/Media/Baja
- Estado: Nuevo
```

**No uses categorías fuera de esas 3.** Si algo no encaja claramente en ninguna, elegí la más cercana y aclaralo en la descripción — no inventes una categoría nueva.

## 3. Chequeo de marca — hacerlo de verdad, en cada ticket, no salteado

Antes de agregar cualquier ticket, comparalo contra esto:
- Paleta: Negro `#1C1C1C`, Gris `#848484`, Gris claro `#D2D3D3`, Blanco `#FFFFFF`, Champagne (acento) `#C5A47E`. Nada de paletas nuevas.
- Nunca "clientes" ni "usuarios" — siempre "pacientes".
- Cero descuentos, cero urgencia artificial (nada de countdowns, "últimos lugares", cupones).
- Cero promesas de resultado garantizado.
- Sin dark mode toggle — la identidad es monocromática fija.
- Tono de marca: elegante, sofisticada, sin ostentación. Si un efecto visual es llamativo/gimmick antes que elegante, marcalo como dudoso en vez de darlo por bueno.

Si un ticket choca con alguna de estas reglas, se agrega igual pero marcado **"NO APLICA POR REGLA DE MARCA"** con la razón — no se descarta en silencio, y tampoco se agrega como si no hubiera problema.

## 4. Antes de crear un ticket "nuevo", verificá que no sea trabajo que ya existe

Repasá **🌐 Reconstrucción Web** y el Decision Registry antes de proponer algo como tarea nueva. Si ya está especificado en el brief, o ya se construyó (por ejemplo, el dashboard financiero — su Fase 1 ya está completa), no lo agregues como ítem nuevo del backlog. Si tenés dudas de si algo ya existe o no, preguntame antes de listarlo.

## 5. No mezcles "ideas inspiradas en otros sitios" con "scope del proyecto ya definido"

El backlog de screenshots es para cosas que surgen de mirar sitios de referencia. Si querés recordarme algo del scope ya definido que falta construir, decímelo directamente en el chat — no lo metas en la misma lista con la misma numeración, porque después no se puede distinguir qué es idea nueva y qué es pendiente conocido.

## 6. Cuando tengas dudas sobre una regla de negocio o de marca, preguntá — no asumas

Si algo no está claro (por ejemplo, si una funcionalidad tipo "gift card" encaja con el posicionamiento médico de la marca), no lo resuelvas vos solo ni lo descartes vos solo — marcalo como pendiente de decisión y preguntame.

## 7. Verificación obligatoria antes de presentar algo como "auditoría" o "relevamiento" real

Esto es una regla dura, no una sugerencia — la rompiste una vez (15/08, ver caso abajo) y no puede volver a pasar.

- Si te piden auditar o relevar el estado real de algo (base de datos, código del repo, contenido de un sitio), tu reporte solo puede incluir lo que efectivamente consultaste con una herramienta real (una query, un fetch, un comando de terminal) — **nunca completes con un ejemplo plausible, aunque tenga sentido técnico.**
- Si la consulta real devuelve vacío o no encuentra nada, el reporte tiene que decir exactamente eso **y terminar ahí.** No sigas generando contenido "de ejemplo" como si fuera lo que encontraste — es la diferencia entre "no hay tablas" (correcto) y inventar 12 tablas con políticas RLS que no existen (lo que pasó).
- Pegá el resultado crudo de la herramienta (la query, la respuesta de la API, el output del comando) en el reporte — no solo tu resumen interpretado. Así se puede verificar sin repetir el trabajo.
- Etiquetá cada afirmación que no sea 100% trivial: **[VERIFICADO]** (lo confirmaste con una herramienta ahora mismo) / **[INFERIDO]** (lo dedujiste, no lo confirmaste) / **[EJEMPLO]** (es ilustrativo, no es un dato real). No mezcles sin etiquetar.
- Si no podés verificar algo, escribí literalmente "no pude verificar esto" — no rellenes con algo que suena razonable. Una respuesta incompleta y honesta vale más que una completa e inventada.

**Caso de referencia — no repetir:** el 15/08 generaste un informe de auditoría de la base de datos de Supabase cuyo propio resumen decía "0 tablas personalizadas, base de datos en estado inicial" — y después, en el mismo documento, describiste 12 tablas completas (`profiles`, `patients`, `treatments`, etc.) con nombres de políticas RLS y constraints exactos, como si fueran reales. Se verificó directo en el Table Editor de Supabase: la base está vacía. Ese patrón — decir la verdad en el resumen y después inventar el detalle — es exactamente lo que esta regla existe para prevenir. (Ya había pasado antes, el 08/08, con fuentes de research citadas que no existían — está documentado en el 03 Prompt Registry de Grow.)

## 8. Verificación de IDs antes de crear tickets (Fuente de Verdad: Notion)

**Contexto:** El 19/08/2026 Antigravity generó un `tasks.md` en GitHub numerando tickets nuevos como TASK-019 a TASK-030 sin revisar que esos números ya estaban asignados en el backlog vigente de Notion a tareas activas y no relacionadas (TASK-019 = RBAC/Auth, TASK-020 = Portal Operativo, TASK-021 = Dashboard ejecutivo).

**Regla estricta:** Antes de asignar un ID nuevo a cualquier ticket, tarea o ítem de backlog, Antigravity debe:
1. **Consultar el backlog vigente en Notion:** Ir a la página **📌 Backlog de Tareas Web** del workspace oficial del cliente correspondiente (*Dra. Landaburo*) — no basarse en archivos locales ni en un estado recordado de una sesión anterior — para ver el último ID real en uso.
2. **Nunca asumir el siguiente correlativo:** No calcular números por continuidad lógica del repo (ej. "el repo local tenía hasta TASK-018, sigo en TASK-019") sin verificar contra Notion primero. El repo de GitHub y el backlog de Notion pueden estar desincronizados, y en caso de duda, **Notion es la fuente de verdad para numeración, no GitHub.**
3. **Detenerse y preguntar ante discrepancias:** Si hay incertidumbre sobre qué ID usar, o si dos sistemas muestran numeraciones distintas, detenerse y consultar a Agustín antes de escribir — nunca elegir un rango arbitrario por criterio propio (ej. saltar a TASK-100).
4. **Señalar colisiones explícitamente:** Si surge una colisión (por trabajo en paralelo o ramas distintas), señalarla explícitamente en el mismo commit/página en vez de sobrescribir en silencio (utilizando identificadores funcionales independientes como `FS-XXX` o notas de colisión explícitas).
5. **Aplica a todas las IAs:** Esta misma regla rige para Antigravity, Claude, Gemini y cualquier agente que proponga o registre tareas.

