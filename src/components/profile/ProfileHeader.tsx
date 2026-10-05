import { Github, Linkedin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MemberProfile } from '../../types';
import { safeExternalUrl } from '../../utils/profileFields';
import { Avatar } from '../ui/Avatar';

export function ProfileHeader({
  profile,
  discordConnected,
}: {
  profile: MemberProfile;
  discordConnected?: boolean;
}) {
  const bioRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  useEffect(() => {
    setExpanded(false);
  }, [profile.bio]);
  useEffect(() => {
    if (expanded || !bioRef.current) return;
    const update = () => {
      const element = bioRef.current;
      if (element) setCanExpand(element.scrollHeight > element.clientHeight + 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bioRef.current);
    return () => observer.disconnect();
  }, [expanded, profile.bio]);
  return (
    <header className="profile-header">
      <Avatar name={profile.name} src={profile.avatarUrl} />
      <div className="profile-identity">
        <h1>{profile.name}</h1>
        <strong>{profile.primaryRole}</strong>
        {profile.bio && (
          <>
            <p className={`profile-bio ${expanded ? '' : 'collapsed'}`} ref={bioRef}>
              {profile.bio}
            </p>
            {canExpand && (
              <button
                aria-expanded={expanded}
                className="profile-bio-toggle"
                onClick={() => setExpanded((value) => !value)}
                type="button"
              >
                {expanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </>
        )}
        <div className="profile-links">
          {discordConnected && <span>Discord conectado</span>}
          {safeExternalUrl(profile.links.github) && (
            <a
              href={safeExternalUrl(profile.links.github)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={16} />
              GitHub
            </a>
          )}
          {safeExternalUrl(profile.links.linkedin) && (
            <a
              href={safeExternalUrl(profile.links.linkedin)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin size={16} />
              LinkedIn
            </a>
          )}
        </div>
      </div>
      <div className="availability">
        <span>Disponibilidade</span>
        <strong>{profile.availability}</strong>
      </div>
    </header>
  );
}
