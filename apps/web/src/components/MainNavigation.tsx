import { NavLink } from 'react-router';
import { navigation } from '@fbr/contracts';

export function MainNavigation() {
  return (
    <nav className="main-nav" aria-label="Navegação principal">
      <ul className="nav-list">
        {navigation.map((item) => (
          <li key={item.path} className="nav-item">
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              {({ isActive }) => (
                <>
                  <span className="nav-indicator" aria-hidden="true" />
                  <span className="nav-label">{item.label}</span>
                  {isActive && (
                    <span className="sr-only"> (página atual)</span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
