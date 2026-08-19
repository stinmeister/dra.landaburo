# 🤝 Guía de Handoff para Equipo Externo / Claude Design

Bienvenido/a al desarrollo del nuevo sitio web oficial de la **Dra. Paula Landaburo — Medicina Estética & Dermatología**.

Este documento sirve como **guía de onboarding técnico y operacional** para que cualquier desarrollador o agente de IA (Claude Design) pueda sumarse al proyecto de forma coordinada, respetando las reglas de arquitectura, marca y workflow.

---

## 🛠️ Stack Tecnológico & Arquitectura

* **Framework:** Next.js `16.2.11` (App Router con React 19)
* **Lenguaje:** TypeScript
* **Estilos:** CSS Modules (Vanilla CSS con `*.module.css`) + Custom Properties globales en `src/app/globals.css`.
* **Iconos:** `lucide-react`
* **Servidor:** AWS EC2 (`t2.medium`, Debian 12, IP `54.94.94.20`)
* **Gestor de Procesos:** PM2 (`dra-landaburo` corriendo en puerto `3000`)
* **Proxy Reverso:** Apache (Bitnami) gestionando SSL y proxyando tráfico a puerto `3000`.

---

## 🎨 Reglas Inviolables de Brand System & UX

Cualquier nuevo componente o página DEBE cumplir estrictamente estas reglas:

1. **Paleta Cromática (Monocromática + Champagne):**
   * **Negro:** `#000000` / `#1C1C1C` (`var(--color-negro)`)
   * **Gris:** `#848484` (`var(--color-gris)`)
   * **Gris Claro:** `#D2D3D3` (`var(--color-gris-claro)`)
   * **Blanco:** `#FFFFFF` (`var(--color-blanco)`)
   * **Acento Champagne (Lujo Sutil):** `#C5A47E` (`var(--color-champagne)`) — Usar con moderación para líneas decorativas, bordes, estados hover y botones principales.

2. **Terminología Obligatoria:**
   * **NUNCA** usar las palabras *"clientes"* ni *"usuarios"*. Usar siempre **"pacientes"**.

3. **Ética Médica & Comunicación:**
   * **CERO urgencia artificial ni descuentos:** Prohibidos contadores regresivos (countdowns), *"últimos lugares"*, *"ofertas 20% OFF"* o cualquier mercantilización agresiva.
   * **CERO promesas milagrosas:** No prometer *"resultados garantizados"*. La comunicación se enfoca en *salud cutánea, acompañamiento profesional, armonización natural y ciencia*.

4. **Identidad Visual Fija:**
   * **Sin Dark Mode Toggle:** La identidad visual es monocromática fija.
   * **Header Dinámico:** El header detecta si la página tiene hero oscuro (Home/Tratamientos) para mostrar texto blanco, o fondo claro (Contacto/Sobre Mí/Blog) para mostrar texto negro. Al hacer scroll (>50px), siempre pasa a fondo blanco con texto negro.

---

## 🚀 Entorno de Desarrollo Local

### 1. Requisitos e Instalación
```bash
git clone <URL_DEL_REPOSITORIO_GITHUB>
cd dra-landaburo
npm install
```

### 2. Levantar servidor local
```bash
npm run dev
# Acceder a http://localhost:3000
```

### 3. Verificar Build antes de Commit
```bash
npm run build
```

---

## 📋 Gestión del Backlog y Especificaciones Funcionales

Las tareas y especificaciones del proyecto se gestionan en:
1. **Especificación Funcional (`ESPECIFICACION_FUNCIONAL.md`):** Documento oficial con estado actual, requerimientos técnicos, rutas de prueba y criterios de aceptación para los tickets de desarrollo prioritarios (`FS-019` a `FS-N02`).
2. **Archivo Maestro `tasks.md`:** Vive en la raíz del repositorio. Contiene los 30 tickets estructurados bajo el estándar de 9 campos (`TASK-001` a `TASK-030`).
3. **Documento de Auditoría QA (`backlog_qa_claude.md`):** Reporte de auditoría y checklist en vivo para validaciones con Claude en Chrome.
4. **Notion Workspace (Dra. Landaburo):** Página principal `🌐 Reconstrucción Web — dralandaburo.com` sincronizada con el estado del backlog.

### Workflow para un nuevo Ticket:
1. Tomar un ticket de `ESPECIFICACION_FUNCIONAL.md` / `tasks.md`.
2. Cambiar el estado de `🆕 Nuevo` a `🔄 En Progreso`.
3. Desarrollar la funcionalidad en local.
4. Verificar compilación limpia con `npm run build`.
5. Hacer commit y push a `https://github.com/stinmeister/dra.landaburo.git` (`master`).
6. Desplegar en EC2 (`54.94.94.20:3000`) o solicitar deploy a Antigravity.
7. Verificar en staging que cumpla los criterios de aceptación del ticket.

---

## 🌐 Protocolo de Despliegue en AWS EC2

El servidor EC2 cuenta con un script automatizado de deploy `/opt/dra-landaburo/deploy.sh`.

Para desplegar cambios en vivo al staging:
```bash
# 1. Hacer push a GitHub
git push origin master

# 2. En el servidor EC2 (vía SSH bitnami@54.94.94.20):
cd /opt/dra-landaburo && git pull origin master && bash deploy.sh
```

---

## 📚 Documentación de Referencia en el Repositorio

* **`ESPECIFICACION_FUNCIONAL.md`** — Requerimientos funcionales, técnicos y criterios de aceptación v1.0.
* **`tasks.md`** — Backlog consolidado de 30 tickets (`TASK-001` a `TASK-030`).
* **`esquema_base_de_datos_supabase.md`** — Blueprint de arquitectura de datos y tablas de Supabase.
* **`backlog_qa_claude.md`** — Checklist de navegación y pruebas para auditoría en Chrome.

