import type { ChangeEvent } from 'react';
import type {
  CheckboxFieldProps,
  SelectFieldProps,
  TextFieldProps,
} from '@fbr/contracts';

function getDescribedBy(id: string, hasHelp: boolean, hasError: boolean): string | undefined {
  const ids: string[] = [];
  if (hasHelp) ids.push(`${id}-help`);
  if (hasError) ids.push(`${id}-error`);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export function TextField({
  id,
  label,
  value,
  help,
  error,
  disabled,
  required,
  onChange,
}: TextFieldProps) {
  const hasHelp = Boolean(help);
  const hasError = Boolean(error);
  const describedBy = getDescribedBy(id, hasHelp, hasError);

  return (
    <div className={`form-field-group ${hasError ? 'form-field-has-error' : ''}`}>
      <label htmlFor={id} className="form-field-label">
        <span>{label}</span>
        {required && <span className="required-indicator" aria-hidden="true">*</span>}
      </label>

      <input
        id={id}
        type="text"
        className="form-input"
        value={value}
        disabled={disabled}
        required={required}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />

      {hasHelp && (
        <p id={`${id}-help`} className="form-field-help">
          {help}
        </p>
      )}

      {hasError && (
        <p id={`${id}-error`} className="form-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextareaField({
  id,
  label,
  value,
  help,
  error,
  disabled,
  required,
  onChange,
}: TextFieldProps) {
  const hasHelp = Boolean(help);
  const hasError = Boolean(error);
  const describedBy = getDescribedBy(id, hasHelp, hasError);

  return (
    <div className={`form-field-group ${hasError ? 'form-field-has-error' : ''}`}>
      <label htmlFor={id} className="form-field-label">
        <span>{label}</span>
        {required && <span className="required-indicator" aria-hidden="true">*</span>}
      </label>

      <textarea
        id={id}
        className="form-textarea"
        value={value}
        disabled={disabled}
        required={required}
        rows={4}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />

      {hasHelp && (
        <p id={`${id}-help`} className="form-field-help">
          {help}
        </p>
      )}

      {hasError && (
        <p id={`${id}-error`} className="form-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  help,
  error,
  disabled,
  required,
  onChange,
}: TextFieldProps) {
  const hasHelp = Boolean(help);
  const hasError = Boolean(error);
  const describedBy = getDescribedBy(id, hasHelp, hasError);

  return (
    <div className={`form-field-group ${hasError ? 'form-field-has-error' : ''}`}>
      <label htmlFor={id} className="form-field-label">
        <span>{label}</span>
        {required && <span className="required-indicator" aria-hidden="true">*</span>}
      </label>

      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="form-input"
        value={value}
        disabled={disabled}
        required={required}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />

      {hasHelp && (
        <p id={`${id}-help`} className="form-field-help">
          {help}
        </p>
      )}

      {hasError && (
        <p id={`${id}-error`} className="form-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  options,
  placeholder,
  help,
  error,
  disabled,
  required,
  onChange,
}: SelectFieldProps) {
  const hasHelp = Boolean(help);
  const hasError = Boolean(error);
  const describedBy = getDescribedBy(id, hasHelp, hasError);

  return (
    <div className={`form-field-group ${hasError ? 'form-field-has-error' : ''}`}>
      <label htmlFor={id} className="form-field-label">
        <span>{label}</span>
        {required && <span className="required-indicator" aria-hidden="true">*</span>}
      </label>

      <select
        id={id}
        className="form-select"
        value={value}
        disabled={disabled}
        required={required}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {hasHelp && (
        <p id={`${id}-help`} className="form-field-help">
          {help}
        </p>
      )}

      {hasError && (
        <p id={`${id}-error`} className="form-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckboxField({
  id,
  label,
  checked,
  help,
  error,
  disabled,
  required,
  onChange,
}: CheckboxFieldProps) {
  const hasHelp = Boolean(help);
  const hasError = Boolean(error);
  const describedBy = getDescribedBy(id, hasHelp, hasError);

  return (
    <div className={`form-field-group form-checkbox-group ${hasError ? 'form-field-has-error' : ''}`}>
      <div className="checkbox-row">
        <input
          id={id}
          type="checkbox"
          className="form-checkbox"
          checked={checked}
          disabled={disabled}
          required={required}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
        <label htmlFor={id} className="checkbox-label">
          <span>{label}</span>
          {required && <span className="required-indicator" aria-hidden="true">*</span>}
        </label>
      </div>

      {hasHelp && (
        <p id={`${id}-help`} className="form-field-help">
          {help}
        </p>
      )}

      {hasError && (
        <p id={`${id}-error`} className="form-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
