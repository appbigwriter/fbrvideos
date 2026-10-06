import { Link } from 'react-router';
import { routePaths } from '@fbr/contracts';
import { AppShell } from '../components/AppShell.js';
import { PageHeader } from '../components/PageHeader.js';
import { EmptyState } from '../components/EmptyState.js';

export function HomePage() {
  return (
    <AppShell>
      <PageHeader
        title="Início"
        description="Painel principal de produções e visão geral do sistema."
      />
      <EmptyState
        title="Início"
        description="Selecione um artigo para começar. Produções e pendências aparecerão aqui."
      >
        <Link to={routePaths.articles} className="action-link">
          Ver artigos disponíveis
        </Link>
      </EmptyState>
    </AppShell>
  );
}

export function ArticlesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Artigos"
        description="Gestão de artigos para geração de produções audiovisuais."
      />
      <EmptyState
        title="Artigos"
        description="Nenhum artigo disponível. A importação será conectada nesta etapa do produto."
      />
    </AppShell>
  );
}

export function ArticlePage() {
  return (
    <AppShell>
      <PageHeader
        title="Detalhe do artigo"
        description="Visualização e revisão de conteúdo da fonte."
      />
      <EmptyState
        title="Detalhe do artigo"
        description="Conteúdo e revisão do artigo serão apresentados aqui."
      />
    </AppShell>
  );
}

export function ProductionsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Produções"
        description="Acompanhamento e histórico de produções de vídeo."
      />
      <EmptyState
        title="Produções"
        description="Nenhuma produção disponível. Crie um vídeo a partir de um artigo."
      >
        <Link to={routePaths.articles} className="action-link">
          Selecionar um artigo
        </Link>
      </EmptyState>
    </AppShell>
  );
}

export function CreateProductionPage() {
  return (
    <AppShell>
      <PageHeader
        title="Criar produção"
        description="Definição de parâmetros para nova produção audiovisual."
      />
      <EmptyState
        title="Criar produção"
        description="Escolha artigo e perfil. As cenas serão planejadas pelo sistema."
      />
    </AppShell>
  );
}

export function ProductionPage() {
  return (
    <AppShell>
      <PageHeader
        title="Acompanhamento da produção"
        description="Monitoramento de estado, etapas e pendências da produção."
      />
      <EmptyState
        title="Acompanhamento"
        description="Estado, etapas, consumo e pendências da produção serão apresentados aqui."
      />
    </AppShell>
  );
}

export function ReviewPage() {
  return (
    <AppShell>
      <PageHeader
        title="Revisão"
        description="Inspeção detalhada da versão renderizada da produção."
      />
      <EmptyState
        title="Revisão"
        description="O vídeo renderizado estará disponível para revisão nesta tela."
      />
    </AppShell>
  );
}

export function DeliveryPage() {
  return (
    <AppShell>
      <PageHeader
        title="Entrega"
        description="Acesso aos arquivos e ativos da versão final aprovada."
      />
      <EmptyState
        title="Entrega"
        description="Arquivos da versão aprovada serão apresentados aqui."
      />
    </AppShell>
  );
}

export function ProfilesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Perfis de produção"
        description="Padrões e parâmetros reutilizáveis para geração de vídeos."
      />
      <EmptyState
        title="Perfis de produção"
        description="Configure uma vez os padrões para vários artigos."
      />
    </AppShell>
  );
}

export function UniversePage() {
  return (
    <AppShell>
      <PageHeader
        title="Universo"
        description="Catálogo de personagens, cenários, estilos e referências visuais."
      />
      <EmptyState
        title="Universo"
        description="Personagens, Bibles e referências serão apresentados aqui."
      />
    </AppShell>
  );
}

export function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Configurações"
        description="Parâmetros gerais de ambiente, fontes e limites."
      />
      <EmptyState
        title="Configurações"
        description="Fontes, fornecedores e limites serão configurados aqui."
      />
    </AppShell>
  );
}
