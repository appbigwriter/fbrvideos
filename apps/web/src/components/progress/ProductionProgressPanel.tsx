import type { ProductionView } from '@fbr/contracts';
import { ProductionStatus } from './ProductionStatus.js';
import { ProductionConsumption } from './ProductionConsumption.js';

export type ProgressPresentation = Pick<
  ProductionView,
  'ref' | 'name' | 'status' | 'stage' | 'costs' | 'pending_issues'
> & {
  actions: Pick<ProductionView['actions'], 'pause' | 'resume' | 'cancel'>;
  notice: string;
};

export interface ProductionProgressPanelProps {
  data: ProgressPresentation | null;
  loading: boolean;
  error: string | null;
  pending: boolean;
  command_error: string | null;
  onRetry(): void;
  onRefresh(): void;
  onPause(): void;
  onResume(): void;
  onCancel(): void;
}

export function ProductionProgressPanel({
  data,
  loading,
  error,
  pending,
  command_error,
  onRetry,
  onRefresh,
  onPause,
  onResume,
  onCancel,
}: ProductionProgressPanelProps) {
  if (loading) {
    return (
      <div className="production-progress-box production-progress-loading" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Carregando acompanhamento da produção...</span>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="production-progress-box production-progress-error" role="alert">
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
      <div className="production-progress-box production-progress-empty" role="status">
        <p className="empty-title">Acompanhamento ainda não disponível</p>
        <p className="empty-subtitle">
          Inicie ou selecione uma produção para acompanhar seu progresso e consumo.
        </p>
      </div>
    );
  }

  const { actions, notice, costs, ...statusData } = data;

  return (
    <div className="production-progress-panel">
      {notice && (
        <div className="production-progress-notice" role="note">
          <span className="notice-icon" aria-hidden="true">ℹ️</span>
          <span className="notice-text">{notice}</span>
        </div>
      )}

      <ProductionStatus data={statusData} />

      <ProductionConsumption costs={costs} />

      <section className="production-progress-card production-progress-actions" aria-label="Ações e comandos de produção">
        <h3 className="production-progress-subtitle">Comandos de Execução</h3>

        {command_error && (
          <div className="production-command-error" role="alert">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <p className="error-text">{command_error}</p>
          </div>
        )}

        <div className="commands-disclaimer-box" role="note">
          <p className="disclaimer-text">
            Pausar e cancelar não garantem interromper uma execução já enviada ao fornecedor. A disponibilidade das ações é definida pelo servidor.
          </p>
        </div>

        <div className="commands-buttons-grid">
          <div className="command-action-item">
            <button
              type="button"
              className="btn-command btn-refresh"
              disabled={pending}
              onClick={onRefresh}
            >
              Atualizar acompanhamento
            </button>
          </div>

          <div className="command-action-item">
            <button
              type="button"
              className="btn-command btn-pause"
              disabled={pending || !actions.pause.enabled}
              aria-disabled={pending || !actions.pause.enabled}
              onClick={onPause}
            >
              Pausar
            </button>
            {!actions.pause.enabled && actions.pause.reason && (
              <span className="action-disabled-reason">{actions.pause.reason}</span>
            )}
          </div>

          <div className="command-action-item">
            <button
              type="button"
              className="btn-command btn-resume"
              disabled={pending || !actions.resume.enabled}
              aria-disabled={pending || !actions.resume.enabled}
              onClick={onResume}
            >
              Retomar
            </button>
            {!actions.resume.enabled && actions.resume.reason && (
              <span className="action-disabled-reason">{actions.resume.reason}</span>
            )}
          </div>

          <div className="command-action-item">
            <button
              type="button"
              className="btn-command btn-cancel"
              disabled={pending || !actions.cancel.enabled}
              aria-disabled={pending || !actions.cancel.enabled}
              onClick={onCancel}
            >
              Cancelar
            </button>
            {!actions.cancel.enabled && actions.cancel.reason && (
              <span className="action-disabled-reason">{actions.cancel.reason}</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
