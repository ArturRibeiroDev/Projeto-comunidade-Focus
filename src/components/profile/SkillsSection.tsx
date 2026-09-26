import { Badge } from '../ui/Badge';

export function SkillsSection({ title, values, accent = false }: { title: string; values: string[]; accent?: boolean }) {
  return (
    <section className="profile-section">
      <h2>{title}</h2>
      <div className="skill-list">
        {values.map((value) => <Badge key={value} tone={accent ? 'orange' : 'zinc'}>{value}</Badge>)}
      </div>
    </section>
  );
}
