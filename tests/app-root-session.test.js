// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/components/app-root.js';
import '../src/components/login-view.js';
import { loadSession, clearSession, saveSession } from '../src/core/session.js';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('app-root sesión y repintado', () => {
  it('sin sesión muestra login-view', async () => {
    const el = document.createElement('app-root');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector('login-view')).toBeTruthy();
  });

  it('login repinta la vista de app con await updateComplete', async () => {
    const el = document.createElement('app-root');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector('login-view')).toBeTruthy();

    // Simular sesión activa y login
    saveSession({ nombre: 'Carlos Cusi', email: 'carlos@cipsa.com.pe' });
    el._session = loadSession();
    await el.updateComplete;

    expect(el.shadowRoot.querySelector('login-view')).toBeNull();
    expect(el.shadowRoot.querySelector('stock-header')).toBeTruthy();
    expect(el.shadowRoot.querySelector('.data-status') || el.shadowRoot.querySelector('main')).toBeTruthy();
  });

  it('logout repinta la vista de login con await updateComplete', async () => {
    saveSession({ nombre: 'Carlos Cusi', email: 'carlos@cipsa.com.pe' });

    const el = document.createElement('app-root');
    document.body.appendChild(el);
    el._session = loadSession();
    await el.updateComplete;

    expect(el.shadowRoot.querySelector('login-view')).toBeNull();
    expect(el.shadowRoot.querySelector('stock-header')).toBeTruthy();

    el._onLogout();
    await el.updateComplete;

    expect(el.shadowRoot.querySelector('login-view')).toBeTruthy();
    expect(el.shadowRoot.querySelector('stock-header')).toBeNull();
    expect(loadSession()).toBeNull();
  });
});
