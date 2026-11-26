import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock del API CacheStorage antes de importar el SW
const deleted = [];
const keys = ['stockpulse-v4', 'stockpulse-v5', 'stockpulse-v6', 'otra-app-v1'];

global.caches = {
  keys: () => Promise.resolve([...keys]),
  delete: (name) => {
    deleted.push(name);
    return Promise.resolve(true);
  },
  has: () => Promise.resolve(false),
  match: () => Promise.resolve(undefined),
  open: () => Promise.resolve({ put: () => Promise.resolve() }),
};

beforeEach(() => {
  deleted.length = 0;
});

afterEach(() => {
  delete global.caches;
});

describe('sw activate', () => {
  it('borra solo stockpulse-* distintas de CACHE_NAME y conserva v6 y cachés ajenas', async () => {
    const CACHE_NAME = 'stockpulse-v6';
    const allKeys = await global.caches.keys();
    const aBorrar = allKeys.filter((k) => k.startsWith('stockpulse-') && k !== CACHE_NAME);

    await Promise.all(aBorrar.map((k) => global.caches.delete(k)));

    expect(deleted).toContain('stockpulse-v4');
    expect(deleted).toContain('stockpulse-v5');
    expect(deleted).not.toContain('stockpulse-v6');
    expect(deleted).not.toContain('otra-app-v1');
    expect(deleted.sort()).toEqual(['stockpulse-v4', 'stockpulse-v5']);
  });
});
