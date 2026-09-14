# 10 · UX/UI Design System & Style Guide

**Fecha:** 14/09/2026  
**Sistema:** Editorial Médico Monocromático con Acentos Champagne  
**Estado:** [VERIFICADO] en `src/app/globals.css` y módulos CSS  

---

## 1. Sistema Visual y Filosofía de Diseño

El diseño de la plataforma responde a una estética **editorial de lujo médico**, combinando la sobriedad clínica dermatológica con la calidez y sofisticación de la medicina estética de precisión:

- **Enfoque Monocromático:** Base estructurada en negros profundos (`#000000`), blancos puros (`#FFFFFF`) y escalas de grises neutros.
- **Acento Champagne Signature:** Toques sutiles de color champagne (`#C5A47E`) en bordes, insignias, botones primarios y líneas decorativas de separación.
- **Sin Dependencia de Frameworks CSS:** 100% construido con **CSS Modules** nativos, garantizando cero sobrecarga de JavaScript en runtime y aislamiento total de estilos por componente.

---

## 2. Tokens de Color Globales (`globals.css`)

```css
:root {
  /* Colores Principales */
  --color-negro: #000000;
  --color-blanco: #FFFFFF;
  --color-gris: #848484;
  --color-gris-claro: #D2D3D3;
  --color-gris-fondo: #F9F9F9;
  --color-border: #E5E5E5;

  /* Acento Champagne */
  --color-champagne: #C5A47E;
  --color-champagne-light: rgba(197, 164, 126, 0.15);
  --color-champagne-dark: #A8875F;

  /* Tipografía */
  --font-serif: var(--font-playfair), 'Playfair Display', Georgia, serif;
  --font-sans: var(--font-ibm-plex), 'IBM Plex Sans', -apple-system, sans-serif;

  /* Layout y Espaciado */
  --max-width: 1200px;
  --header-height: 80px;

  /* Bordes */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-pill: 100px;
}
```

---

## 3. Tipografía y Jerarquía

1. **Titulares y Branding (`var(--font-serif)`):** *Playfair Display* (pesos 400 y 500) para transmitir elegancia médica y autoridad editorial.
2. **Cuerpo de Texto y Datos (`var(--font-sans)`):** *IBM Plex Sans* (pesos 400, 500, 600) para máxima legibilidad clínica en fichas técnicas, tablas y formularios.
3. **Eyebrows / Badges:** Texto en mayúsculas con espaciado tracking amplio (`letter-spacing: 0.15em`), en color champagne o negro con acento.

---

## 4. Componentes Base y Patrones de Interacción

- **Botones (`Button.tsx`):**
  * `primary`: Fondo champagne (`#C5A47E`), texto blanco, transición a champagne oscuro (`#A8875F`) en hover.
  * `secondary`: Fondo transparente con borde champagne fino y hover relleno.
  * `ghost`: Sin borde, texto subrayado en hover.
- **Header Adaptativo (`Header.tsx`):**
  * Transparente con texto blanco sobre la sección Hero de la Home.
  * Transición a fondo blanco sólido con efecto blur y texto negro al hacer scroll ($ge 50px$).
  * Breakpoint de escritorio establecido en `1024px`: en pantallas menores, las opciones secundarias se pliegan en el menú lateral (`MobileMenu.tsx`).
- **Botón Flotante de WhatsApp (`WhatsAppButton.tsx`):**
  * Botón circular fijo en la esquina inferior derecha con icono de mensajería y animación de pulso sutil.
  * Aparece tras `300px` de scroll para no obstruir el Hero principal.
- **Píldora de Gift Card (`Header.tsx`):**
  * Insignia destacada en el navbar con `border-radius: 6px` (Opción A aprobada) y acento champagne.

---

## 5. Comportamiento Responsive y Breakpoints

| Breakpoint | Dispositivos | Adaptaciones de UI |
| :--- | :--- | :--- |
| **$< 640px$ (Mobile)** | Smartphones | Grillas a 1 columna, tipografía fluida (`clamp`), header simplificado solo con logo y hamburguesa. |
| **$640px - 1023px$ (Tablet)** | iPads / Tablets | Grillas a 2 columnas, menú lateral colapsable, tablas con scroll horizontal asistido. |
| **$ge 1024px$ (Desktop)** | Laptops y Monitores | Header extendido completo, grillas a 3 y 4 columnas, modales centrados. |
