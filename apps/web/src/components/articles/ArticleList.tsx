import type { ArticleList as ArticleListType, VersionRef } from '@fbr/contracts';
import { configurationStatusLabels } from '@fbr/contracts';

export interface ArticleListProps {
  data: ArticleListType;
  onOpenArticle(ref: VersionRef): void;
  onCreateVideo(ref: VersionRef): void;
  onPageChange(offset: number): void;
}

export function ArticleList({
  data,
  onOpenArticle,
  onCreateVideo,
  onPageChange,
}: ArticleListProps) {
  const { items, total, offset, limit } = data;

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  const startRecord = total === 0 ? 0 : offset + 1;
  const endRecord = Math.min(offset + items.length, total);

  return (
    <div className="article-list-wrapper">
      <div className="article-list-container">
        <table className="article-table">
          <caption className="sr-only">Lista de artigos disponíveis</caption>
          <thead>
            <tr>
              <th scope="col">Título</th>
              <th scope="col">Autora</th>
              <th scope="col">Revisão</th>
              <th scope="col">Personagem</th>
              <th scope="col">Situação</th>
              <th scope="col" className="col-actions">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const { article, eligibility, needs_capture_review } = item;
              const ref: VersionRef = { id: article.id, version: article.version };
              const statusLabel =
                configurationStatusLabels[article.status] ?? article.status;
              const characterText = article.character
                ? `${article.character.id} (v${article.character.version})`
                : 'Autoria pendente';

              return (
                <tr
                  key={`${article.id}-v${article.version}`}
                  className={needs_capture_review ? 'row-capture-review' : ''}
                >
                  <td className="cell-title">
                    <div className="article-title-text">{article.title}</div>
                    {needs_capture_review && (
                      <div className="capture-review-notice">
                        ⚠️ Captura incompleta — requer revisão de conteúdo
                      </div>
                    )}
                    {article.source.url && (
                      <div className="article-source-url">
                        Fonte: {article.source.url}
                      </div>
                    )}
                  </td>
                  <td className="cell-author">{article.source_author}</td>
                  <td className="cell-version">v{article.version}</td>
                  <td className="cell-character">{characterText}</td>
                  <td className="cell-status">
                    <span className={`status-badge status-${article.status}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <div className="actions-group">
                      <button
                        type="button"
                        className="btn-action btn-open-article"
                        onClick={() => onOpenArticle(ref)}
                      >
                        Abrir artigo
                      </button>

                      {eligibility.allowed ? (
                        <button
                          type="button"
                          className="btn-action btn-create-video"
                          onClick={() => onCreateVideo(ref)}
                        >
                          Criar vídeo
                        </button>
                      ) : (
                        <div className="action-blocked-wrapper">
                          <button
                            type="button"
                            className="btn-action btn-create-video btn-disabled"
                            disabled
                            aria-disabled="true"
                            title={eligibility.blockers.map((b) => b.message).join(' | ')}
                          >
                            Criar vídeo
                          </button>
                          {eligibility.blockers.length > 0 && (
                            <span className="blocker-hint">
                              {eligibility.blockers[0]?.message}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <nav className="pagination-nav" aria-label="Paginação de artigos">
          <div className="pagination-info">
            Mostrando {startRecord}–{endRecord} de {total} artigos
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn-pagination"
              disabled={!hasPrev}
              onClick={() => onPageChange(prevOffset)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn-pagination"
              disabled={!hasNext}
              onClick={() => onPageChange(nextOffset)}
            >
              Próximo
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
