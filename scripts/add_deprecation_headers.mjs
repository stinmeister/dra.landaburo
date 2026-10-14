import fs from 'fs';
import path from 'path';

const DOCS_DIR = 'docs';
const NEW_DOCS = new Set([
  '00_INDICE.md',
  '01_VISION_Y_ALCANCE.md',
  '02_ARQUITECTURA.md',
  '03_MODELO_DE_DATOS.md',
  '04_MAPA_FUNCIONAL.md',
  '05_ROLES_Y_PERMISOS.md',
  '06_USER_JOURNEYS.md',
  '07_PROCESOS_OPERATIVOS.md',
  '08_FLUJOS_CRITICOS.md',
  '09_MAQUINAS_DE_ESTADO.md',
  '10_UX_UI_Y_PATRONES.md',
  '11_INTEGRACIONES.md',
  '12_SEGURIDAD.md',
  '13_OPERACION_Y_DESPLIEGUE.md',
  '14_GLOSARIO.md',
  '15_ESTADO_Y_DEUDA.md',
  'README.md',
]);

const BANNER = `> [!WARNING]
> **DOCUMENTO HISTÓRICO SUPERADO (14/09/2026):**  
> Este documento ha sido reemplazado y consolidado en el nuevo cuerpo documental oficial del 14/10/2026.  
> Para consultar la documentación vigente y verificada contra el código vivo y la base de datos de producción (34 tablas, 5 RPCs, 10 usuarios), dirigirse a [**00_INDICE.md**](./00_INDICE.md).

---

`;

const files = fs.readdirSync(DOCS_DIR);
let count = 0;

for (const f of files) {
  if (!f.endsWith('.md')) continue;
  if (NEW_DOCS.has(f)) continue;

  const fullPath = path.join(DOCS_DIR, f);
  const content = fs.readFileSync(fullPath, 'utf8');

  if (content.includes('DOCUMENTO HISTÓRICO SUPERADO')) {
    console.log(`Skipping ${f} (already has banner)`);
    continue;
  }

  const updated = BANNER + content;
  fs.writeFileSync(fullPath, updated, 'utf8');
  console.log(`✓ Added banner to ${f}`);
  count++;
}

console.log(`\nCompletado: ${count} archivos históricos actualizados con banner de deprecación.`);
