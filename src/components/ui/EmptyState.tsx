import { SearchX } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <SearchX aria-hidden="true" size={22} />
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}
