import { CheckCircle2 } from 'lucide-react';
import type { MemberEvidence, Project } from '../../types';
import { formatDate } from '../../utils/format';

export function EvidenceSection({ evidence, projects }: { evidence: MemberEvidence[]; projects: Project[] }) {
  const projectName = (projectId?: string) => projects.find((project) => project.id === projectId)?.name;

  return (
    <section className="profile-section evidence-section">
      <div className="profile-section-title"><h2>Evidências</h2><span>{evidence.length} registros</span></div>
      <div className="evidence-list">
        {evidence.map((item) => (
          <div className="evidence-item" key={item.id}>
            <span className="evidence-icon"><CheckCircle2 size={17} /></span>
            <div>
              <strong>{item.label}</strong>
              <small>{[projectName(item.projectId), item.technology, formatDate(item.recordedAt)].filter(Boolean).join(' · ')}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
