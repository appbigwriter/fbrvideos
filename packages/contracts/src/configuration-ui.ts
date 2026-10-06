import type { ArticleList, Universe, Character, Reference } from './configuration.js';
import type { Article, VersionRef } from './schemas.js';

export interface ArticleFilters { q: string; source_author: string; character_id: string; status: Article['status'] | ''; }
export interface SelectOption { value: string; label: string; disabled?: boolean; }
export interface ArticlesPanelProps {
  data: ArticleList; filters: ArticleFilters; author_options: readonly SelectOption[]; character_options: readonly SelectOption[];
  loading: boolean; error: string | null;
  onFiltersChange(filters: ArticleFilters): void;
  onOpenArticle(ref: VersionRef): void;
  onCreateVideo(ref: VersionRef): void;
  onImport(): void;
  onRetry(): void;
  onPageChange(offset: number): void;
}
export type UniverseTab = 'characters' | 'environments' | 'wardrobe_props' | 'styles' | 'voices';
export type UniverseSelection = { kind: 'character' | 'reference'; ref: VersionRef } | null;
export interface UniversePanelProps {
  data: Universe; tab: UniverseTab; selected: UniverseSelection; loading: boolean; error: string | null;
  onTabChange(tab: UniverseTab): void;
  onSelect(selection: UniverseSelection): void;
  onOpenBible(ref: VersionRef): void;
  onRetry(): void;
}
export const universeTabs: readonly { id: UniverseTab; label: string; reference_kinds: readonly Reference['kind'][] }[] = [
  { id:'characters',label:'Personagens',reference_kinds:['character'] },
  { id:'environments',label:'Ambientes',reference_kinds:['environment'] },
  { id:'wardrobe_props',label:'Figurinos e objetos',reference_kinds:['wardrobe','prop'] },
  { id:'styles',label:'Estilos',reference_kinds:['style','composition'] },
  { id:'voices',label:'Vozes',reference_kinds:['voice'] },
];
export const configurationStatusLabels = {
  imported:'Importado', incomplete:'Captura incompleta', association_pending:'Autoria pendente', available:'Disponível', source_changed:'Origem alterada',
  draft:'Rascunho', confirmed:'Confirmado', archived:'Arquivado', pending:'Pendente', approved:'Aprovado', calibrating:'Em calibração', validated:'Validado', suspended:'Suspenso',
} as const;
export function selectedUniverseRecord(data: Universe, selection: UniverseSelection): Character | Reference | null {
  if (!selection) return null;
  const records = selection.kind === 'character' ? data.characters : data.references;
  return records.find(record => record.id === selection.ref.id && record.version === selection.ref.version) ?? null;
}
export interface FieldBaseProps { id: string; label: string; help: string | null; error: string | null; disabled: boolean; required: boolean; }
export interface TextFieldProps extends FieldBaseProps { value: string; onChange(value: string): void; }
export interface SelectFieldProps extends TextFieldProps { options: readonly SelectOption[]; placeholder: string; }
export interface CheckboxFieldProps extends FieldBaseProps { checked: boolean; onChange(checked: boolean): void; }
export interface FormActionsProps { pending: boolean; can_submit: boolean; submit_label: string; blocked_reason: string | null; onCancel(): void; }
export const profileFieldDescriptions = [
  { id:'name',label:'Nome',help:'Nome reutilizável do perfil.' },
  { id:'character',label:'Personagem',help:'Selecionar uma versão confirmada.' },
  { id:'language',label:'Idioma',help:'Idioma da produção.' },
  { id:'target_seconds',label:'Duração-alvo',help:'Proposta sujeita à calibração e ao áudio efetivo.' },
  { id:'recipe',label:'Receita',help:'Estrutura audiovisual candidata.' },
  { id:'voice',label:'Voz',help:'Referência vocal; cadastro não comprova integração ou qualidade.' },
  { id:'budget',label:'Orçamento',help:'Moeda, teto, margem e tentativas definidos pelo operador.' },
] as const;
