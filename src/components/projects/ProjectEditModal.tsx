import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { ProjectDisplay, SquadRecommendation } from '../../types';
import { toList } from '../../utils/format';
import { projectPlanError, todayIsoDate, validProjectPlan } from '../../domain/projectSchedule';
import type { ProjectEditInput } from '../../services/projectService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function ProjectEditModal({
  project,
  open,
  busy,
  onClose,
  onSave,
}: {
  project: ProjectDisplay;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (input: ProjectEditInput) => Promise<boolean>;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.shortDescription);
  const [objective, setObjective] = useState(project.objective ?? '');
  const [maxMembers, setMaxMembers] = useState(project.memberLimit);
  const [duration, setDuration] = useState(project.suggestedDuration);
  const [plannedStartDate, setPlannedStartDate] = useState(project.plannedStartDate ?? '');
  const [plannedEndDate, setPlannedEndDate] = useState(project.plannedEndDate ?? '');
  const [technologies, setTechnologies] = useState(project.suggestedTechnologies.join(', '));
  const [areas, setAreas] = useState(project.recommendedAreas.join(', '));
  const [composition, setComposition] = useState<SquadRecommendation[]>(project.suggestedRoles);
  const minPlanDate = todayIsoDate();
  const plan = { plannedStartDate, plannedEndDate };
  const planError = projectPlanError(plan);

  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setDescription(project.shortDescription);
    setObjective(project.objective ?? '');
    setMaxMembers(project.memberLimit);
    setDuration(project.suggestedDuration);
    setPlannedStartDate(project.plannedStartDate ?? '');
    setPlannedEndDate(project.plannedEndDate ?? '');
    setTechnologies(project.suggestedTechnologies.join(', '));
    setAreas(project.recommendedAreas.join(', '));
    setComposition(project.suggestedRoles.map((item) => ({ ...item })));
    // Preserve unsaved edits if the same project refreshes while this modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  const updateComposition = (index: number, value: SquadRecommendation) =>
    setComposition((items) => items.map((item, position) => (position === index ? value : item)));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validProjectPlan(plan)) return;
    if (
      await onSave({
        name,
        description,
        objective,
        maxMembers,
        duration,
        plannedStartDate,
        plannedEndDate,
        composition: composition.filter((item) => item.role.trim()),
        technologies: toList(technologies),
        areas: toList(areas),
      })
    )
      onClose();
  };

  return (
    <Modal
      open={open}
      title="Editar projeto"
      description="Alterações estruturais são permitidas apenas enquanto a squad está em formação."
      onClose={busy ? () => {} : onClose}
    >
      <form className="lifecycle-form" onSubmit={submit}>
        <label className="field">
          <span>Nome</span>
          <input
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Descrição</span>
          <textarea
            required
            maxLength={1000}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Objetivo</span>
          <textarea
            maxLength={2000}
            rows={2}
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
          />
        </label>
        <div className="edit-form-grid">
          <label className="field">
            <span>Limite de membros</span>
            <input
              type="number"
              min={Math.max(2, project.members.length)}
              max={50}
              required
              value={maxMembers}
              onChange={(event) => setMaxMembers(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="muted-copy">
          Planejamento (opcional). Você pode deixar em branco e definir depois com sua squad.
        </p>
        <div className="edit-form-grid">
          <label className="field">
            <span>Data prevista de início</span>
            <input
              type="date"
              min={minPlanDate}
              value={plannedStartDate}
              onChange={(event) => setPlannedStartDate(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Data prevista de conclusão</span>
            <input
              type="date"
              min={plannedStartDate || minPlanDate}
              value={plannedEndDate}
              onChange={(event) => setPlannedEndDate(event.target.value)}
            />
          </label>
        </div>
        {planError && <p className="field-error">{planError}</p>}
        <label className="field">
          <span>Tecnologias</span>
          <input value={technologies} onChange={(event) => setTechnologies(event.target.value)} />
        </label>
        <label className="field">
          <span>Áreas</span>
          <input value={areas} onChange={(event) => setAreas(event.target.value)} />
        </label>
        <div className="edit-composition">
          <div className="edit-composition-heading">
            <span>Composição sugerida</span>
            <Button
              aria-label="Adicionar função sugerida"
              icon={<Plus size={15} />}
              onClick={() => setComposition((items) => [...items, { role: '', amount: 1 }])}
              size="icon"
              title="Adicionar função sugerida"
            />
          </div>
          {composition.map((item, index) => (
            <div className="edit-composition-row" key={index}>
              <input
                aria-label={`Função ${index + 1}`}
                placeholder="Função"
                value={item.role}
                onChange={(event) =>
                  updateComposition(index, { ...item, role: event.target.value })
                }
              />
              <input
                aria-label={`Quantidade para ${item.role || `função ${index + 1}`}`}
                type="number"
                min={1}
                max={50}
                value={item.amount}
                onChange={(event) =>
                  updateComposition(index, { ...item, amount: Number(event.target.value) })
                }
              />
              <Button
                aria-label={`Remover função ${item.role || index + 1}`}
                icon={<Trash2 size={15} />}
                onClick={() =>
                  setComposition((items) => items.filter((_, position) => position !== index))
                }
                size="icon"
                title="Remover função"
                variant="ghost"
              />
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <Button disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy || !validProjectPlan(plan)} type="submit" variant="primary">
            {busy ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
