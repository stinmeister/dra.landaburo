# Glosario Técnico, Clínico y de Dominio

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14

---

## 1. Términos Técnicos y de Arquitectura

- **Next.js App Router:** Paradigma de enrutamiento basado en carpetas introducido en Next.js 13+ y consolidado en Next.js 16, permitiendo Server Components por defecto y streaming asíncrono.
- **RSC (React Server Components):** Componentes de React que se ejecutan y renderizan exclusivamente en el servidor, generando HTML sin incluir código JavaScript en el bundle del navegador.
- **Client Components (`'use client'`):** Componentes interactivos que se ejecutan tanto en SSR como en el navegador para manejar eventos de usuario y hooks de React.
- **CSS Modules:** Sistema de estilos locales con nombres de clase hasheados automáticamente, evitando colisiones globales sin runtime de JS.
- **Standalone Build:** Modo de compilación de Next.js que crea una carpeta autónoma con solo los módulos `node_modules` necesarios para producción.
- **PM2:** Administrador de procesos para Node.js que garantiza alta disponibilidad, reinicios automáticos y monitoreo en el servidor Linux EC2.
- **Reverse Proxy (Apache):** Servidor intermediario que recibe el tráfico HTTPS en el puerto 443, maneja los certificados SSL y reenvía las solicitudes al puerto 3000 de Next.js.
- **Supabase / PostgREST:** Plataforma Backend-as-a-Service basada en PostgreSQL que expone automáticamente una API REST segura mediante políticas RLS.
- **RLS (Row Level Security):** Mecanismo de seguridad a nivel de motor de PostgreSQL que restringe qué filas puede consultar o modificar un usuario según su JWT.
- **RBAC (Role-Based Access Control):** Modelo de autorización que asigna permisos de acceso a las distintas secciones del dashboard según el rol del usuario (`medica`, `cosmiatra`, `secretaria`, `admin`).
- **HMAC-SHA256:** Algoritmo criptográfico utilizado para validar la autenticidad e integridad de los webhooks enviados por Mercado Pago.
- **n8n:** Plataforma de automatización de flujos de trabajo basada en nodos utilizada para integrar sistemas externos con la API de Next.js.

---

## 2. Términos Clínicos, Estéticos y de Negocio

- **Pacientes:** Término unificado y obligatorio para referirse a las personas que reciben atención médica o estética en el consultorio. Nunca referirse como «clientes».
- **Armonización Facial:** Conjunto de procedimientos médico-estéticos mínimamente invasivos orientados a equilibrar y resaltar las proporciones naturales del rostro.
- **Toxina Botulínica:** Proteína purificada que relaja temporalmente los músculos faciales para atenuar arrugas dinámicas y tratar afecciones funcionales como el bruxismo.
- **Ácido Hialurónico:** Polisacárido biocompatible y reabsorbible utilizado como material de relleno dérmico para restaurar volumen, perfilar labios y redefinir contornos.
- **Bioestimuladores de Colágeno:** Sustancias inyectables (como hidroxiapatita de calcio o ácido poli-L-láctico) que inducen a los fibroblastos a sintetizar colágeno tipo I y III propio.
- **Salud Capilar & Tricología Médica:** Especialidad médica enfocada en el diagnóstico y tratamiento avanzado de la caída del cabello y salud del cuero cabelludo.
- **Cosmiatría Integral (Mercedes Pasquet):** Área de cuidado de la piel no invasivo que comprende higienes profundas, peelings químicos superficiales, dermaplaning y bioestimulación.
- **Sulderm:** Línea dermocosmética oficial formulada con activos de grado dermatológico comercializada en la tienda online.
- **Gift Card DL:** Certificado de regalo exclusivo para tratamientos de cosmiatría y dermocosmética con código identificador `DL-XXXX-XXXX` y vigencia de 90 días.
- **Kiosco de Admisión:** Interfaz táctil ubicada en la sala de espera del consultorio (Leandro N. Alem 45, Gualeguaychú) para el auto check-in de pacientes.
