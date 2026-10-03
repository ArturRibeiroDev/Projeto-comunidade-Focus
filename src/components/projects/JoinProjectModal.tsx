import { UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProjectDisplay } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function JoinProjectModal({
  project,
  open,
  defaultRole,
  defaultIntent,
  onClose,
  onJoin,
  busy = false,
}: {
  project?: ProjectDisplay;
  open: boolean;
  defaultRole: string;
  defaultIntent: string;
  onClose: () => void;
  onJoin: (projectId: string, role: string, intent: string) => void;
  busy?: boolean;
}) {
  const [role, setRole] = useState(
    project?.recommendedAreas.includes(defaultRole) ? defaultRole : '',
  );
  const [intent, setIntent] = useState(defaultIntent);

  useEffect(() => {
    if (open) {
      setRole(project?.recommendedAreas.includes(defaultRole) ? defaultRole : '');
      setIntent(defaultIntent);
    }
  }, [defaultIntent, defaultRole, open, project?.id, project?.recommendedAreas]);

  if (!project) return null;

  const confirm = () => {
    if (!project.recommendedAreas.includes(role)) return;
    onJoin(project.id, role, intent);
  };

  return (
    <Modal
      open={open}
      title="Solicitar entrada"
      description={`Sua solicitação será enviada ao líder da squad de ${project.name}.`}
      onClose={onClose}
    >
      <div className="join-modal-body">
        <p className="modal-prompt">Como você pretende contribuir nesta squad?</p>
        <label className="field">
          <span>
            Função principal <em>Obrigatória</em>
          </span>
          <select required value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Selecione uma função permitida</option>
            {project.recommendedAreas.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Intenção de contribuição</span>
          <textarea
            rows={4}
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            placeholder="Conte brevemente onde pretende colaborar."
          />
        </label>
        <div className="modal-actions">
          <Button disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !project.recommendedAreas.includes(role)}
            icon={<UsersRound size={17} />}
            onClick={confirm}
            variant="primary"
          >
            {busy ? 'Enviando...' : 'Solicitar entrada'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
