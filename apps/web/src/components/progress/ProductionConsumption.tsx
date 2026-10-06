import type { CostSummary } from '@fbr/contracts';

export interface ProductionConsumptionProps {
  costs: CostSummary;
}

function formatMinor(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) {
    return 'Estimativa indisponível';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

export function ProductionConsumption({ costs }: ProductionConsumptionProps) {
  const {
    currency,
    estimated_minor,
    committed_minor,
    confirmed_minor,
    ceiling_minor,
    safety_margin_minor,
  } = costs;

  return (
    <section className="production-progress-card production-progress-consumption" aria-label="Consumo e orçamento de mídia">
      <h3 className="production-progress-subtitle">Consumo e Limites de Mídia</h3>

      <div className="consumption-grid">
        <div className="consumption-item">
          <span className="consumption-label">Estimativa de mídia</span>
          <span className={`consumption-value ${estimated_minor === null ? 'value-unavailable' : ''}`}>
            {formatMinor(estimated_minor, currency)}
          </span>
        </div>

        <div className="consumption-item">
          <span className="consumption-label">Comprometido com mídia</span>
          <span className="consumption-value">
            {formatMinor(committed_minor, currency)}
          </span>
        </div>

        <div className="consumption-item">
          <span className="consumption-label">Confirmado de mídia</span>
          <span className="consumption-value">
            {formatMinor(confirmed_minor, currency)}
          </span>
        </div>

        <div className="consumption-item">
          <span className="consumption-label">Teto de mídia</span>
          <span className="consumption-value">
            {formatMinor(ceiling_minor, currency)}
          </span>
        </div>

        <div className="consumption-item">
          <span className="consumption-label">Margem de segurança</span>
          <span className="consumption-value">
            {formatMinor(safety_margin_minor, currency)}
          </span>
        </div>
      </div>

      <div className="consumption-notice-box" role="note">
        <span className="notice-icon" aria-hidden="true">ℹ️</span>
        <p className="notice-text">
          Planejamento por OAuth utiliza a cota da conta. Os valores de mídia não medem essa utilização.
        </p>
      </div>
    </section>
  );
}
