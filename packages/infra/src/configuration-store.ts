import { readFile } from 'node:fs/promises';
import pg from 'pg';
import type { EntityKind } from '@fbr/contracts';
import { ApplicationError, recordSchemas, type ConfigurationStore, type ConfigurationTransaction, type ConfigurationRecord } from '@fbr/domain';

export interface SqlClient { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; }
export interface SqlDatabase extends SqlClient { transaction<T>(run: (client: SqlClient) => Promise<T>): Promise<T>; }

export class PostgresDatabase implements SqlDatabase {
  private readonly pool: pg.Pool;
  constructor(connectionString: string, onIdleError: (code: 'postgres_idle_connection_lost') => void = code => console.error(code)) {
    this.pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000, max: 5 });
    // pg remove o client desconectado; o listener evita erro não tratado e mantém detalhes da conexão fora dos logs.
    this.pool.on('error', () => onIdleError('postgres_idle_connection_lost'));
  }
  async query(sql: string, values?: unknown[]) { return this.pool.query(sql, values); }
  async transaction<T>(run: (client: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await run(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async close(): Promise<void> { await this.pool.end(); }
}
export async function migrateConfiguration(db: SqlDatabase): Promise<void> {
  const sql = await readFile(new URL('../migrations/001_configuration.sql', import.meta.url), 'utf8');
  const productions = await readFile(new URL('../migrations/002_productions.sql', import.meta.url), 'utf8');
  const inference = await readFile(new URL('../migrations/003_planning_inference.sql', import.meta.url), 'utf8');
  const generation = await readFile(new URL('../migrations/004_generation_queue.sql', import.meta.url), 'utf8');
  const media = await readFile(new URL('../migrations/005_media_records.sql', import.meta.url), 'utf8');
  const review = await readFile(new URL('../migrations/006_review_workflow.sql', import.meta.url), 'utf8');
  const corrections = await readFile(new URL('../migrations/007_correction_proposals.sql', import.meta.url), 'utf8');
  const assembly = await readFile(new URL('../migrations/008_local_assembly.sql', import.meta.url), 'utf8');
  const execution = await readFile(new URL('../migrations/009_correction_execution.sql', import.meta.url), 'utf8');
  const httpIntents = await readFile(new URL('../migrations/010_provider_http_intents.sql', import.meta.url), 'utf8');
  const operations=await readFile(new URL('../migrations/011_operations.sql',import.meta.url),'utf8');
  const providerEvents=await readFile(new URL('../migrations/012_provider_events.sql',import.meta.url),'utf8');
  const pipeline=await readFile(new URL('../migrations/013_pipeline.sql',import.meta.url),'utf8');
  const budget=await readFile(new URL('../migrations/014_budget.sql',import.meta.url),'utf8');
  const evidence=await readFile(new URL('../migrations/015_runtime_evidence.sql',import.meta.url),'utf8');
  await db.transaction(async client => { await client.query('SELECT pg_advisory_xact_lock(6401201)'); await client.query(sql); await client.query(productions); await client.query(inference); await client.query(generation); await client.query(media); await client.query(review); await client.query(corrections); await client.query(assembly); await client.query(execution); await client.query(httpIntents);await client.query(operations);await client.query(providerEvents);await client.query(pipeline);await client.query(budget);await client.query(evidence); });
}
export function configurationReader(client: SqlClient) {
  return {
    async get(kind: EntityKind, id: string, version?: number): Promise<ConfigurationRecord | null> {
      const result = version === undefined
        ? await client.query('SELECT r.record FROM configuration_revisions r JOIN configuration_heads h USING(kind,id,version) WHERE r.kind=$1 AND r.id=$2', [kind,id])
        : await client.query('SELECT record FROM configuration_revisions WHERE kind=$1 AND id=$2 AND version=$3', [kind,id,version]);
      return result.rows[0] ? recordSchemas[kind].parse(result.rows[0].record) : null;
    },
    async list(kind: EntityKind): Promise<ConfigurationRecord[]> {
      const result = await client.query('SELECT r.record FROM configuration_revisions r JOIN configuration_heads h USING(kind,id,version) WHERE r.kind=$1 ORDER BY r.id', [kind]);
      return result.rows.map(row => recordSchemas[kind].parse(row.record));
    },
    async bible(hash: string): Promise<string | null> {
      const result = await client.query('SELECT original FROM character_bibles WHERE hash=$1', [hash]);
      return typeof result.rows[0]?.original === 'string' ? result.rows[0].original : null;
    },
  };
}
export class PostgresConfigurationStore implements ConfigurationStore {
  constructor(private readonly db: SqlDatabase) {}
  get(kind: EntityKind, id: string, version?: number) { return configurationReader(this.db).get(kind,id,version); }
  list(kind: EntityKind) { return configurationReader(this.db).list(kind); }
  bible(hash: string) { return configurationReader(this.db).bible(hash); }
  async command(commandId: string, fingerprint: string, run: (tx: ConfigurationTransaction) => Promise<ConfigurationRecord>): Promise<ConfigurationRecord> {
    return this.db.transaction(async client => {
      await client.query('INSERT INTO configuration_commands(command_id,fingerprint) VALUES ($1,$2) ON CONFLICT DO NOTHING', [commandId,fingerprint]);
      const existing = (await client.query('SELECT fingerprint,result FROM configuration_commands WHERE command_id=$1 FOR UPDATE', [commandId])).rows[0]!;
      if (existing.fingerprint !== fingerprint) throw new ApplicationError('conflict', 'O comando já foi usado com outros dados.');
      if (existing.result !== null) return existing.result as ConfigurationRecord;
      const tx: ConfigurationTransaction = {
        ...configurationReader(client),
        async saveBible(hash, original) { await client.query('INSERT INTO character_bibles(hash,original) VALUES ($1,$2) ON CONFLICT DO NOTHING', [hash,original]); },
        async append(kind, record, expected) {
          if (expected === null) await client.query('INSERT INTO configuration_heads(kind,id,version) VALUES ($1,$2,0) ON CONFLICT DO NOTHING', [kind,record.id]);
          const result = await client.query('UPDATE configuration_heads SET version=$3 WHERE kind=$1 AND id=$2 AND version=$4 RETURNING version', [kind,record.id,record.version,expected ?? 0]);
          if (result.rowCount !== 1) throw new ApplicationError('conflict', 'Outra edição alterou a versão. Recarregue antes de salvar.');
          await client.query('INSERT INTO configuration_revisions(kind,id,version,record) VALUES ($1,$2,$3,$4::jsonb)', [kind,record.id,record.version,JSON.stringify(record)]);
        },
      };
      const record = await run(tx);
      await client.query('UPDATE configuration_commands SET result=$2::jsonb WHERE command_id=$1', [commandId,JSON.stringify(record)]);
      return record;
    });
  }
}
