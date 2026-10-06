import { createHash, randomUUID } from 'node:crypto';
import { ArticleSchema, CharacterSchema, ReferenceSchema, ProfileSchema,
  SaveArticleSchema, SaveCharacterSchema, SaveReferenceSchema, SaveProfileSchema, ImportUrlSchema, RefreshArticleSchema,
  type Article, type Character, type Reference, type Profile, type EntityKind, type VersionRef } from '@fbr/contracts';

export type ConfigurationRecord = Article | Character | Reference | Profile;
export class ApplicationError extends Error {
  constructor(public readonly code: 'validation' | 'not_found' | 'conflict' | 'ineligible' | 'attempts_exceeded' | 'provider_unknown' | 'budget_exceeded', message: string) { super(message); }
}
export interface ConfigurationReader {
  get(kind: EntityKind, id: string, version?: number): Promise<ConfigurationRecord | null>;
  list(kind: EntityKind): Promise<ConfigurationRecord[]>;
  bible(hash: string): Promise<string | null>;
}
export interface ConfigurationTransaction extends ConfigurationReader {
  append(kind: EntityKind, record: ConfigurationRecord, expected: number | null): Promise<void>;
  saveBible(hash: string, content: string): Promise<void>;
}
export interface ConfigurationStore extends ConfigurationReader {
  command(commandId: string, fingerprint: string, run: (tx: ConfigurationTransaction) => Promise<ConfigurationRecord>): Promise<ConfigurationRecord>;
}
export const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export const recordSchemas = { articles: ArticleSchema, characters: CharacterSchema, references: ReferenceSchema, profiles: ProfileSchema };
const commands = { articles: SaveArticleSchema, characters: SaveCharacterSchema, references: SaveReferenceSchema, profiles: SaveProfileSchema };

export class ConfigurationService {
  constructor(public readonly store: ConfigurationStore, private readonly author = 'local_operator') {}

  async importUrl(raw: unknown, capture: (url: string) => Promise<{ url: string; captured_at: string; title: string; source_author: string; content: string; images: Article['source_images'] }>, id?: string): Promise<Article> {
    const command = id ? RefreshArticleSchema.parse(raw) : ImportUrlSchema.parse(raw);
    const fingerprint = sha256(canonical({ action: id ? 'refresh_url' : 'import_url', id: id ?? null, command }));
    return this.store.command(command.command_id, fingerprint, async tx => {
      const old = id ? await tx.get('articles', id) as Article | null : null;
      if (id && !old) throw new ApplicationError('not_found', 'Artigo não encontrado.');
      if (old && ('expected_version' in command && old.version !== command.expected_version)) throw new ApplicationError('conflict', 'A versão do artigo mudou.');
      const url = old ? old.source.url : 'url' in command ? command.url : null;
      if (!url) throw new ApplicationError('ineligible', 'Artigo manual não possui URL para recaptura.');
      const result = await capture(url);
      const scopedStore: ConfigurationStore = { ...tx, command: async (_id, _fingerprint, run) => run(tx) };
      const service = new ConfigurationService(scopedStore, this.author);
      return service.save('articles', { command_id: command.command_id, expected_version: old?.version ?? null,
        reason: old ? 'Atualização da captura; revisão humana necessária.' : 'Importação por URL; revisão humana necessária.',
        data: { title: result.title, source_author: result.source_author, content: result.content, complete: false,
          character: old && old.source_author === result.source_author ? old.character : null },
      }, id, result);
    }) as Promise<Article>;
  }

  async save(kind: EntityKind, raw: unknown, id?: string, capture?: { url: string; captured_at: string; images: Article['source_images'] }): Promise<ConfigurationRecord> {
    const input = commands[kind].parse(raw);
    if ((id === undefined) !== (input.expected_version === null)) throw new ApplicationError('validation', 'Criação exige versão nula; revisão exige versão esperada.');
    const fingerprint = sha256(canonical({ kind, id: id ?? null, input, capture: capture ? { url: capture.url } : null }));
    return this.store.command(input.command_id, fingerprint, async tx => {
      const old = id ? await tx.get(kind, id) : null;
      if (id && !old) throw new ApplicationError('not_found', 'Registro não encontrado.');
      if (old && old.version !== input.expected_version) throw new ApplicationError('conflict', 'A versão mudou. Atualize o registro antes de salvar.');
      const now = new Date().toISOString();
      const base = { id: old?.id ?? randomUUID(), version: (old?.version ?? 0) + 1, created_at: now, author: this.author,
        changes: [...(old?.changes ?? []), { at: now, author: this.author, reason: input.reason }] };
      let record: ConfigurationRecord;
      if (kind === 'articles') {
        const data = SaveArticleSchema.parse(raw).data;
        if (data.character) await this.require(tx, 'characters', data.character, true);
        const previous = old as Article | null;
        const content = data.content.replace(/\r\n?/g, '\n').trim();
        record = ArticleSchema.parse({ ...base, ...data, content,
          status: !data.complete ? 'incomplete' : !data.character ? 'association_pending' : 'available',
          source: capture ? { kind: 'url', url: capture.url, captured_at: capture.captured_at } : previous?.source ?? { kind: 'manual', url: null, captured_at: now },
          source_images: capture?.images ?? previous?.source_images ?? [], content_hash: sha256(content),
          segments: content.split(/\n\s*\n/).filter(Boolean).map((text, index) => ({ id: `segment_${index + 1}`, text })),
        });
      } else if (kind === 'characters') {
        const { bible_original, interpretation, interpretation_confirmed, ...data } = SaveCharacterSchema.parse(raw).data;
        const previous = old as Character | null;
        if (!bible_original && !previous) throw new ApplicationError('validation', 'Informe o Character Bible original.');
        const hash = bible_original !== undefined ? sha256(bible_original) : previous!.bible.original_hash;
        if (bible_original !== undefined) await tx.saveBible(hash, bible_original);
        for (const ref of data.references) await this.require(tx, 'references', ref);
        if (data.voice) await this.requireVoice(tx, data.voice);
        record = CharacterSchema.parse({ ...base, ...data, bible: { original_uri: `/api/bibles/${hash}`, original_hash: hash, interpretation, interpretation_confirmed } });
      } else if (kind === 'references') {
        const data = SaveReferenceSchema.parse(raw).data;
        if (data.asset_refs.length) throw new ApplicationError('ineligible', 'Upload e vinculação de mídia serão disponibilizados na integração de assets.');
        record = ReferenceSchema.parse({ ...base, ...data });
      } else {
        const data = SaveProfileSchema.parse(raw).data;
        await this.require(tx, 'characters', data.character, true);
        for (const ref of data.permitted_references) await this.require(tx, 'references', ref);
        if (data.voice) await this.requireVoice(tx, data.voice);
        record = ProfileSchema.parse({ ...base, ...data });
      }
      await tx.append(kind, record, input.expected_version);
      return record;
    });
  }

  private async require(tx: ConfigurationReader, kind: EntityKind, ref: VersionRef, confirmed = false): Promise<ConfigurationRecord> {
    const record = await tx.get(kind, ref.id, ref.version);
    if (!record) throw new ApplicationError('ineligible', 'Referência aponta para registro ou versão inexistente.');
    if (record.status === 'archived' || (confirmed && record.status !== 'confirmed')) throw new ApplicationError('ineligible', 'Confirme a personagem e utilize referências não arquivadas.');
    return record;
  }
  private async requireVoice(tx: ConfigurationReader, ref: VersionRef): Promise<void> {
    const record = await this.require(tx, 'references', ref) as Reference;
    if (record.kind !== 'voice') throw new ApplicationError('ineligible', 'A referência de voz deve ser do tipo voice.');
  }
}

export function articleEligibility(article: Article) {
  const blockers = [];
  if (!article.complete) blockers.push({ code: 'source_incomplete', message: 'A captura precisa de revisão.', next_action: 'Corrigir o conteúdo e confirmar a captura completa.', required: true });
  if (!article.character) blockers.push({ code: 'author_unassigned', message: 'Autoria sem personagem associada.', next_action: 'Associar uma personagem confirmada.', required: true });
  return { allowed: blockers.length === 0, calibration_only: false, blockers };
}
