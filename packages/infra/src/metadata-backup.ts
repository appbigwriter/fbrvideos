import { z } from 'zod';
import { canonical, sha256 } from '@fbr/domain';
import { HashSchema, TimestampSchema } from '@fbr/contracts';
import type { SqlDatabase } from './configuration-store.js';

// Ordem inclui as dependências das foreign keys. Transporte pg-boss é reconstruível a partir do journal.
const legacyTables = {
  character_bibles: ['hash', 'original'],
  configuration_heads: ['kind', 'id', 'version'],
  configuration_revisions: ['kind', 'id', 'version', 'record'],
  configuration_commands: ['command_id', 'fingerprint', 'result'],
  production_heads: ['id', 'version'],
  production_revisions: ['id', 'version', 'record'],
  production_snapshots: ['production_id', 'record'],
  production_events: ['id', 'production_id', 'version', 'record'],
  production_dossiers: ['id', 'version', 'record'],
  production_commands: ['command_id', 'fingerprint', 'result'],
  planning_inferences: ['execution_key', 'fingerprint', 'state', 'started_at', 'result'],
  generation_heads: ['id', 'production_id', 'execution_key', 'attempt', 'fingerprint', 'version'],
  generation_revisions: ['id', 'version', 'record'],
  media_heads: ['kind', 'id', 'production_id', 'version'],
  media_revisions: ['kind', 'id', 'version', 'record'],
} as const;
const version6Tables = { ...legacyTables,
  review_commands: ['command_id','fingerprint','result'],
  review_point_heads: ['id','production_id','version'],
  review_point_revisions: ['id','version','record'],
  delivery_manifests: ['id','production_id','render_id','render_version','storage_key','hash','record'],
} as const;
const version7Tables={...version6Tables,correction_proposal_heads:['id','production_id','point_id','version'],correction_proposal_revisions:['id','version','record']} as const;
const version8Tables={...version7Tables,assembly_runs:['command_id','fingerprint','production_id','production_version','state','lease_token','started_at','result','diagnostic']} as const;
const version9Tables={...version8Tables,correction_execution_plans:['id','correction_id','production_id','hash','record']} as const;
const tables={...version9Tables,provider_http_intents:['adapter_id','execution_key','attempt','production_id','fingerprint','record']} as const;
const rowSchemas = Object.fromEntries(Object.entries(tables).map(([name, columns]) => [name,
  z.array(z.strictObject(Object.fromEntries(columns.map(column => [column, z.json()]))))]));
const legacyRows = Object.fromEntries(Object.keys(legacyTables).map(name=>[name,rowSchemas[name]!]));
const LegacyBackupContentSchema = z.strictObject({ format:z.literal('fbr-metadata-5'),created_at:TimestampSchema,
  includes_asset_bytes:z.literal(false),tables:z.strictObject(legacyRows) });
const version6Rows=Object.fromEntries(Object.keys(version6Tables).map(name=>[name,rowSchemas[name]!]));
const Version6BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-6'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version6Rows)});
const version7Rows=Object.fromEntries(Object.keys(version7Tables).map(name=>[name,rowSchemas[name]!]));
const Version7BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-7'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version7Rows)});
const version8Rows=Object.fromEntries(Object.keys(version8Tables).map(name=>[name,rowSchemas[name]!]));
const Version8BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-8'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version8Rows)});
const version9Rows=Object.fromEntries(Object.keys(version9Tables).map(name=>[name,rowSchemas[name]!]));
const Version9BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-9'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version9Rows)});
const BackupContentSchema = z.strictObject({ format: z.literal('fbr-metadata-10'), created_at: TimestampSchema,
  includes_asset_bytes: z.literal(false), tables: z.strictObject(rowSchemas) });
export const MetadataBackupSchema = z.union([BackupContentSchema.extend({ hash: HashSchema }),Version9BackupContentSchema.extend({hash:HashSchema}),Version8BackupContentSchema.extend({hash:HashSchema}),Version7BackupContentSchema.extend({hash:HashSchema}),Version6BackupContentSchema.extend({hash:HashSchema}),LegacyBackupContentSchema.extend({ hash: HashSchema })]);
export type MetadataBackup = z.infer<typeof MetadataBackupSchema>;

export async function captureMetadataBackup(db: SqlDatabase): Promise<MetadataBackup> {
  return db.transaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const content: Record<string, unknown> = {};
    for (const [table, columns] of Object.entries(tables)) {
      const rows = (await client.query(`SELECT ${columns.join(',')} FROM ${table} ORDER BY ${columns[0]}`)).rows;
      content[table] = JSON.parse(JSON.stringify(rows));
    }
    const payload = BackupContentSchema.parse({ format: 'fbr-metadata-10', created_at: new Date().toISOString(), includes_asset_bytes: false, tables: content });
    return MetadataBackupSchema.parse({ ...payload, hash: sha256(canonical(payload)) });
  });
}
/** Só restaura em tabelas vazias e migradas. Não apaga nem substitui dados do destino. */
export async function restoreMetadataBackup(db: SqlDatabase, raw: unknown) {
  const backup = MetadataBackupSchema.parse(raw), { hash, ...payload } = backup;
  if (hash !== sha256(canonical(payload))) throw new Error('metadata_backup_hash_mismatch');
  return db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(6401201)');
    for (const table of Object.keys(tables)) await client.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
    for (const table of Object.keys(tables)) if ((await client.query(`SELECT 1 FROM ${table} LIMIT 1`)).rows.length)
      throw new Error('metadata_restore_requires_empty_database');
    let restored = 0;
    for (const [table, columns] of Object.entries(tables)) for (const row of backup.tables[table]??[]) {
      const values = columns.map(column => {
        const value = row[column];
        return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
      });
      await client.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_column, i) => `$${i + 1}`).join(',')})`, values);
      restored++;
    }
    return restored;
  });
}
