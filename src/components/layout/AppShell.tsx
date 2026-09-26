import { useState, type ReactNode } from 'react';
import type { Filters, MemberProfile } from '../../types';
import type { View } from '../../viewTypes';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children, activeView, filters, profile, onNavigate, onQueryChange, onRestore }: {
  children: ReactNode;
  activeView: View;
  filters: Filters;
  profile: MemberProfile;
  onNavigate: (view: View) => void;
  onQueryChange: (query: string) => void;
  onRestore: () => void;
}) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`app-shell ${compact ? 'sidebar-compact' : ''}`}>
      <Sidebar
        activeView={activeView}
        compact={compact}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={onNavigate}
        onRestore={onRestore}
        onToggleCompact={() => setCompact((value) => !value)}
        profile={profile}
      />
      <div className="app-main">
        <Topbar
          activeView={activeView}
          onCreate={() => onNavigate('create')}
          onOpenMenu={() => setMobileOpen(true)}
          onQueryChange={onQueryChange}
          profileAvatar={profile.avatarUrl}
          query={filters.query}
        />
        <main className="workspace">{children}</main>
      </div>
    </div>
  );
}
