import { FrogAccessoryId, FrogSkin } from '../data/frogs';
import { drawCartoonFrog } from './frogRenderer';

export type PlatformKind = 'lily' | 'rock' | 'bouncy' | 'moving';

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PlatformKind;
  moveAmp: number;
  baseY: number;
  phase: number;
  sinking: number;
  touched: boolean;
}

interface GrappleHook {
  x: number;
  y: number;
  used: boolean;
}

interface Firefly {
  x: number;
  y: number;
  collected: boolean;
  phase: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface FrogParkourCallbacks {
  onHudUpdate: (score: number, meters: number, flies: number, combo: number) => void;
  onJump: () => void;
  onTongue: () => void;
  onFlyCollect: () => void;
  onGameOver: (score: number, meters: number, flies: number) => void;
}

export class FrogParkourStage {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private skin: FrogSkin;
  private accessory: FrogAccessoryId;
  private callbacks: FrogParkourCallbacks;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private active = false;
  private rafId: number | null = null;
  private lastTime = 0;
  private clock = 0;

  private frogX = 120;
  private frogY = 260;
  private vx = 0;
  private vy = 0;
  private grounded = true;
  private canDoubleHop = true;
  private charging = false;
  private chargeRatio = 0;
  private chargeDir = 1;
  private dead = false;

  private grappling = false;
  private grappleTarget: GrappleHook | null = null;
  private grappleAngle = 0;
  private grappleAngVel = 0;
  private grappleLen = 110;

  private cameraX = 0;
  private startX = 120;
  private maxMeters = 0;
  private flies = 0;
  private combo = 1;
  private bonusPoints = 0;

  private platforms: Platform[] = [];
  private hooks: GrappleHook[] = [];
  private fireflies: Firefly[] = [];
  private popups: Popup[] = [];
  private generatedUpToX = 0;

  constructor(
    canvas: HTMLCanvasElement,
    opts: { skin: FrogSkin; accessory: FrogAccessoryId },
    callbacks: FrogParkourCallbacks
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D unavailable');
    this.ctx = context;
    this.skin = opts.skin;
    this.accessory = opts.accessory;
    this.callbacks = callbacks;

    this.handleResize = this.handleResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.loop = this.loop.bind(this);
  }

  public setAppearance(opts: { skin: FrogSkin; accessory: FrogAccessoryId }): void {
    this.skin = opts.skin;
    this.accessory = opts.accessory;
  }

  public resetGame(): void {
    const baseH = Math.max(420, this.height || 640);
    const startY = baseH * 0.68;
    this.platforms = [
      { x: 40, y: startY, w: 170, h: 22, kind: 'rock', moveAmp: 0, baseY: startY, phase: 0, sinking: 0, touched: true },
    ];
    this.hooks = [];
    this.fireflies = [];
    this.popups = [];
    this.generatedUpToX = 210;

    this.frogX = 125;
    this.startX = 125;
    this.frogY = startY - 22;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.canDoubleHop = true;
    this.charging = false;
    this.chargeRatio = 0;
    this.grappling = false;
    this.grappleTarget = null;
    this.dead = false;

    this.cameraX = 0;
    this.maxMeters = 0;
    this.flies = 0;
    this.combo = 1;
    this.bonusPoints = 0;

    this.ensureWorldGenerated();
    this.callbacks.onHudUpdate(0, 0, 0, 1);
  }

  private ensureWorldGenerated(): void {
    const targetX = this.cameraX + Math.max(900, this.width + 600);
    const baseH = Math.max(420, this.height || 640);
    while (this.generatedUpToX < targetX) {
      const prev = this.platforms[this.platforms.length - 1];
      const gap = 85 + Math.random() * 145;
      const nx = prev.x + prev.w + gap;
      const ny = Math.max(baseH * 0.38, Math.min(baseH * 0.76, prev.baseY + (Math.random() - 0.5) * 140));
      const nw = Math.max(72, 130 - this.maxMeters * 0.18 + Math.random() * 45);
      const roll = Math.random();
      const kind: PlatformKind =
        roll < 0.24 ? 'bouncy' : roll < 0.45 ? 'moving' : roll < 0.72 ? 'lily' : 'rock';

      this.platforms.push({
        x: nx,
        y: ny,
        w: nw,
        h: 20,
        kind,
        moveAmp: kind === 'moving' ? 28 + Math.random() * 24 : 0,
        baseY: ny,
        phase: Math.random() * Math.PI * 2,
        sinking: 0,
        touched: false,
      });

      // Place a grapple lotus hook above wide gaps
      if (gap > 140) {
        this.hooks.push({
          x: prev.x + prev.w + gap * 0.5,
          y: Math.min(prev.baseY, ny) - 135,
          used: false,
        });
      }

      if (Math.random() < 0.75) {
        this.fireflies.push({
          x: prev.x + prev.w + gap * 0.55,
          y: Math.min(prev.baseY, ny) - 55 - Math.random() * 55,
          collected: false,
          phase: Math.random() * Math.PI * 2,
        });
      }

      this.generatedUpToX = nx + nw;
    }
  }

  public start(): void {
    if (this.active) return;
    this.active = true;
    this.handleResize();
    if (this.platforms.length === 0) this.resetGame();
    window.addEventListener('resize', this.handleResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.active = false;
    window.removeEventListener('resize', this.handleResize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
  }

  private onPointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    if (this.dead) return;
    if (this.grounded) {
      this.charging = true;
      this.chargeRatio = 0.15;
      this.chargeDir = 1;
      return;
    }

    // Mid-air: try tongue grapple to nearest unused hook ahead/above!
    if (!this.grappling) {
      let bestHook: GrappleHook | null = null;
      let bestDist = 230;
      for (const h of this.hooks) {
        if (h.used) continue;
        const d = Math.hypot(h.x - this.frogX, h.y - this.frogY);
        if (d < bestDist && h.y < this.frogY + 40) {
          bestDist = d;
          bestHook = h;
        }
      }
      if (bestHook) {
        this.grappling = true;
        this.grappleTarget = bestHook;
        bestHook.used = true;
        this.grappleLen = Math.max(70, Math.min(165, bestDist));
        this.grappleAngle = Math.atan2(this.frogX - bestHook.x, this.frogY - bestHook.y);
        this.grappleAngVel = Math.max(2.4, Math.hypot(this.vx, this.vy) / this.grappleLen);
        this.callbacks.onTongue();
        return;
      }

      // Otherwise mid-air double hop!
      if (this.canDoubleHop) {
        this.canDoubleHop = false;
        this.vx = Math.max(this.vx, 220);
        this.vy = -440;
        this.popups.push({ x: this.frogX, y: this.frogY - 24, text: 'DUBBEL HOP!', color: '#bae6fd', life: 0 });
        this.callbacks.onJump();
      }
    }
  }

  private onPointerUp(): void {
    if (this.dead) return;
    if (this.grappling) {
      this.grappling = false;
      this.grappleTarget = null;
      this.vx = Math.max(260, this.vx + 120);
      this.vy = Math.min(-340, this.vy - 120);
      this.canDoubleHop = true;
      this.callbacks.onJump();
      return;
    }

    if (this.charging && this.grounded) {
      this.charging = false;
      const power = 0.25 + this.chargeRatio * 0.75;
      this.vx = 185 + power * 270;
      this.vy = -(380 + power * 430);
      this.grounded = false;
      this.chargeRatio = 0;
      this.callbacks.onJump();
    }
  }

  private currentScore(): number {
    return Math.round(this.maxMeters * 10 + this.bonusPoints);
  }

  private loop(now: number): void {
    if (!this.active) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.clock += dt;

    if (!this.dead) {
      if (this.charging && this.grounded) {
        this.chargeRatio += dt * 1.45 * this.chargeDir;
        if (this.chargeRatio >= 1) {
          this.chargeRatio = 1;
          this.chargeDir = -1;
        } else if (this.chargeRatio <= 0.12) {
          this.chargeRatio = 0.12;
          this.chargeDir = 1;
        }
      }

      // Update moving/sinking platforms
      for (const p of this.platforms) {
        if (p.kind === 'moving') {
          p.y = p.baseY + Math.sin(this.clock * 2.1 + p.phase) * p.moveAmp;
        }
        if (p.touched && p.kind === 'lily') {
          p.sinking += dt * 16;
          p.y += dt * 16;
        }
      }

      if (this.grappling && this.grappleTarget) {
        const gAcc = -9.8 * Math.sin(this.grappleAngle);
        this.grappleAngVel += gAcc * dt;
        this.grappleAngle += this.grappleAngVel * dt;
        const nextX = this.grappleTarget.x + Math.sin(this.grappleAngle) * this.grappleLen;
        const nextY = this.grappleTarget.y + Math.cos(this.grappleAngle) * this.grappleLen;
        this.vx = (nextX - this.frogX) / Math.max(dt, 0.01);
        this.vy = (nextY - this.frogY) / Math.max(dt, 0.01);
        this.frogX = nextX;
        this.frogY = nextY;
        if (this.grappleAngle > 0.95) {
          this.onPointerUp();
        }
      } else if (!this.grounded) {
        const prevY = this.frogY;
        this.vy += 1080 * dt;
        this.frogX += this.vx * dt;
        this.frogY += this.vy * dt;

        // Landing check
        if (this.vy > 0) {
          for (const p of this.platforms) {
            const footPrev = prevY + 18;
            const footNow = this.frogY + 18;
            if (
              this.frogX >= p.x - 10 &&
              this.frogX <= p.x + p.w + 10 &&
              footPrev <= p.y + 12 &&
              footNow >= p.y
            ) {
              this.frogY = p.y - 18;
              if (p.kind === 'bouncy') {
                this.vy = -720;
                this.vx = Math.max(250, this.vx);
                this.grounded = false;
                this.canDoubleHop = true;
                this.popups.push({ x: this.frogX, y: this.frogY - 22, text: 'BOING!!', color: '#f472b6', life: 0 });
                this.callbacks.onJump();
              } else {
                this.vy = 0;
                this.vx = 0;
                this.grounded = true;
                this.canDoubleHop = true;
                if (!p.touched) {
                  p.touched = true;
                  this.combo = Math.min(10, this.combo + 1);
                  this.bonusPoints += 15 * this.combo;
                }
              }
              break;
            }
          }
        }
      } else {
        // Keep frog resting on current platform if moving/sinking
        const currentPlat = this.platforms.find((p) => this.frogX >= p.x - 12 && this.frogX <= p.x + p.w + 12 && Math.abs(this.frogY + 18 - p.y) < 35);
        if (currentPlat) {
          this.frogY = currentPlat.y - 18;
        }
      }

      // Collect fireflies
      for (const f of this.fireflies) {
        if (!f.collected && Math.hypot(f.x - this.frogX, f.y - this.frogY) < 38) {
          f.collected = true;
          this.flies++;
          this.bonusPoints += 35 * this.combo;
          this.popups.push({ x: f.x, y: f.y - 14, text: `+${35 * this.combo}`, color: '#fde047', life: 0 });
          this.callbacks.onFlyCollect();
        }
      }

      // Track distance
      const metersNow = Math.max(0, (this.frogX - this.startX) / 36);
      if (metersNow > this.maxMeters) {
        this.maxMeters = Math.round(metersNow * 10) / 10;
      }

      const targetCam = Math.max(0, this.frogX - this.width * 0.28);
      this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 8);
      this.ensureWorldGenerated();

      // Cull old objects
      const cullX = this.cameraX - 300;
      if (this.platforms.length > 18) this.platforms = this.platforms.filter((p) => p.x + p.w > cullX);
      if (this.hooks.length > 12) this.hooks = this.hooks.filter((h) => h.x > cullX);
      if (this.fireflies.length > 20) this.fireflies = this.fireflies.filter((f) => !f.collected && f.x > cullX);

      this.callbacks.onHudUpdate(this.currentScore(), this.maxMeters, this.flies, this.combo);

      // Splash check
      if (this.frogY > (this.height || 640) + 25) {
        this.dead = true;
        this.callbacks.onGameOver(this.currentScore(), this.maxMeters, this.flies);
      }
    }

    this.popups = this.popups.filter((p) => {
      p.life += dt;
      p.y -= 42 * dt;
      return p.life < 0.7;
    });

    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private draw(): void {
    const { ctx, width, height } = this;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Jungle pond gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#022c22');
    grad.addColorStop(0.6, '#065f46');
    grad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Distant jungle silhouettes
    ctx.fillStyle = 'rgba(2, 44, 34, 0.55)';
    for (let i = 0; i < 10; i++) {
      const bx = ((i * 180 - this.cameraX * 0.2) % (width + 240)) - 120;
      ctx.beginPath();
      ctx.arc(bx, height - 70, 75, 0, Math.PI * 2);
      ctx.fill();
    }

    // Water strip at bottom
    ctx.fillStyle = 'rgba(14, 165, 233, 0.5)';
    ctx.fillRect(0, height - 38, width, 38);

    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // Grapple hooks (lotus flowers hanging on vines)
    for (const h of this.hooks) {
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(h.x, 0);
      ctx.lineTo(h.x, h.y);
      ctx.stroke();

      ctx.fillStyle = h.used ? '#64748b' : '#f472b6';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fce7f3';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Platforms
    for (const p of this.platforms) {
      if (p.kind === 'lily') {
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#14532d';
      } else if (p.kind === 'bouncy') {
        ctx.fillStyle = '#ec4899';
        ctx.strokeStyle = '#fbcfe8';
      } else if (p.kind === 'moving') {
        ctx.fillStyle = '#a16207';
        ctx.strokeStyle = '#fde68a';
      } else {
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#cbd5e1';
      }
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 10);
      ctx.fill();
      ctx.stroke();
    }

    // Fireflies
    for (const f of this.fireflies) {
      if (f.collected) continue;
      const fy = f.y + Math.sin(this.clock * 4 + f.phase) * 7;
      ctx.fillStyle = 'rgba(253, 224, 71, 0.32)';
      ctx.beginPath();
      ctx.arc(f.x, fy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(f.x, fy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tongue grapple line
    if (this.grappling && this.grappleTarget) {
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.frogX, this.frogY - 6);
      ctx.lineTo(this.grappleTarget.x, this.grappleTarget.y);
      ctx.stroke();
    }

    // Charge trajectory arc preview
    if (this.charging && this.grounded) {
      const power = 0.25 + this.chargeRatio * 0.75;
      const pvx = 185 + power * 270;
      const pvy = -(380 + power * 430);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
      for (let t = 0.08; t <= 0.72; t += 0.08) {
        const px = this.frogX + pvx * t;
        const py = this.frogY + pvy * t + 0.5 * 1080 * t * t;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Frog
    drawCartoonFrog(ctx, this.frogX, this.frogY, 24, {
      skin: this.skin,
      accessory: this.accessory,
      squashY: this.charging ? 1 - this.chargeRatio * 0.28 : 1,
      airborne: !this.grounded,
    });

    // Popups
    for (const pop of this.popups) {
      ctx.globalAlpha = 1 - pop.life / 0.7;
      ctx.fillStyle = pop.color;
      ctx.font = '800 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    ctx.restore();
  }
}
