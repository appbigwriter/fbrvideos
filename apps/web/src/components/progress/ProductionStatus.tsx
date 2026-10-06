import type { ProductionView } from '@fbr/contracts';
import { productionStateLabels } from '@fbr/contracts';

export interface ProductionStatusProps {
  data: Pick<ProductionView, 'ref' | 'name' | 'status' | 'stage' | 'pending_issues'>;
}

const stageLabels: Record<ProductionView['stage'], string> = {
  preparation: 'Preparação',
  script_direction: 'Roteiro e direção',
  generation: 'Geração',
  assembly: 'Montagem',
  review: 'Revisão',
  delivery: 'Entrega',
};

export function ProductionStatus({ data }: ProductionStatusProps) {
  const { ref, name, status, stage, pending_issues } = data;
  const statusLabel = productionStateLabels[status] ?? status;
  const stageLabel = stageLabels[stage] ?? stage;

  return (
    <section className="production-progress-card production-progress-status" aria-label="Status da produção">
      <div className="production-progress-header">
        <div className="production-progress-title-meta">
          <h3 className="production-progress-name">{name}</h3>
          <span className="production-progress-version">v{ref.version}</span>
          <span className={`status-badge status-${status}`}>
            {statusLabel}
          </span>
        </div>
        <div className="production-progress-stage-badge">
          <span className="stage-label">Etapa atual:</span>
          <span className="stage-value">{stageLabel}</span>
        </div>
      </div>

      <div className="production-progress-issues-section">
        <h4 className="production-progress-subtitle">
          {pending_issues.length > 0 ? 'Pendências da Produção' : 'Status de Pendências'}
        </h4>

        {pending_issues.length > 0 ? (
          <ul className="production-progress-issues-list" aria-label="Lista de pendências">
            {pending_issues.map((issue, index) => (
              <li
                key={`${issue.code}-${index}`}
                className={`production-progress-issue-item ${issue.required ? 'issue-required' : ''}`}
              >
                <div className="issue-header-row">
                  <span className="issue-icon" aria-hidden="true">
                    {issue.required ? '⛔' : '⚠️'}
                  </span>
                  <span className="issue-message-text">{issue.message}</span>
                  {issue.required && (
                    <span className="issue-badge-required">Obrigatória</span>
                  )}
                </div>
                <div className="issue-action-row">
                  <span className="action-label">Próxima ação:</span>
                  <span className="action-text">{issue.next_action}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="production-progress-no-issues">
            <span className="check-icon" aria-hidden="true">✓</span>
            <span>Nenhuma pendência ativa nesta produção.</span>
          </div>
        )}
      </div>
    </section>
  );
}
