export type ProjectPlan = {
  plannedStartDate?: string;
  plannedEndDate?: string;
};

export function todayIsoDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatProjectDuration(
  kind: 'template' | 'project',
  suggestion: string,
  plan: ProjectPlan,
): string {
  if (kind === 'template') return '';
  const format = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(year, month - 1, day));
  };
  if (plan.plannedStartDate && plan.plannedEndDate)
    return `${format(plan.plannedStartDate)} → ${format(plan.plannedEndDate)}`;
  if (plan.plannedStartDate) return `Início: ${format(plan.plannedStartDate)}`;
  if (plan.plannedEndDate) return `Até ${format(plan.plannedEndDate)}`;
  return '';
}

export function validProjectPlan(plan: ProjectPlan): boolean {
  if (plan.plannedStartDate && plan.plannedStartDate < todayIsoDate()) return false;
  return (
    !plan.plannedStartDate || !plan.plannedEndDate || plan.plannedEndDate >= plan.plannedStartDate
  );
}

export function projectPlanError(plan: ProjectPlan): string {
  if (plan.plannedStartDate && plan.plannedStartDate < todayIsoDate())
    return 'Escolha uma data de início válida.';
  if (plan.plannedStartDate && plan.plannedEndDate && plan.plannedEndDate < plan.plannedStartDate)
    return 'A data de conclusão precisa ser posterior à data de início.';
  return '';
}
