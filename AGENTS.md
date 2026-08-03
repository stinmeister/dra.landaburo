# Dra. Landaburo — Website Project

## Infrastructure Guardrails (AWS EC2)
- **DO NOT** launch new EC2 instances
- **DO NOT** change instance type
- **DO NOT** add load balancers, NAT gateways, or any AWS service with recurring cost
- **DO NOT** install services with recurring costs without explicit approval from Agustín
- All infrastructure changes must be cost-conscious and performant

## SSH Access
- Host: 54.94.94.20
- User: bitnami
- Key: ~/.ssh/antigravity_dralandaburo (ed25519)

## Brand Rules (Non-Negotiable)
- Colors: #000000, #848484, #D2D3D3, #FFFFFF (monochromatic)
- Fonts: Faraz Modern (titles, pending full version) + IBM Plex Sans (body)
- Always "pacientes", never "clientes" or "usuarios"
- Never: "arrugas", "viejo/a", "10 años menos", discounts, urgency
- Use "líneas de expresión" instead of "arrugas"
- Spanish Rioplatense, currency ARS
- Mention Nordlys when discussing laser/IPL treatments

## Stack
- Next.js 16 (App Router) + TypeScript
- CSS Modules (NO Tailwind)
- Supabase (Postgres + Auth + Storage)
- MercadoPago Checkout Pro (Phase 2)
- Docker during migration, evaluate PM2 after cutover
