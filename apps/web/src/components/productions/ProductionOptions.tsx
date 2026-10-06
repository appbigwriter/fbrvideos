import type { ChangeEvent } from 'react';
import type { ProductionOptionsProps } from '@fbr/contracts';
import {
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from '../forms/ConfigurationFields.js';

export function ProductionOptions({
  name,
  profile_value,
  profile_options,
  mode,
  target_seconds,
  avoid,
  pending,
  error,
  onNameChange,
  onProfileChange,
  onModeChange,
  onTargetSecondsChange,
  onAvoidChange,
}: ProductionOptionsProps) {
  const handleModeSelect = (e: ChangeEvent<HTMLInputElement>) => {
    onModeChange(e.target.value as 'calibration' | 'recurring');
  };

  return (
    <section className="production-options-section" aria-label="Parâmetros de configuração da produção">
      {error && (
        <div className="options-error-box" role="alert">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <p className="error-text">{error}</p>
        </div>
      )}

      <div className="options-fields-stack">
        <TextField
          id="production-name"
          label="Nome da produção"
          value={name}
          disabled={pending}
          required={true}
          help="Identificador descritivo desta versão de produção."
          error={null}
          onChange={onNameChange}
        />

        <SelectField
          id="production-profile"
          label="Perfil de produção"
          value={profile_value}
          options={profile_options}
          placeholder="Selecione um perfil de produção..."
          disabled={pending}
          required={true}
          help="Define padrões visuais, de voz, formato e limites de orçamento."
          error={null}
          onChange={onProfileChange}
        />

        <fieldset className="mode-fieldset" disabled={pending}>
          <legend className="mode-legend">Modo de produção</legend>
          <div className="mode-radios-row">
            <label className="mode-radio-label">
              <input
                type="radio"
                name="production-mode"
                value="calibration"
                checked={mode === 'calibration'}
                disabled={pending}
                onChange={handleModeSelect}
                className="mode-radio-input"
              />
              <span className="mode-radio-text">
                <strong>Calibração</strong> (testes supervisionados e validação de padrões)
              </span>
            </label>

            <label className="mode-radio-label">
              <input
                type="radio"
                name="production-mode"
                value="recurring"
                checked={mode === 'recurring'}
                disabled={pending}
                onChange={handleModeSelect}
                className="mode-radio-input"
              />
              <span className="mode-radio-text">
                <strong>Recorrente</strong> (produção padrão para perfis validados)
              </span>
            </label>
          </div>
        </fieldset>

        <details className="advanced-options-details">
          <summary className="advanced-options-summary">
            Opções avançadas de planejamento
          </summary>
          <div className="advanced-options-body">
            <NumberField
              id="production-target-seconds"
              label="Duração-alvo (segundos)"
              value={target_seconds}
              disabled={pending}
              required={false}
              help="Duração estimada para o planejamento de ritmo e planos."
              error={null}
              onChange={onTargetSecondsChange}
            />

            <TextareaField
              id="production-avoid"
              label="Elementos a evitar"
              value={avoid}
              disabled={pending}
              required={false}
              help="Diretrizes negativas, termos ou enquadramentos que o planejador deve evitar."
              error={null}
              onChange={onAvoidChange}
            />
          </div>
        </details>
      </div>
    </section>
  );
}
