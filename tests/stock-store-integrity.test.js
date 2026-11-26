// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveData,
  loadData,
  snapshotInternoValido,
  LOCAL_TTL,
  SESSION_TTL,
  FRESHNESS_TTL,
} from '../src/core/stock-store.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('stock-store snapshotInternoValido', () => {
  it('acepta datos válidos con meta.revision no vacío', () => {
    const data = { productos: [], fuente: 'api' };
    const meta = { revision: '2026-10-25T10:00:00-05:00' };
    expect(snapshotInternoValido(data, meta)).toBe(true);
  });

  it('rechaza productos no array', () => {
    expect(snapshotInternoValido({ productos: 'no', fuente: 'api' }, { revision: 'x' })).toBe(false);
    expect(snapshotInternoValido({}, { revision: 'x' })).toBe(false);
  });

  it('rechaza meta.revision vacía o ausente', () => {
    expect(snapshotInternoValido({ productos: [], fuente: 'api' }, { revision: '' })).toBe(false);
    expect(snapshotInternoValido({ productos: [], fuente: 'api' }, {})).toBe(false);
    expect(snapshotInternoValido({ productos: [], fuente: 'api' }, undefined)).toBe(false);
  });

  it('rechaza fuente error', () => {
    expect(snapshotInternoValido({ productos: [], fuente: 'error' }, { revision: 'x' })).toBe(false);
  });
});

describe('stock-store saveData rechaza inválido', () => {
  it('no guarda ni notifica {fuente:"error"}', () => {
    saveData({ productos: [], fuente: 'error' }, { revision: 'x' });
    expect(loadData()).toBeNull();
  });

  it('no guarda snapshot sin productos array', () => {
    saveData({ productos: 'no', fuente: 'api' }, { revision: 'x' });
    expect(loadData()).toBeNull();
  });

  it('no guarda snapshot con revision vacía', () => {
    saveData({ productos: [], fuente: 'api' }, { revision: '' });
    expect(loadData()).toBeNull();
  });
});

describe('stock-store loadData ignora legacy', () => {
  it('ignora entrada legacy con fuente error', () => {
    localStorage.setItem('g360_stock_data_local_v1', JSON.stringify({
      ts: Date.now(),
      data: { productos: [], fuente: 'error' },
    }));
    localStorage.setItem('g360_stock_meta_v1', JSON.stringify({ revision: 'x', lastFetchedAt: new Date().toISOString() }));
    expect(loadData()).toBeNull();
  });

  it('ignora entrada con productos no array', () => {
    localStorage.setItem('g360_stock_data_local_v1', JSON.stringify({
      ts: Date.now(),
      data: { productos: 'no', fuente: 'api' },
    }));
    localStorage.setItem('g360_stock_meta_v1', JSON.stringify({ revision: 'x', lastFetchedAt: new Date().toISOString() }));
    expect(loadData()).toBeNull();
  });

  it('TTLs intactos: LOCAL_TTL 7d, SESSION_TTL 5min, FRESHNESS_TTL 15min', () => {
    expect(LOCAL_TTL).toBe(7 * 24 * 60 * 60 * 1000);
    expect(SESSION_TTL).toBe(5 * 60 * 1000);
    expect(FRESHNESS_TTL).toBe(15 * 60 * 1000);
  });
});
