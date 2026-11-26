// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import '../src/components/pulso-form.js';

const require = createRequire(import.meta.url);
let rg;
let generateSpy;

beforeAll(async () => {
  require('../public/exceljs.min.js'); // adjunta window.ExcelJS para report-generator.js
  rg = await import('../src/core/report-generator.js');
  generateSpy = vi.spyOn(rg, 'generateReportXLSX').mockResolvedValue(new Blob(['x']));
});

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
  generateSpy.mockClear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const stockDataError = {
  productos: [],
  fuente: 'error',
  error: 'No hay datos',
};

const stockDataNoArray = {
  productos: 'no-es-array',
  fuente: 'api',
};

const stockDataVacioValido = {
  productos: [],
  fuente: 'api',
  enriquecido: true,
  lastUpdated: '2026-10-25T10:00:00-05:00',
};

describe('pulso-form integridad de exportación', () => {
  it('con fuente=error no invoca generateReportXLSX y muestra errorMsg', async () => {
    const el = document.createElement('pulso-form');
    el.stockData = stockDataError;
    document.body.appendChild(el);
    await el.updateComplete;

    await el._handleSubmit(new Event('submit'));
    await el.updateComplete;

    expect(generateSpy).not.toHaveBeenCalled();
    expect(el.errorMsg).toContain('No hay datos válidos');
    expect(el.showModal).toBe(false);
  });

  it('con productos no-array no invoca generateReportXLSX y muestra errorMsg', async () => {
    const el = document.createElement('pulso-form');
    el.stockData = stockDataNoArray;
    document.body.appendChild(el);
    await el.updateComplete;

    await el._handleSubmit(new Event('submit'));
    await el.updateComplete;

    expect(generateSpy).not.toHaveBeenCalled();
    expect(el.errorMsg).toContain('No hay datos válidos');
    expect(el.showModal).toBe(false);
  });

  it('con catálogo vacío válido SÍ genera reporte y abre modal', async () => {
    const el = document.createElement('pulso-form');
    el.stockData = stockDataVacioValido;
    document.body.appendChild(el);
    await el.updateComplete;

    await el._handleSubmit(new Event('submit'));
    await el.updateComplete;

    expect(generateSpy).toHaveBeenCalled();
    expect(el.showModal).toBe(true);
    expect(el.errorMsg).toBe('');
  });

  it('el botón submit está disabled con fuente error o productos no-array', async () => {
    const elErr = document.createElement('pulso-form');
    elErr.stockData = stockDataError;
    document.body.appendChild(elErr);
    await elErr.updateComplete;
    expect(elErr.shadowRoot.querySelector('button[type="submit"]').disabled).toBe(true);

    const elNoArr = document.createElement('pulso-form');
    elNoArr.stockData = stockDataNoArray;
    document.body.appendChild(elNoArr);
    await elNoArr.updateComplete;
    expect(elNoArr.shadowRoot.querySelector('button[type="submit"]').disabled).toBe(true);

    const elValido = document.createElement('pulso-form');
    elValido.stockData = stockDataVacioValido;
    document.body.appendChild(elValido);
    await elValido.updateComplete;
    expect(elValido.shadowRoot.querySelector('button[type="submit"]').disabled).toBe(false);
  });
});
