import { Menu, Plus } from 'lucide-react';
import type { MemberProfile, ProjectDisplay } from '../../types';
import type { View } from '../../viewTypes';
import { Button } from '../ui/Button';
import { FocusLogo } from './FocusLogo';
import { UserMenu } from './UserMenu';
import { ProjectSearch } from './ProjectSearch';

const titles: Record<View, string> = {
  dashboard: 'Dashboard',
  catalog: 'Projetos',
  'my-projects': 'Meus projetos',
  create: 'Criar projeto',
  community: 'Comunidade',
  profile: 'Perfil',
  admin: 'Administração',
};

export function Topbar({
  activeView,
  query,
  profile,
  projects,
  onOpenMenu,
  onQueryChange,
  onSelectProject,
  onViewAllSearch,
  onCreate,
  onNavigate,
  onEditProfile,
  onSignOut,
}: {
  activeView: View;
  query: string;
  profile: MemberProfile;
  projects: ProjectDisplay[];
  onOpenMenu: () => void;
  onQueryChange: (query: string) => void;
  onSelectProject: (id: string) => void;
  onViewAllSearch: () => void;
  onCreate: () => void;
  onNavigate: (view: View) => void;
  onEditProfile: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-context">
        <Button
          aria-label="Abrir menu"
          className="menu-button"
          icon={<Menu size={18} />}
          onClick={onOpenMenu}
          size="icon"
          variant="ghost"
        />
        <button
          aria-label="Ir para Dashboard"
          className="topbar-mobile-logo logo-home"
          onClick={() => onNavigate('dashboard')}
          title="Ir para Dashboard"
        >
          <FocusLogo compact />
        </button>
        <div className="breadcrumb">
          <button onClick={() => onNavigate('dashboard')} type="button">
            Focus Academy
          </button>
          <i>/</i>
          <strong>{titles[activeView]}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        <ProjectSearch
          onQueryChange={onQueryChange}
          onSelect={onSelectProject}
          onViewAll={onViewAllSearch}
          projects={projects}
          query={query}
        />
        <Button
          className="topbar-create"
          icon={<Plus size={17} />}
          onClick={onCreate}
          variant="primary"
        >
          Criar projeto
        </Button>
        <UserMenu
          profile={profile}
          onProfile={() => onNavigate('profile')}
          onEdit={onEditProfile}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}
