import type { ShotDetailsProps, VersionRef } from '@fbr/contracts';

export function ShotDetails({ shot }: ShotDetailsProps) {
  const {
    id,
    version,
    route,
    shot_class,
    intent,
    duration,
    visual,
    references,
    continuity_in,
    continuity_out,
    dependencies,
    constraints,
    risks,
    mandatory_criteria,
    fallback,
  } = shot;

  const resolvedDurationText =
    duration.resolved_seconds !== null
      ? `${duration.resolved_seconds}s (resolvida)`
      : 'Duração real pendente';

  const targetDurationText =
    duration.target_seconds !== null
      ? `${duration.target_seconds}s (alvo/estimativa)`
      : 'Duração alvo não definida';

  // Coleta referências não nulas
  const activeRefs: { label: string; ref: VersionRef }[] = [];
  if (references.character) activeRefs.push({ label: 'Personagem', ref: references.character });
  if (references.environment) activeRefs.push({ label: 'Ambiente', ref: references.environment });
  if (references.wardrobe) activeRefs.push({ label: 'Figurino', ref: references.wardrobe });
  if (references.style) activeRefs.push({ label: 'Estilo', ref: references.style });
  if (references.composition) activeRefs.push({ label: 'Composição', ref: references.composition });
  references.props.forEach((prop, i) => {
    activeRefs.push({ label: `Objeto #${i + 1}`, ref: prop });
  });

  return (
    <details className="shot-details-card" id={`shot-${id}`}>
      <summary className="shot-summary">
        <div className="shot-summary-header">
          <span className="shot-id-tag">{id} (v{version})</span>
          <span className={`shot-route-badge route-${route}`}>{route}</span>
          <span className="shot-class-badge">{shot_class}</span>
        </div>
        <div className="shot-summary-timing">
          <span className="timing-target">{targetDurationText}</span>
          <span className="timing-divider">·</span>
          <span className="timing-resolved">{resolvedDurationText}</span>
        </div>
      </summary>

      <div className="shot-details-body">
        <div className="shot-meta-grid">
          <div className="shot-meta-item full-width">
            <span className="meta-label">Intenção visual:</span>
            <p className="meta-text">{intent}</p>
          </div>

          <div className="shot-meta-item full-width">
            <span className="meta-label">Ação e movimento:</span>
            <p className="meta-text">{visual.action}</p>
            <p className="meta-subtext">
              <strong>Câmera:</strong> {visual.camera} ({visual.camera_motion}) | <strong>Sujeito:</strong> {visual.subject_motion}
            </p>
          </div>

          <div className="shot-meta-item">
            <span className="meta-label">Enquadramento e layout:</span>
            <p className="meta-text">{visual.framing} — {visual.layout}</p>
            <p className="meta-subtext"><strong>Iluminação:</strong> {visual.lighting}</p>
          </div>

          <div className="shot-meta-item">
            <span className="meta-label">Área segura de legenda:</span>
            <p className="meta-text">{visual.subtitle_safe_area}</p>
          </div>

          <div className="shot-meta-item">
            <span className="meta-label">Estado inicial:</span>
            <p className="meta-text">{visual.initial_state}</p>
          </div>

          <div className="shot-meta-item">
            <span className="meta-label">Estado final:</span>
            <p className="meta-text">{visual.final_state}</p>
          </div>

          <div className="shot-meta-item full-width">
            <span className="meta-label">Continuidade e dependências:</span>
            <p className="meta-text">
              <strong>Entrada:</strong> {continuity_in.length > 0 ? continuity_in.join('; ') : 'Não registrada'}
            </p>
            <p className="meta-text">
              <strong>Saída:</strong> {continuity_out.length > 0 ? continuity_out.join('; ') : 'Não registrada'}
            </p>
            {dependencies.length > 0 && (
              <p className="meta-subtext">
                <strong>Depende dos planos:</strong> {dependencies.map((d) => `${d.id} (v${d.version})`).join(', ')}
              </p>
            )}
          </div>

          <div className="shot-meta-item">
            <span className="meta-label">Elementos visuais obrigatórios:</span>
            <ul className="meta-list">
              {visual.required_elements.map((el, i) => (
                <li key={i}>{el}</li>
              ))}
            </ul>
          </div>

          <div className="shot-meta-item">
            <span className="meta-label">Referências vinculadas:</span>
            {activeRefs.length > 0 ? (
              <ul className="meta-list">
                {activeRefs.map((r, i) => (
                  <li key={i}>
                    <strong>{r.label}:</strong> {r.ref.id} (v{r.ref.version})
                  </li>
                ))}
              </ul>
            ) : (
              <span className="meta-empty-text">Nenhuma referência específica</span>
            )}
            <p className="meta-empty-text">{[
              ['Personagem', references.character], ['Ambiente', references.environment],
              ['Figurino', references.wardrobe], ['Estilo', references.style], ['Composição', references.composition],
            ].filter(([, ref]) => !ref).map(([label]) => `${label}: sem referência`).join(' · ')}</p>
          </div>

          <div className="shot-meta-item">
            <span className="meta-label">Restrições e riscos:</span>
            <ul className="meta-list">
              {constraints.map((res, i) => (
                <li key={`res-${i}`} className="restriction-item">🚫 {res}</li>
              ))}
              {risks.map((risk, i) => (
                <li key={`risk-${i}`} className="risk-item">⚠️ {risk}</li>
              ))}
              {constraints.length === 0 && risks.length === 0 && (
                <li className="meta-empty-text">Nenhuma restrição registrada</li>
              )}
            </ul>
          </div>

          <div className="shot-meta-item">
            <span className="meta-label">Critérios obrigatórios:</span>
            <ul className="meta-list">
              {mandatory_criteria.map((crit, i) => (
                <li key={i} className="criteria-item">{crit}</li>
              ))}
            </ul>
          </div>
        </div>

        {fallback && (
          <div className={`shot-fallback-box ${fallback.changes_narrative_intent ? 'fallback-intent-shift' : ''}`}>
            <h5 className="fallback-title">Plano de Contingência / Fallback</h5>
            <p className="fallback-details">
              <strong>Rota alternativa:</strong> {fallback.route}
            </p>
            <p className="fallback-reason">
              <strong>Descrição:</strong> {fallback.description}
            </p>
            {fallback.changes_narrative_intent && (
              <div className="fallback-warning-notice">
                ⚠️ <strong>Atenção:</strong> Este fallback altera a intenção narrativa original e requer revisão prévia antes da execução.
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
