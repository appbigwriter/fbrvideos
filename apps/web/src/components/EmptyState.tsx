import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-label={`Estado vazio: ${title}`}>
      <div className="empty-state-icon" aria-hidden="true">
        ✦
      </div>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-description">{description}</p>
      {children ? <div className="empty-state-actions">{children}</div> : null}
    </section>
  );
}
