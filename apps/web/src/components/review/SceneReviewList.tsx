import type { ReviewScene, VersionRef } from '@fbr/contracts';

export interface SceneReviewListProps {
  scenes: readonly ReviewScene[];
  selected_shot: VersionRef | null;
  onSelectShot(ref: VersionRef): void;
}

function isSameRef(a: VersionRef | null, b: VersionRef | null): boolean {
  return !!a && !!b && a.id === b.id && a.version === b.version;
}

export function SceneReviewList({
  scenes,
  selected_shot,
  onSelectShot,
}: SceneReviewListProps) {
  if (scenes.length === 0) {
    return (
      <div className="scene-review-empty-list" role="status">
        <p className="empty-text">Nenhuma cena disponível para revisão nesta versão.</p>
      </div>
    );
  }

  return (
    <div className="scene-review-list-container" aria-label="Lista de cenas para revisão">
      <h3 className="scene-review-subtitle">Cenas da Produção ({scenes.length})</h3>
      <div className="scene-review-cards-grid">
        {scenes.map((scene) => {
          const isSelected = isSameRef(scene.ref, selected_shot);
          const timeRangeText = `${scene.start_seconds.toFixed(2)}s – ${scene.end_seconds.toFixed(2)}s`;

          return (
            <article
              key={`${scene.ref.id}:${scene.ref.version}`}
              className={`scene-review-card ${isSelected ? 'scene-review-card-selected' : ''}`}
            >
              <button
                type="button"
                className="scene-select-button"
                aria-pressed={isSelected}
                onClick={() => onSelectShot(scene.ref)}
              >
                <div className="scene-card-header">
                  <h4 className="scene-card-title">{scene.title}</h4>
                  <span className="scene-time-badge">{timeRangeText}</span>
                </div>
                <p className="scene-transcript-text">“{scene.transcript}”</p>
                {isSelected && (
                  <span className="scene-selected-indicator" aria-hidden="true">
                    ● Cena selecionada
                  </span>
                )}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
