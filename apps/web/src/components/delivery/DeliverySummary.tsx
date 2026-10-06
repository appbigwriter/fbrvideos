import type { DeliveryView } from '@fbr/contracts';
import { productionStateLabels } from '@fbr/contracts';

export interface DeliverySummaryProps {
  data: DeliveryView;
}

const deliveryKindLabels: Record<DeliveryView['kind'], { title: string; badge: string; className: string }> = {
  unavailable: {
    title: 'Entrega ainda indisponível',
    badge: 'Indisponível',
    className: 'kind-unavailable',
  },
  preview: {
    title: 'Prévia para revisão',
    badge: 'Prévia (Não aprovada)',
    className: 'kind-preview',
  },
  approved_delivery: {
    title: 'Entrega aprovada',
    badge: 'Versão final aprovada',
    className: 'kind-approved',
  },
};

function formatMinor(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) {
    return 'Estimativa indisponível';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

export function DeliverySummary({ data }: DeliverySummaryProps) {
  const { name, production, status, kind, costs, notice } = data;
  const statusLabel = productionStateLabels[status] ?? status;
  const kindConfig = deliveryKindLabels[kind] ?? deliveryKindLabels.unavailable;

  return (
    <div className="delivery-summary-container">
      {notice && (
        <div className="delivery-notice-banner" role="note">
          <span className="notice-icon" aria-hidden="true">ℹ️</span>
          <span className="notice-text">{notice}</span>
        </div>
      )}

      <header className="delivery-header-card">
        <div className="delivery-header-top">
          <div className="delivery-title-row">
            <h3 className="delivery-production-name">{name}</h3>
            <span className="delivery-version-badge">v{production.version}</span>
            <span className={`status-badge status-${status}`}>{statusLabel}</span>
          </div>
          <div className={`delivery-kind-badge ${kindConfig.className}`}>
            {kindConfig.badge}
          </div>
        </div>

        <div className="delivery-kind-info">
          <h4 className="delivery-kind-title">{kindConfig.title}</h4>
          {kind === 'preview' && (
            <p className="delivery-preview-warning">
              ⚠️ <strong>Aviso:</strong> Esta é uma prévia renderizada para verificação. O pacote final aprovado só é liberado após aprovação humana integral.
            </p>
          )}
        </div>

        <div className="delivery-costs-section">
          <h5 className="costs-heading">Resumo de Custos de Mídia</h5>
          <div className="costs-grid">
            <div className="cost-item">
              <span className="cost-label">Estimativa:</span>
              <span className="cost-val">{formatMinor(costs.estimated_minor, costs.currency)}</span>
            </div>
            <div className="cost-item">
              <span className="cost-label">Comprometido:</span>
              <span className="cost-val">{formatMinor(costs.committed_minor, costs.currency)}</span>
            </div>
            <div className="cost-item">
              <span className="cost-label">Confirmado:</span>
              <span className="cost-val">{formatMinor(costs.confirmed_minor, costs.currency)}</span>
            </div>
            <div className="cost-item">
              <span className="cost-label">Teto:</span>
              <span className="cost-val">{formatMinor(costs.ceiling_minor, costs.currency)}</span>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
