import { ProductionSchema, ProductionSnapshotSchema, ProductionEventSchema, DossierSchema,
  type Production, type ProductionSnapshot, type ProductionEvent, type Dossier } from '@fbr/contracts';
import { ApplicationError, type ProductionStore, type ProductionTransaction } from '@fbr/domain';
import { configurationReader, type SqlClient, type SqlDatabase } from './configuration-store.js';
function reader(client: SqlClient) {
  return {
    async get(id: string,version?: number) {
      const result = version === undefined ? await client.query('SELECT r.record FROM production_revisions r JOIN production_heads h USING(id,version) WHERE r.id=$1',[id])
        : await client.query('SELECT record FROM production_revisions WHERE id=$1 AND version=$2',[id,version]);
      return result.rows[0] ? ProductionSchema.parse(result.rows[0].record) : null;
    },
    async list() { const result = await client.query('SELECT r.record FROM production_revisions r JOIN production_heads h USING(id,version) ORDER BY r.record->>\'created_at\' DESC'); return result.rows.map(r => ProductionSchema.parse(r.record)); },
    async snapshot(id: string) { const result = await client.query('SELECT record FROM production_snapshots WHERE production_id=$1',[id]); return result.rows[0] ? ProductionSnapshotSchema.parse(result.rows[0].record) : null; },
    async dossier(ref: {id:string;version:number}) { const result = await client.query('SELECT record FROM production_dossiers WHERE id=$1 AND version=$2',[ref.id,ref.version]); return result.rows[0] ? DossierSchema.parse(result.rows[0].record) : null; },
    async events(id: string) { const result = await client.query('SELECT record FROM production_events WHERE production_id=$1 ORDER BY version',[id]); return result.rows.map(r => ProductionEventSchema.parse(r.record)); },
  };
}
export class PostgresProductionStore implements ProductionStore {
  constructor(private readonly db: SqlDatabase) {}
  get(id: string,version?: number) { return reader(this.db).get(id,version); }
  list() { return reader(this.db).list(); }
  snapshot(id: string) { return reader(this.db).snapshot(id); }
  dossier(ref: {id:string;version:number}) { return reader(this.db).dossier(ref); }
  events(id: string) { return reader(this.db).events(id); }
  async command(id: string,fingerprint: string,run: (tx: ProductionTransaction) => Promise<Production>) {
    return this.db.transaction(async client => {
      await client.query('INSERT INTO production_commands(command_id,fingerprint) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,fingerprint]);
      const existing = (await client.query('SELECT fingerprint,result FROM production_commands WHERE command_id=$1 FOR UPDATE',[id])).rows[0]!;
      if (existing.fingerprint !== fingerprint) throw new ApplicationError('conflict','Chave de comando já utilizada com outros dados.');
      if (existing.result !== null) return ProductionSchema.parse(existing.result);
      const tx: ProductionTransaction = {...reader(client),configuration:configurationReader(client),
        async saveSnapshot(snapshot: ProductionSnapshot) { await client.query('INSERT INTO production_snapshots(production_id,record) VALUES($1,$2::jsonb)',[snapshot.production_id,JSON.stringify(snapshot)]); },
        async saveDossier(dossier: Dossier) { await client.query('INSERT INTO production_dossiers(id,version,record) VALUES($1,$2,$3::jsonb)',[dossier.id,dossier.version,JSON.stringify(dossier)]); },
        async append(record: Production,expected: number|null,event: ProductionEvent) {
          if (expected === null) await client.query('INSERT INTO production_heads(id,version) VALUES($1,0) ON CONFLICT DO NOTHING',[record.id]);
          const updated = await client.query('UPDATE production_heads SET version=$2 WHERE id=$1 AND version=$3 RETURNING version',[record.id,record.version,expected ?? 0]);
          if (updated.rowCount !== 1) throw new ApplicationError('conflict','Outra operação alterou a produção.');
          await client.query('INSERT INTO production_revisions(id,version,record) VALUES($1,$2,$3::jsonb)',[record.id,record.version,JSON.stringify(record)]);
          await client.query('INSERT INTO production_events(id,production_id,version,record) VALUES($1,$2,$3,$4::jsonb)',[event.id,record.id,record.version,JSON.stringify(event)]);
        }};
      const result = await run(tx);
      await client.query('UPDATE production_commands SET result=$2::jsonb WHERE command_id=$1',[id,JSON.stringify(result)]);
      return result;
    });
  }
}
