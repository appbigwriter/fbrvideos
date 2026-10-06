import { z } from 'zod';
import { ArticleSchema, CharacterSchema, ReferenceSchema, ProfileSchema, IdSchema, VersionRefSchema, EligibilitySchema } from './schemas.js';

const text = z.string().trim().min(1);
export const EntityKindSchema = z.enum(['articles', 'characters', 'references', 'profiles']);
export type EntityKind = z.infer<typeof EntityKindSchema>;
export const ArticleInputSchema = z.strictObject({
  title: text.max(500), source_author: text.max(300), content: text.max(500_000),
  complete: z.boolean(), character: VersionRefSchema.nullable(),
});
export const CharacterInputSchema = z.strictObject({
  name: text.max(300), status: z.enum(['draft', 'confirmed', 'archived']),
  bible_original: z.string().min(1).max(500_000).optional(), interpretation: text.max(100_000),
  interpretation_confirmed: z.boolean(), references: z.array(VersionRefSchema).max(100),
  voice: VersionRefSchema.nullable(), authorized_variations: z.array(text.max(2000)).max(100),
}).refine(v => v.status !== 'confirmed' || v.interpretation_confirmed, { message: 'Confirmar a interpretação antes de confirmar a personagem' });
export const ReferenceInputSchema = ReferenceSchema.omit({ id: true, version: true, created_at: true, author: true, changes: true })
  .extend({ status: z.enum(['pending', 'archived']), asset_refs: z.array(VersionRefSchema).max(100) });
export const ProfileInputSchema = z.strictObject(ProfileSchema.shape).omit({ id: true, version: true, created_at: true, author: true, changes: true })
  .extend({ status: z.enum(['draft', 'calibrating', 'suspended']) });
const command = { command_id: IdSchema, expected_version: z.int().positive().nullable(), reason: text.max(2000) };
export const SaveArticleSchema = z.strictObject({ ...command, data: ArticleInputSchema });
export const SaveCharacterSchema = z.strictObject({ ...command, data: CharacterInputSchema });
export const SaveReferenceSchema = z.strictObject({ ...command, data: ReferenceInputSchema });
export const SaveProfileSchema = z.strictObject({ ...command, data: ProfileInputSchema });
export const ImportUrlSchema = z.strictObject({ command_id: IdSchema, url: z.url().max(4000) });
export const RefreshArticleSchema = z.strictObject({ command_id: IdSchema, expected_version: z.int().positive() });
export const ArticleListItemSchema = z.strictObject({
  article: ArticleSchema, eligibility: EligibilitySchema, needs_capture_review: z.boolean(),
});
export const ArticleListSchema = z.strictObject({ items: z.array(ArticleListItemSchema), total: z.int().nonnegative(), offset: z.int().nonnegative(), limit: z.int().positive() });
export const UniverseSchema = z.strictObject({ characters: z.array(CharacterSchema), references: z.array(ReferenceSchema) });
export const ProfilesSchema = z.strictObject({ items: z.array(ProfileSchema) });
export const ArticleFilterOptionsSchema = z.strictObject({authors:z.array(z.string().min(1))});
export type ArticleList = z.infer<typeof ArticleListSchema>;
export type Universe = z.infer<typeof UniverseSchema>;
export type Profiles = z.infer<typeof ProfilesSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
export type ArticleInput = z.infer<typeof ArticleInputSchema>;
export type CharacterInput = z.infer<typeof CharacterInputSchema>;
export type ReferenceInput = z.infer<typeof ReferenceInputSchema>;
export type ProfileInput = z.infer<typeof ProfileInputSchema>;
export const configurationFields = {
  profile: ['name', 'character', 'language', 'target_seconds', 'recipe', 'permitted_shot_classes', 'permitted_references', 'voice', 'delivery', 'budget', 'status'] as const,
  reference: ['name', 'kind', 'rules', 'usage_permission', 'status'] as const,
};
