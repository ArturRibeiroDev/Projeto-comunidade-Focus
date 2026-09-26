import { Github, Linkedin } from 'lucide-react';
import type { MemberProfile } from '../../types';

export function ProfileHeader({ profile }: { profile: MemberProfile }) {
  return (
    <header className="profile-header">
      <img src={profile.avatarUrl} alt="" />
      <div className="profile-identity">
        <span className="profile-kicker">Perfil profissional</span>
        <h1>{profile.name}</h1>
        <strong>{profile.primaryRole}</strong>
        <p>{profile.bio}</p>
        <div className="profile-links">
          {profile.links.github && <a href={profile.links.github} target="_blank" rel="noreferrer"><Github size={16} />GitHub</a>}
          {profile.links.linkedin && <a href={profile.links.linkedin} target="_blank" rel="noreferrer"><Linkedin size={16} />LinkedIn</a>}
        </div>
      </div>
      <div className="availability"><span>Disponibilidade</span><strong>{profile.availability}</strong></div>
    </header>
  );
}
