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

const PENDING_KEY = 'frog_parkour_pending_scores_v1';

export interface FrogScorePayload {
  deviceId: string;
  playerName: string;
  score: number;
  meters: number;
  flies: number;
  skinId: number;
  accessory: FrogAccessoryId;
}

function loadPendingScores(): FrogScorePayload[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function savePendingScores(items: FrogScorePayload[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(0, 5)));
  } catch {
    // Ignore storage quota issues
  }
}

function enqueuePendingScore(payload: FrogScorePayload): void {
  const existing = loadPendingScores();
  existing.push(payload);
  existing.sort((a, b) => b.score - a.score);
  savePendingScores(existing.slice(0, 5));
}

async function postFrogScore(base: string, payload: FrogScorePayload): Promise<boolean> {
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
    return false;
  }
}

export async function submitGlobalFrogScore(
  baseUrl: string,
  payload: FrogScorePayload
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
  if (Math.round(payload.score) <= 0) return false;
  const ok = await postFrogScore(base, payload);
  if (!ok) enqueuePendingScore(payload);
  return ok;
}

export async function flushPendingFrogScores(baseUrl: string): Promise<void> {
  const base = cleanUrl(baseUrl);
  if (!base) return;
  const pending = loadPendingScores();
  if (pending.length === 0) return;
  const remaining: FrogScorePayload[] = [];
  for (const item of pending) {
    const ok = await postFrogScore(base, item);
    if (!ok) remaining.push(item);
  }
  savePendingScores(remaining);
}

