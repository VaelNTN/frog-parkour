import { FrogAccessoryId, FrogSkin } from '../data/frogs';

export function drawCartoonFrog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opts: {
    skin: FrogSkin;
    accessory: FrogAccessoryId;
    squashY?: number;
    airborne?: boolean;
    tilt?: number;
    eyeLookX?: number;
    eyeLookY?: number;
    charging?: boolean;
    mouthOpen?: boolean;
  }
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) return;

  const {
    skin,
    accessory,
    squashY = 1,
    airborne = false,
    tilt = 0,
    eyeLookX = 0.02,
    eyeLookY = 0,
    charging = false,
    mouthOpen = false,
  } = opts;

  const s = size;
  const sy = Math.max(0.58, Math.min(1.42, Number.isFinite(squashY) ? squashY : 1));
  const sx = Math.max(0.68, Math.min(1.42, 1 / Math.pow(sy, 0.75)));
  const safeTilt = Number.isFinite(tilt) ? Math.max(-0.55, Math.min(0.55, tilt)) : 0;
  const anchorShiftY = (1 - sy) * s * 0.48;

  ctx.save();
  ctx.translate(x, y + anchorShiftY);
  ctx.rotate(safeTilt);
  ctx.scale(sx, sy);

  const outline = '#052e16';
  const strokeW = Math.max(2, s * 0.075);

  // Hind legs & webbed feet
  ctx.fillStyle = skin.spots;
  ctx.strokeStyle = outline;
  ctx.lineWidth = strokeW;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (airborne) {
      ctx.ellipse(side * s * 0.5, s * 0.58, s * 0.19, s * 0.44, side * -0.45, 0, Math.PI * 2);
    } else {
      ctx.ellipse(side * s * 0.6, s * 0.27, s * 0.29, s * 0.18, side * 0.28, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Little webbed foot toes
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    if (airborne) {
      ctx.ellipse(side * s * 0.64, s * 0.96, s * 0.16, s * 0.08, side * -0.3, 0, Math.PI * 2);
    } else {
      ctx.ellipse(side * s * 0.78, s * 0.42, s * 0.18, s * 0.08, side * 0.1, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = skin.spots;
  }

  // Body
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.73, s * 0.54, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Top glossy sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.12, -s * 0.22, s * 0.42, s * 0.17, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Belly
  ctx.fillStyle = skin.belly;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.15, s * 0.48, s * 0.31, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spots
  ctx.fillStyle = skin.spots;
  for (const [spX, spY, spR] of [
    [-0.37, -0.14, 0.085],
    [0.35, -0.1, 0.078],
    [-0.22, 0.04, 0.055],
  ]) {
    ctx.beginPath();
    ctx.arc(s * spX, s * spY, s * spR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Front little hands
  ctx.fillStyle = skin.body;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.6, s * 0.06);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (airborne) {
      ctx.ellipse(side * s * 0.56, -s * 0.02, s * 0.12, s * 0.19, side * 0.65, 0, Math.PI * 2);
    } else {
      ctx.ellipse(side * s * 0.32, s * 0.38, s * 0.11, s * 0.16, side * 0.15, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }

  // Rosy cheeks
  ctx.fillStyle = charging ? 'rgba(251, 113, 133, 0.48)' : 'rgba(251, 113, 133, 0.32)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * s * 0.42, -s * 0.06, s * 0.11, s * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Big frog eyes on top
  const lookX = Math.max(-0.06, Math.min(0.08, eyeLookX));
  const lookY = Math.max(-0.06, Math.min(0.06, eyeLookY));
  ctx.lineWidth = strokeW;
  for (const side of [-1, 1]) {
    const ex = side * s * 0.34;
    const ey = -s * 0.48;

    ctx.fillStyle = skin.body;
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey - s * 0.02, s * 0.165, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(ex + s * lookX, ey - s * 0.02 + s * lookY, s * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Glossy eye catchlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + s * (lookX - 0.03), ey - s * 0.06 + s * lookY, s * 0.035, 0, Math.PI * 2);
    ctx.fill();

    // Determined eyebrows when charging
    if (charging) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(2, s * 0.065);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - side * s * 0.14, ey - s * 0.2);
      ctx.lineTo(ex + side * s * 0.12, ey - s * 0.27);
      ctx.stroke();
    }
  }

  // Mouth (open while tongue grappling, cheeky grin otherwise)
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.lineCap = 'round';
  if (mouthOpen) {
    ctx.fillStyle = '#881337';
    ctx.beginPath();
    ctx.ellipse(s * 0.06, -s * 0.04, s * 0.2, s * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, -s * 0.1, s * 0.34, 0.22, Math.PI - 0.22);
    ctx.stroke();
  }

  // Accessories
  if (accessory === 'kroon') {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = Math.max(1.8, s * 0.055);
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 0.62);
    ctx.lineTo(-s * 0.28, -s * 0.94);
    ctx.lineTo(-s * 0.08, -s * 0.78);
    ctx.lineTo(0, -s * 1.02);
    ctx.lineTo(s * 0.08, -s * 0.78);
    ctx.lineTo(s * 0.28, -s * 0.94);
    ctx.lineTo(s * 0.24, -s * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Crown gem
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(0, -s * 0.76, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  } else if (accessory === 'ninja') {
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = Math.max(1.4, s * 0.04);
    ctx.beginPath();
    ctx.roundRect(-s * 0.56, -s * 0.36, s * 1.12, s * 0.15, s * 0.05);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.56, -s * 0.29);
    ctx.lineTo(-s * 0.98, -s * 0.44);
    ctx.lineTo(-s * 0.86, -s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (accessory === 'bril') {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = Math.max(2, s * 0.05);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(side * s * 0.34 - s * 0.16, -s * 0.63, s * 0.32, s * 0.24, s * 0.07);
      ctx.fill();
      ctx.stroke();
      // Lens shine
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = Math.max(1.2, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(side * s * 0.34 - s * 0.09, -s * 0.58);
      ctx.lineTo(side * s * 0.34 + s * 0.04, -s * 0.46);
      ctx.stroke();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = Math.max(2, s * 0.05);
    }
    // Bridge
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, -s * 0.52);
    ctx.lineTo(s * 0.18, -s * 0.52);
    ctx.stroke();
  } else if (accessory === 'pet') {
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = Math.max(1.6, s * 0.05);
    ctx.beginPath();
    ctx.arc(0, -s * 0.64, s * 0.32, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-s * 0.02, -s * 0.69, s * 0.58, s * 0.1, s * 0.04);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(0, -s * 0.96, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
