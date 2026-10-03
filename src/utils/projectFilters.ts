import type { Filters, ProjectDisplay } from '../types';

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function projectMatchesQuery(project: ProjectDisplay, query: string): boolean {
  const searchable = normalize(
    [
      project.name,
      project.shortDescription,
      project.category,
      project.status ?? '',
      project.difficulty,
      project.type,
      ...(project.kind === 'template' ? ['Focus Idea'] : []),
      ...project.recommendedAreas,
      ...project.suggestedTechnologies,
      ...project.possibleStacks,
    ].join(' '),
  );
  return normalize(query)
    .split(' ')
    .filter(Boolean)
    .every((term) => searchable.includes(term));
}

export function searchProjects(projects: ProjectDisplay[], query: string): ProjectDisplay[] {
  return projects.filter((project) => projectMatchesQuery(project, query));
}

export function createEmptyFilters(): Filters {
  return {
    query: '',
    status: 'Todos',
    area: 'Todas',
    technology: 'Todas',
    difficulty: 'Todas',
    type: 'Todos',
  };
}

export function projectMatchesFilters(project: ProjectDisplay, filters: Filters) {
  const queryMatches = projectMatchesQuery(project, filters.query);
  const statusMatches = filters.status === 'Todos' || project.status === filters.status;
  const areaMatches = filters.area === 'Todas' || project.recommendedAreas.includes(filters.area);
  const technologyMatches =
    filters.technology === 'Todas' || project.suggestedTechnologies.includes(filters.technology);
  const difficultyMatches =
    filters.difficulty === 'Todas' || project.difficulty === filters.difficulty;
  const typeMatches = filters.type === 'Todos' || project.type === filters.type;

  return (
    queryMatches &&
    statusMatches &&
    areaMatches &&
    technologyMatches &&
    difficultyMatches &&
    typeMatches
  );
}

export function filterProjects(projects: ProjectDisplay[], filters: Filters) {
  return projects.filter((project) => projectMatchesFilters(project, filters));
}

export function collectProjectOptions(projects: ProjectDisplay[]) {
  const areas = new Set<string>();
  const technologies = new Set<string>();

  for (const project of projects) {
    project.recommendedAreas.forEach((area) => areas.add(area));
    project.suggestedTechnologies.forEach((technology) => technologies.add(technology));
  }

  return {
    areas: Array.from(areas).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    technologies: Array.from(technologies).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}
