import { AssetSchema, TimelineSchema, EvaluationSchema, ApprovalSchema, type AssetStore,
  type Asset, type Timeline, type Evaluation, type Approval, type VersionRef } from '@fbr/contracts';
import { ApplicationError, sameRef } from '@fbr/domain';
import type { SqlClient, SqlDatabase } from './configuration-store.js';

const schemas = { asset: AssetSchema, timeline: TimelineSchema, evaluation: EvaluationSchema, approval: ApprovalSchema };
export type MediaKind = keyof typeof schemas;
type MediaRecord = Asset | Timeline | Evaluation | Approval;
export interface MediaWrite { kind: MediaKind; record: unknown; expected_version: number | null }
async function read(client: SqlClient, kind: MediaKind, ref: VersionRef, productionId?: string): Promise<MediaRecord | null> {
  const result = await client.query(`SELECT r.record FROM media_revisions r JOIN media_heads h USING(kind,id)
    WHERE r.kind=$1 AND r.id=$2 AND r.version=$3 AND ($4::text IS NULL OR h.production_id=$4)`, [kind, ref.id, ref.version, productionId ?? null]);
  return result.rows[0] ? schemas[kind].parse(result.rows[0].record) : null;
}
/** Batch atômico permite registrar asset/avaliação da mesma revisão sem estados parcialmente aprovados. */
export class PostgresMediaStore {
  constructor(private readonly db: SqlDatabase, private readonly files: AssetStore) {}
  get(kind: MediaKind, ref: VersionRef, productionId?: string) { return read(this.db, kind, ref, productionId); }
  async commit(productionId: string, writes: MediaWrite[]) {
    return this.db.transaction(client=>this.commitWithin(client,productionId,writes));
  }
  // Uso interno: o chamador mantém a transação que publica mídia e produção juntas.
  async commitWithin(client: SqlClient, productionId: string, writes: MediaWrite[]) {
    const records = writes.map(write => ({ ...write, record: schemas[write.kind].parse(write.record) }));
    if (!records.length) throw new ApplicationError('validation', 'Registro de mídia vazio.');
    if (new Set(records.map(write => `${write.kind}:${write.record.id}`)).size !== records.length)
      throw new ApplicationError('validation', 'Batch repete a mesma entidade de mídia.');
    for (const write of records) {
      if (write.record.version !== (write.expected_version ?? 0) + 1) throw new ApplicationError('conflict', 'Revisão de mídia não segue a anterior.');
      if (write.kind === 'asset' && !await this.files.exists(write.record as Asset)) throw new ApplicationError('ineligible', 'Arquivo ausente ou corrompido.');
    }
      // Serializa operações da produção e dá ordem consistente aos locks de entidades compartilhadas.
      if (!(await client.query('SELECT id FROM production_heads WHERE id=$1 FOR UPDATE', [productionId])).rows[0])
        throw new ApplicationError('not_found', 'Produção não encontrada.');
      for (const write of [...records].sort((a, b) => `${a.kind}:${a.record.id}`.localeCompare(`${b.kind}:${b.record.id}`))) {
        if (write.expected_version === null) await client.query('INSERT INTO media_heads(kind,id,production_id,version) VALUES($1,$2,$3,0) ON CONFLICT DO NOTHING', [write.kind, write.record.id, productionId]);
        const head = (await client.query('SELECT production_id,version FROM media_heads WHERE kind=$1 AND id=$2 FOR UPDATE', [write.kind, write.record.id])).rows[0];
        if (!head || head.production_id !== productionId || Number(head.version) !== (write.expected_version ?? 0))
          throw new ApplicationError('conflict', 'Mídia alterada por outra operação ou pertencente a outra produção.');
        await client.query('INSERT INTO media_revisions(kind,id,version,record) VALUES($1,$2,$3,$4::jsonb)', [write.kind, write.record.id, write.record.version, JSON.stringify(write.record)]);
        await client.query('UPDATE media_heads SET version=$3 WHERE kind=$1 AND id=$2', [write.kind, write.record.id, write.record.version]);
      }
      for (const write of records) await this.validate(client, productionId, write.kind, write.record);
      return records.map(write => write.record);
  }
  private async validate(client: SqlClient, productionId: string, kind: MediaKind, record: MediaRecord) {
    if (kind === 'asset') {
      const asset = record as Asset;
      if (asset.status === 'approved') {
        let approved = false;
        for (const ref of asset.evaluation_refs) {
          const evaluation = await read(client, 'evaluation', ref, productionId) as Evaluation | null;
          if (!evaluation || !sameRef(evaluation.target, asset)) throw new ApplicationError('ineligible', 'Avaliação não corresponde à revisão do arquivo.');
          approved ||= evaluation.status === 'approved' && evaluation.method !== 'model_signal';
        }
        if (!approved) throw new ApplicationError('ineligible', 'Arquivo não possui avaliação aprovada.');
      }
    }
    if (kind === 'evaluation') {
      const evaluation = record as Evaluation;
      if (!await read(client, 'asset', evaluation.target, productionId) && !await read(client, 'timeline', evaluation.target, productionId))
        throw new ApplicationError('ineligible', 'Avaliação aponta para revisão ausente ou de outra produção.');
    }
    if (kind === 'timeline') {
      const timeline = record as Timeline;
      if (timeline.production.id !== productionId || !(await client.query('SELECT 1 FROM production_revisions WHERE id=$1 AND version=$2', [productionId, timeline.production.version])).rows[0])
        throw new ApplicationError('ineligible', 'Timeline não corresponde à revisão da produção.');
      if (['ready', 'rendered'].includes(timeline.status)) for (const segment of [...timeline.audio, ...timeline.video, ...timeline.music]) {
        const asset = await read(client, 'asset', segment.asset, productionId) as Asset | null;
        if (!asset || asset.status !== 'approved' || !await this.files.exists(asset)) throw new ApplicationError('ineligible', 'Timeline utiliza arquivo ausente, inválido ou de outra produção.');
        const head = (await client.query("SELECT version FROM media_heads WHERE kind='asset' AND id=$1 AND production_id=$2", [asset.id, productionId])).rows[0];
        if (Number(head?.version) !== asset.version) throw new ApplicationError('ineligible', 'Nova timeline não pode reutilizar revisão de asset substituída.');
        if ('shot' in segment ? !['image', 'clip'].includes(asset.type) : asset.type !== 'audio')
          throw new ApplicationError('ineligible', 'Tipo de arquivo incompatível com a trilha.');
        if ('source_out_seconds' in segment && asset.type !== 'image' && (asset.file.duration_seconds === null || segment.source_out_seconds > asset.file.duration_seconds))
          throw new ApplicationError('ineligible', 'Recorte da timeline excede a duração medida do arquivo.');
      }
    }
    if (kind === 'approval') {
      const approval = record as Approval;
      if (approval.status === 'active' && approval.kind === 'final') {
        const target = await read(client, 'asset', approval.target, productionId) as Asset | null;
        if (!target || target.type !== 'render' || target.status !== 'approved' || !await this.files.exists(target))
          throw new ApplicationError('ineligible', 'Aprovação final exige render íntegro e avaliado da revisão exata.');
        const head = (await client.query("SELECT version FROM media_heads WHERE kind='asset' AND id=$1 AND production_id=$2", [target.id, productionId])).rows[0];
        if (Number(head?.version) !== target.version) throw new ApplicationError('ineligible', 'Aprovação final não pode apontar para render substituído.');
      }
      if (approval.status === 'active') for (const ref of approval.evaluation_refs) {
        const evaluation = await read(client, 'evaluation', ref, productionId) as Evaluation | null;
        if (!evaluation || evaluation.status !== 'approved' || evaluation.method !== 'human' || !sameRef(evaluation.target, approval.target))
          throw new ApplicationError('ineligible', 'Aprovação exige avaliação humana da revisão exata.');
      }
    }
  }
}
