import type { DeliveryPanelProps } from '@fbr/contracts';
import { DeliverySummary } from './DeliverySummary.js';
import { DeliveryFiles } from './DeliveryFiles.js';

export function DeliveryPanel({
  data,
  loading,
  error,
  pending,
  command_error,
  onRetry,
  onExport,
}: DeliveryPanelProps) {
  if (loading) {
    return (
      <div className="delivery-panel delivery-box delivery-loading" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Carregando dados da entrega...</span>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="delivery-panel delivery-box delivery-error" role="alert">
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
      <div className="delivery-panel delivery-box delivery-empty" role="status">
        <p className="empty-title">Informações de entrega não disponíveis</p>
        <p className="empty-subtitle">
          Inicie uma produção e conclua suas etapas para ter acesso aos arquivos e pacotes de entrega.
        </p>
      </div>
    );
  }

  const { files, kind, export_action } = data;

  return (
    <div className="delivery-panel">
      <DeliverySummary data={data} />

      <DeliveryFiles files={files} kind={kind} />

      <section className="delivery-actions-card" aria-label="Ações de exportação do pacote final">
        <h4 className="delivery-actions-title">Pacote de Entrega</h4>

        {command_error && (
          <div className="delivery-command-error" role="alert">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <p className="error-text">{command_error}</p>
          </div>
        )}

        <div className="delivery-export-action-row">
          <div className="export-action-main">
            <button
              type="button"
              className="btn-export-package"
              disabled={pending || !export_action.enabled}
              aria-disabled={pending || !export_action.enabled}
              onClick={onExport}
            >
              {pending ? (
                <>
                  <span className="submit-spinner" aria-hidden="true" />
                  <span>Preparando pacote...</span>
                </>
              ) : (
                'Preparar pacote aprovado'
              )}
            </button>
            {!export_action.enabled && export_action.reason && (
              <span className="export-disabled-reason">{export_action.reason}</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
