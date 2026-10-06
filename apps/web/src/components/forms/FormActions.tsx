import type { FormActionsProps } from '@fbr/contracts';

export function FormActions({
  pending,
  can_submit,
  submit_label,
  blocked_reason,
  onCancel,
}: FormActionsProps) {
  const isSubmitDisabled = pending || !can_submit;

  return (
    <div className="form-actions-wrapper">
      {blocked_reason && (
        <div className="form-blocked-notice" role="status">
          <span className="blocked-icon" aria-hidden="true">⚠️</span>
          <span className="blocked-text">{blocked_reason}</span>
        </div>
      )}

      <div className="form-actions-buttons">
        <button
          type="button"
          className="btn-form-cancel"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className={`btn-form-submit ${pending ? 'btn-form-pending' : ''}`}
          disabled={isSubmitDisabled}
          aria-disabled={isSubmitDisabled}
        >
          {pending ? (
            <>
              <span className="submit-spinner" aria-hidden="true" />
              <span>Salvando...</span>
            </>
          ) : (
            submit_label
          )}
        </button>
      </div>
    </div>
  );
}
