import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Filters, MemberProfile, PlatformRole, ProjectDisplay } from '../../types';
import type { View } from '../../viewTypes';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ScrollToTopButton } from './ScrollToTopButton';

const sidebarWidthKey = 'focusedu.sidebar.width';
const clampWidth = (value: number) => Math.max(196, Math.min(336, value));

export function AppShell({ children, activeView, accountRole, filters, profile, searchProjects, onNavigate, onEditProfile, onQueryChange, onSelectSearchProject, onViewAllSearch, onSignOut }: {
  children: ReactNode;
  activeView: View;
  accountRole: PlatformRole;
  filters: Filters;
  profile: MemberProfile;
  searchProjects: ProjectDisplay[];
  onNavigate: (view: View) => void;
  onEditProfile: () => void;
  onQueryChange: (query: string) => void;
  onSelectSearchProject: (id: string) => void;
  onViewAllSearch: () => void;
  onSignOut: () => void;
}) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return clampWidth(Number(localStorage.getItem(sidebarWidthKey)) || 232); }
    catch { return 232; }
  });
  const [resizing, setResizing] = useState(false);
  const saveSidebarWidth = (value: number) => {
    const width = clampWidth(value);
    setSidebarWidth(width);
    try { localStorage.setItem(sidebarWidthKey, String(width)); } catch { /* preference is optional */ }
  };

  useEffect(() => {
    if (!resizing) return;
    const move = (event: PointerEvent) => setSidebarWidth(clampWidth(event.clientX));
    const stop = (event: PointerEvent) => { saveSidebarWidth(event.clientX); setResizing(false); };
    const cancel = () => setResizing(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    window.addEventListener('blur', cancel, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); };
  }, [resizing]);

  return (
    <div className={`app-shell ${compact ? 'sidebar-compact' : ''} ${resizing ? 'sidebar-resizing' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      <Sidebar
        activeView={activeView}
        accountRole={accountRole}
        compact={compact}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        onToggleCompact={() => setCompact((value) => !value)}
        onStartResize={() => setResizing(true)}
        onResize={saveSidebarWidth}
        sidebarWidth={sidebarWidth}
        profile={profile}
      />
      <div className="app-main">
        <Topbar
          activeView={activeView}
          onCreate={() => onNavigate('create')}
          onOpenMenu={() => setMobileOpen(true)}
          onQueryChange={onQueryChange}
          onSelectProject={onSelectSearchProject}
          onViewAllSearch={onViewAllSearch}
          projects={searchProjects}
          onNavigate={onNavigate}
          onEditProfile={onEditProfile}
          onSignOut={onSignOut}
          profile={profile}
          query={filters.query}
        />
        <main className="workspace">{children}</main>
        <ScrollToTopButton />
      </div>
    </div>
  );
}
