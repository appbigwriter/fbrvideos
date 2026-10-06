import { Route, Routes } from 'react-router';
import { routePaths } from '@fbr/contracts';
import { HomeConnected,OperationsPage } from './pages/OperationsConnected.js';
import { ReviewPage } from './pages/ReviewConnected.js';
import { DeliveryPage } from './pages/DeliveryConnected.js';
import { ArticlesPage, ArticlePage } from './pages/ArticlesConnected.js';
import { UniversePage } from './pages/UniverseConnected.js';
import { ProfilesPage } from './pages/ProfilesConnected.js';
import { ProductionsPage, CreateProductionPage, ProductionPage } from './pages/ProductionsConnected.js';

export function AppRoutes() {
  return <Routes>
    <Route path={routePaths.home} element={<HomeConnected />} />
    <Route path={routePaths.articles} element={<ArticlesPage />} />
    <Route path={routePaths.article} element={<ArticlePage />} />
    <Route path={routePaths.productions} element={<ProductionsPage />} />
    <Route path={routePaths.createProduction} element={<CreateProductionPage />} />
    <Route path={routePaths.production} element={<ProductionPage />} />
    <Route path={routePaths.review} element={<ReviewPage />} />
    <Route path={routePaths.delivery} element={<DeliveryPage />} />
    <Route path={routePaths.profiles} element={<ProfilesPage />} />
    <Route path={routePaths.universe} element={<UniversePage />} />
    <Route path={routePaths.settings} element={<OperationsPage />} />
    <Route path="*" element={<HomeConnected />} />
  </Routes>;
}
