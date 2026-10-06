import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';

// Desenvolvimento apenas: cluster persistente, sem instalar serviços nem criar usuários do SO.
const directory = resolve('var/postgres-native');
await new Promise<void>((ready, fail) => {
  const probe = createServer();
  probe.once('error', () => fail(new Error('Porta 55432 indisponível. Se dev:db já estiver ativo, use a instância existente.')));
  probe.listen(55432, '127.0.0.1', () => probe.close(error => error ? fail(error) : ready()));
});
mkdirSync(directory, { recursive: true });
const database = new EmbeddedPostgres({ databaseDir: directory, user: 'fbr', password: 'fbr_local_only',
  port: 55432, persistent: true, authMethod: 'scram-sha-256', createPostgresUser: false,
  initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {}, onError: () => {} });
if (!existsSync(resolve(directory, 'PG_VERSION'))) await database.initialise();
await database.start();
const client = database.getPgClient('postgres', '127.0.0.1');
await client.connect();
for (const name of ['fbr', 'fbr_s1_test']) {
  const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!found.rowCount) await client.query(`CREATE DATABASE ${name}`);
}
const result = await client.query<{ version: string }>('SELECT version()');
console.log(result.rows[0]?.version);
await client.end();
if (!existsSync('.env')) writeFileSync('.env', 'DATABASE_URL=postgresql://fbr:fbr_local_only@127.0.0.1:55432/fbr\n', { flag: 'wx' });
console.log('PostgreSQL local pronto em 127.0.0.1:55432; cluster persistente em var/postgres-native.');
console.log('Ctrl+C encerra o processo e preserva os dados.');
