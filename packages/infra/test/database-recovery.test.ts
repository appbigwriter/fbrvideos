import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { PostgresDatabase } from '../src/configuration-store.js';

test('Conexão ociosa interrompida é descartada sem encerrar processo, e a próxima consulta reconecta', async t => {
  if (!process.env.TEST_DATABASE_URL) { t.skip('Requer PostgreSQL nativo em TEST_DATABASE_URL.'); return; }
  let resolveLost!: (code: string) => void, rejectLost!: (error: Error) => void;
  const lost = new Promise<string>((resolve, reject) => { resolveLost = resolve; rejectLost = reject; });
  const database = new PostgresDatabase(process.env.TEST_DATABASE_URL, code => resolveLost(code));
  const control = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const before = (await database.query('SELECT pg_backend_pid() AS pid')).rows[0]!;
    await control.connect();
    const controller = (await control.query('SELECT pg_backend_pid() AS pid')).rows[0]!;
    assert.notEqual(before.pid, controller.pid);
    // Interrompe somente a conexão obtida por este teste; não reinicia servidor nem outros clients.
    await control.query('SELECT pg_terminate_backend($1)', [before.pid]);
    timeout = setTimeout(() => rejectLost(new Error('idle_error_event_missing')), 3000);
    assert.equal(await lost, 'postgres_idle_connection_lost');
    const after = (await database.query('SELECT pg_backend_pid() AS pid, 42 AS value')).rows[0]!;
    assert.equal(after.value, 42); assert.notEqual(after.pid, before.pid);
  } finally { clearTimeout(timeout); await control.end(); await database.close(); }
});
