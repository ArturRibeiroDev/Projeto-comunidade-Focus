import { Award } from 'lucide-react';
import type { GamificationProgress } from '../../types';
import { formatDate } from '../../utils/format';

export function GamificationSection({ progress }: { progress: GamificationProgress }) {
  const next = progress.nextLevelPoints;
  const span = next ? next - progress.currentLevelPoints : 1;
  const completed = next ? progress.points - progress.currentLevelPoints : span;
  const percentage = Math.min(100, Math.max(0, (completed / span) * 100));

  return (
    <section className="profile-section gamification-section">
      <div className="profile-section-title">
        <h2>Progresso</h2>
        <span>Nivel {progress.level}</span>
      </div>
      <div className="progress-summary">
        <strong>{progress.points} pontos</strong>
        <span>{next ? `${progress.points} / ${next}` : 'Nivel maximo v1'}</span>
      </div>
      <div className="level-progress" aria-label={`Progresso do nivel ${progress.level}`}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      <div className="achievement-grid">
        {progress.achievements.map((achievement) => (
          <article
            className={achievement.unlockedAt ? 'achievement unlocked' : 'achievement'}
            key={achievement.code}
          >
            <Award size={17} />
            <div>
              <strong>{achievement.name}</strong>
              <span>{achievement.description}</span>
              {achievement.unlockedAt && <time>{formatDate(achievement.unlockedAt)}</time>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
