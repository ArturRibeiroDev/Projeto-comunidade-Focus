export function friendlyProjectError(message: string): string {
  if (import.meta.env.DEV) {
    console.warn('[FocusAcademy] Falha em ação de projeto', {
      code: message.match(/[A-Z_]+(?::\d+)?/)?.[0] ?? 'UNKNOWN',
    });
  }
  const match = /(?:OWNED_PROJECT_LIMIT|DAILY_PROJECT_LIMIT|JOINED_PROJECT_LIMIT):(\d+)/.exec(
    message,
  );
  if (match) {
    const limit = Number(match[1]);
    if (match[0].startsWith('OWNED'))
      return `Você já possui ${limit} projetos em andamento ou formação.`;
    if (match[0].startsWith('DAILY'))
      return `Você atingiu o limite de ${limit} projetos criados nas últimas 24 horas.`;
    return `Você já participa do limite de ${limit} projetos ativos permitido. Conclua ou saia de algum projeto em formação antes de entrar em outro.`;
  }
  if (message.includes('ACCOUNT_SUSPENDED')) return 'Sua conta está temporariamente suspensa.';
  if (message.includes('DISCORD_REQUIRED') && !message.includes('PROJECT_START_DISCORD_REQUIRED'))
    return 'Conecte seu Discord antes de participar de projetos.';
  if (message.includes('JOIN_REQUEST_PENDING'))
    return 'Sua solicitação já está aguardando aprovação.';
  if (message.includes('PROJECT_FULL')) return 'Esta squad não possui mais vagas.';
  if (message.includes('ONLY_OWNER_CAN_DECIDE_JOIN_REQUEST'))
    return 'Somente o líder pode aprovar solicitações.';
  const missingDiscord = /PROJECT_START_DISCORD_REQUIRED:(\d+)/.exec(message);
  if (missingDiscord) {
    const count = Number(missingDiscord[1]);
    return count === 1
      ? 'Não é possível iniciar a squad. 1 membro ainda precisa conectar o Discord.'
      : `Não é possível iniciar a squad. ${count} membros ainda precisam conectar o Discord.`;
  }
  if (message.includes('PROJECT_NOT_FORMING')) return 'Este projeto não recebe solicitações agora.';
  if (message.includes('MEMBERSHIP_NOT_FOUND')) return 'Sua participação não foi encontrada.';
  if (message.includes('OWNER_CANNOT_LEAVE_PROJECT'))
    return 'O líder não pode sair da própria squad.';
  if (/Data final anterior|projects_planned_dates_order|planned_dates|end.*start/i.test(message))
    return 'A data de conclusão precisa ser posterior à data de início.';
  if (/date|data/i.test(message)) return 'Escolha uma data de início válida.';
  if (/permission|permiss|acesso|42501|owner|responsavel|responsável/i.test(message))
    return 'Você não tem permissão para realizar esta ação.';
  if (/network|fetch|timeout|failed to fetch/i.test(message))
    return 'Não foi possível criar o projeto neste momento.';
  return 'Não foi possível criar o projeto neste momento.';
}
