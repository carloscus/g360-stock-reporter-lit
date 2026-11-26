// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import '../src/components/stock-search.js';

const productoConXSS = (over = {}) => ({
  sku: '011019',
  nombre: 'Producto normal',
  linea: 'PELOTAS',
  categoria: 'VINIBALL',
  estado_linea: 'IMPORTADO',
  vigente: true,
  descontinuado: false,
  revision: '',
  um: 'UND',
  un_bx: 48,
  stock: 100,
  bx: 2,
  predespacho: 0,
  precio: 9.99,
  peso_kg: 0.5,
  ean13: '',
  ean14: '',
  keywords: [],
  orden: 10,
  almacenes_venta: [{ almacen: 'VES', disponible: 100, stock: 100, predespacho: 0, esInspeccion: false }],
  ...over,
});

async function montar() {
  document.body.innerHTML = '';
  const el = document.createElement('stock-search');
  el.stockData = { productos: [productoConXSS()] };
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('stock-search XSS en highlight', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('escapa  con onerror: no crea tag  ni atributos ejecutables', async () => {
    const el = await montar();
    el.stockData = {
      productos: [productoConXSS({ sku: '<img src=x onerror=alert(1)>' })],
    };
    el.searchTerm = 'img';
    el._search();
    await el.updateComplete;

    const skuEl = el.shadowRoot.querySelector('.sku');
    expect(skuEl).toBeTruthy();
    const html = skuEl.innerHTML;
    expect(html).toContain('&lt;');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('<mark>');
    // Ningún tag HTML creado a partir del texto malicioso
    expect(html).not.toMatch(/<img\b/);
    expect(html).not.toMatch(/<iframe\b/);
  });

  it('escapa nombre con comillas y atributos inyectados', async () => {
    const el = await montar();
    el.stockData = {
      productos: [productoConXSS({ nombre: '<span onclick="x">Nombre</span>' })],
    };
    el.searchTerm = 'nombre';
    el._search();
    await el.updateComplete;

    const nombreEl = el.shadowRoot.querySelector('.nombre');
    const html = nombreEl.innerHTML;
    expect(html).toContain('&lt;span');
    expect(html).not.toContain('<span');
    // onclick="x" queda escapado como texto, no como atributo HTML
    expect(html).not.toMatch(/<span\b/);
    expect(html).toContain('<mark>');
  });

  it('conserva <mark> solo alrededor del texto coincidente', async () => {
    const el = await montar();
    el.stockData = {
      productos: [productoConXSS({ nombre: 'VOLEY VINIBALL' })],
    };
    el.searchTerm = 'voley';
    el._search();
    await el.updateComplete;

    const nombreEl = el.shadowRoot.querySelector('.nombre');
    expect(nombreEl.innerHTML).toContain('<mark>VOLEY</mark>');
    expect(nombreEl.innerHTML).not.toContain('&lt;mark');
  });

  it('no queda onerror= ni atributos inyectados como HTML en ningún resultado', async () => {
    const el = await montar();
    el.stockData = {
      productos: [
        productoConXSS({ sku: '<img src=x onerror=alert(1)>' }),
        productoConXSS({ sku: '011020', nombre: '<iframe src="javascript:alert(2)">' }),
      ],
    };
    el.searchTerm = 'img';
    el._search();
    await el.updateComplete;

    const htmlCompleto = el.shadowRoot.innerHTML;
    // No debe haber tags HTML creados a partir del texto malicioso
    expect(htmlCompleto).not.toMatch(/<img\b/);
    expect(htmlCompleto).not.toMatch(/<iframe\b/);
    // Ningún elemento del DOM tiene onerror/onclick como atributo real
    const conHandlers = el.shadowRoot.querySelectorAll('[onerror], [onclick], [onload]');
    expect(conHandlers).toHaveLength(0);
    // Todo queda escapado
    expect(htmlCompleto).toContain('&lt;');
  });
});
