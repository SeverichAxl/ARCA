import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MOCK_DOMAINS,
  evaluateDemoCheck,
  getActiveMockDomains,
  getMockErrorFor,
  getMockLatencyMs,
  parseMockDomains,
  parseMockErrorConfig,
} from '../src/lib/api/mock-status';

function withEnv(name: string, value: string | undefined, run: () => void): void {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

test('parseMockDomains no activa mocks por defecto cuando la variable no existe', () => {
  assert.deepEqual(parseMockDomains(undefined), [...DEFAULT_MOCK_DOMAINS]);
  assert.deepEqual(parseMockDomains(undefined), []);
  assert.equal(DEFAULT_MOCK_DOMAINS.includes('contratos'), false);
});

test('planillas puede activarse explícitamente como dominio simulado', () => {
  assert.equal(DEFAULT_MOCK_DOMAINS.includes('planillas'), false);
  assert.deepEqual(parseMockDomains('planillas'), ['planillas']);
});

test('parseMockDomains acepta lista, normaliza y descarta desconocidos', () => {
  assert.deepEqual(parseMockDomains('contratos, planillas'), ['contratos', 'planillas']);
  assert.deepEqual(parseMockDomains('CONTRATOS;desconocido;contratos'), ['contratos']);
});

test('una cadena vacía desactiva todos los mocks', () => {
  assert.deepEqual(parseMockDomains(''), []);
  assert.deepEqual(parseMockDomains('   '), []);
});

test('los sentinelas none/off/false/0 desactivan los mocks en Windows', () => {
  for (const value of ['none', 'off', 'false', '0', 'NONE']) {
    assert.deepEqual(parseMockDomains(value), [], `Sentinel ${value}`);
  }
});

test('getActiveMockDomains lee NEXT_PUBLIC_API_MOCKS', () => {
  withEnv('NEXT_PUBLIC_API_MOCKS', '', () => {
    assert.deepEqual(getActiveMockDomains(), []);
  });
  withEnv('NEXT_PUBLIC_API_MOCKS', 'planillas', () => {
    assert.deepEqual(getActiveMockDomains(), ['planillas']);
  });
  withEnv('NEXT_PUBLIC_API_MOCKS', undefined, () => {
    assert.deepEqual(getActiveMockDomains(), []);
  });
});

test('parseMockErrorConfig interpreta error global y por dominio', () => {
  assert.deepEqual(parseMockErrorConfig('409'), [{ domain: null, status: 409 }]);
  assert.deepEqual(parseMockErrorConfig('contratos:409,planillas:500'), [
    { domain: 'contratos', status: 409 },
    { domain: 'planillas', status: 500 },
  ]);
  assert.deepEqual(parseMockErrorConfig('418,otro:500'), []);
});

test('getMockErrorFor prioriza la configuración por dominio', () => {
  withEnv('NEXT_PUBLIC_API_MOCK_ERROR', '500,contratos:409', () => {
    assert.equal(getMockErrorFor('contratos'), 409);
    assert.equal(getMockErrorFor('planillas'), 500);
  });
});

test('getMockLatencyMs es determinista y queda entre 200 y 600 ms', () => {
  withEnv('NEXT_PUBLIC_API_MOCK_LATENCY', undefined, () => {
    const first = getMockLatencyMs('list:1');
    const second = getMockLatencyMs('list:1');
    assert.equal(first, second);
    assert.ok(first >= 200 && first <= 600);
  });
});

test('NEXT_PUBLIC_API_MOCK_LATENCY=0 desactiva la latencia', () => {
  withEnv('NEXT_PUBLIC_API_MOCK_LATENCY', '0', () => {
    assert.equal(getMockLatencyMs('cualquier-semilla'), 0);
  });
});

test('evaluateDemoCheck falla solo cuando hay dominios simulados', () => {
  assert.deepEqual(evaluateDemoCheck([]), {
    ok: true,
    message: 'Sin dominios simulados: listo para demo con backend real.',
  });
  const active = evaluateDemoCheck(['contratos', 'planillas']);
  assert.equal(active.ok, false);
  assert.match(active.message, /contratos/);
  assert.match(active.message, /planillas/);
});
