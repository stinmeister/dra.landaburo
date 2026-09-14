# Modelo de Contenido, Catálogo y Copybook

Estado de Verificación: [VERIFICADO]
Fecha de Auditoría: 2026-09-14
Fuentes de Contenido: Base de datos Supabase (`treatments`, `products`, `posts`) y archivos estáticos (`src/data/`)

---

## 1. Catálogo Médico de Tratamientos

El catálogo clínico de la Dra. Paula Landaburo está estructurado en tres pilares médicos más el área de cosmiatría y bienestar regenerativo:

### 1.1. Categorización
- **Armonización Facial:**
  - *Toxina Botulínica (Botox):* Tratamiento de arrugas de expresión (frente, entrecejo, patas de gallo), bruxismo (maseteros) y nefertiti lift.
  - *Ácido Hialurónico & Labios Signature:* Relleno y perfilado labial, rinomodelación, proyección de mentón, marcación mandibular y ojeras.
  - *Bioestimuladores de Colágeno:* Radiesse (hidroxiapatita de calcio), Sculptra (ácido poli-L-láctico) y HarmonyCa.
  - *Skinboosters & Mesoterapia Facial:* Revitalización profunda con microinyecciones de ácido hialurónico no reticulado y vitaminas.
  - *Peelings Médicos:* Renovación celular para manchas, fotoenvejecimiento y secuelas de acné.
- **Bienestar Corporal:**
  - *Tratamiento de Celulitis y Adiposidad:* Mesoterapia corporal, enzimas recombinantes y drenaje.
  - *Flacidez Corporal:* Bioestimulación de glúteos, abdomen y brazos.
- **Salud Capilar & Tricología Médica [VERIFICADO - Copybook Oficial]:**
  - *Mesoterapia Capilar:* Cócteles de aminoácidos, biotina y factores estimulantes del folículo piloso.
  - *Plasma Rico en Plaquetas (PRP) Capilar:* Bioestimulación autóloga para alopecia androgenética y efluvio telógeno.
- **Cosmiatría Avanzada (Mercedes Pasquet):**
  - *Limpieza Facial Profunda:* Higiene, extracción de impurezas, espátula ultrasónica y alta frecuencia.
  - *Dermaplaning:* Exfoliación mecánica suave con bisturí quirúrgico.
  - *Total Glow:* Protocolo de hidratación intensa y luminosidad.
- **Medicina Regenerativa & Sueroterapia:**
  - *Sueros Inmunológicos, Detox y Antiaging:* Infusiones intravenosas de micronutrientes y antioxidantes de alta biodisponibilidad.

---

## 2. Catálogo de Skincare Sulderm (Tienda)

La tienda comercializa la línea dermocosmética oficial **Sulderm** (31 productos activos en la tabla `products` de Supabase):

### 2.1. Familias de Productos
1. **Higiene y Limpieza:** Emulsiones de limpieza suaves, aguas micelares purificantes y geles limpiadores con ácido salicílico.
2. **Sérums y Concentrados Activos:**
   - Vitamina C al 10% y 15% (Antioxidante / Luminosidad).
   - Ácido Hialurónico Multimolecular (Hidratación epidérmica y dérmica).
   - Niacinamida + Zinc (Seborregulador / Barrera cutánea).
   - Retinol / Retinaldehído (Antiarrugas y textura).
3. **Cremas Hidratantes y Reparadoras:** Fórmulas con ceramidas, péptidos y manteca de karité para pieles sensibles y post-procedimiento.
4. **Protección Solar:** Filtros solares FPS 50+ toque seco con protección UVA/UVB y luz azul.

---

## 3. Copybook y Tono de Comunicación Institucional

### 3.1. Reglas Innegociables de Lenguaje [VERIFICADO]
- **Término Obligatorio:** Se utiliza siempre la palabra **«pacientes»**, NUNCA «clientes», «consumidores» ni «usuarios» en textos públicos.
- **Identidad Médica:** Se utiliza **«Dra. Paula Landaburo»** de forma consistente (no incluir segundo nombre «Natalia» en piezas web para mantener uniformidad de marca).
- **Título Oficial de Especialidad Capilar:** Se define formalmente como **«Salud Capilar & Tricología Médica»**.
- **Tono de Voz:** Médico, empático, sobrio, elegante y rigurosamente honesto.
- **Prohibición de Sobrerepresentación:** No se hacen promesas de "rejuvenecimiento milagroso" o resultados irreales; se prioriza la armonización natural, la salud dérmica y el respeto por la anatomía individual.

---

## 4. Blog y Divulgación Médica

- **Estructura del Contenido (`posts`):** Artículos en formato Markdown con títulos, extractos, imágenes de cabecera, tiempo de lectura estimado y fecha de publicación.
- **Temáticas:** Educación sobre mitos de la toxina botulínica, cuidados post-peeling, fotoprotección invernal y salud capilar.
