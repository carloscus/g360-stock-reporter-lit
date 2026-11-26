/**
 * @file stock-service.js
 * @description Servicio para cargar datos de stock desde el API backend.
 *              El API ya enriquece cada item con un_bx, peso_kg, ean13, ean14.
 *              Usa stock-store con 3 capas: memoria → sessionStorage → localStorage → API.
 *              Sin dependencias de JSON estáticos (enriquecimiento viene del API).
 * @author @carloscus
 * @version 7.6.0
 */

import { saveData, loadData, isStale, getMeta, INSPECCION_ALMACEN, ALMACEN_PRINCIPAL, ALMACEN_TRASLADO, ALMACEN_EXPORTACION } from './stock-store.js';

const STOCK_API_URL = import.meta.env?.VITE_STOCK_API_URL || 'https://g360-stock-api.onrender.com/api/v1/stock';
// Clave de lectura limitada para la PWA estatica. Nunca usar aqui la clave
// administrativa de upload/catalogo. Rotarla desde Render cuando corresponda.
// Se puede sobreescribir con VITE_STOCK_READ_KEY (ver .env.example).
const STOCK_READ_API_KEY = import.meta.env?.VITE_STOCK_READ_KEY || 'cipsa2026';
const API_TIMEOUT_MS = 25000;
// Probe: solo metadata (limit=1, ~1 KB) para detectar regeneración sin descargar
// el payload completo (~1.3 MB). Timeout amplio porque el proceso puede estar
// dormido en Render y tardar 30-60s en despertar y regenerar el reporte.
const PROBE_TIMEOUT_MS = 60000;
// Keep-alive: solo tocar /health, respuesta pequeña. Timeout corto.
const HEALTH_TIMEOUT_MS = 5000;

// Ventana horaria del backend (Lima, UTC-5): Lun-Sáb 07:00 a 22:59.
// El API solo regenera el reporte dentro de esta ventana (ver _es_momento_valido).
const LIMA_TZ_OFFSET_MS = -5 * 60 * 60 * 1000;

let _loading = null;
let _currentLoadId = 0;
let _lastError = null;

// Test-only: resetear estado interno del módulo entre pruebas.
export function __resetLoadState() {
  _loading = null;
  _currentLoadId = 0;
  _lastError = null;
}

/**
 * Último error de carga de datos (red, forma, invariante o monotonía).
 * Se expone vía getLastError() para que app-root lo refleje en la barra
 * de estado sin que viaje por el store.
 */
export function getLastError() {
  return _lastError;
}

function _setError(err) {
  _lastError = err || null;
}

/**
 * Valida estrictamente un payload completo del API antes de transformar o
 * guardar. Es una función pura: no toca el store ni efectos laterales.
 *
 * Invariantes:
 *  - items es array; metadata es objeto
 *  - items.length === metadata.total_skus
 *  - items=[] válido solo si total_skus===0 && metadata.enriquecido===true
 *  - SKU único
 *  - almacenes[].disponible/stock/predespacho finitos >= 0
 *  - un_bx opcional, entero >= 1
 *  - precio/peso_kg opcionales, finitos >= 0
 *  - fecha_descarga ISO estricta con zona horaria, Date.parse finito y
 *    sin rollover imposible (p.ej. 2026-02-30)
 *  - Transformación idempotente
 */
export function validarSnapshotAPI(apiData) {
  if (!apiData || typeof apiData !== 'object' || Array.isArray(apiData)) {
    throw new Error('API payload debe ser un objeto');
  }

  const { items, metadata } = apiData;

  if (!Array.isArray(items)) {
    throw new Error('items debe ser un array');
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('metadata debe ser un objeto');
  }

  // items=[] solo válido si total_skus===0 && enriquecido===true
  if (items.length === 0) {
    if (!(metadata.total_skus === 0 && metadata.enriquecido === true)) {
      throw new Error('items vacío requiere total_skus===0 y enriquecido===true');
    }
  } else if (items.length !== metadata.total_skus) {
    throw new Error('items.length !== metadata.total_skus');
  }

  const seenSkus = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('cada item debe ser un objeto');
    }
    if (typeof item.sku !== 'string' || !item.sku) {
      throw new Error('cada item requiere sku no vacío');
    }
    if (seenSkus.has(item.sku)) {
      throw new Error(`SKU duplicado: ${item.sku}`);
    }
    seenSkus.add(item.sku);

    const almacenes = item.almacenes;
    if (almacenes !== undefined && almacenes !== null) {
      if (!Array.isArray(almacenes)) {
        throw new Error('almacenes debe ser array');
      }
      for (const a of almacenes) {
        if (!a || typeof a !== 'object') {
          throw new Error('cada almacén debe ser un objeto');
        }
        for (const campo of ['disponible', 'stock', 'predespacho']) {
          const v = a[campo];
          if (v !== undefined && v !== null) {
            if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
              throw new Error(`almacenes[].${campo} debe ser finito >= 0`);
            }
          }
        }
      }
    }

    // un_bx opcional, entero >= 1
    if (item.un_bx !== undefined && item.un_bx !== null) {
      if (typeof item.un_bx !== 'number' || !Number.isInteger(item.un_bx) || item.un_bx < 1) {
        throw new Error('un_bx debe ser entero >= 1');
      }
    }

    // precio/peso_kg opcionales, finitos >= 0
    for (const campo of ['precio', 'peso_kg']) {
      const v = item[campo];
      if (v !== undefined && v !== null) {
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          throw new Error(`item.${campo} debe ser finito >= 0`);
        }
      }
    }
  }

  // fecha_descarga: ISO estricta con zona horaria, Date.parse finito, sin rollover imposible
  const fecha = metadata.fecha_descarga;
  if (typeof fecha !== 'string' || !fecha) {
    throw new Error('metadata.fecha_descarga ausente');
  }
  // ISO estricto: requiere zona horaria (Z o +/-HH:MM)
  if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(fecha)) {
    throw new Error('metadata.fecha_descarga requiere zona horaria');
  }
  const ts = Date.parse(fecha);
  if (!Number.isFinite(ts)) {
    throw new Error('metadata.fecha_descarga no es ISO válido');
  }
  // Detectar rollover imposible: Date.parse normaliza 2026-02-30 a 2 de marzo.
  // Verificar que el día del mes exista (independiente del offset horario).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCDate() !== +m[3]) {
      throw new Error('metadata.fecha_descarga tiene rollover de fecha imposible');
    }
  }

  return true;
}

/**
 * ¿Estamos dentro de la ventana operativa del reporte (Lun-Sáb 07:00-22:59 hora Lima)?
 * Domingo y madrugadas el backend no regenera datos.
 */
export function isBusinessHours(date = new Date()) {
  const lima = new Date(date.getTime() + LIMA_TZ_OFFSET_MS);
  const weekday = lima.getUTCDay(); // 0 = domingo
  const hour = lima.getUTCHours();
  return weekday !== 0 && hour >= 7 && hour < 23;
}

export function formatLimaTime(isoString) {
  if (!isoString) return '—';
  const lima = new Date(new Date(isoString).getTime() + LIMA_TZ_OFFSET_MS);
  const hh = String(lima.getUTCHours()).padStart(2, '0');
  const mm = String(lima.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Ordena productos por el campo `orden` del API (catálogo maestro).
 * Los ítems sin orden (0) van al final; dentro del mismo orden, por SKU.
 */
export function sortByOrden(items) {
  return [...items].sort((a, b) => {
    const aOrd = a.orden || 0;
    const bOrd = b.orden || 0;
    if (aOrd === 0 && bOrd === 0) return a.sku.localeCompare(b.sku);
    if (aOrd === 0) return 1;
    if (bOrd === 0) return -1;
    return aOrd - bOrd;
  });
}

function _normalizarLinea(lineaApi) {
  if (!lineaApi) return '';
  return lineaApi.replace(/^[\w-]+\s*-\s*/, '').trim();
}

function _generarNombreCorto(descripcion) {
  if (!descripcion) return '';
  let clean = descripcion.replace(/^(N|INFLABLE|PELOTA|BALÓN|JUEGO)\s+/i, '').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function _extraerAlmacenesVenta(item) {
  return (item.almacenes || [])
    .filter((a) => a.tipo === 'venta')
    .map((a) => ({
      almacen: a.almacen,
      nombre: a.nombre || '',
      disponible: a.disponible || 0,
      stock: a.stock || 0,
      predespacho: a.predespacho || 0,
      esInspeccion: a.almacen === INSPECCION_ALMACEN,
    }));
}

function _calcularStockTotal(almacenesVenta) {
  if (!almacenesVenta || almacenesVenta.length === 0) return 0;
  return almacenesVenta.reduce((sum, a) => sum + a.disponible, 0);
}

/**
 * Disponible de venta = disponible del almacén VES (único de venta directa).
 * Los lotes 129 (Secundario), 40 (Traslado) y 121 (Inspección/QC) son
 * informativos e independientes: NUNCA se suman al disponible, porque son
 * lotes diferentes y el vendedor de campo podría equivocarse.
 * Criterio único compartido por dashboard, alertas, buscador y reportes.
 */
function _calcularStockVES(almacenesVenta) {
  return stockEnAlmacen({ almacenes_venta: almacenesVenta }, ALMACEN_PRINCIPAL);
}

/**
 * Umbral de cajas para BAJO vs OK. También define "cantidad grande" para los
 * badges de QC (121) y traslado (40) en el buscador.
 */
export const UMBRAL_BAJO_STOCK = 10;

/**
 * Disponibles puntuales por almacén (por lote, sin sumar entre almacenes).
 */
export function stockEnAlmacen(producto, codigo) {
  return producto?.almacenes_venta?.find((a) => a.almacen === codigo)?.disponible || 0;
}

export function predespachoEnAlmacen(producto, codigo) {
  return producto?.almacenes_venta?.find((a) => a.almacen === codigo)?.predespacho || 0;
}

/**
 * Disponible de venta = disponible VES. Los lotes 129/40/121/122 nunca suman.
 */
export function disponibleVES(producto) {
  return stockEnAlmacen(producto, ALMACEN_PRINCIPAL);
}

/**
 * ¿El SKU tiene movimiento en el almacén 122 (Exportación)?
 */
export function tieneStock122(producto) {
  const e = producto?.almacenes_venta?.find((a) => a.almacen === ALMACEN_EXPORTACION);
  return (e?.disponible || 0) > 0 || (e?.predespacho || 0) > 0;
}

/**
 * Carga datos desde la API.
 * Retorna null si ya hay datos en cache (manejado por loadStockData).
 */
export async function fetchFromAPI() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(STOCK_API_URL, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'X-API-Key': STOCK_READ_API_KEY },
    });
    if (!response.ok) throw new Error(`API HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sonda ligera (limit=1, ~1 KB) que además sirve como "wake":
 * despierta el proceso dormido en Render y, si el cache expiró y estamos
 * en ventana horaria, el backend regenera el reporte en el mismo request.
 * Devuelve solo la metadata para comparar `fecha_descarga` sin bajar 1.3 MB.
 */
export async function probeStockData() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // Sin parametro offset/hay que incluir limit=1 para no traer items.
    // El backend calcula cache_expirado y despierta/regenera igual aqui.
    const url = `${STOCK_API_URL}?limit=1`;
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'X-API-Key': STOCK_READ_API_KEY },
    });
    if (!response.ok) throw new Error(`Probe HTTP ${response.status}`);
    const data = await response.json();
    return {
      fecha_descarga: data?.metadata?.fecha_descarga || '',
      cache_expirado: data?.metadata?.cache_expirado === true,
      cache_expiro_en: data?.metadata?.cache_expiro_en || 900,
      total_skus: data?.metadata?.total_skus || 0,
      en_ventana: isBusinessHours(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keep-alive barato hacia /health (sin key de payload completo).
 * Despierta el proceso dormido de Render para que el probe/payload posterior
 * no tenga que esperar 30-90s de cold start. Timeout corto (5s): solo nos
 * interesa tocar el servidor, no su contenido.
 */
export async function pingHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const url = STOCK_API_URL.replace(/\/api\/v1\/stock$/, '/api/v1/health');
    await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'X-API-Key': STOCK_READ_API_KEY },
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Transforma la respuesta del API al formato interno de los componentes.
 * Consume el modelo ENRIQUECIDO completo (ItemStockEnriched): además de stock,
 * mapea um, flags comerciales y `revision` (estado para badges del frontend).
 * Exportada para tests de comportamiento con payloads reales.
 */
export function transformAPIResponse(apiData) {
  const productos = [];
  const stockMap = {};

  for (const item of apiData.items) {
    const almacenesVenta = _extraerAlmacenesVenta(item);
    // stock = disponible VES (único almacén de venta): criterio de estados,
    // alertas y reportes. stockFisico = total en almacenes de venta
    // (VES+129+40+121): solo para KPIs de valor/peso de inventario.
    const stock = _calcularStockVES(almacenesVenta);
    const stockFisico = _calcularStockTotal(almacenesVenta);
    // un_bx ya viene del API enriquecido
    const unBx = item.un_bx || 1;
    const bx = Math.floor(stock / unBx);
    // Agotado = no se puede formar una caja completa (o sin unidades);
    // Bajo = 1 a (UMBRAL_BAJO_STOCK-1) cajas; OK = UMBRAL_BAJO_STOCK+.
    // Mismo criterio que getEstado en el Excel.
    const estado = bx === 0 ? 'AGOTADO' : bx < UMBRAL_BAJO_STOCK ? 'BAJO' : 'OK';

    const producto = {
      sku: item.sku,
      nombre: item.descripcion,
      nombre_corto: item.nombre_corto || _generarNombreCorto(item.descripcion),
      linea: _normalizarLinea(item.linea),
      linea_id: item.linea_id || '',
      categoria: item.categoria,
      categoria_venta: item.categoria_venta || '',
      grupo: item.grupo || '',
      familia: item.familia || '',
      tipo: item.tipo || '',
      um: item.um || '',
      un_bx: unBx,
      precio: item.precio || 0,
      peso_kg: item.peso_kg || 0,
      ean13: item.ean13 || '',
      ean14: item.ean14 || '',
      estado_linea: item.estado_linea || '',
      orden: item.orden || 0,
      sin_catalogo: item.sin_catalogo || false,
      sin_stock: item.sin_stock || false,
      // Flags comerciales publicados por el catálogo maestro (v3.6.0)
      descontinuado: item.descontinuado || false,
      en_guia: item.en_guia || false,
      compromiso: item.compromiso || false,
      cotizable: item.cotizable || false,
      por_activar: item.por_activar || false,
      vigente: item.vigente !== false,
      origen: item.origen || '',
      derivado_de: item.derivado_de || '',
      // Estado designado por el backend para badges del frontend
      revision: item.revision || '',
      stock,
      stockFisico,
      bx,
      predespacho: almacenesVenta.reduce((sum, a) => sum + a.predespacho, 0),
      almacenes_venta: almacenesVenta,
      almacenes_count: almacenesVenta.length,
      keywords: item.keywords || [],
      estado,
    };

    productos.push(producto);
    stockMap[item.sku] = stock;
  }

  // Nunca fabricar fecha con new Date(): usar metadata.fecha_descarga.
  // transformAPIResponse es idempotente: misma entrada => misma salida.
  const lastUpdated = apiData.metadata?.fecha_descarga || '';
  return {
    productos: sortByOrden(productos),
    stockMap,
    lastUpdated,
    totalAlmacenes: apiData.metadata?.total_almacenes || almacenesCount(apiData.items),
    totalSkus: productos.length,
    fuente: 'api',
    // false ⇒ el backend sirvió sin catálogo: un_bx/peso/precio vienen en 0/1.
    enriquecido: apiData.metadata?.enriquecido === true,
  };
}

function almacenesCount(items) {
  const set = new Set();
  for (const item of items) {
    for (const a of (item.almacenes || [])) {
      if (a.tipo === 'venta') set.add(a.almacen);
    }
  }
  return set.size;
}

/**
 * Compara dos revisiones (fechas ISO) SOLO por Date.parse cuando ambas son válidas.
 * - nueva < guardada => 'cached' (no sobrescribir)
 *   nueva > guardada => 'newer'
 *   iguales => 'equal'
 * - si alguna no parsea => 'cached' si hay previa válida, 'error' si no
 * Nunca compara cadenas ISO directamente.
 */
function _compararRevisiones(nueva, guardada) {
  const tsNueva = nueva ? Date.parse(nueva) : NaN;
  const tsGuardada = guardada ? Date.parse(guardada) : NaN;
  const nuevaValida = Number.isFinite(tsNueva);
  const guardadaValida = Number.isFinite(tsGuardada);

  if (nuevaValida && guardadaValida) {
    if (tsNueva < tsGuardada) return 'cached';
    if (tsNueva > tsGuardada) return 'newer';
    return 'equal';
  }
  if (guardadaValida) return 'cached';
  return 'error';
}

/**
 * Carga datos con prioridad de cache + refresh en background si está stale (>15 min).
 *
 * @param {boolean} force - Si true, ignora cache y refresca desde API
 */
export async function loadStockData(force = false) {
  // 1. Cache (instantáneo).
  const mem = loadData();

  // 2. Un solo in-flight también para force: quitar bypass !force en _loading.
  // Cualquier llamada (force o no) reutiliza la promesa en vuelo.
  if (_loading) return _loading;
  const loadId = ++_currentLoadId;

  _loading = (async () => {
    try {
      const apiData = await fetchFromAPI();
      const newRevision = apiData.metadata?.fecha_descarga || '';
      const prev = getMeta();
      const prevRevision = prev?.revision;

      // Comparación de revisión SOLO por Date.parse cuando ambas fechas son válidas.
      const cmp = _compararRevisiones(newRevision, prevRevision);
      if (cmp === 'cached') {
        // Nueva revisión no es mayor que la guardada: no sobrescribir.
        const cached = loadData();
        if (cached) return cached;
      }

      // Validar el payload ANTES de transformar/saveData
      validarSnapshotAPI(apiData);

      const data = transformAPIResponse(apiData);
      saveData(data, { source: 'api', version: 'v1', revision: newRevision });
      _setError(null);
      return data;
    } catch (error) {
      console.warn('[stock-service] API no disponible:', error.message);
      _setError(error.message);

      // Con caché válida devolverla en error; sin caché devolver centinela
      // {productos:[],fuente:'error',error} SIN persistir.
      const local = loadData();
      if (local) {
        console.log('[stock-service] Usando datos locales, refresh en background');
        refreshInBackground();
        return local;
      }

      console.error('[stock-service] Sin datos disponibles');
      return {
        productos: [],
        stockMap: {},
        lastUpdated: '',
        totalAlmacenes: 0,
        totalSkus: 0,
        fuente: 'error',
        error: error.message,
      };
    } finally {
      // finally limpia _loading solo si sigue siendo la promesa actual
      if (_currentLoadId === loadId) {
        _loading = null;
      }
    }
  })();

  // Si hay caché válida y no es force, devolverla tras esperar el intento
  // del API (para que _lastError quede seteado si falla).
  if (mem && !force) {
    await _loading;
    return mem;
  }

  return _loading;
}

/**
 * Refresh en background: actualiza datos sin bloquear la UI.
 * Se llama cuando los datos cumplen 15 min (frescura del API).
 * Mantiene gate sobre _loading (no lanza fetch concurrente).
 */
export function refreshInBackground() {
  if (_loading) return;
  console.log('[stock-service] Refresh en background (datos >15 min)');
  loadStockData(true).catch(err => console.warn('[stock-service] Background refresh falló:', err));
}

/**
 * Calcula las cajas (bx) según stock y unidades por caja.
 */
export function calculateBx(stock, unBx = 1) {
  const u = Number(unBx) || 1;
  return Math.floor((Number(stock) || 0) / u);
}

/**
 * ¿El SKU se vende por unidades (no por cajas)?
 * un_bx 0/1 (o ausente) = el producto no tiene empaque en cajas,
 * mostrar stock en unidades para no inflar el volumen de cajas.
 */
export function esPorUnidades(producto) {
  return !(Number(producto?.un_bx) > 1);
}

/**
 * ¿El producto pertenece al catálogo maestro? Se identifica por tener
 * un estado de línea definido en el API enriquecido.
 */
export function esCatalogo(producto) {
  return (producto?.estado_linea || '').trim() !== '';
}

/**
 * ¿El producto está fuera del catálogo maestro? (sin estado de línea)
 */
export function esSinCatalogo(producto) {
  return !esCatalogo(producto);
}

/** Un producto vigente no está descontinuado ni inactivo en el ERP. */
export function esVigente(producto) {
  return !producto?.descontinuado && producto?.vigente !== false;
}

/** Universo accionable: catálogo maestro + vigente (sin descontinuados). */
export function productosBase(productos) {
  return (productos || []).filter((p) => esCatalogo(p) && esVigente(p));
}

/** Alertas de reposición: SKUs base con menos de UMBRAL_BAJO_STOCK cajas. */
export function contarAlertas(productos, umbral = UMBRAL_BAJO_STOCK) {
  return productosBase(productos).filter((p) => (p.bx ?? 0) < umbral).length;
}

const REVISION_LABELS = {
  descontinuado: 'Descontinuado',
  revision_venta: 'Revisión venta',
  por_activar: 'Por activar',
  compromiso: 'Compromiso',
};

/**
 * Badge comercial según el campo `revision` que publica el backend
 * (descontinuado, revision_venta, por_activar, compromiso).
 * `sin_catalogo` se excluye: ya existe el badge "Sin catálogo".
 * @returns {{rev: string, label: string}|null}
 */
export function revisionBadge(producto) {
  const rev = (producto?.revision || '').trim();
  if (!rev || rev === 'sin_catalogo') return null;
  return { rev, label: REVISION_LABELS[rev] || rev };
}

/**
 * Etiqueta de stock según el modo de venta del SKU:
 * cajas ("N bx") si vende por caja, unidades ("N u") si vende por unidad.
 * Las unidades solo se muestran cuando no alcanza una caja completa
 * (bx 0), para revisión granular (ej: "0 bx · 24 u").
 */
export function etiquetaStock(producto, stock = producto?.stock ?? 0) {
  if (esPorUnidades(producto)) return `${stock} u`;
  const bx = _getBx(producto);
  if (bx === 0) return stock > 0 ? `0 bx · ${stock} u` : '0 bx';
  return `${bx} bx`;
}

/**
 * Cajas que aportan al volumen total. Los SKUs por unidades aportan 0
 * (ya se contabilizan en unidades) para no inflar el total de cajas.
 */
export function cajasEfectivas(producto) {
  if (esPorUnidades(producto)) return 0;
  return _getBx(producto) || 0;
}

function _getBx(producto) {
  if (producto.bx !== undefined && producto.bx !== null) return producto.bx;
  return calculateBx(producto.stock ?? 0, producto.un_bx);
}

/**
 * Genera la lista de alertas (críticas y de advertencia) ordenadas.
 * Excluye SKUs descontinuados o no vigentes: no tiene sentido reponerlos.
 */
export function generateAlerts(productos, limit = null) {
  const alerts = [];
  for (const p of productos) {
    if (p.descontinuado || p.vigente === false) continue;
    const bx = _getBx(p);
    if (bx === 0) {
      alerts.push({ sku: p.sku, nombre: p.nombre, linea: p.linea,
        categoria: p.categoria, stock: p.stock ?? 0, bx, un_bx: p.un_bx || 1, type: 'critical' });
    } else if (bx < UMBRAL_BAJO_STOCK) {
      alerts.push({ sku: p.sku, nombre: p.nombre, linea: p.linea,
        categoria: p.categoria, stock: p.stock ?? 0, bx, un_bx: p.un_bx || 1, type: 'warning' });
    }
  }
  alerts.sort((a, b) => a.type !== b.type ? (a.type === 'critical' ? -1 : 1) : a.bx - b.bx);
  return limit ? alerts.slice(0, limit) : alerts;
}

/**
 * Calcula estadísticas agregadas del inventario.
 */
export function calculateStats(productos) {
  let conStock = 0, bajoStock = 0, sinStock = 0;
  for (const p of productos) {
    const bx = _getBx(p);
    if (bx === 0) sinStock++;
    else if (bx < UMBRAL_BAJO_STOCK) bajoStock++;
    else conStock++
  }
  return { total: productos.length, conStock, bajoStock, sinStock };
}

/**
 * Calcula KPIs optimizados usando los datos enriquecidos del API
 * (precio, peso_kg, estado_linea, un_bx).
 * Retorna valor de inventario, peso total, cajas, desglose por
 * estado de línea y disponibilidad porcentual.
 */
export function calculateKPIs(productos) {
  let valorInventario = 0;
  let pesoTotal = 0;
  let cajasTotal = 0;
  let unidades = 0;
  const porEstadoLinea = {};
  const porCategoria = {};
  const conPrecio = [];
  const sinPrecio = [];

  for (const p of productos) {
    const stock = p.stockFisico ?? p.stock ?? 0;
    unidades += stock;

    valorInventario += stock * (p.precio || 0);
    pesoTotal += stock * (p.peso_kg || 0);
    cajasTotal += cajasEfectivas(p);

    const estado = (p.estado_linea || 'SIN DEFINIR').trim();
    porEstadoLinea[estado] = (porEstadoLinea[estado] || 0) + 1;

    const cat = p.categoria || 'SIN CATEGORIA';
    if (!porCategoria[cat]) {
      porCategoria[cat] = { skus: 0, valor: 0, peso: 0, cajas: 0, unidades: 0 };
    }
    porCategoria[cat].skus += 1;
    porCategoria[cat].unidades += stock;
    porCategoria[cat].valor += stock * (p.precio || 0);
    porCategoria[cat].peso += stock * (p.peso_kg || 0);
    porCategoria[cat].cajas += cajasEfectivas(p);

    if (p.precio && p.precio > 0) conPrecio.push(p);
    else sinPrecio.push(p);
  }

  // Unidades que no deberían existir (stock sin precio de lista)
  const unidadesSinPrecio = sinPrecio.reduce((s, p) => s + (p.stockFisico ?? p.stock ?? 0), 0);

  const estados = Object.entries(porEstadoLinea)
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, skus]) => ({ nombre, skus }));

  return {
    valorInventario,
    pesoTotalKg: pesoTotal,
    cajasTotal,
    unidades,
    porEstadoLinea: estados,
    estadoLineaTotal: Object.keys(porEstadoLinea).length,
    categoriasTotales: Object.keys(porCategoria).length,
    porCategoria: Object.entries(porCategoria)
      .sort((a, b) => b[1].skus - a[1].skus)
      .map(([nombre, v]) => ({ nombre, ...v })),
    conPrecio: conPrecio.length,
    sinPrecio: sinPrecio.length,
    unidadesSinPrecio,
  };
}
