import { useReducer, useCallback } from 'react';
import type { LaborEntry, JobDiaryEntry, SubcontractorWork, MaterialDelivered, PhotoAttachment, Weather } from '@/types';

export interface FormSnapshot {
  date: string;
  weather: Weather | undefined;
  comments: string;
  laborEntries: LaborEntry[];
  diaryEntries: JobDiaryEntry[];
  subcontractorEntries: SubcontractorWork[];
  deliveryEntries: MaterialDelivered[];
  photos: PhotoAttachment[];
  signature: string;
}

type Action =
  | { type: 'SET_FIELD'; field: keyof FormSnapshot; value: unknown }
  | { type: 'SET_FIELD_QUIET'; field: keyof FormSnapshot; value: unknown }
  | { type: 'TAKE_SNAPSHOT' }
  | { type: 'RESET'; snapshot: FormSnapshot }
  | { type: 'UNDO' }
  | { type: 'REDO' };

interface State {
  past: FormSnapshot[];
  current: FormSnapshot;
  future: FormSnapshot[];
}

const MAX_HISTORY = 50;

function cloneSnapshot(s: FormSnapshot): FormSnapshot {
  return structuredClone(s);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FIELD': {
      const past = [...state.past, cloneSnapshot(state.current)].slice(-MAX_HISTORY);
      const current = { ...state.current, [action.field]: action.value };
      return { past, current, future: [] };
    }
    case 'SET_FIELD_QUIET': {
      return { ...state, current: { ...state.current, [action.field]: action.value } };
    }
    case 'TAKE_SNAPSHOT': {
      const past = [...state.past, cloneSnapshot(state.current)].slice(-MAX_HISTORY);
      return { ...state, past, future: [] };
    }
    case 'RESET': {
      return { past: [], current: action.snapshot, future: [] };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      const past = state.past.slice(0, -1);
      const future = [cloneSnapshot(state.current), ...state.future];
      return { past, current: prev, future };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const future = state.future.slice(1);
      const past = [...state.past, cloneSnapshot(state.current)];
      return { past, current: next, future };
    }
    default:
      return state;
  }
}

export function useUndoRedo(initialSnapshot: FormSnapshot) {
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    current: initialSnapshot,
    future: [],
  });

  const set = useCallback(<K extends keyof FormSnapshot>(field: K, value: FormSnapshot[K]) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const setQuiet = useCallback(<K extends keyof FormSnapshot>(field: K, value: FormSnapshot[K]) => {
    dispatch({ type: 'SET_FIELD_QUIET', field, value });
  }, []);

  const takeSnapshot = useCallback(() => {
    dispatch({ type: 'TAKE_SNAPSHOT' });
  }, []);

  const reset = useCallback((snapshot: FormSnapshot) => {
    dispatch({ type: 'RESET', snapshot });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  return {
    state: state.current,
    set,
    setQuiet,
    takeSnapshot,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
