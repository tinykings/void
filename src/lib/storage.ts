import { Media, UserState } from './types';

const STORAGE_KEY = 'void_user_state';

const defaultState: UserState = {
  apiKey: '',
  watchlist: [],
  watched: [],
  githubToken: '',
  gistId: '',
  vidAngelEnabled: false,
};

export const loadState = (): UserState => {
  if (typeof window === 'undefined') return defaultState;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState;
  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to parse state', e);
    return defaultState;
  }
};

export const saveState = (state: Partial<UserState>) => {
  if (typeof window === 'undefined') return;
  const current = loadState();
  const next = { ...current, ...state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const toggleInList = (media: Media, listType: 'watchlist' | 'watched') => {
  const state = loadState();
  const list = state[listType];
  const exists = list.find((m) => m.id === media.id && m.media_type === media.media_type);

  if (exists) {
    state[listType] = list.filter((m) => !(m.id === media.id && m.media_type === media.media_type));
  } else {
    state[listType] = [...list, media];
    // If adding to watched, maybe remove from watchlist?
    if (listType === 'watched') {
      state.watchlist = state.watchlist.filter((m) => !(m.id === media.id && m.media_type === media.media_type));
    }
  }
  
  saveState(state);
  return state;
};
