import { useEffect, useState, type FormEvent } from 'react';
import type { ProjectStatus } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export type LifecycleTarget = Exclude<ProjectStatus, 'FORMING'>;
export type LifecycleDetails = {
  repositoryUrl?: string;
  demoUrl?: string;
  completionSummary?: string;
  cancellationReason?: string;
};

const labels: Record<LifecycleTarget, { title: string; description: string; command: string }> = {
  ACTIVE: {
    title: 'Iniciar projeto',
    description:
      'Após iniciar, a squad deixa de aceitar novas entradas. A composição recomendada não é obrigatória.',
    command: 'Iniciar projeto',
  },
  COMPLETED: {
    title: 'Concluir projeto',
    description: 'A conclusão registrará uma evidência para cada membro atual da squad.',
    command: 'Concluir projeto',
  },
  CANCELLED: {
    title: 'Cancelar projeto',
    description:
      'O projeto permanecerá no histórico. Os membros não poderão entrar ou sair pelo fluxo comum.',
    command: 'Cancelar projeto',
  },
  ARCHIVED: {
    title: 'Arquivar projeto',
    description: 'O projeto continuará acessível no histórico, somente para leitura.',
    command: 'Arquivar projeto',
  },
};

export function ProjectLifecycleModal({
  target,
  projectName,
  administrative = false,
  busy,
  onClose,
  onConfirm,
}: {
  target?: LifecycleTarget;
  projectName: string;
  administrative?: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (target: LifecycleTarget, details: LifecycleDetails) => Promise<boolean>;
}) {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [completionSummary, setCompletionSummary] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    setRepositoryUrl('');
    setDemoUrl('');
    setCompletionSummary('');
    setCancellationReason('');
  }, [target, projectName]);

  if (!target) return null;
  const isAdministrativeCancellation = target === 'CANCELLED' && administrative;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAdministrativeCancellation && !cancellationReason.trim()) return;
    if (await onConfirm(target, { repositoryUrl, demoUrl, completionSummary, cancellationReason }))
      onClose();
  };
  const copy = isAdministrativeCancellation
    ? {
        title: 'Cancelar projeto administrativamente?',
        description: 'Essa ação interromperá a squad e tornará o canal Discord somente leitura.',
        command: 'Cancelar projeto',
      }
    : labels[target];

  return (
    <Modal
      open
      title={copy.title}
      description={`${projectName}. ${copy.description}`}
      onClose={busy ? () => {} : onClose}
    >
      <form className="lifecycle-form" onSubmit={submit}>
        {target === 'COMPLETED' && (
          <>
            <label className="field">
              <span>URL do repositório</span>
              <input
                type="url"
                pattern="https?://.+"
                placeholder="https://..."
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
              />
            </label>
            <label className="field">
              <span>URL do projeto</span>
              <input
                type="url"
                pattern="https?://.+"
                placeholder="https://..."
                value={demoUrl}
                onChange={(event) => setDemoUrl(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Resumo da entrega</span>
              <textarea
                maxLength={1200}
                rows={4}
                value={completionSummary}
                onChange={(event) => setCompletionSummary(event.target.value)}
              />
            </label>
          </>
        )}
        {target === 'CANCELLED' && (
          <label className="field">
            <span>Motivo do cancelamento</span>
            <textarea
              maxLength={500}
              required={isAdministrativeCancellation}
              rows={3}
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
            />
          </label>
        )}
        <div className="modal-actions">
          <Button disabled={busy} onClick={onClose}>
            Voltar
          </Button>
          <Button
            disabled={busy}
            type="submit"
            variant={target === 'CANCELLED' ? 'danger' : 'primary'}
          >
            {busy ? 'Aguarde...' : copy.command}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
