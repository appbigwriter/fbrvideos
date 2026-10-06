import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from './AppRoutes.js';
import {SessionGate} from './SessionGate.js';
import './styles/shell.css';
import './styles/articles.css';
import './styles/universe.css';
import './styles/forms.css';
import './styles/connected.css';
import './styles/production-setup.css';
import './styles/dossier.css';
import './styles/production-progress.css';
import './styles/scene-review.css';
import './styles/delivery.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter><SessionGate><AppRoutes /></SessionGate></BrowserRouter>,
);
