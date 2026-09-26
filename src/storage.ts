import { initialState } from './data/seed';
import type { HubState } from './types';

const STORAGE_KEY = 'focus-hub-state-v1';

export function loadHubState(): HubState {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return initialState;
  }

  try {
    const parsed = JSON.parse(stored) as HubState;

    if (!parsed.profile || !Array.isArray(parsed.projects)) {
      return initialState;
    }

    return {
      ...parsed,
      profile: {
        ...parsed.profile,
        evidence: parsed.profile.evidence.map((item) => ({
          ...item,
          label: item.label.replaceAll('Focus Hub', 'FocusEdu')
        }))
      }
    };
  } catch {
    return initialState;
  }
}

export function saveHubState(state: HubState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetHubState() {
  window.localStorage.removeItem(STORAGE_KEY);
}
