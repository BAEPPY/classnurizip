import { useEffect, useState } from 'react';
import { categories, type Category } from './api';

export type StoryDraft = { category: Category; title: string; content: string };
type SaveState = 'empty' | 'saved' | 'error';
type DraftState = {
  draft: StoryDraft;
  saveState: SaveState;
  restored: boolean;
  storedValue: string | null;
};
const emptyDraft = (): StoryDraft => ({ category: 'daily', title: '', content: '' });
export const hasDraftText = (draft: StoryDraft) =>
  Boolean(draft.title.trim() || draft.content.trim());

function readDraft(key: string): DraftState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    if (!raw) return { draft: emptyDraft(), saveState: 'empty', restored: false, storedValue: raw };
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      typeof value.title !== 'string' ||
      value.title.length > 80 ||
      typeof value.content !== 'string' ||
      value.content.length > 3000 ||
      !categories.some((category) => category.id === value.category)
    )
      return { draft: emptyDraft(), saveState: 'empty', restored: false, storedValue: raw };
    const draft = { title: value.title, content: value.content, category: value.category };
    return {
      draft,
      saveState: hasDraftText(draft) ? 'saved' : 'empty',
      restored: hasDraftText(draft),
      storedValue: raw,
    };
  } catch {
    return { draft: emptyDraft(), saveState: 'error', restored: false, storedValue: raw };
  }
}

export function useStoryDraft(nickname: string) {
  const key = `topten:story-draft:v1:${encodeURIComponent(nickname.normalize('NFKC').toLowerCase())}`;
  const [state, setState] = useState(() => readDraft(key));
  useEffect(() => {
    function changedInAnotherTab(event: StorageEvent) {
      if (event.key !== key && event.key !== null) return;
      setState((current) => {
        if (event.newValue === current.storedValue) return current;
        if (!hasDraftText(current.draft)) return readDraft(key);
        // Keep this tab's writing visible and stop claiming it is safely saved.
        return { ...current, saveState: 'error' };
      });
    }
    window.addEventListener('storage', changedInAnotherTab);
    return () => window.removeEventListener('storage', changedInAnotherTab);
  }, [key]);

  function updateDraft(draft: StoryDraft) {
    let saveState: SaveState = hasDraftText(draft) ? 'saved' : 'empty';
    let storedValue = state.storedValue;
    try {
      // An older tab must not overwrite another tab's newer saved story.
      if (localStorage.getItem(key) !== storedValue)
        throw new Error('Draft changed in another tab');
      // Save in the input handler, so closing or refreshing immediately cannot
      // drop the last edit while waiting for a debounce timer or React effect.
      const nextValue = hasDraftText(draft) ? JSON.stringify({ version: 1, ...draft }) : null;
      if (nextValue) localStorage.setItem(key, nextValue);
      else localStorage.removeItem(key);
      storedValue = nextValue;
    } catch {
      saveState = 'error';
    }
    setState({ draft, saveState, restored: false, storedValue });
  }

  function clearDraft() {
    try {
      if (localStorage.getItem(key) !== state.storedValue) {
        // Publishing this tab's story must keep a newer draft from another tab.
        setState(readDraft(key));
        return;
      }
    } catch {
      /* updateDraft reports unavailable storage without losing UI state. */
    }
    updateDraft(emptyDraft());
  }

  // Board owns the hook so a temporarily unavailable browser store still keeps
  // the current draft in memory when the composer is closed and reopened.
  return { ...state, updateDraft, clearDraft };
}
