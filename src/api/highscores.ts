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
  return baseUrl.trim().replace(/\/+$/, '');
}

export async function fetchGlobalFrogHighscores(
  baseUrl: string,
  deviceId: string,
  limit = 50
): Promise<GlobalFrogResponse> {
  const base = cleanUrl(baseUrl);
  if (!base) throw new Error('NO_BACKEND_URL');
  const res = await fetch(
    `${base}/api/frog-parkour/highscores?limit=${limit}&deviceId=${encodeURIComponent(deviceId)}`,
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
): Promise<void> {
  const base = cleanUrl(baseUrl);
  if (!base || payload.score <= 0) return;
  try {
    await fetch(`${base}/api/frog-parkour/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: payload.deviceId,
        playerName: payload.playerName.trim() || 'FrogKing',
        score: payload.score,
        meters: payload.meters,
        flies: payload.flies,
        skinId: payload.skinId,
        accessory: payload.accessory,
      }),
    });
  } catch {
    // Offline fallback stays silent
  }
}
