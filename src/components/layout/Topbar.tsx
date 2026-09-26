import { Menu, Plus, Search } from 'lucide-react';
import type { View } from '../../viewTypes';
import { Button } from '../ui/Button';
import { FocusLogo } from './FocusLogo';

const titles: Record<View, string> = {
  dashboard: 'Dashboard',
  catalog: 'Projetos',
  'my-projects': 'Meus projetos',
  create: 'Criar projeto',
  profile: 'Perfil'
};

export function Topbar({ activeView, query, profileAvatar, onOpenMenu, onQueryChange, onCreate }: {
  activeView: View;
  query: string;
  profileAvatar: string;
  onOpenMenu: () => void;
  onQueryChange: (query: string) => void;
  onCreate: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-context">
        <Button aria-label="Abrir menu" className="menu-button" icon={<Menu size={18} />} onClick={onOpenMenu} size="icon" variant="ghost" />
        <div className="topbar-mobile-logo"><FocusLogo compact /></div>
        <div className="breadcrumb"><span>FocusEdu</span><i>/</i><strong>{titles[activeView]}</strong></div>
      </div>
      <div className="topbar-actions">
        <label className="global-search">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">Buscar projetos</span>
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar projetos..." />
        </label>
        <Button className="topbar-create" icon={<Plus size={17} />} onClick={onCreate} variant="primary">Criar projeto</Button>
        <img className="topbar-avatar" src={profileAvatar} alt="Seu perfil" />
      </div>
    </header>
  );
}
