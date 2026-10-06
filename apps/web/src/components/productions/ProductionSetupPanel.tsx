import type { ProductionOptionsProps, ProductionSummaryProps } from '@fbr/contracts';
import { ProductionOptions } from './ProductionOptions.js';
import { ProductionSummary } from './ProductionSummary.js';

export interface ProductionSetupPanelProps {
  summary: ProductionSummaryProps;
  options: ProductionOptionsProps;
}

export function ProductionSetupPanel({ summary, options }: ProductionSetupPanelProps) {
  return (
    <div className="production-setup-panel">
      <div className="setup-options-column">
        <ProductionOptions {...options} />
      </div>
      <div className="setup-summary-column">
        <ProductionSummary {...summary} />
      </div>
    </div>
  );
}
