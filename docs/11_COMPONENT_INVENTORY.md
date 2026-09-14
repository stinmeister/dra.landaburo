# Inventario de Componentes UI y Frontend

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14
Total de Componentes Auditados: 39 componentes en `src/components/` + 49 páginas y layouts en `src/app/`

---

## 1. Arquitectura de Componentes

La aplicación utiliza la arquitectura Next.js 16 App Router con componentes divididos estrictamente entre:
- **Server Components (RSC):** Renderizados en servidor para optimización de bundle, SEO y streaming.
- **Client Components (`'use client'`):** Para interactividad de interfaz, hooks (`useState`, `useEffect`, `useContext`), formularios y llamadas a APIs del navegador.

No se utiliza Tailwind CSS; todos los estilos se gestionan mediante **CSS Modules** con variables globales definidas en `src/app/globals.css`.

---

## 2. Inventario Detallado de Componentes

### 2.1. Layout y Navegación (`src/components/layout/`)

| Componente | Tipo | Props / Inputs | Estado Interno / Hooks | Dependencias / Iconos | Estado |
|---|---|---|---|---|---|
| `Header.tsx` | Client | Ninguna | `isScrolled`, `isMobileMenuOpen` | `lucide-react` (`Menu`, `ShoppingBag`), `CartIcon`, `UserMenu` | [VERIFICADO] |
| `MobileMenu.tsx` | Client | `isOpen: boolean`, `onClose: () => void` | Animación de apertura, scroll lock | `lucide-react` (`X`, `ChevronRight`, `Phone`, `Instagram`) | [VERIFICADO] |
| `Footer.tsx` | Server | Ninguna | Ninguno (Estático) | `lucide-react` (`MapPin`, `Phone`, `Mail`, `Instagram`, `Clock`) | [VERIFICADO] |
| `UserMenu.tsx` | Client | Ninguna | `user`, `role`, `isOpen` | Supabase Auth (`createBrowserClient`), `lucide-react` (`User`, `LogOut`, `LayoutDashboard`) | [VERIFICADO] |
| `WhatsAppButton.tsx` | Client | Ninguna | `isVisible` (scroll > 300px) | `lucide-react` (`MessageCircle`), `trackWhatsAppClick` | [VERIFICADO] |

### 2.2. Inicio / Landing Page (`src/components/home/`)

| Componente | Tipo | Props / Inputs | Estado Interno / Hooks | Dependencias / Iconos | Estado |
|---|---|---|---|---|---|
| `Hero.tsx` | Server | Ninguna | Ninguno | Next `Image`, `Link` | [VERIFICADO] |
| `Welcome.tsx` | Server | Ninguna | Ninguno | Next `Image`, `ScrollAnimation` | [VERIFICADO] |
| `TreatmentCategories.tsx` | Server | Ninguna | Ninguno | Next `Image`, `Link` | [VERIFICADO] |
| `PartnersMarquee.tsx` | Server | Ninguna | Ninguno | Next `Image` (logos marcas aliadas) | [VERIFICADO] |
| `DoctorBio.tsx` | Server | Ninguna | Ninguno | Next `Image`, `Link` | [VERIFICADO] |
| `StatsCounter.tsx` | Client | Ninguna | `isVisible`, contadores animados | `IntersectionObserver` | [VERIFICADO] |
| `TeamSection.tsx` | Client | Ninguna | Ninguno | `@/data/team`, Next `Image`, `lucide-react` (`Instagram`) | [VERIFICADO] |
| `TestimonialsCarousel.tsx` | Client | Ninguna | `current`, `paused`, `setInterval` | `@/data/testimonials`, `lucide-react` (`Star`, `ChevronLeft`, `ChevronRight`), Schema.org | [VERIFICADO] |
| `GiftCardsCTA.tsx` | Client | Ninguna | Ninguno | `trackConfigureGiftCard`, Next `Link` | [VERIFICADO] |
| `InstagramCTA.tsx` | Server | Ninguna | Ninguno | `lucide-react` (`Instagram`) | [VERIFICADO] |

### 2.3. Catálogo y Tienda (`src/components/tienda/`)

| Componente | Tipo | Props / Inputs | Estado Interno / Hooks | Dependencias / Iconos | Estado |
|---|---|---|---|---|---|
| `ProductCard.tsx` | Client | `product: Product` | `isHovered` | `AddToCartButton`, Next `Image`, `Link` | [VERIFICADO] |
| `AddToCartButton.tsx` | Client | `product: Product`, `variant?: 'primary'|'compact'` | `added`, feedback temporal | `useCart` hook, `trackAddToCart` | [VERIFICADO] |
| `CartIcon.tsx` | Client | Ninguna | `totalItems` | `useCart` hook, `lucide-react` (`ShoppingBag`) | [VERIFICADO] |

### 2.4. Tratamientos y Ficha Clínica (`src/components/tratamientos/`)

| Componente | Tipo | Props / Inputs | Estado Interno / Hooks | Dependencias / Iconos | Estado |
|---|---|---|---|---|---|
| `TreatmentCTAButton.tsx` | Client | `treatmentName: string`, `slug: string` | Modal / redirección WhatsApp | `trackScheduleClick`, `lucide-react` (`Calendar`, `ArrowRight`) | [VERIFICADO] |
| `TreatmentFAQ.tsx` | Client | `faqs: Array<{q: string, a: string}>` | `openIndex: number | null` | `lucide-react` (`ChevronDown`) | [VERIFICADO] |

### 2.5. Autenticación y Contacto (`src/components/auth/` & `src/components/contacto/`)

| Componente | Tipo | Props / Inputs | Estado Interno / Hooks | Dependencias / Iconos | Estado |
|---|---|---|---|---|---|
| `LoginForm.tsx` | Client | Ninguna | `email`, `password`, `loading`, `error` | Supabase Auth (`signInWithPassword`), `useRouter` | [VERIFICADO] |
| `RegisterForm.tsx` | Client | Ninguna | `fullName`, `email`, `password`, `phone` | Supabase Auth (`signUp`), `useRouter` | [VERIFICADO] |
| `ContactForm.tsx` | Client | Ninguna | `formData`, `status: 'idle'|'sending'|'success'|'error'` | Fetch `/api/contacto`, `trackContactLead` | [VERIFICADO] |

### 2.6. Panel Administrativo / Dashboard (`src/components/dashboard/`)

| Componente | Tipo | Props / Inputs | Estado Interno / Hooks | Dependencias / Iconos | Estado |
|---|---|---|---|---|---|
| `DashboardNav.tsx` | Client | `allowedSections: string[]` | `activeSection` | Next `Link`, `usePathname`, RBAC filters | [VERIFICADO] |
| `DashboardSignOut.tsx` | Client | Ninguna | `loading` | Supabase Auth (`signOut`), `lucide-react` (`LogOut`) | [VERIFICADO] |
| `TaskList.tsx` | Client | `initialTasks: StaffTask[]`, `date: string` | `tasks`, `filter`, `updating` | Supabase RPC / REST, `lucide-react` (`CheckCircle2`, `Clock`, `Plus`) | [VERIFICADO] |
| `ConfiguracionOperativa.tsx` | Client | `rules: RecurringRule[]`, `closedDays: ClosedDay[]` | `selectedDay`, `isEditing` | Supabase CRUD | [VERIFICADO] |
| `CampanasWidget.tsx` | Client | `campaigns: Campaign[]` | `selectedCampaign`, `metricsFilter` | Recharts / SVG visualizer | [VERIFICADO] |
| `PostForm.tsx` | Client | `initialData?: Post`, `isEdit?: boolean` | `title`, `slug`, `markdown`, `coverImage`, `status` | Markdown preview, Supabase CRUD | [VERIFICADO] |
| `BlogDeleteButton.tsx` | Client | `postId: string` | `confirming`, `loading` | Supabase DELETE, `lucide-react` (`Trash2`) | [VERIFICADO] |
| `KioskAdmissionsList.tsx` | Client | `admissions: Admission[]` | `searchTerm`, `statusFilter` | Realtime subscription, `lucide-react` (`UserCheck`) | [VERIFICADO] |
| `PeriodSelector.tsx` | Client | `selectedPeriod: string`, `onChange: (p) => void` | `isOpen` | UI Dropdown | [VERIFICADO] |
| `TreatmentSearch.tsx` | Client | `treatments: Treatment[]` | `query`, `selectedCategory` | Instant fuzzy search client-side | [VERIFICADO] |

### 2.7. Elementos de UI Compartidos y Utilidades (`src/components/ui/` & `src/components/tracking/`)

| Componente | Tipo | Props / Inputs | Estado Interno / Hooks | Dependencias / Iconos | Estado |
|---|---|---|---|---|---|
| `Button.tsx` | Server | `variant`, `size`, `href`, `children`, etc. | Ninguno (Polimórfico `button` / `Link`) | CSS Modules | [VERIFICADO] |
| `CookieBanner.tsx` | Client | Ninguna | `showBanner`, `preferences` | `localStorage`, `/api/cookies/consent` | [VERIFICADO] |
| `ScrollAnimation.tsx` | Client | `children`, `animation: 'fade-up'|'fade-in'` | `inView` | `IntersectionObserver` | [VERIFICADO] |
| `Typewriter.tsx` | Client | `words: string[]`, `speed?: number` | `currentText`, `wordIndex` | Timer intervals | [VERIFICADO] |
| `TrackingScripts.tsx` | Client | Ninguna | Escucha cambios en consentimientos | GA4 Script (`gtag`), Meta Pixel Script (`fbq`) | [VERIFICADO] |
| `MarkdownRenderer.tsx` | Server | `content: string` | Ninguno (Server Parser) | HTML Sanitizer / Regex formatting | [VERIFICADO] |
