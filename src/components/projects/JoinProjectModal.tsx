import { UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { roleOptions } from '../../data/options';
import type { Project } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function JoinProjectModal({ project, open, defaultRole, defaultIntent, onClose, onJoin }: {
  project?: Project;
  open: boolean;
  defaultRole: string;
  defaultIntent: string;
  onClose: () => void;
  onJoin: (projectId: string, role: string, intent: string) => void;
}) {
  const [role, setRole] = useState(defaultRole);
  const [intent, setIntent] = useState(defaultIntent);

  useEffect(() => {
    if (open) {
      setRole(defaultRole);
      setIntent(defaultIntent);
    }
  }, [defaultIntent, defaultRole, open, project?.id]);

  if (!project) return null;

  const confirm = () => {
    if (!role) return;
    onJoin(project.id, role, intent);
    onClose();
  };

  return (
    <Modal open={open} title="Entrar no projeto" description={`Você está entrando na squad de ${project.name}.`} onClose={onClose}>
      <div className="join-modal-body">
        <p className="modal-prompt">Como você pretende contribuir nesta squad?</p>
        <label className="field">
          <span>Função principal <em>Obrigatória</em></span>
          <select required value={role} onChange={(event) => setRole(event.target.value)}>
            {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Intenção de contribuição</span>
          <textarea rows={4} value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="Conte brevemente onde pretende colaborar." />
        </label>
        <div className="modal-actions">
          <Button onClick={onClose}>Cancelar</Button>
          <Button disabled={!role} icon={<UsersRound size={17} />} onClick={confirm} variant="primary">Entrar na squad</Button>
        </div>
      </div>
    </Modal>
  );
}
