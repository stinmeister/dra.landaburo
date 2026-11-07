import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPPORTED_TABS,
  parseArsPriceCell,
  extractCodedRowsFromWorkbook,
  planPriceSync,
} from '../src/lib/priceSync/sheetParser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, 'fixtures', 'precios_nati_gualeguaychu_fixture.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

test('parseArsPriceCell acepta formatos ARS reales válidos', () => {
  assert.deepEqual(parseArsPriceCell('$50.000'), { ok: true, priceArs: 50000 });
  assert.deepEqual(parseArsPriceCell(' $35.000'), { ok: true, priceArs: 35000 });
  assert.deepEqual(parseArsPriceCell('$10.000 x sesión'), { ok: true, priceArs: 10000 });
  assert.deepEqual(parseArsPriceCell('$40.000 por zona'), { ok: true, priceArs: 40000 });
  assert.deepEqual(parseArsPriceCell(80000), { ok: true, priceArs: 80000 });
});

test('parseArsPriceCell rechaza rangos, dólares, texto ambiguo y vacíos', () => {
  const rango = parseArsPriceCell('$220.000/$250.000');
  assert.equal(rango.ok, false);
  assert.equal(rango.reason, 'precio_rango_o_multiple');

  const dolares = parseArsPriceCell('420 dolares ');
  assert.equal(dolares.ok, false);
  assert.equal(dolares.reason, 'precio_en_dolares');

  const usd = parseArsPriceCell('U$S 320');
  assert.equal(usd.ok, false);
  assert.equal(usd.reason, 'precio_en_dolares');

  const vacio = parseArsPriceCell('');
  assert.equal(vacio.ok, false);
  assert.equal(vacio.reason, 'precio_vacio');

  const consultar = parseArsPriceCell('Consultar');
  assert.equal(consultar.ok, false);
  assert.equal(consultar.reason, 'precio_texto_sin_numero');

  const comaDecimal = parseArsPriceCell('0,5');
  assert.equal(comaDecimal.ok, false);

  const menorAlMinimo = parseArsPriceCell('$50');
  assert.equal(menorAlMinimo.ok, false);
  assert.equal(menorAlMinimo.reason, 'precio_menor_al_minimo');
});

test('extractCodedRowsFromWorkbook respeta las columnas exactas de cada pestaña e ignora URDI, Mercedes y Combos', () => {
  const { extracted, tabStats } = extractCodedRowsFromWorkbook(fixture.sheetsByTab);

  assert.equal(tabStats.length, 4);

  // En Tratamientos Pau: bloque G/H lee precio de H, y bloque principal lee D (ignorando C USD y E Mercedes)
  const minox5 = extracted.find((r) => r.codigoWeb === 'minoxidil-5-mg');
  assert.ok(minox5);
  assert.equal(minox5.tab, SUPPORTED_TABS.PAU);
  assert.equal(minox5.rawPrice, '$28.000');

  const botoxMasetero = extracted.find((r) => r.codigoWeb === 'botox-masetero');
  assert.ok(botoxMasetero);
  assert.equal(botoxMasetero.rawPrice, '$260.000'); // Col D, NO $220 de Mercedes en Col E

  // En Tratamientos Mechi: lee Col B, ignorando Col D ("URDI" = $38.000)
  const limpiezaProf = extracted.find((r) => r.codigoWeb === 'limpieza-facial-profunda');
  assert.ok(limpiezaProf);
  assert.equal(limpiezaProf.rawPrice, '$50.000');

  // Filas sin codigo_web ("Exfoliación cuerpo entero", encabezados de categoría Sulderm, etc.) NO entran
  const sinCodigo = extracted.find((r) => /exfoliaci[oó]n cuerpo entero/i.test(r.sheetLabel));
  assert.equal(sinCodigo, undefined);

  // En Cremas Sulderm: lee Col D ($45.000), ignorando Col E Combo ($80.000)
  const acneplur = extracted.find((r) => r.codigoWeb === 'acneplur-foam');
  assert.ok(acneplur);
  assert.equal(acneplur.rawPrice, '$45.000');
});

test('planPriceSync aplica todas las reglas y salvaguardas sobre el fixture', () => {
  const plan = planPriceSync({
    sheetsByTab: fixture.sheetsByTab,
    products: fixture.catalogSnapshot.products,
    treatments: fixture.catalogSnapshot.treatments,
    maxPctChange: 50,
  });

  // 1. Actualizaciones válidas (<= 50%)
  const updatedCodes = plan.updates.map((u) => u.codigoWeb).sort();
  assert.deepEqual(updatedCodes, [
    'acneplur-foam',
    'bellivm-velvet',
    'limpieza-facial-basica-sin-extracciones',
    'minoxidil-5-mg',
  ]);

  const basicUpdate = plan.updates.find(
    (u) => u.codigoWeb === 'limpieza-facial-basica-sin-extracciones'
  );
  assert.equal(basicUpdate.oldPriceArs, 30000);
  assert.equal(basicUpdate.newPriceArs, 35000);
  assert.equal(basicUpdate.entityType, 'cosmetology_treatment');

  // 2. Sin cambios (mismo importe)
  const unchangedCodes = plan.unchanged.map((u) => u.codigoWeb).sort();
  assert.deepEqual(unchangedCodes, [
    'agua-micelar-3-en-1',
    'dutasteride-05-mg',
    'electroestimulacion-por-sesion',
    'latisse-bimatoprost-003',
    'limpieza-facial-profunda',
    'minoxidil-1-mg',
  ]);

  // 3. Salteados con razón exacta
  const reasonByCode = Object.fromEntries(plan.skipped.map((s) => [s.codigoWeb, s.reason]));
  assert.equal(reasonByCode['botox-masetero'], 'tratamiento_medico_excluido');
  assert.equal(reasonByCode['hifu-facial'], 'tratamiento_medico_excluido');
  assert.equal(reasonByCode['antiox-c'], 'precio_en_dolares');
  assert.equal(reasonByCode['dermapen-facial'], 'precio_rango_o_multiple');
  assert.equal(reasonByCode['total-glow-de-todo-personalizado'], 'variacion_mayor_50_porciento');
  assert.equal(reasonByCode['gluteos'], 'precio_vacio');
  assert.equal(reasonByCode['exfoliacion-por-zona'], 'codigo_web_inexistente_en_web');
  assert.equal(reasonByCode['hydra-age-plus'], 'precio_texto_sin_numero');
  assert.equal(reasonByCode['crema-anti-celulitis'], 'codigo_web_duplicado_en_planilla');
});

test('Hifu habilitado como Cosmetologia se sincroniza desde columna C', () => {
  const plan = planPriceSync({
    sheetsByTab: {
      Hifu: [
        ['Grupo', 'Zona', 'Precio', 'codigo_web'],
        ['Facial', 'HIFU Facial', '$125.000', 'hifu-facial-cosmiatria'],
      ],
    },
    products: [],
    treatments: [
      {
        id: '00000000-0000-0000-0000-000000000099',
        slug: 'hifu-facial-cosmiatria',
        title: 'HIFU Facial',
        category: 'Cosmetologia',
        price_ars: 110000,
        is_active: true,
      },
    ],
  });

  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].newPriceArs, 125000);
});
