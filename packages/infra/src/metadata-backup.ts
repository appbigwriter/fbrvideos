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
const version10Tables={...version9Tables,provider_http_intents:['adapter_id','execution_key','attempt','production_id','fingerprint','record']} as const;
const version11Tables={...version10Tables,
  assembly_runs:['command_id','fingerprint','production_id','production_version','state','lease_token','started_at','result','diagnostic','heartbeat_at'],
  calibration_observations:['id','version','production_id','production_version','profile_id','profile_version','fingerprint','record'],
  calibration_profile_decisions:['id','profile_id','profile_version','report_hash','record'],
  provider_normalized_receipts:['adapter_id','external_id','execution_key','attempt','record'],
  provider_callback_inbox:['adapter_id','event_id','execution_id','payload_hash','received_at','processed_at','attempts','lease_until','lease_token','next_attempt_at','diagnostic'],
  provider_quotes:['adapter_id','execution_key','attempt','record'],
  pipeline_commands:['command_id','production_id','fingerprint','result'],
  source_edit_audits:['command_id','production_id','record'],
  synthetic_generation_results:['external_id','production_id','fingerprint','record'],
  production_budget_commands:['command_id','production_id','fingerprint','record','result'],
} as const;
const tables={...version11Tables,assembly_evidence:['command_id','production_id','record'],operational_samples:['id','recorded_at','record']} as const;
const rowSchemas = Object.fromEntries(Object.entries(tables).map(([name, columns]) => [name,
  z.array(z.strictObject(Object.fromEntries(columns.map(column => [column, z.json()]))))]));
const legacyRows = Object.fromEntries(Object.keys(legacyTables).map(name=>[name,rowSchemas[name]!]));
const LegacyBackupContentSchema = z.strictObject({ format:z.literal('fbr-metadata-5'),created_at:TimestampSchema,
  includes_asset_bytes:z.literal(false),tables:z.strictObject(legacyRows) });
const version6Rows=Object.fromEntries(Object.keys(version6Tables).map(name=>[name,rowSchemas[name]!]));
const Version6BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-6'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version6Rows)});
const version7Rows=Object.fromEntries(Object.keys(version7Tables).map(name=>[name,rowSchemas[name]!]));
const Version7BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-7'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version7Rows)});
const version8Rows=Object.fromEntries(Object.entries(version8Tables).map(([name,columns])=>[name,z.array(z.strictObject(Object.fromEntries(columns.map(column=>[column,z.json()]))))]));
const Version8BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-8'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version8Rows)});
const version9Rows=Object.fromEntries(Object.entries(version9Tables).map(([name,columns])=>[name,z.array(z.strictObject(Object.fromEntries(columns.map(column=>[column,z.json()]))))]));
const Version9BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-9'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version9Rows)});
const version10Rows=Object.fromEntries(Object.entries(version10Tables).map(([name,columns])=>[name,z.array(z.strictObject(Object.fromEntries(columns.map(column=>[column,z.json()]))))]));
const Version10BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-10'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version10Rows)});
const version11Rows=Object.fromEntries(Object.entries(version11Tables).map(([name,columns])=>[name,z.array(z.strictObject(Object.fromEntries(columns.map(column=>[column,z.json()]))))]));
const Version11BackupContentSchema=z.strictObject({format:z.literal('fbr-metadata-11'),created_at:TimestampSchema,includes_asset_bytes:z.literal(false),tables:z.strictObject(version11Rows)});
const BackupContentSchema = z.strictObject({ format: z.literal('fbr-metadata-12'), created_at: TimestampSchema,
  includes_asset_bytes: z.literal(false), tables: z.strictObject(rowSchemas) });
export const MetadataBackupSchema = z.union([BackupContentSchema.extend({ hash: HashSchema }),Version11BackupContentSchema.extend({hash:HashSchema}),Version10BackupContentSchema.extend({hash:HashSchema}),Version9BackupContentSchema.extend({hash:HashSchema}),Version8BackupContentSchema.extend({hash:HashSchema}),Version7BackupContentSchema.extend({hash:HashSchema}),Version6BackupContentSchema.extend({hash:HashSchema}),LegacyBackupContentSchema.extend({ hash: HashSchema })]);
export type MetadataBackup = z.infer<typeof MetadataBackupSchema>;

export async function captureMetadataBackup(db: SqlDatabase): Promise<MetadataBackup> {
  return db.transaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const content: Record<string, unknown> = {};
    for (const [table, columns] of Object.entries(tables)) {
      const rows = (await client.query(`SELECT ${columns.join(',')} FROM ${table} ORDER BY ${columns[0]}`)).rows;
      content[table] = JSON.parse(JSON.stringify(rows));
    }
    const payload = BackupContentSchema.parse({ format: 'fbr-metadata-12', created_at: new Date().toISOString(), includes_asset_bytes: false, tables: content });
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
      const present=columns.filter(column=>column in row);
      const values = present.map(column => {
        const value = row[column];
        return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
      });
      await client.query(`INSERT INTO ${table}(${present.join(',')}) VALUES(${present.map((_column, i) => `$${i + 1}`).join(',')})`, values);
      restored++;
    }
    return restored;
  });
}
