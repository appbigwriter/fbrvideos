import type {
  Character,
  Reference,
  UniversePanelProps,
  UniverseTab,
} from '@fbr/contracts';
import {
  configurationStatusLabels,
  selectedUniverseRecord,
  universeTabs,
} from '@fbr/contracts';
import { UniverseDetails } from './UniverseDetails.js';

export function UniversePanel({
  data,
  tab,
  selected,
  loading,
  error,
  onTabChange,
  onSelect,
  onOpenBible,
  onRetry,
}: UniversePanelProps) {
  const currentTabConfig = universeTabs.find((t) => t.id === tab) ?? universeTabs[0]!;
  const activeRecord = selectedUniverseRecord(data, selected);

  // Filtragem dos registros da aba ativa
  const characterItems: Character[] = tab === 'characters' ? data.characters : [];
  const referenceItems: Reference[] = data.references.filter((ref) =>
    currentTabConfig.reference_kinds.includes(ref.kind),
  );

  const isTabEmpty = characterItems.length === 0 && referenceItems.length === 0;

  return (
    <div className="universe-panel">
      <nav className="universe-tabs-nav" aria-label="Abas do Universo">
        <div className="universe-tabs-list" role="tablist">
          {universeTabs.map((t) => {
            const isActive = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${t.id}`}
                className={`universe-tab-button ${isActive ? 'universe-tab-active' : ''}`}
                onClick={() => onTabChange(t.id as UniverseTab)}
              >
                <span className="tab-indicator" aria-hidden="true" />
                <span className="tab-label">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {loading && (
        <div className="universe-status-box universe-loading" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span>Carregando elementos do Universo...</span>
        </div>
      )}

      {error && !loading && (
        <div className="universe-status-box universe-error" role="alert">
          <div className="error-message-content">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <p className="error-text">{error}</p>
          </div>
          <button type="button" className="btn-retry" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && (
        <div
          id={`tabpanel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="universe-content-layout"
        >
          <div className="universe-cards-column">
            {isTabEmpty ? (
              <div className="universe-empty-tab" role="status">
                <p className="empty-title">Nenhum registro nesta categoria</p>
                <p className="empty-subtitle">
                  Não há itens cadastrados para a seção “{currentTabConfig.label}”.
                </p>
              </div>
            ) : (
              <div className="universe-cards-grid">
                {characterItems.map((char) => {
                  const isSelected =
                    selected?.kind === 'character' &&
                    selected.ref.id === char.id &&
                    selected.ref.version === char.version;
                  const statusLabel =
                    configurationStatusLabels[char.status] ?? char.status;

                  return (
                    <article
                      key={`char-${char.id}-v${char.version}`}
                      className={`universe-card ${isSelected ? 'universe-card-selected' : ''}`}
                      onClick={() =>
                        onSelect({
                          kind: 'character',
                          ref: { id: char.id, version: char.version },
                        })
                      }
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect({
                            kind: 'character',
                            ref: { id: char.id, version: char.version },
                          });
                        }
                      }}
                    >
                      <div className="card-media-preview" aria-hidden="true">
                        <span className="preview-placeholder-icon">🎭</span>
                        <span className="preview-placeholder-text">Sem mídia disponível</span>
                      </div>
                      <div className="card-content">
                        <div className="card-badge-row">
                          <span className="badge-entity-type">Personagem</span>
                          <span className="card-version">v{char.version}</span>
                        </div>
                        <h4 className="card-title">{char.name}</h4>
                        <div className="card-status-row">
                          <span className={`status-badge status-${char.status}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {referenceItems.map((refItem) => {
                  const isSelected =
                    selected?.kind === 'reference' &&
                    selected.ref.id === refItem.id &&
                    selected.ref.version === refItem.version;
                  const statusLabel =
                    configurationStatusLabels[refItem.status] ?? refItem.status;

                  return (
                    <article
                      key={`ref-${refItem.id}-v${refItem.version}`}
                      className={`universe-card ${isSelected ? 'universe-card-selected' : ''}`}
                      onClick={() =>
                        onSelect({
                          kind: 'reference',
                          ref: { id: refItem.id, version: refItem.version },
                        })
                      }
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect({
                            kind: 'reference',
                            ref: { id: refItem.id, version: refItem.version },
                          });
                        }
                      }}
                    >
                      <div className="card-media-preview" aria-hidden="true">
                        <span className="preview-placeholder-icon">🖼️</span>
                        <span className="preview-placeholder-text">Sem mídia disponível</span>
                      </div>
                      <div className="card-content">
                        <div className="card-badge-row">
                          <span className="badge-entity-type">Ref: {refItem.kind}</span>
                          <span className="card-version">v{refItem.version}</span>
                        </div>
                        <h4 className="card-title">{refItem.name}</h4>
                        <div className="card-status-row">
                          <span className={`status-badge status-${refItem.status}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="universe-details-column">
            <UniverseDetails
              record={activeRecord}
              selection={selected}
              onSelect={onSelect}
              onOpenBible={onOpenBible}
            />
          </div>
        </div>
      )}
    </div>
  );
}
