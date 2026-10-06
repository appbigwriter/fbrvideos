import type { ProductionSummaryProps } from '@fbr/contracts';

export function ProductionSummary({
  data,
  loading,
  error,
  onRetry,
}: ProductionSummaryProps) {
  if (loading) {
    return (
      <aside className="production-summary-box production-summary-loading" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Carregando resumo da produção...</span>
      </aside>
    );
  }

  if (error && !loading) {
    return (
      <aside className="production-summary-box production-summary-error" role="alert">
        <div className="error-message-content">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <p className="error-text">{error}</p>
        </div>
        <button type="button" className="btn-retry" onClick={onRetry}>
          Tentar novamente
        </button>
      </aside>
    );
  }

  if (!data) {
    return (
      <aside className="production-summary-box production-summary-empty" role="status">
        <p className="empty-title">Resumo indisponível</p>
        <p className="empty-subtitle">
          Selecione um artigo e perfil para visualizar o resumo dos parâmetros.
        </p>
      </aside>
    );
  }

  const { article, profile, mode, budget_label, estimate_label, blockers } = data;
  const isCalibration = mode === 'calibration';

  return (
    <aside className="production-summary-box" aria-label="Resumo dos parâmetros de produção">
      <div className="summary-header">
        <h3 className="summary-title">Resumo do Planejamento</h3>
        <span className={`summary-mode-badge ${isCalibration ? 'mode-calibration' : 'mode-recurring'}`}>
          {isCalibration ? 'Modo Calibração' : 'Modo Recorrente'}
        </span>
      </div>

      <div className="summary-sections">
        <div className="summary-item">
          <span className="summary-item-label">Artigo selecionado:</span>
          <div className="summary-item-value">
            <span className="item-title">{article.title}</span>
            <span className="item-version"> (v{article.ref.version})</span>
          </div>
        </div>

        <div className="summary-item">
          <span className="summary-item-label">Perfil de produção:</span>
          <div className="summary-item-value">
            {profile ? (
              <>
                <span className="item-title">{profile.name}</span>
                <span className="item-version"> (v{profile.ref.version})</span>
              </>
            ) : (
              <span className="item-pending-text">Nenhum perfil selecionado</span>
            )}
          </div>
        </div>

        <div className="summary-item">
          <span className="summary-item-label">Orçamento e margem:</span>
          <div className="summary-item-value">
            {budget_label ? (
              <span>{budget_label}</span>
            ) : (
              <span className="item-pending-text">Sem orçamento definido</span>
            )}
          </div>
        </div>

        <div className="summary-item">
          <span className="summary-item-label">Estimativa de custos:</span>
          <div className="summary-item-value">
            <span className="item-estimate-text">{estimate_label}</span>
          </div>
        </div>
      </div>

      <div className="summary-blockers-section">
        <h4 className="blockers-heading">
          {blockers.length > 0 ? 'Impedimentos para planejamento' : 'Status de elegibilidade'}
        </h4>

        {blockers.length > 0 ? (
          <ul className="blockers-list" aria-label="Lista de impedimentos">
            {blockers.map((blocker, index) => (
              <li key={`${blocker.code}-${index}`} className="blocker-item">
                <span className="blocker-icon" aria-hidden="true">⛔</span>
                <div className="blocker-details">
                  <p className="blocker-message">{blocker.message}</p>
                  <p className="blocker-action">
                    <strong>Próxima ação:</strong> {blocker.next_action}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="no-blockers-notice">
            <span className="check-icon" aria-hidden="true">✓</span>
            <span>Nenhum impedimento identificado para o planejamento.</span>
          </div>
        )}
      </div>
    </aside>
  );
}
