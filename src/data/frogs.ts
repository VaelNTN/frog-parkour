export interface FrogSkin {
  id: number;
  name: string;
  body: string;
  belly: string;
  spots: string;
}

export type FrogAccessoryId = 'none' | 'kroon' | 'ninja' | 'bril' | 'pet';

export const FROG_SKINS: FrogSkin[] = [
  { id: 0, name: 'Boomkikker', body: '#22c55e', belly: '#bef264', spots: '#15803d' },
  { id: 1, name: 'Gouden Kikvors', body: '#facc15', belly: '#fef9c3', spots: '#ca8a04' },
  { id: 2, name: 'Gifkikker Blauw', body: '#0ea5e9', belly: '#bae6fd', spots: '#1e3a8a' },
  { id: 3, name: 'Lava Kikker', body: '#ef4444', belly: '#fed7aa', spots: '#7f1d1d' },
  { id: 4, name: 'Ninja Kikker', body: '#334155', belly: '#94a3b8', spots: '#0f172a' },
  { id: 5, name: 'Paarse Prins', body: '#a855f7', belly: '#e9d5ff', spots: '#581c87' },
];

export const FROG_ACCESSORIES: { id: FrogAccessoryId; label: string }[] = [
  { id: 'none', label: 'Geen' },
  { id: 'kroon', label: 'Kroon' },
  { id: 'ninja', label: 'Hoofdband' },
  { id: 'bril', label: 'Zonnebril' },
  { id: 'pet', label: 'Petje' },
];

export function getFrogSkin(id: number): FrogSkin {
  return FROG_SKINS.find((f) => f.id === id) || FROG_SKINS[0];
}
