import type { ChangeEvent } from 'react';
import type { ArticleFilters as ArticleFiltersType, SelectOption } from '@fbr/contracts';
import { configurationStatusLabels } from '@fbr/contracts';

export interface ArticleFiltersProps {
  filters: ArticleFiltersType;
  author_options: readonly SelectOption[];
  character_options: readonly SelectOption[];
  onFiltersChange(filters: ArticleFiltersType): void;
  onImport(): void;
}

const statusOptions: readonly { value: ArticleFiltersType['status']; label: string }[] = [
  { value: '', label: 'Todas as situações' },
  { value: 'available', label: configurationStatusLabels.available },
  { value: 'imported', label: configurationStatusLabels.imported },
  { value: 'association_pending', label: configurationStatusLabels.association_pending },
  { value: 'incomplete', label: configurationStatusLabels.incomplete },
  { value: 'source_changed', label: configurationStatusLabels.source_changed },
];

export function ArticleFilters({
  filters,
  author_options,
  character_options,
  onFiltersChange,
  onImport,
}: ArticleFiltersProps) {
  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, q: e.target.value });
  };

  const handleAuthorChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, source_author: e.target.value });
  };

  const handleCharacterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, character_id: e.target.value });
  };

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      status: e.target.value as ArticleFiltersType['status'],
    });
  };

  return (
    <section className="article-filters-section" aria-label="Filtros e ações de artigos">
      <div className="filters-row">
        <div className="filter-field filter-search">
          <label htmlFor="article-search" className="filter-label">
            Buscar artigos
          </label>
          <input
            id="article-search"
            type="search"
            className="filter-input"
            placeholder="Buscar por título ou conteúdo..."
            value={filters.q}
            onChange={handleQueryChange}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="filter-author" className="filter-label">
            Autora
          </label>
          <select
            id="filter-author"
            className="filter-select"
            value={filters.source_author}
            onChange={handleAuthorChange}
          >
            <option value="">Todas as autoras</option>
            {author_options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="filter-character" className="filter-label">
            Personagem
          </label>
          <select
            id="filter-character"
            className="filter-select"
            value={filters.character_id}
            onChange={handleCharacterChange}
          >
            <option value="">Todas as personagens</option>
            {character_options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="filter-status" className="filter-label">
            Situação
          </label>
          <select
            id="filter-status"
            className="filter-select"
            value={filters.status}
            onChange={handleStatusChange}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filters-actions">
          <button
            type="button"
            className="btn-import-article"
            onClick={onImport}
          >
            Importar artigo
          </button>
        </div>
      </div>
    </section>
  );
}
