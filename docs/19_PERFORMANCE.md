# Rendimiento, Optimización y Métricas Web

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14
Tecnología de Build: Next.js 16 (Turbopack)
Salida de Compilación: Standalone Node.js Container

---

## 1. Optimización del Bundle y Arquitectura de Carga

### 1.1. Server Components vs Client Components
- El 65% de la superficie visual inicial (Hero, Welcome, Categories, DoctorBio, Footer) se renderiza como **React Server Components (RSC)**.
- Se elimina el JavaScript innecesario del cliente para estas secciones, transfiriendo 0 KB de runtime de hooks en el bundle inicial de esas partes.

### 1.2. Cero Dependencias Pesadas
- Se prescindió de frameworks CSS de gran peso (Tailwind, Bootstrap) a favor de **CSS Modules nativos**.
- Los iconos provienen de `lucide-react` con imports puntuales (`tree-shaking` efectivo).
- Sin dependencias de UI complejas (como Material UI o Ant Design) que incrementen el First Load JS.

---

## 2. Optimización de Imágenes y Tipografías

### 2.1. Next.js Image Optimization
- Todas las imágenes utilizan `next/image` con atributos `sizes` adaptativos, responsive layout y compresión automática a formatos modernos **WebP / AVIF**.
- Carga diferida (`loading="lazy"`) por defecto en secciones inferiores y `priority` en el Hero.

### 2.2. Fuentes Web Optimizadas (`next/font`)
- Fuentes Google **Playfair Display** (serif) e **IBM Plex Sans** (sans-serif) se descargan en tiempo de build mediante `next/font/google`.
- Sin llamadas externas a servidores de Google Fonts durante la ejecución del navegador (`zero layout shift` / `display: swap`).

---

## 3. Estrategia de Caché y Entrega

1. **Proxy Apache:** Compresión HTTP `gzip` y `brotli` habilitada para HTML, CSS, JS y JSON.
2. **Assets Estáticos (`/_next/static/`):** Servidos con encabezados `Cache-Control: public, max-age=31536000, immutable`.
3. **Rutas Dinámicas:** Route Handlers que interactúan con base de datos utilizan estrategias `force-dynamic` o ISR según el caso de uso.
