import { describe, expect, it } from 'vitest';
import { friendlyProjectCreationError, friendlyProjectError } from './projectErrors';

describe('friendlyProjectError', () => {
  it('traduz os limites do banco', () => {
    expect(friendlyProjectError('OWNED_PROJECT_LIMIT:3')).toContain('3 projetos');
    expect(friendlyProjectError('DAILY_PROJECT_LIMIT:3')).toContain('24 horas');
    expect(friendlyProjectError('JOINED_PROJECT_LIMIT:5')).toContain('5 projetos ativos');
    expect(friendlyProjectError('ACCOUNT_SUSPENDED')).toContain('suspensa');
  });
});

describe('friendlyProjectCreationError', () => {
  it('explains the owned-project limit reported by the creation trigger', () => {
    expect(friendlyProjectCreationError(new Error('OWNED_PROJECT_LIMIT:2'))).toBe(
      'Você atingiu o limite de 2 projetos próprios em aberto. Conclua, cancele ou arquive um projeto antes de criar outro.',
    );
  });

  it('uses the real daily and participation limit codes', () => {
    expect(friendlyProjectCreationError({ message: 'DAILY_PROJECT_LIMIT:3' })).toBe(
      'Você atingiu o limite de criação de projetos nas últimas 24 horas. Tente novamente mais tarde.',
    );
    expect(friendlyProjectCreationError(new Error('JOINED_PROJECT_LIMIT:5'))).toBe(
      'Você atingiu o limite de participações simultâneas em projetos.',
    );
  });

  it('maps known Discord, date and unavailable-source errors without exposing SQL details', () => {
    expect(friendlyProjectCreationError(new Error('ACCOUNT_SUSPENDED'))).toBe(
      'Sua conta está temporariamente suspensa.',
    );
    expect(friendlyProjectCreationError(new Error('DISCORD_REQUIRED'))).toBe(
      'Conecte seu Discord antes de continuar.',
    );
    expect(friendlyProjectCreationError(new Error('INVALID_PROJECT_AREAS'))).toBe(
      'Selecione áreas válidas para o projeto.',
    );
    expect(friendlyProjectCreationError(new Error('INVALID_PROJECT_ROLE'))).toBe(
      'Escolha uma função entre as áreas do projeto.',
    );
    expect(friendlyProjectCreationError(new Error('Escopo inválido'))).toBe(
      'Revise o escopo do projeto antes de criar.',
    );
    expect(friendlyProjectCreationError(new Error('Data final anterior à inicial'))).toBe(
      'A data de conclusão precisa ser posterior à data de início.',
    );
    expect(friendlyProjectCreationError(new Error('projects_planned_dates_order'))).toBe(
      'A data de conclusão precisa ser posterior à data de início.',
    );
    expect(friendlyProjectCreationError(new Error('Template indisponível'))).toBe(
      'Este template não está disponível para criar um projeto.',
    );
    expect(friendlyProjectCreationError(new Error('Projeto indisponível'))).toBe(
      'Este projeto não está disponível para criar uma nova squad.',
    );
  });

  it('keeps unknown and internal database errors generic', () => {
    const fallback = 'Não foi possível criar o projeto neste momento.';
    expect(
      friendlyProjectCreationError(new Error('unknown SQL constraint internal_table_key')),
    ).toBe(fallback);
    expect(friendlyProjectCreationError({ message: 'stack trace', details: 'private data' })).toBe(
      fallback,
    );
    expect(friendlyProjectCreationError({ code: 'P0001' })).toBe(fallback);
  });
});
