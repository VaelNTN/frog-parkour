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
  }
): void {
  const { skin, accessory, squashY = 1, airborne = false } = opts;
  const s = size;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(2 - squashY, squashY);

  // Hind legs
  ctx.fillStyle = skin.spots;
  ctx.strokeStyle = '#052e16';
  ctx.lineWidth = Math.max(2, s * 0.07);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (airborne) {
      ctx.ellipse(side * s * 0.52, s * 0.56, s * 0.2, s * 0.44, side * -0.45, 0, Math.PI * 2);
    } else {
      ctx.ellipse(side * s * 0.6, s * 0.25, s * 0.28, s * 0.18, side * 0.3, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }

  // Body
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.72, s * 0.54, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belly
  ctx.fillStyle = skin.belly;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.14, s * 0.48, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spots
  ctx.fillStyle = skin.spots;
  for (const [sx, sy, r] of [
    [-0.36, -0.14, 0.09],
    [0.34, -0.1, 0.08],
  ]) {
    ctx.beginPath();
    ctx.arc(s * sx, s * sy, s * r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Big frog eyes on top
  for (const side of [-1, 1]) {
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.arc(side * s * 0.34, -s * 0.48, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(side * s * 0.34, -s * 0.5, s * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(side * s * 0.36, -s * 0.5, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  // Big frog grin
  ctx.strokeStyle = '#052e16';
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 0.34, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Accessories
  if (accessory === 'kroon') {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#854d0e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 0.62);
    ctx.lineTo(-s * 0.28, -s * 0.94);
    ctx.lineTo(-s * 0.08, -s * 0.78);
    ctx.lineTo(0, -s * 1.0);
    ctx.lineTo(s * 0.08, -s * 0.78);
    ctx.lineTo(s * 0.28, -s * 0.94);
    ctx.lineTo(s * 0.24, -s * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (accessory === 'ninja') {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-s * 0.56, -s * 0.36, s * 1.12, s * 0.15);
    ctx.beginPath();
    ctx.moveTo(-s * 0.56, -s * 0.29);
    ctx.lineTo(-s * 0.96, -s * 0.42);
    ctx.lineTo(-s * 0.85, -s * 0.18);
    ctx.closePath();
    ctx.fill();
  } else if (accessory === 'bril') {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = Math.max(2, s * 0.05);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(side * s * 0.34 - s * 0.16, -s * 0.63, s * 0.32, s * 0.24, s * 0.07);
      ctx.fill();
      ctx.stroke();
    }
  } else if (accessory === 'pet') {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, -s * 0.64, s * 0.32, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(0, -s * 0.68, s * 0.55, s * 0.09);
  }

  ctx.restore();
}
