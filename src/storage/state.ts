import { Device } from '@capacitor/device';
import { FrogAccessoryId } from '../data/frogs';

const SAVE_KEY = 'frog_parkour_save_v1';
const DEVICE_KEY = 'frog_parkour_device_id_v1';

export interface FrogHighscore {
  id: string;
  playerName: string;
  score: number;
  meters: number;
  flies: number;
  skinId: number;
  accessory: FrogAccessoryId;
  createdAt: string;
}

export interface FrogState {
  deviceId: string;
  apiBaseUrl: string;
  skinId: number;
  accessory: FrogAccessoryId;
  playerName: string;
  soundEnabled: boolean;
  bestScore: number;
  bestMeters: number;
  highscores: FrogHighscore[];
}

function generateFallbackDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `fp-${crypto.randomUUID()}`;
  }
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function resolveDeviceId(): Promise<string> {
  const cached = localStorage.getItem(DEVICE_KEY);
  try {
    const info = await Device.getId();
    if (info?.identifier && info.identifier.trim().length >= 4) {
      const id = `phone-${info.identifier.trim()}`;
      localStorage.setItem(DEVICE_KEY, id);
      return id;
    }
  } catch {
    // Web fallback
  }
  if (cached && cached.trim().length >= 4) return cached;
  const fresh = generateFallbackDeviceId();
  localStorage.setItem(DEVICE_KEY, fresh);
  return fresh;
}

export function loadFrogState(deviceId: string): FrogState {
  const defaultApi = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const base: FrogState = {
    deviceId,
    apiBaseUrl: defaultApi,
    skinId: 0,
    accessory: 'none',
    playerName: 'FrogKing',
    soundEnabled: true,
    bestScore: 0,
    bestMeters: 0,
    highscores: [],
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<FrogState>;
    return {
      deviceId,
      apiBaseUrl:
        typeof parsed.apiBaseUrl === 'string' && parsed.apiBaseUrl.trim()
          ? parsed.apiBaseUrl.trim().replace(/\/+$/, '')
          : defaultApi,
      skinId: typeof parsed.skinId === 'number' ? parsed.skinId : 0,
      accessory: parsed.accessory || 'none',
      playerName:
        typeof parsed.playerName === 'string' && parsed.playerName.trim()
          ? parsed.playerName.trim()
          : 'FrogKing',
      soundEnabled: parsed.soundEnabled !== false,
      bestScore: Math.max(0, Number(parsed.bestScore || 0)),
      bestMeters: Math.max(0, Number(parsed.bestMeters || 0)),
      highscores: Array.isArray(parsed.highscores) ? parsed.highscores : [],
    };
  } catch {
    return base;
  }
}

export function saveFrogState(state: FrogState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

export function recordFrogScore(state: FrogState, score: number, meters: number, flies: number): void {
  if (score <= 0) return;
  if (score > state.bestScore) state.bestScore = score;
  if (meters > state.bestMeters) state.bestMeters = meters;
  state.highscores.push({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    playerName: state.playerName.trim() || 'FrogKing',
    score,
    meters,
    flies,
    skinId: state.skinId,
    accessory: state.accessory,
    createdAt: new Date().toISOString(),
  });
  state.highscores = state.highscores.sort((a, b) => b.score - a.score).slice(0, 50);
  saveFrogState(state);
}
