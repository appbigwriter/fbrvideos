import type { DossierPanelProps } from '@fbr/contracts';
import { NarrativeBlocks } from './NarrativeBlocks.js';

export function DossierPanel({
  data,
  loading,
  error,
  onRetry,
}: DossierPanelProps) {
  if (loading) {
    return (
      <div className="dossier-panel-box dossier-loading" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Carregando planejamento e dossiê...</span>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="dossier-panel-box dossier-error" role="alert">
        <div className="error-message-content">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <p className="error-text">{error}</p>
        </div>
        <button type="button" className="btn-retry" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dossier-panel-box dossier-empty" role="status">
        <p className="empty-title">Planejamento ainda não disponível</p>
        <p className="empty-subtitle">
          O dossiê audiovisual será gerado automaticamente a partir do artigo e perfil selecionados.
        </p>
      </div>
    );
  }

  const { dossier, notice } = data;
  const { briefing, pending_issues, shots } = dossier;

  // Soma a duração-alvo estimada dos planos
  const totalTargetSeconds = shots.length > 0 && shots.every(s => s.duration.target_seconds !== null)
    ? shots.reduce((acc, s) => acc + s.duration.target_seconds!, 0) : null;

  return (
    <div className="dossier-panel">
      {notice && (
        <div className="dossier-notice-banner" role="note">
          <span className="notice-icon" aria-hidden="true">ℹ️</span>
          <span className="notice-text">{notice}</span>
        </div>
      )}

      <header className="dossier-overview-card">
        <div className="dossier-overview-header">
          <div className="dossier-title-meta">
            <span className="dossier-badge">Dossiê Técnico</span>
            <span className="dossier-version">v{dossier.version}</span>
            <span className={`status-badge status-${dossier.status}`}>{dossier.status}</span>
          </div>
          <div className="dossier-target-time">
            <span className="time-label">Duração estimada total:</span>
            <span className="time-val">
              {totalTargetSeconds !== null ? `${totalTargetSeconds}s` : 'Estimativa total indisponível'}
            </span>
          </div>
        </div>

        <div className="dossier-briefing-section">
          <h3 className="briefing-heading">Briefing e Objetivos</h3>
          <p className="briefing-text"><strong>Objetivo:</strong> {briefing.objective}</p>
          <p className="briefing-text"><strong>Público:</strong> {briefing.audience}</p>
          <p className="briefing-text"><strong>Mensagem central:</strong> {briefing.message}</p>
          <div className="briefing-guidelines">
            <span className="guideline-item">
              <strong>Situação narrativa:</strong> {briefing.narrative_situation}
            </span>
            <span className="guideline-item">
              <strong>Arco visual:</strong> {briefing.visual_arc}
            </span>
          </div>
          {briefing.omitted_content.length > 0 && <div><h4>Conteúdo omitido no planejamento</h4>
            <ul>{briefing.omitted_content.map((text,index) => <li key={index}>{text}</li>)}</ul></div>}
        </div>

        {pending_issues.length > 0 && (
          <div className="dossier-issues-section">
            <h3 className="issues-heading">Pendências do Dossiê</h3>
            <ul className="issues-list">
              {pending_issues.map((issue, idx) => (
                <li key={`${issue.code}-${idx}`} className="issue-item">
                  <span className="issue-icon" aria-hidden="true">⚠️</span>
                  <div className="issue-details">
                    <p className="issue-message">{issue.message}</p>
                    <p className="issue-action"><strong>Ação necessária:</strong> {issue.next_action}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <NarrativeBlocks data={data} />
    </div>
  );
}
