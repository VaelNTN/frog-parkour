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
    chargeRatio?: number;
    mouthOpen?: boolean;
    blink?: boolean;
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
    chargeRatio = 0,
    mouthOpen = false,
    blink = false,
  } = opts;

  const s = size;
  const sy = Math.max(0.58, Math.min(1.42, Number.isFinite(squashY) ? squashY : 1));
  const sx = Math.max(0.68, Math.min(1.42, 1 / Math.pow(sy, 0.75)));
  const safeTilt = Number.isFinite(tilt) ? Math.max(-0.55, Math.min(0.55, tilt)) : 0;
  const safeCharge = Math.max(0, Math.min(1, Number.isFinite(chargeRatio) ? chargeRatio : 0));
  const anchorShiftY = (1 - sy) * s * 0.48;

  ctx.save();
  ctx.translate(x, y + anchorShiftY);
  ctx.rotate(safeTilt);
  ctx.scale(sx, sy);

  const outline = '#052e16';
  const strokeW = Math.max(1.8, s * 0.07);

  // 1. Articulated Hind Legs (Thigh + Calf + Webbed Foot with Toe Pads)
  for (const side of [-1, 1]) {
    const hipX = side * s * 0.46;
    const hipY = s * 0.2;

    if (airborne) {
      // Dynamic mid-jump leg extension
      const kneeX = side * s * 0.68;
      const kneeY = s * 0.5;
      const ankleX = side * s * 0.56;
      const ankleY = s * 0.88;
      const footX = side * s * 0.68;
      const footY = s * 1.04;

      // Thigh muscle
      ctx.fillStyle = skin.spots;
      ctx.strokeStyle = outline;
      ctx.lineWidth = strokeW;
      ctx.beginPath();
      ctx.ellipse(
        (hipX + kneeX) * 0.5,
        (hipY + kneeY) * 0.5,
        s * 0.17,
        s * 0.28,
        side * -0.58,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();

      // Calf muscle
      ctx.fillStyle = skin.body;
      ctx.beginPath();
      ctx.ellipse(
        (kneeX + ankleX) * 0.5,
        (kneeY + ankleY) * 0.5,
        s * 0.115,
        s * 0.26,
        side * 0.25,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();

      // Webbed hind foot fan + 3 distinct toe pads
      drawWebbedFoot(ctx, ankleX, ankleY, footX, footY, side, s, skin.body, skin.belly, outline, strokeW * 0.85, true);
    } else {
      // Coiled thigh & calf when perched / charging
      const coil = charging ? 0.35 + safeCharge * 0.65 : 0.22;
      const kneeX = side * s * (0.74 - coil * 0.08);
      const kneeY = s * (0.12 - coil * 0.14);
      const ankleX = side * s * (0.58 - coil * 0.04);
      const ankleY = s * 0.42;
      const footX = side * s * 0.84;
      const footY = s * 0.45;

      // Calf tucked underneath thigh
      ctx.fillStyle = skin.spots;
      ctx.strokeStyle = outline;
      ctx.lineWidth = strokeW;
      ctx.beginPath();
      ctx.ellipse(
        (kneeX + ankleX) * 0.5,
        (kneeY + ankleY) * 0.5 + s * 0.04,
        s * 0.22,
        s * 0.11,
        side * (0.35 + coil * 0.2),
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();

      // Muscular thigh coiled above calf
      ctx.fillStyle = skin.body;
      ctx.beginPath();
      ctx.ellipse(
        (hipX + kneeX) * 0.5,
        (hipY + kneeY) * 0.5,
        s * 0.27,
        s * (0.165 + coil * 0.025),
        side * (-0.18 - coil * 0.24),
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();

      // Thigh muscle highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(
        (hipX + kneeX) * 0.5,
        (hipY + kneeY) * 0.5 - s * 0.05,
        s * 0.15,
        s * 0.05,
        side * (-0.18 - coil * 0.24),
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Webbed hind foot planted with 3 toe pads
      drawWebbedFoot(ctx, ankleX, ankleY, footX, footY, side, s, skin.body, skin.belly, outline, strokeW * 0.85, false);
    }
  }

  // 2. Body with Smooth Shading
  const bodyGrad = ctx.createLinearGradient(0, -s * 0.55, 0, s * 0.55);
  bodyGrad.addColorStop(0, skin.body);
  bodyGrad.addColorStop(0.75, skin.body);
  bodyGrad.addColorStop(1, skin.spots);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = outline;
  ctx.lineWidth = strokeW;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.74, s * 0.54, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Top glossy dorsal highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.08, -s * 0.25, s * 0.44, s * 0.15, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // 3. Dappled / Spotted Back Markings
  for (const [spX, spY, spR] of [
    [-0.4, -0.16, 0.095],
    [0.39, -0.12, 0.088],
    [-0.28, 0.06, 0.065],
    [0.27, 0.05, 0.058],
    [-0.04, -0.32, 0.068],
    [0.14, -0.25, 0.05],
  ]) {
    ctx.fillStyle = skin.spots;
    ctx.beginPath();
    ctx.arc(s * spX, s * spY, s * spR, 0, Math.PI * 2);
    ctx.fill();

    // Subtle lighter inner dapple speck
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.arc(s * (spX - 0.015), s * (spY - 0.015), s * spR * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Textured Cream-Gold Belly
  const bellyGrad = ctx.createLinearGradient(0, -s * 0.12, 0, s * 0.48);
  bellyGrad.addColorStop(0, '#fef9c3');
  bellyGrad.addColorStop(0.55, skin.belly);
  bellyGrad.addColorStop(1, '#fde68a');
  ctx.fillStyle = bellyGrad;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.16, s * 0.49, s * 0.31, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly rim contour & subtle rib texture lines
  ctx.strokeStyle = 'rgba(20, 83, 45, 0.16)';
  ctx.lineWidth = Math.max(1, s * 0.032);
  ctx.stroke();
  for (const [ry, rw] of [
    [0.08, 0.24],
    [0.19, 0.31],
    [0.3, 0.23],
  ]) {
    ctx.beginPath();
    ctx.arc(0, s * (ry - 0.14), s * rw, 0.35 * Math.PI, 0.65 * Math.PI);
    ctx.stroke();
  }

  // 5. Front Arms & Fingers with Toe Pads
  ctx.lineWidth = Math.max(1.5, s * 0.055);
  for (const side of [-1, 1]) {
    const shX = side * s * 0.42;
    const shY = s * 0.08;
    const handX = airborne ? side * s * 0.62 : side * s * 0.33;
    const handY = airborne ? -s * 0.06 : s * 0.43;

    ctx.fillStyle = skin.body;
    ctx.strokeStyle = outline;
    ctx.beginPath();
    ctx.ellipse(
      (shX + handX) * 0.5,
      (shY + handY) * 0.5,
      s * 0.105,
      s * 0.18,
      airborne ? side * 0.85 : side * 0.18,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();

    // 3 cute fingers with distinct toe pads
    const baseAngle = airborne ? (side > 0 ? -0.35 : Math.PI + 0.35) : Math.PI * 0.5 - side * 0.18;
    for (const spread of [-0.45, 0, 0.45]) {
      const a = baseAngle + spread;
      const tipX = handX + Math.cos(a) * s * 0.11;
      const tipY = handY + Math.sin(a) * s * 0.11;
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.4, s * 0.045);
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.fillStyle = skin.belly;
      ctx.beginPath();
      ctx.arc(tipX, tipY, s * 0.044, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 6. Rosy Cheeks
  ctx.fillStyle = charging ? 'rgba(251, 113, 133, 0.5)' : 'rgba(251, 113, 133, 0.32)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * s * 0.44, -s * 0.06, s * 0.115, s * 0.065, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. Cute Nostrils
  ctx.fillStyle = outline;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * s * 0.085, -s * 0.25, s * 0.026, s * 0.018, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // 8. Expressive Mouth Line
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.8, s * 0.058);
  ctx.lineCap = 'round';
  if (mouthOpen) {
    ctx.fillStyle = '#881337';
    ctx.beginPath();
    ctx.ellipse(s * 0.05, -s * 0.04, s * 0.21, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cute pink tongue inside mouth
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.ellipse(s * 0.05, s * 0.02, s * 0.13, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (charging) {
    // Focused smirk while charging
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 0.04);
    ctx.quadraticCurveTo(0, -s * 0.11, s * 0.26, -s * 0.02);
    ctx.stroke();
  } else {
    // Big cheerful frog smile with dimples
    ctx.beginPath();
    ctx.arc(0, -s * 0.12, s * 0.34, 0.22, Math.PI - 0.22);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * s * 0.32, -s * 0.03, s * 0.02, 0, Math.PI * 2);
      ctx.fillStyle = outline;
      ctx.fill();
    }
  }

  // 9. Expressive Large Shaded Eyes (Colored Iris, Crisp Pupil, Brows, Dual Highlights)
  const lookX = Math.max(-0.06, Math.min(0.08, eyeLookX));
  const lookY = Math.max(-0.06, Math.min(0.06, eyeLookY));
  const irisColor = skin.id === 1 ? '#0ea5e9' : skin.id === 2 ? '#f59e0b' : '#eab308';
  const irisDark = skin.id === 1 ? '#0369a1' : skin.id === 2 ? '#b45309' : '#a16207';

  for (const side of [-1, 1]) {
    const ex = side * s * 0.34;
    const ey = -s * 0.49;
    const eyeSocketR = s * 0.255;
    const scleraR = s * 0.185;

    // Outer eye socket
    ctx.fillStyle = skin.body;
    ctx.strokeStyle = outline;
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeSocketR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (blink && !charging && !airborne) {
      // Happy closed eyelid blink
      ctx.fillStyle = skin.spots;
      ctx.beginPath();
      ctx.arc(ex, ey - s * 0.01, scleraR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.8, s * 0.06);
      ctx.beginPath();
      ctx.arc(ex, ey + s * 0.02, scleraR * 0.72, Math.PI + 0.3, -0.3);
      ctx.stroke();
      continue;
    }

    // Sclera with soft upper lid shadow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey - s * 0.015, scleraR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.beginPath();
    ctx.arc(ex, ey - s * 0.015, scleraR, Math.PI + 0.15, -0.15);
    ctx.fill();

    // Colored Iris
    const px = ex + s * lookX;
    const py = ey - s * 0.015 + s * lookY;
    const irisR = scleraR * 0.66;
    const irisGrad = ctx.createRadialGradient(px, py, irisR * 0.2, px, py, irisR);
    irisGrad.addColorStop(0, irisColor);
    irisGrad.addColorStop(1, irisDark);
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(px, py, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Crisp Pupil (widens mid-air, tightens when charging)
    const pupilRx = airborne ? s * 0.088 : charging ? s * 0.068 : s * 0.078;
    const pupilRy = airborne ? s * 0.088 : charging ? s * 0.056 : s * 0.072;
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.ellipse(px, py, pupilRx, pupilRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dual Glossy Specular Eye Highlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - s * 0.042, py - s * 0.048, s * 0.042, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + s * 0.045, py + s * 0.036, s * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // Eyelid / Brow expression
    ctx.strokeStyle = outline;
    ctx.lineCap = 'round';
    if (charging) {
      // Determined angled upper eyelid & brow
      ctx.fillStyle = skin.spots;
      ctx.beginPath();
      ctx.arc(ex, ey - s * 0.015, scleraR, Math.PI + 0.1, -0.1);
      ctx.closePath();
      ctx.fill();

      ctx.lineWidth = Math.max(2, s * 0.065);
      ctx.beginPath();
      ctx.moveTo(ex - side * s * 0.15, ey - s * 0.19);
      ctx.lineTo(ex + side * s * 0.13, ey - s * 0.28);
      ctx.stroke();
    } else if (airborne) {
      // Excited raised brow arc
      ctx.lineWidth = Math.max(1.5, s * 0.048);
      ctx.beginPath();
      ctx.arc(ex, ey - s * 0.14, s * 0.16, Math.PI + 0.45, -0.45);
      ctx.stroke();
    }
  }

  // 10. Accessories
  if (accessory === 'kroon') {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = Math.max(1.8, s * 0.055);
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 0.64);
    ctx.lineTo(-s * 0.28, -s * 0.96);
    ctx.lineTo(-s * 0.08, -s * 0.8);
    ctx.lineTo(0, -s * 1.04);
    ctx.lineTo(s * 0.08, -s * 0.8);
    ctx.lineTo(s * 0.28, -s * 0.96);
    ctx.lineTo(s * 0.24, -s * 0.64);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(0, -s * 0.78, s * 0.05, 0, Math.PI * 2);
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
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = Math.max(2, s * 0.05);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(side * s * 0.34 - s * 0.17, -s * 0.64, s * 0.34, s * 0.25, s * 0.07);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(1.2, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(side * s * 0.34 - s * 0.09, -s * 0.59);
      ctx.lineTo(side * s * 0.34 + s * 0.04, -s * 0.47);
      ctx.stroke();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = Math.max(2, s * 0.05);
    }
    ctx.beginPath();
    ctx.moveTo(-s * 0.17, -s * 0.53);
    ctx.lineTo(s * 0.17, -s * 0.53);
    ctx.stroke();
  } else if (accessory === 'pet') {
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = Math.max(1.6, s * 0.05);
    ctx.beginPath();
    ctx.arc(0, -s * 0.65, s * 0.32, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-s * 0.02, -s * 0.7, s * 0.58, s * 0.1, s * 0.04);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(0, -s * 0.97, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawWebbedFoot(
  ctx: CanvasRenderingContext2D,
  ankleX: number,
  ankleY: number,
  footX: number,
  footY: number,
  side: number,
  s: number,
  bodyColor: string,
  padColor: string,
  outline: string,
  lineW: number,
  airborne: boolean
): void {
  const baseAngle = airborne ? Math.atan2(footY - ankleY, footX - ankleX) : side > 0 ? 0.12 : Math.PI - 0.12;
  const toeSpread = airborne ? 0.42 : 0.34;
  const toeLen = s * (airborne ? 0.24 : 0.25);

  const toes: [number, number][] = [-toeSpread, 0, toeSpread].map((offset) => {
    const a = baseAngle + offset;
    return [ankleX + Math.cos(a) * toeLen, ankleY + Math.sin(a) * toeLen];
  });

  // Translucent webbing membrane between toes
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(ankleX, ankleY);
  ctx.lineTo(toes[0][0], toes[0][1]);
  ctx.quadraticCurveTo((toes[0][0] + toes[1][0]) * 0.5, (toes[0][1] + toes[1][1]) * 0.5, toes[1][0], toes[1][1]);
  ctx.quadraticCurveTo((toes[1][0] + toes[2][0]) * 0.5, (toes[1][1] + toes[2][1]) * 0.5, toes[2][0], toes[2][1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Distinct rounded toe pads at tips
  ctx.fillStyle = padColor;
  for (const [tx, ty] of toes) {
    ctx.beginPath();
    ctx.arc(tx, ty, s * 0.052, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
