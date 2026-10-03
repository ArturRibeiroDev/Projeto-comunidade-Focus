import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 520);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  if (!visible) return null;
  return (
    <Button
      aria-label="Voltar ao topo"
      className="scroll-to-top"
      icon={<ArrowUp size={18} />}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      size="icon"
      title="Voltar ao topo"
    />
  );
}
