# SEO, Metadatos y Accesibilidad (A11y)

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14
Estándares: Next.js 16 Metadata API, OpenGraph, JSON-LD Schema.org, WCAG 2.1 AA

---

## 1. Estrategia de Metadatos y SEO On-Page

### 1.1. Metadatos Base Globales (`src/app/layout.tsx`)
- **Título por Defecto:** `Dra. Paula Landaburo | Medicina Estética & Dermatología`
- **Plantilla de Título:** `%s | Dra. Paula Landaburo`
- **Descripción:** `Consultorio médico especializado en armonización facial, rejuvenecimiento natural, salud capilar y cosmiatría en Gualeguaychú, Entre Ríos.`
- **Canonical URL:** `https://dralandaburo.com`
- **OpenGraph & Twitter Cards:** Configurados con imágenes en formato 1200x630px y tarjetas `summary_large_image`.

### 1.2. Metadatos Dinámicos (`generateMetadata`)
Las rutas dinámicas generan metadatos específicos en servidor:
- **Tratamientos (`/tratamientos/[slug]`):** Extrae título, resumen clínico e imagen del hero del tratamiento.
- **Productos (`/tienda/[slug]`):** Extrae nombre del producto, descripción, precio ARS y fotos de presentación.
- **Blog (`/blog/[slug]`):** Extrae título del post, extracto, autor (Dra. Paula Landaburo) y fecha de publicación.

### 1.3. Sitemap y Robots
- **Sitemap Dinámico:** `src/app/sitemap.ts` compila todas las URLs estáticas y dinámicas (tratamientos, productos, blog) con prioridad y frecuencia de actualización.
- **Robots:** `src/app/robots.ts` permite indexación en `/`, `/tratamientos`, `/tienda`, `/blog`, `/sobre-mi`, `/contacto` y bloquea estrictamente `/dashboard/*`, `/portal/*`, `/kiosco/*`, `/api/*`.

---

## 2. Datos Estructurados (JSON-LD / Schema.org)

Se inyectan esquemas estructurados para enriquecer la presencia en los resultados de búsqueda de Google:

1. **MedicalBusiness & Physician (`HomePage` & `Tratamientos`):**
```json
{
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  "name": "Consultorio Dra. Paula Landaburo",
  "image": "https://dralandaburo.com/images/Dra.Landaburo.png",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Leandro N. Alem 45",
    "addressLocality": "Gualeguaychú",
    "addressRegion": "Entre Ríos",
    "postalCode": "E2820",
    "addressCountry": "AR"
  },
  "telephone": "+5491169684062",
  "priceRange": "$$"
}
```
2. **AggregateRating (`TestimonialsCarousel.tsx`):** Calificación 5.0 basada en Google Reviews reales.
3. **Product & Offer (`ProductPage`):** Disponibilidad, precio en ARS y marca Sulderm.

---

## 3. Accesibilidad (A11y) y Estándares WCAG

- **HTML Semántico:** Uso correcto de `<header>`, `<main>`, `<footer>`, `<article>`, `<section>`, `<nav>`, `<aside>` y encabezados jerárquicos (`h1` a `h4`).
- **Textos Alternativos (`alt`):** Todas las etiquetas `<Image>` de Next.js incluyen descripciones contextuales para lectores de pantalla.
- **Contraste de Color:** La paleta principal (negro `#000000`, gris grafito `#1A1A1A`, blanco `#FFFFFF`) cumple con el ratio mínimo de 4.5:1 exigido por WCAG AA. Los detalles en champagne (`#C5A47E` / `#A8875F`) se utilizan como acentos estéticos o con suficiente contraste sobre fondos oscuros.
- **Navegación por Teclado:** Elementos interactivos (botones, links, inputs, menú móvil) poseen `:focus-visible` con contornos claros.
- **Soporte de Movimiento Reducido:** Las animaciones CSS respetan la directiva `@media (prefers-reduced-motion: reduce)`.
