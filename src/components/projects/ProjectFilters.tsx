import { Filter, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { projectDifficulties, projectStatuses, projectTypes } from '../../data/options';
import type { Filters } from '../../types';
import { Button } from '../ui/Button';

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="field select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function ProjectFilters({ filters, projectOptions, activeCount, onChange, onClear }: {
  filters: Filters;
  projectOptions: { areas: string[]; technologies: string[] };
  activeCount: number;
  onChange: <Key extends keyof Filters>(key: Key, value: Filters[Key]) => void;
  onClear: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <section className={`filters ${mobileOpen ? 'mobile-expanded' : ''}`} aria-label="Filtros de projetos">
      <div className="filters-heading">
        <div><Filter size={16} /><strong>Filtros</strong>{activeCount > 0 && <span>{activeCount}</span>}</div>
        <Button className="filter-mobile-toggle" icon={mobileOpen ? <X size={16} /> : <SlidersHorizontal size={16} />} onClick={() => setMobileOpen((value) => !value)} size="small" variant="secondary">
          {mobileOpen ? 'Fechar' : 'Filtrar'}
        </Button>
        {activeCount > 0 && <Button className="filter-clear" icon={<RotateCcw size={14} />} onClick={onClear} size="small" variant="ghost">Limpar</Button>}
      </div>
      <div className="filters-grid">
        <SelectField label="Status" value={filters.status} onChange={(value) => onChange('status', value as Filters['status'])} options={projectStatuses} />
        <SelectField label="Área" value={filters.area} onChange={(value) => onChange('area', value)} options={['Todas', ...projectOptions.areas]} />
        <SelectField label="Tecnologia" value={filters.technology} onChange={(value) => onChange('technology', value)} options={['Todas', ...projectOptions.technologies]} />
        <SelectField label="Dificuldade" value={filters.difficulty} onChange={(value) => onChange('difficulty', value as Filters['difficulty'])} options={projectDifficulties} />
        <SelectField label="Tipo" value={filters.type} onChange={(value) => onChange('type', value as Filters['type'])} options={projectTypes} />
      </div>
    </section>
  );
}
