import type { ChangeEvent } from 'react';
import { ReviewCategorySchema, type SceneReviewPanelProps } from '@fbr/contracts';

export interface SceneCommentFormProps {
  current_seconds: number;
  category: SceneReviewPanelProps['category'];
  comment: string;
  can_submit: boolean;
  submit_reason: string | null;
  pending: boolean;
  command_error: string | null;
  comment_enabled: boolean;
  onCategoryChange(value: SceneReviewPanelProps['category']): void;
  onCommentChange(value: string): void;
  onSubmit(): void;
}

const reviewCategoryLabels: Record<SceneReviewPanelProps['category'], string> = {
  image_mismatch: 'Imagem não corresponde à fala',
  identity: 'Identidade da personagem',
  environment: 'Ambiente',
  motion: 'Movimento',
  speech_voice: 'Fala ou voz',
  comment: 'Comentário',
};

export function SceneCommentForm({
  current_seconds,
  category,
  comment,
  can_submit,
  submit_reason,
  pending,
  command_error,
  comment_enabled,
  onCategoryChange,
  onCommentChange,
  onSubmit,
}: SceneCommentFormProps) {
  const isInputDisabled = pending || !comment_enabled;

  const handleCategorySelect = (e: ChangeEvent<HTMLSelectElement>) => {
    onCategoryChange(ReviewCategorySchema.parse(e.target.value));
  };

  const handleCommentInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onCommentChange(e.target.value);
  };

  return (
    <section className="scene-comment-section" aria-label="Registro de apontamentos e comentários de revisão">
      <h3 className="scene-review-subtitle">Registrar Apontamento</h3>

      <div className="current-timecode-box">
        <span className="timecode-label">Trecho atual do vídeo:</span>
        <span className="timecode-value">{current_seconds.toFixed(2)}s</span>
      </div>

      <form
        className="scene-comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="form-field-group">
          <label htmlFor="review-category" className="form-field-label">
            Categoria do apontamento
          </label>
          <select
            id="review-category"
            className="form-select"
            value={category}
            disabled={isInputDisabled}
            onChange={handleCategorySelect}
          >
            {Object.entries(reviewCategoryLabels).map(([catKey, catLabel]) => (
              <option key={catKey} value={catKey}>
                {catLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field-group">
          <label htmlFor="review-comment" className="form-field-label">
            Comentário ou descrição do problema
          </label>
          <textarea
            id="review-comment"
            className="form-textarea"
            rows={4}
            maxLength={4000}
            value={comment}
            disabled={isInputDisabled}
            placeholder="Descreva o apontamento ou observação sobre esta cena..."
            onChange={handleCommentInput}
          />
        </div>

        {submit_reason && (
          <div className="submit-reason-box" role="status">
            <span className="reason-icon" aria-hidden="true">ℹ️</span>
            <span className="reason-text">{submit_reason}</span>
          </div>
        )}

        {command_error && (
          <div className="command-error-box" role="alert">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <p className="error-text">{command_error}</p>
          </div>
        )}

        <div className="form-actions-row">
          <button
            type="submit"
            className="btn-submit-comment"
            disabled={!can_submit}
            aria-disabled={!can_submit}
          >
            {pending ? (
              <>
                <span className="submit-spinner" aria-hidden="true" />
                <span>Enviando...</span>
              </>
            ) : (
              'Registrar apontamento'
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
