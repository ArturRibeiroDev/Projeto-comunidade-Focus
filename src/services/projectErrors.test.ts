import { describe, expect, it } from 'vitest';
import { friendlyProjectError } from './projectErrors';

describe('friendlyProjectError', () => {
  it('traduz os limites do banco', () => {
    expect(friendlyProjectError('OWNED_PROJECT_LIMIT:3')).toContain('3 projetos');
    expect(friendlyProjectError('DAILY_PROJECT_LIMIT:3')).toContain('24 horas');
    expect(friendlyProjectError('JOINED_PROJECT_LIMIT:5')).toContain('5 projetos ativos');
    expect(friendlyProjectError('ACCOUNT_SUSPENDED')).toContain('suspensa');
  });
});
