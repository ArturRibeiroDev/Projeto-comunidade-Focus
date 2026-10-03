import { useEffect, useState, type FormEvent } from 'react';
import { projectPlanError, todayIsoDate, validProjectPlan } from '../../domain/projectSchedule';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function ProjectPlanModal({
  name,
  areas,
  busy,
  onClose,
  onCreate,
}: {
  name?: string;
  busy: boolean;
  onClose: () => void;
  areas: string[];
  onCreate: (role: string, start?: string, end?: string) => Promise<boolean>;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [role, setRole] = useState('');
  const minPlanDate = todayIsoDate();
  const plan = { plannedStartDate: start, plannedEndDate: end };
  const planError = projectPlanError(plan);
  useEffect(() => {
    setStart('');
    setEnd('');
    setRole('');
  }, [areas, name]);
  if (!name) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (areas.includes(role) && validProjectPlan(plan) && (await onCreate(role, start, end)))
      onClose();
  };
  return (
    <Modal
      open
      title="Criar projeto"
      description={`Criar uma squad para ${name}. O planejamento pode ser alterado enquanto o projeto está em formação.`}
      onClose={busy ? () => {} : onClose}
    >
      <form className="lifecycle-form" onSubmit={submit}>
        <label className="field">
          <span>
            Sua função na squad <em>Obrigatória</em>
          </span>
          <select required value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Selecione uma função permitida</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <p className="muted-copy">
          Planejamento (opcional). Você pode deixar em branco e definir depois com sua squad.
        </p>
        <div className="edit-form-grid">
          <label className="field">
            <span>Data prevista de início</span>
            <input
              type="date"
              min={minPlanDate}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Data prevista de conclusão</span>
            <input
              type="date"
              min={start || minPlanDate}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
        </div>
        {planError && <p className="field-error">{planError}</p>}
        <div className="modal-actions">
          <Button disabled={busy} onClick={onClose}>
            Voltar
          </Button>
          <Button
            disabled={busy || !areas.includes(role) || !validProjectPlan(plan)}
            type="submit"
            variant="primary"
          >
            {busy ? 'Criando...' : 'Criar projeto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
