import type { Character, Reference, UniverseSelection, VersionRef } from '@fbr/contracts';
import { configurationStatusLabels } from '@fbr/contracts';

export interface UniverseDetailsProps {
  record: Character | Reference | null;
  selection: UniverseSelection;
  onSelect(selection: UniverseSelection): void;
  onOpenBible(ref: VersionRef): void;
}

function isCharacterRecord(record: Character | Reference, selection: UniverseSelection): record is Character {
  return selection?.kind === 'character';
}

export function UniverseDetails({
  record,
  selection,
  onSelect,
  onOpenBible,
}: UniverseDetailsProps) {
  if (!record || !selection) {
    return (
      <aside className="universe-details universe-details-empty" aria-label="Detalhes da seleção">
        <div className="details-empty-content">
          <span className="details-empty-icon" aria-hidden="true">ℹ️</span>
          <p className="details-empty-text">
            Selecione um personagem ou referência ao lado para visualizar informações e diretrizes completas.
          </p>
        </div>
      </aside>
    );
  }

  const isChar = isCharacterRecord(record, selection);
  const statusLabel = configurationStatusLabels[record.status] ?? record.status;
  const versionRef: VersionRef = { id: record.id, version: record.version };

  return (
    <aside className="universe-details" aria-label={`Detalhes de ${record.name}`}>
      <div className="details-header">
        <div className="details-header-main">
          <span className="details-badge-kind">
            {isChar ? 'Personagem' : `Referência: ${record.kind}`}
          </span>
          <h3 className="details-title">{record.name}</h3>
          <div className="details-meta-row">
            <span className="details-version">v{record.version}</span>
            <span className={`status-badge status-${record.status}`}>{statusLabel}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn-close-details"
          onClick={() => onSelect(null)}
          aria-label="Fechar detalhes"
        >
          ✕
        </button>
      </div>

      <div className="details-media-fallback" aria-label="Visualização de mídia">
        <span className="media-placeholder-icon" aria-hidden="true">🖼️</span>
        <span className="media-placeholder-label">Sem mídia disponível</span>
      </div>

      <div className="details-body">
        {isChar ? (
          <>
            <section className="details-section">
              <h4 className="section-heading">Interpretação e Bible</h4>
              <div className="interpretation-box">
                <p className="interpretation-text">{record.bible.interpretation}</p>
                <div className="interpretation-status">
                  {record.bible.interpretation_confirmed ? (
                    <span className="badge-confirmed">✓ Interpretação confirmada</span>
                  ) : (
                    <span className="badge-pending">⏳ Interpretação pendente</span>
                  )}
                </div>
              </div>
              <p className="bible-distinction-notice">
                Nota: A interpretação acima é uma síntese operacional e não substitui o Bible original.
              </p>
              <button
                type="button"
                className="btn-open-bible"
                onClick={() => onOpenBible(versionRef)}
              >
                📖 Consultar Bible original
              </button>
            </section>

            <section className="details-section">
              <h4 className="section-heading">Voz e Referências Vinculadas</h4>
              <div className="linked-info-item">
                <span className="info-label">Voz:</span>
                <span className="info-value">
                  {record.voice
                    ? `${record.voice.id} (v${record.voice.version})`
                    : 'Nenhuma voz associada'}
                </span>
              </div>
              <div className="linked-info-item">
                <span className="info-label">Referências:</span>
                <span className="info-value">
                  {record.references.length > 0
                    ? record.references.map((r) => `${r.id} (v${r.version})`).join(', ')
                    : 'Nenhuma referência associada'}
                </span>
              </div>
            </section>

            <section className="details-section">
              <h4 className="section-heading">Variações Autorizadas</h4>
              {record.authorized_variations.length > 0 ? (
                <ul className="variations-list">
                  {record.authorized_variations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Nenhuma variação registrada.</p>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="details-section">
              <h4 className="section-heading">Direitos e Permissão de Uso</h4>
              <div className="linked-info-item">
                <span className="info-label">Permissão:</span>
                <span className="info-value">{record.usage_permission}</span>
              </div>
            </section>

            <section className="details-section">
              <h4 className="section-heading">Regras e Diretrizes</h4>
              {record.rules.length > 0 ? (
                <ul className="rules-list">
                  {record.rules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Nenhuma regra definida.</p>
              )}
            </section>

            <section className="details-section">
              <h4 className="section-heading">Ativos Vinculados</h4>
              {record.asset_refs.length > 0 ? (
                <ul className="assets-list">
                  {record.asset_refs.map((a, idx) => (
                    <li key={idx}>
                      {a.id} (v{a.version})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Nenhum ativo associado.</p>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
