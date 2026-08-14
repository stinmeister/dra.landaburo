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

## 📋 Gestión del Backlog de Tareas

Las tareas del proyecto se gestionan en **dos lugares sincronizados**:
1. **Archivo Local `tasks.md`:** Vive en la raíz del repositorio. Contiene los tickets estructurados (`TASK-001` a `TASK-018`).
2. **Notion Workspace (Grow OS / Dra. Landaburo):** Base de datos/sección de tareas donde se registra el estado vivo de cada desarrollo.

### Workflow para un nuevo Ticket:
1. Tomar un ticket de `tasks.md` o Notion.
2. Cambiar el estado de `🆕 Nuevo` a `🔄 En Progreso`.
3. Desarrollar la funcionalidad en una rama de Git o en `master`.
4. Verificar con `npm run build`.
5. Cambiar el estado a `✅ Completado` en `tasks.md` y Notion.

---

## 🌐 Protocolo de Despliegue en AWS EC2

El servidor EC2 cuenta con un script automatizado de deploy `/opt/dra-landaburo/deploy.sh`.

Para desplegar cambios en vivo a producción:
```bash
# 1. Hacer push a la rama de producción
git push production master

# 2. El script del servidor ejecutará automáticamente:
# npm ci -> npm run build -> cp static files -> pm2 restart
```

---

## 📚 Documentación de Referencia en Notion

Para consultar la visión completa del proyecto, arquitectura y guías de tono:
* **`00 README AI`** (Punto de entrada obligatorio)
* **`01 Project Context`** (Estructura del proyecto)
* **`02 Brand System`** (Identidad y guías de marca)
* **`Workflow Registry`** (Integraciones n8n WF-01 a WF-07)
