import { FrogAccessoryId } from '../data/frogs';

export interface GlobalFrogEntry {
  rank: number;
  deviceId: string;
  playerName: string;
  score: number;
  meters: number;
  flies: number;
  skinId: number;
  accessory: FrogAccessoryId;
  updatedAt: string;
}

export interface GlobalFrogResponse {
  ok: boolean;
  entries: GlobalFrogEntry[];
  player: GlobalFrogEntry | null;
}

function cleanUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchGlobalFrogHighscores(
  baseUrl: string,
  deviceId: string,
  limit = 50
): Promise<GlobalFrogResponse> {
  const base = cleanUrl(baseUrl);
  if (!base) throw new Error('NO_BACKEND_URL');
  const safeLimit = Math.max(1, Math.min(100, Math.round(Number.isFinite(limit) ? limit : 50)));
  const res = await fetchWithTimeout(
    `${base}/api/frog-parkour/highscores?limit=${safeLimit}&deviceId=${encodeURIComponent(deviceId)}`,
    { method: 'GET' }
  );
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return (await res.json()) as GlobalFrogResponse;
}

export async function submitGlobalFrogScore(
  baseUrl: string,
  payload: {
    deviceId: string;
    playerName: string;
    score: number;
    meters: number;
    flies: number;
    skinId: number;
    accessory: FrogAccessoryId;
  }
): Promise<boolean> {
  const base = cleanUrl(baseUrl);
  if (
    !base ||
    !Number.isFinite(payload.score) ||
    !Number.isFinite(payload.meters) ||
    !Number.isFinite(payload.flies)
  ) {
    return false;
  }
  const cleanScore = Math.round(payload.score);
  if (cleanScore <= 0) return false;
  try {
    const res = await fetchWithTimeout(`${base}/api/frog-parkour/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: payload.deviceId,
        playerName: payload.playerName.trim().slice(0, 20) || 'FrogKing',
        score: cleanScore,
        meters: Math.max(0, Math.round(payload.meters * 10) / 10),
        flies: Math.max(0, Math.round(payload.flies)),
        skinId: Number.isInteger(payload.skinId) ? payload.skinId : 0,
        accessory: payload.accessory,
      }),
    });
    return res.ok;
  } catch {
    // Offline fallback stays silent
    return false;
  }
}
