import type { Filters, Project } from '../types';

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function createEmptyFilters(): Filters {
  return {
    query: '',
    status: 'Todos',
    area: 'Todas',
    technology: 'Todas',
    difficulty: 'Todas',
    type: 'Todos'
  };
}

export function projectMatchesFilters(project: Project, filters: Filters) {
  const searchable = normalize(
    [
      project.name,
      project.shortDescription,
      project.category,
      project.status,
      project.difficulty,
      project.type,
      project.recommendedAreas.join(' '),
      project.suggestedTechnologies.join(' '),
      project.possibleStacks.join(' ')
    ].join(' ')
  );

  const queryMatches = filters.query.trim() === '' || searchable.includes(normalize(filters.query.trim()));
  const statusMatches = filters.status === 'Todos' || project.status === filters.status;
  const areaMatches = filters.area === 'Todas' || project.recommendedAreas.includes(filters.area);
  const technologyMatches =
    filters.technology === 'Todas' || project.suggestedTechnologies.includes(filters.technology);
  const difficultyMatches = filters.difficulty === 'Todas' || project.difficulty === filters.difficulty;
  const typeMatches = filters.type === 'Todos' || project.type === filters.type;

  return queryMatches && statusMatches && areaMatches && technologyMatches && difficultyMatches && typeMatches;
}

export function filterProjects(projects: Project[], filters: Filters) {
  return projects.filter((project) => projectMatchesFilters(project, filters));
}

export function collectProjectOptions(projects: Project[]) {
  const areas = new Set<string>();
  const technologies = new Set<string>();

  for (const project of projects) {
    project.recommendedAreas.forEach((area) => areas.add(area));
    project.suggestedTechnologies.forEach((technology) => technologies.add(technology));
  }

  return {
    areas: Array.from(areas).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    technologies: Array.from(technologies).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  };
}
