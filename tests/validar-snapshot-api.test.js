import { describe, it, expect } from 'vitest';
import { validarSnapshotAPI, transformAPIResponse } from '../src/core/stock-service.js';

const payloadValido = {
  metadata: {
    fecha_descarga: '2026-10-25T00:35:53-05:00',
    total_skus: 2,
    enriquecido: true,
  },
  items: [
    {
      sku: '011019',
      descripcion: 'Producto A',
      almacenes: [
        { almacen: 'VES', tipo: 'venta', disponible: 100, stock: 100, predespacho: 10 },
      ],
      precio: 9.99,
      peso_kg: 0.5,
      un_bx: 10,
    },
    {
      sku: '011020',
      descripcion: 'Producto B',
      almacenes: [
        { almacen: 'VES', tipo: 'venta', disponible: 0, stock: 0, predespacho: 0 },
      ],
    },
  ],
};

describe('validarSnapshotAPI', () => {
  it('acepta payload válido completo', () => {
    expect(validarSnapshotAPI(payloadValido)).toBe(true);
  });

  it('rechaza metadata ausente', () => {
    expect(() => validarSnapshotAPI({ items: [] })).toThrow(/metadata/);
  });

  it('rechaza metadata no objeto', () => {
    expect(() => validarSnapshotAPI({ items: [], metadata: 'no' })).toThrow(/metadata/);
  });

  it('rechaza items no array', () => {
    expect(() => validarSnapshotAPI({ metadata: { total_skus: 0, enriquecido: true }, items: 'no' })).toThrow(/items/);
  });

  it('rechaza items vacío con total_skus != 0', () => {
    expect(() =>
      validarSnapshotAPI({ metadata: { total_skus: 5, enriquecido: true }, items: [] })
    ).toThrow(/total_skus/);
  });

  it('acepa items vacío cuando total_skus===0 && enriquecido===true', () => {
    expect(() =>
      validarSnapshotAPI({
        metadata: { total_skus: 0, enriquecido: true, fecha_descarga: '2026-10-25T10:00:00-05:00' },
        items: [],
      })
    ).not.toThrow();
  });

  it('rechaza length desalineado entre items y total_skus', () => {
    expect(() =>
      validarSnapshotAPI({
        metadata: { total_skus: 3, enriquecido: true },
        items: [{ sku: 'A', almacenes: [] }, { sku: 'B', almacenes: [] }],
      })
    ).toThrow(/total_skus/);
  });

  it('rechaza SKU duplicado', () => {
    expect(() =>
      validarSnapshotAPI({
        metadata: { total_skus: 2, enriquecido: true },
        items: [
          { sku: 'A', almacenes: [] },
          { sku: 'A', almacenes: [] },
        ],
      })
    ).toThrow(/duplicado/);
  });

  it('rechaza disponible negativo', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.items[0].almacenes[0].disponible = -5;
    expect(() => validarSnapshotAPI(p)).toThrow(/disponible/);
  });

  it('rechaza disponible NaN', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.items[0].almacenes[0].disponible = NaN;
    expect(() => validarSnapshotAPI(p)).toThrow(/disponible/);
  });

  it('rechaza stock negativo', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.items[0].almacenes[0].stock = -1;
    expect(() => validarSnapshotAPI(p)).toThrow(/stock/);
  });

  it('rechaza predespacho negativo', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.items[0].almacenes[0].predespacho = -3;
    expect(() => validarSnapshotAPI(p)).toThrow(/predespacho/);
  });

  it('rechaza fecha_descarga ausente', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    delete p.metadata.fecha_descarga;
    expect(() => validarSnapshotAPI(p)).toThrow(/fecha_descarga/);
  });

  it('rechaza fecha_descarga sin zona horaria', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.metadata.fecha_descarga = '2026-10-25T00:35:53';
    expect(() => validarSnapshotAPI(p)).toThrow(/zona|ISO/);
  });

  it('rechaza fecha_descarga con rollover imposible 2026-02-30', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.metadata.fecha_descarga = '2026-02-30T00:00:00-05:00';
    expect(() => validarSnapshotAPI(p)).toThrow(/rollover/);
  });

  it('acepta offset -05:00', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.metadata.fecha_descarga = '2026-10-25T00:35:53-05:00';
    expect(() => validarSnapshotAPI(p)).not.toThrow();
  });

  it('acepta offset Z (UTC)', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.metadata.fecha_descarga = '2026-10-25T00:35:53Z';
    expect(() => validarSnapshotAPI(p)).not.toThrow();
  });

  it('rechaza un_bx no entero', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.items[0].un_bx = 2.5;
    expect(() => validarSnapshotAPI(p)).toThrow(/un_bx/);
  });

  it('rechaza un_bx cero', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.items[0].un_bx = 0;
    expect(() => validarSnapshotAPI(p)).toThrow(/un_bx/);
  });

  it('acepta un_bx omitido', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    delete p.items[0].un_bx;
    expect(() => validarSnapshotAPI(p)).not.toThrow();
  });

  it('rechaza precio negativo', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.items[0].precio = -1;
    expect(() => validarSnapshotAPI(p)).toThrow(/precio/);
  });

  it('rechaza peso_kg negativo', () => {
    const p = JSON.parse(JSON.stringify(payloadValido));
    p.items[0].peso_kg = -0.5;
    expect(() => validarSnapshotAPI(p)).toThrow(/peso_kg/);
  });

  it('rechaza payload no objeto', () => {
    expect(() => validarSnapshotAPI(null)).toThrow(/objeto/);
    expect(() => validarSnapshotAPI([1, 2])).toThrow(/objeto/);
    expect(() => validarSnapshotAPI('string')).toThrow(/objeto/);
  });

  it('transformación idempotente: misma entrada => misma salida', () => {
    const a = transformAPIResponse(payloadValido);
    const b = transformAPIResponse(payloadValido);
    expect(a).toEqual(b);
    // lastUpdated debe venir de metadata.fecha_descarga, no de new Date()
    expect(a.lastUpdated).toBe('2026-10-25T00:35:53-05:00');
  });
});
