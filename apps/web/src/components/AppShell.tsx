import type { ReactNode } from 'react';
import { MainNavigation } from './MainNavigation.js';

export interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className="app-sidebar" aria-label="Barra lateral">
        <div className="brand-header">
          <span className="brand-logo" aria-hidden="true">🎬</span>
          <span className="brand-title">FBR Videos</span>
        </div>
        <MainNavigation />
      </aside>
      <main id="main-content" className="app-main" tabIndex={-1}>
        <div className="content-container">
          {children}
        </div>
      </main>
    </div>
  );
}
