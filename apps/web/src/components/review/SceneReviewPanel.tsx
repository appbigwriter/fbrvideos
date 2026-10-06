import type { SceneReviewPanelProps } from '@fbr/contracts';
import { SceneReviewList } from './SceneReviewList.js';
import { SceneCommentForm } from './SceneCommentForm.js';

export function SceneReviewPanel({
  data,
  loading,
  error,
  pending,
  command_error,
  selected_shot,
  current_seconds,
  category,
  comment,
  can_submit,
  submit_reason,
  onRetry,
  onSelectShot,
  onCategoryChange,
  onCommentChange,
  onSubmit,
}: SceneReviewPanelProps) {
  if (loading) {
    return (
      <div className="scene-review-panel scene-review-box scene-review-loading" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <span>Carregando dados da revisão...</span>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="scene-review-panel scene-review-box scene-review-error" role="alert">
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
      <div className="scene-review-panel scene-review-box scene-review-empty" role="status">
        <p className="empty-title">Acompanhamento da revisão ainda não disponível</p>
        <p className="empty-subtitle">
          Esta produção ainda não possui uma versão renderizada para inspeção de cenas.
        </p>
      </div>
    );
  }

  return (
    <div className="scene-review-panel">
      <div className="scene-review-layout-grid">
        <div className="scene-review-list-column">
          <SceneReviewList
            scenes={data.scenes}
            selected_shot={selected_shot}
            onSelectShot={onSelectShot}
          />
        </div>

        <div className="scene-review-form-column">
          <SceneCommentForm
            current_seconds={current_seconds}
            category={category}
            comment={comment}
            can_submit={can_submit}
            submit_reason={submit_reason}
            pending={pending}
            command_error={command_error}
            comment_enabled={data.actions.comment.enabled}
            onCategoryChange={onCategoryChange}
            onCommentChange={onCommentChange}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}
