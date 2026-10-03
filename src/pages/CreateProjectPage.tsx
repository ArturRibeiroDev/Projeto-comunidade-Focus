import { ArrowRight, BookTemplate, Save, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { projectDifficulties, technologySuggestions } from '../data/options';
import type { ProjectTemplate, ProjectDifficulty } from '../types';
import type { ProjectFormState } from '../viewTypes';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { projectPlanError, todayIsoDate, validProjectPlan } from '../domain/projectSchedule';

function TagInput({
  label,
  value,
  onChange,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
}) {
  const id = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-options`;
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <input required value={value} onChange={(event) => onChange(event.target.value)} list={id} />
      <datalist id={id}>
        {suggestions.map((suggestion) => (
          <option value={suggestion} key={suggestion} />
        ))}
      </datalist>
    </label>
  );
}

export function CreateProjectPage({
  templates,
  projectForm,
  onFormChange,
  onSubmit,
  onReuseTemplate,
  busy,
  areaOptions,
}: {
  templates: ProjectTemplate[];
  projectForm: ProjectFormState;
  onFormChange: (form: ProjectFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReuseTemplate: (projectId: string) => void;
  busy: boolean;
  areaOptions: string[];
}) {
  const [mode, setMode] = useState<'template' | 'community'>('template');
  const minPlanDate = todayIsoDate();
  const planError = projectPlanError(projectForm);
  const update = <Key extends keyof ProjectFormState>(key: Key, value: ProjectFormState[Key]) =>
    onFormChange({ ...projectForm, [key]: value });

  return (
    <div className="page-stack content-narrow">
      <PageHeader
        eyebrow="Nova squad"
        title="Criar projeto"
        description="Comece com um escopo preparado pela Focus ou publique uma ideia da comunidade."
      />
      <div className="create-options" role="tablist" aria-label="Forma de criação">
        <button
          aria-selected={mode === 'template'}
          className={mode === 'template' ? 'active' : ''}
          onClick={() => setMode('template')}
          role="tab"
        >
          <BookTemplate size={20} />
          <span>
            <strong>Usar uma Focus Idea</strong>
            <small>Comece com um escopo preparado e adapte com a squad.</small>
          </span>
        </button>
        <button
          aria-selected={mode === 'community'}
          className={mode === 'community' ? 'active' : ''}
          onClick={() => setMode('community')}
          role="tab"
        >
          <Sparkles size={20} />
          <span>
            <strong>Criar projeto comunitário</strong>
            <small>Publique uma ideia própria com áreas e tecnologias livres.</small>
          </span>
        </button>
      </div>

      {mode === 'template' ? (
        <section className="template-list" role="tabpanel">
          {templates.map((template) => (
            <article className="template-row" key={template.id}>
              <div className="template-copy">
                <div>
                  <Badge tone="orange">Focus Idea</Badge>
                </div>
                <h2>{template.name}</h2>
                <p>{template.description}</p>
                <small>
                  {template.difficulty} · até {template.recommendedMaxMembers} membros sugeridos
                </small>
              </div>
              <Button
                disabled={busy}
                icon={<ArrowRight size={16} />}
                onClick={() => onReuseTemplate(template.id)}
                variant="primary"
              >
                Usar esta ideia
              </Button>
            </article>
          ))}
        </section>
      ) : (
        <form className="structured-form" onSubmit={onSubmit} role="tabpanel">
          <div className="form-intro field-wide">
            <h2>Projeto comunitário</h2>
            <p>Defina o essencial. A composição e a stack continuam flexíveis para a squad.</p>
          </div>
          <label className="field field-wide">
            <span>Nome</span>
            <input
              required
              value={projectForm.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Ex.: Portal de Mentorias"
            />
          </label>
          <label className="field field-wide">
            <span>Descrição curta</span>
            <textarea
              required
              rows={3}
              value={projectForm.shortDescription}
              onChange={(event) => update('shortDescription', event.target.value)}
              placeholder="Descreva o problema, público e resultado esperado."
            />
          </label>
          <label className="field">
            <span>Categoria</span>
            <input
              required
              value={projectForm.category}
              onChange={(event) => update('category', event.target.value)}
              placeholder="Comunidade"
            />
          </label>
          <label className="field">
            <span>Limite de membros</span>
            <input
              type="number"
              min={2}
              max={12}
              value={projectForm.memberLimit}
              onChange={(event) => update('memberLimit', Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Dificuldade</span>
            <select
              value={projectForm.difficulty}
              onChange={(event) => update('difficulty', event.target.value as ProjectDifficulty)}
            >
              {projectDifficulties
                .filter((item) => item !== 'Todas')
                .map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
            </select>
          </label>
          <div className="field field-wide">
            <span>Planejamento (opcional)</span>
            <small>Você pode deixar em branco e definir depois com sua squad.</small>
            <div className="edit-form-grid">
              <label className="field">
                <span>Data prevista de início</span>
                <input
                  type="date"
                  min={minPlanDate}
                  value={projectForm.plannedStartDate}
                  onChange={(event) => update('plannedStartDate', event.target.value)}
                />
              </label>
              <label className="field">
                <span>Data prevista de conclusão</span>
                <input
                  type="date"
                  min={projectForm.plannedStartDate || minPlanDate}
                  value={projectForm.plannedEndDate}
                  onChange={(event) => update('plannedEndDate', event.target.value)}
                />
              </label>
            </div>
            {planError && <p className="field-error">{planError}</p>}
          </div>
          <label className="field">
            <span>Áreas sugeridas para contribuir</span>
            <select
              multiple
              required
              value={projectForm.recommendedAreas
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)}
              onChange={(event) =>
                update(
                  'recommendedAreas',
                  Array.from(event.currentTarget.selectedOptions, (option) => option.value).join(
                    ', ',
                  ),
                )
              }
              size={Math.min(6, Math.max(3, areaOptions.length))}
            >
              {areaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sua função na squad</span>
            <select
              required
              value={projectForm.ownerParticipationRole}
              onChange={(event) => update('ownerParticipationRole', event.target.value)}
            >
              <option value="">Selecione uma área do projeto</option>
              {projectForm.recommendedAreas
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
                .map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
            </select>
          </label>
          <TagInput
            label="Tecnologias sugeridas"
            value={projectForm.suggestedTechnologies}
            onChange={(value) => update('suggestedTechnologies', value)}
            suggestions={technologySuggestions}
          />
          <label className="field field-wide">
            <span>Stacks possíveis</span>
            <input
              required
              value={projectForm.possibleStacks}
              onChange={(event) => update('possibleStacks', event.target.value)}
            />
          </label>
          <label className="field field-wide">
            <span>Entregáveis</span>
            <input
              required
              value={projectForm.outcomes}
              onChange={(event) => update('outcomes', event.target.value)}
            />
          </label>
          <div className="form-actions field-wide">
            <Button
              disabled={
                busy ||
                !validProjectPlan(projectForm) ||
                !projectForm.ownerParticipationRole ||
                !projectForm.recommendedAreas
                  .split(',')
                  .map((area) => area.trim())
                  .includes(projectForm.ownerParticipationRole)
              }
              icon={<Save size={17} />}
              type="submit"
              variant="primary"
            >
              {busy ? 'Criando...' : 'Criar projeto'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
