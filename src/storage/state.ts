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

function sanitizePositiveNumber(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const VALID_ACCESSORIES: ReadonlySet<FrogAccessoryId> = new Set([
  'none',
  'kroon',
  'ninja',
  'bril',
  'pet',
]);

function sanitizeAccessory(val: unknown): FrogAccessoryId {
  return typeof val === 'string' && VALID_ACCESSORIES.has(val as FrogAccessoryId)
    ? (val as FrogAccessoryId)
    : 'none';
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
    const rawSkinId = Number(parsed.skinId);
    const skinId = Number.isInteger(rawSkinId) && rawSkinId >= 0 && rawSkinId <= 5 ? rawSkinId : 0;

    const highscores: FrogHighscore[] = Array.isArray(parsed.highscores)
      ? parsed.highscores
          .filter((item): item is FrogHighscore => {
            if (!item || typeof item !== 'object') return false;
            return Number.isFinite(Number(item.score)) && Number(item.score) > 0;
          })
          .map((item) => ({
            id: typeof item.id === 'string' && item.id ? item.id : generateFallbackDeviceId(),
            playerName:
              typeof item.playerName === 'string' && item.playerName.trim()
                ? item.playerName.trim().slice(0, 20)
                : 'FrogKing',
            score: Math.round(sanitizePositiveNumber(item.score)),
            meters: Math.round(sanitizePositiveNumber(item.meters) * 10) / 10,
            flies: Math.round(sanitizePositiveNumber(item.flies)),
            skinId:
              Number.isInteger(Number(item.skinId)) && Number(item.skinId) >= 0 && Number(item.skinId) <= 5
                ? Number(item.skinId)
                : 0,
            accessory: sanitizeAccessory(item.accessory),
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 50)
      : [];

    return {
      deviceId,
      apiBaseUrl:
        typeof parsed.apiBaseUrl === 'string' && parsed.apiBaseUrl.trim()
          ? parsed.apiBaseUrl.trim().replace(/\/+$/, '')
          : defaultApi,
      skinId,
      accessory: sanitizeAccessory(parsed.accessory),
      playerName:
        typeof parsed.playerName === 'string' && parsed.playerName.trim()
          ? parsed.playerName.trim().slice(0, 20)
          : 'FrogKing',
      soundEnabled: parsed.soundEnabled !== false,
      bestScore: Math.round(sanitizePositiveNumber(parsed.bestScore)),
      bestMeters: Math.round(sanitizePositiveNumber(parsed.bestMeters) * 10) / 10,
      highscores,
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
  if (!Number.isFinite(score) || !Number.isFinite(meters) || !Number.isFinite(flies)) return;
  const cleanScore = Math.round(score);
  const cleanMeters = Math.max(0, Math.round(meters * 10) / 10);
  const cleanFlies = Math.max(0, Math.round(flies));
  if (cleanScore <= 0) return;
  if (cleanScore > state.bestScore) state.bestScore = cleanScore;
  if (cleanMeters > state.bestMeters) state.bestMeters = cleanMeters;
  state.highscores.push({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    playerName: state.playerName.trim().slice(0, 20) || 'FrogKing',
    score: cleanScore,
    meters: cleanMeters,
    flies: cleanFlies,
    skinId: state.skinId,
    accessory: state.accessory,
    createdAt: new Date().toISOString(),
  });
  state.highscores = state.highscores.sort((a, b) => b.score - a.score).slice(0, 50);
  saveFrogState(state);
}
