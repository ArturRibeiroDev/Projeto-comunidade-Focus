import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjectTypeBadge } from './ProjectStatusBadge';

describe('project type label', () => {
  it('shows Focus Idea without changing the internal type', () => {
    expect(renderToStaticMarkup(<ProjectTypeBadge type="Focus Project" />)).toContain('Focus Idea');
  });

  it('keeps the label for an executed community project', () => {
    expect(renderToStaticMarkup(<ProjectTypeBadge type="Community Project" />)).toContain(
      'Community Project',
    );
  });
});
