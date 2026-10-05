export function SkillsSection({
  title,
  values,
}: {
  title: string;
  values: string[];
  accent?: boolean;
}) {
  return (
    <section className="profile-section">
      <h2>{title}</h2>
      <div className="skill-list">
        {values.length > 0 ? (
          <p className="profile-skill-copy">{values.join(' · ')}</p>
        ) : (
          <p className="muted-copy">
            {title === 'Áreas' ? 'Nenhuma área adicionada.' : 'Nenhum item adicionado.'}
          </p>
        )}
      </div>
    </section>
  );
}
