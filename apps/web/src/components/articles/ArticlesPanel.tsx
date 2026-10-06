import type { ArticlesPanelProps } from '@fbr/contracts';
import { ArticleFilters } from './ArticleFilters.js';
import { ArticleList } from './ArticleList.js';

export function ArticlesPanel({
  data,
  filters,
  author_options,
  character_options,
  loading,
  error,
  onFiltersChange,
  onOpenArticle,
  onCreateVideo,
  onImport,
  onRetry,
  onPageChange,
}: ArticlesPanelProps) {
  const isQueryFiltered =
    filters.q !== '' ||
    filters.source_author !== '' ||
    filters.character_id !== '' ||
    filters.status !== '';

  return (
    <div className="articles-panel">
      <ArticleFilters
        filters={filters}
        author_options={author_options}
        character_options={character_options}
        onFiltersChange={onFiltersChange}
        onImport={onImport}
      />

      {loading && (
        <div className="articles-status-box articles-loading" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span>Carregando artigos...</span>
        </div>
      )}

      {error && !loading && (
        <div className="articles-status-box articles-error" role="alert">
          <div className="error-message-content">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <p className="error-text">{error}</p>
          </div>
          <button type="button" className="btn-retry" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && data.items.length === 0 && (
        <div className="articles-empty-notice" role="status">
          <p className="empty-title">Nenhum artigo encontrado.</p>
          <p className="empty-subtitle">
            {isQueryFiltered
              ? 'Tente ajustar os termos de busca ou limpar os filtros aplicados.'
              : 'Nenhum artigo disponível no momento. Clique em "Importar artigo" para começar.'}
          </p>
        </div>
      )}

      {!loading && !error && data.items.length > 0 && (
        <ArticleList
          data={data}
          onOpenArticle={onOpenArticle}
          onCreateVideo={onCreateVideo}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
