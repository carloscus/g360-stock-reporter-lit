// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadStockData,
  getLastError,
  __resetLoadState,
} from '../src/core/stock-service.js';
import {
  saveData,
  loadData,
  getMeta,
  __resetStoreState,
} from '../src/core/stock-store.js';

const producto = (sku = '011019') => ({
  sku,
  descripcion: 'Producto',
  almacenes: [{ almacen: 'VES', tipo: 'venta', disponible: 10, stock: 10, predespacho: 0 }],
});

const payloadValido = {
  metadata: {
    fecha_descarga: '2026-10-25T10:00:00-05:00',
    total_skus: 1,
    enriquecido: true,
  },
  items: [producto()],
};

const payloadViejo = {
  metadata: {
    fecha_descarga: '2026-10-24T10:00:00-05:00',
    total_skus: 1,
    enriquecido: true,
  },
  items: [producto('011018')],
};

const payloadInvalido = {
  metadata: {
    fecha_descarga: '2026-10-25T10:00:00-05:00',
    total_skus: 5,
    enriquecido: true,
  },
  items: [producto()], // length 1 !== total_skus 5
};

function mockFetch(response) {
  global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(response), { status: 200 })));
}

function mockFetchError() {
  global.fetch = vi.fn(() => Promise.reject(new Error('Network down')));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetLoadState();
  __resetStoreState();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  __resetLoadState();
  __resetStoreState();
});

describe('loadStockData - caché y errores', () => {
  it('con caché válida + API 200 inválido preserva la caché y no sobrescribe', async () => {
    const datosCache = {
      productos: [{ sku: 'CACHE', nombre: 'Cache', stock: 5, bx: 0 }],
      stockMap: {},
      lastUpdated: '2026-10-24T10:00:00-05:00',
      totalAlmacenes: 1,
      totalSkus: 1,
      fuente: 'api',
      enriquecido: true,
    };
    saveData(datosCache, { source: 'api', version: 'v1', revision: '2026-10-24T10:00:00-05:00' });

    mockFetch(payloadInvalido);

    const result = await loadStockData(false);
    expect(result.productos[0].sku).toBe('CACHE');
    expect(getMeta()?.revision).toBe('2026-10-24T10:00:00-05:00');
  });

  it('error con caché devuelve datos de caché y revision intacta', async () => {
    const datosCache = {
      productos: [{ sku: 'CACHE', nombre: 'Cache', stock: 5, bx: 0 }],
      stockMap: {},
      lastUpdated: '2026-10-24T10:00:00-05:00',
      totalAlmacenes: 1,
      totalSkus: 1,
      fuente: 'api',
      enriquecido: true,
    };
    saveData(datosCache, { source: 'api', version: 'v1', revision: '2026-10-24T10:00:00-05:00' });

    mockFetchError();

    const result = await loadStockData(false);
    expect(result.productos[0].sku).toBe('CACHE');
    expect(getMeta()?.revision).toBe('2026-10-24T10:00:00-05:00');
    expect(getLastError()).toBe('Network down');
  });

  it('error sin caché devuelve fuente error y NO persiste', async () => {
    mockFetchError();

    const result = await loadStockData(false);
    expect(result.fuente).toBe('error');
    expect(result.productos).toEqual([]);
    expect(getLastError()).toBe('Network down');
    expect(loadData()).toBeNull();
    expect(getMeta()).toBeNull();
  });

  it('coalescencia: 2 llamadas force concurrentes => 1 fetch', async () => {
    mockFetch(payloadValido);

    const p1 = loadStockData(true);
    const p2 = loadStockData(true);

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(global.fetch.mock.calls.length).toBe(1);
    expect(r1.fuente).toBe('api');
    expect(r2.fuente).toBe('api');
    expect(getLastError()).toBeNull();
  });

  it('monotonía en dos ciclos secuenciales: primero nueva, luego force con vieja => conserva nueva', async () => {
    mockFetch(payloadValido);
    const r1 = await loadStockData(true);
    expect(r1.productos[0].sku).toBe('011019');
    expect(getMeta()?.revision).toBe('2026-10-25T10:00:00-05:00');
    expect(getLastError()).toBeNull();

    mockFetch(payloadViejo);
    const r2 = await loadStockData(true);
    expect(r2.productos[0].sku).toBe('011019');
    expect(getMeta()?.revision).toBe('2026-10-25T10:00:00-05:00');
    expect(getLastError()).toBeNull();
  });

  it('getLastError devuelve null tras éxito', async () => {
    mockFetch(payloadValido);
    await loadStockData(true);
    expect(getLastError()).toBeNull();
  });

  it('manual refresh con error silencioso y caché válida: _dataError sigue true', async () => {
    const datosCache = {
      productos: [{ sku: 'CACHE', nombre: 'Cache', stock: 5, bx: 0 }],
      stockMap: {},
      lastUpdated: '2026-10-24T10:00:00-05:00',
      totalAlmacenes: 1,
      totalSkus: 1,
      fuente: 'api',
      enriquecido: true,
    };
    saveData(datosCache, { source: 'api', version: 'v1', revision: '2026-10-24T10:00:00-05:00' });

    mockFetchError();

    const result = await loadStockData(true);
    expect(result.productos[0].sku).toBe('CACHE'); // devuelve caché
    expect(getMeta()?.revision).toBe('2026-10-24T10:00:00-05:00'); // revisión intacta
    expect(getLastError()).toBe('Network down'); // _lastError seteado aunque no lance
  });
});
