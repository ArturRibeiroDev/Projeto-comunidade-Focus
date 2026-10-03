import { LogOut, Pencil, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { MemberProfile } from '../../types';

export function UserMenu({
  profile,
  onProfile,
  onEdit,
  onSignOut,
}: {
  profile: MemberProfile;
  onProfile: () => void;
  onEdit: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const act = (callback: () => void) => {
    setOpen(false);
    callback();
  };
  return (
    <div className="user-menu" ref={wrapper}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir menu do usuário"
        className="user-menu-trigger"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() =>
              wrapper.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(),
            );
          }
        }}
        ref={trigger}
      >
        <img className="topbar-avatar" src={profile.avatarUrl} alt="" />
      </button>
      {open && (
        <div
          className="user-menu-popover"
          id={menuId}
          role="menu"
          onKeyDown={(event) => {
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
            );
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              items[
                (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length
              ]?.focus();
            }
          }}
        >
          <div className="user-menu-identity">
            <img src={profile.avatarUrl} alt="" />
            <span>
              <strong>{profile.name}</strong>
              <small>{profile.primaryRole}</small>
            </span>
          </div>
          <div className="user-menu-items">
            <button role="menuitem" onClick={() => act(onProfile)}>
              <UserRound size={16} />
              Meu perfil
            </button>
            <button role="menuitem" onClick={() => act(onEdit)}>
              <Pencil size={16} />
              Editar perfil
            </button>
            <button role="menuitem" onClick={() => act(onSignOut)}>
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
