import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function harness() {
  const storage = new Map([['swm-auth', JSON.stringify({ state: { accessToken: 'old-access', refreshToken: 'old-refresh' } })]]);
  let rejectResponse;
  let postCount = 0;
  let finishRefresh;
  const client = (config) => Promise.resolve({ config });
  client.interceptors = {
    request: { use() {} },
    response: { use(_ok, rejected) { rejectResponse = rejected; } },
  };
  const axios = {
    create: () => client,
    post: () => {
      postCount++;
      return new Promise((resolve) => { finishRefresh = resolve; });
    },
  };
  const source = readFileSync(new URL('../src/lib/api-base.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name) => { assert.equal(name, 'axios'); return axios; },
    process: { env: {} },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    window: { location: { origin: 'http://localhost', assign() { throw new Error('Unexpected login redirect'); } } },
  });
  return {
    exports, storage,
    reject: (url = '/subscriptions/') => rejectResponse({ response: { status: 401 }, config: { url, headers: { Authorization: 'Bearer old-access' } } }),
    finish: () => finishRefresh({ data: { access: 'new-access', refresh: 'new-refresh' } }),
    count: () => postCount,
  };
}

test('concurrent expired requests rotate once and persist the new refresh token', async () => {
  const app = harness();
  const notifications = [];
  app.exports.setAuthRefreshListener((access, refresh) => notifications.push([access, refresh]));
  const first = app.reject();
  const second = app.reject('/dashboard/');
  assert.equal(app.count(), 1);
  app.finish();
  const results = await Promise.all([first, second]);
  assert.equal(JSON.parse(app.storage.get('swm-auth')).state.refreshToken, 'new-refresh');
  assert.deepEqual(notifications, [['new-access', 'new-refresh']]);
  for (const result of results) assert.equal(result.config.headers.Authorization, 'Bearer new-access');
});

test('invalid login does not trigger token refresh', async () => {
  const app = harness();
  await assert.rejects(app.reject('/auth/token/'));
  assert.equal(app.count(), 0);
});
