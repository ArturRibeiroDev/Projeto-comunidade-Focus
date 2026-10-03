import { getSupabase } from '../lib/supabase';
import { throwReadError } from './readError';
import type { ProjectTemplate, SquadRecommendation } from '../types';

export async function getTemplates(): Promise<ProjectTemplate[]> {
  const client = getSupabase();
  const [templates, technologies, areas, skills] = await Promise.all([
    client.from('project_templates').select('*').eq('archived', false).order('name'),
    client.from('project_template_technologies').select('template_id,skill_id'),
    client.from('project_template_areas').select('template_id,skill_id'),
    client.from('skills').select('id,name'),
  ]);
  for (const [source, result] of [
    ['project_templates', templates],
    ['project_template_technologies', technologies],
    ['project_template_areas', areas],
    ['skills', skills],
  ] as const)
    if (result.error) throwReadError('os templates', source, result.error);
  const names = new Map((skills.data ?? []).map((skill) => [skill.id, skill.name]));
  return (templates.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    problem: row.problem,
    objective: row.objective,
    suggestedFeatures: row.suggested_features ?? [],
    acceptanceCriteria: row.acceptance_criteria ?? [],
    difficulty: row.difficulty,
    suggestedDuration: row.suggested_duration,
    audience: row.audience ?? '',
    evolutionIdeas: row.evolution_ideas ?? [],
    recommendedMaxMembers: row.recommended_max_members,
    suggestedComposition: row.suggested_composition as SquadRecommendation[],
    suggestedTechnologies: (technologies.data ?? [])
      .filter((link) => link.template_id === row.id)
      .map((link) => names.get(link.skill_id))
      .filter((name): name is string => Boolean(name)),
    relatedAreas: (areas.data ?? [])
      .filter((link) => link.template_id === row.id)
      .map((link) => names.get(link.skill_id))
      .filter((name): name is string => Boolean(name)),
    possibleStacks: row.possible_stacks ?? [],
    outcomes: row.outcomes ?? [],
    official: row.official,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
