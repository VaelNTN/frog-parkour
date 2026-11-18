import { FrogAccessoryId, FrogSkin } from '../data/frogs';
import { drawCartoonFrog } from './frogRenderer';

export type PlatformKind = 'lily' | 'rock' | 'bouncy' | 'moving';

interface Platform {
  x: number;
  y: number;
  prevY: number;
  w: number;
  h: number;
  kind: PlatformKind;
  moveAmp: number;
  baseY: number;
  phase: number;
  sinking: number;
  touched: boolean;
  bobOffset: number;
  bobVel: number;
  lotusSide: number;
}

interface GrappleHook {
  x: number;
  y: number;
  used: boolean;
  phase: number;
}

interface Dragonfly {
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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  kind: 'water' | 'sparkle' | 'ring';
}

interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Cloud {
  x: number;
  yFrac: number;
  scale: number;
  speed: number;
  alpha: number;
}

interface AmbientFirefly {
  x: number;
  yFrac: number;
  phase: number;
  speed: number;
  size: number;
}

export interface FrogParkourCallbacks {
  onHudUpdate: (score: number, meters: number, flies: number, combo: number) => void;
  onJump: () => void;
  onBounce?: () => void;
  onTongue: () => void;
  onFlyCollect: () => void;
  onGameOver: (score: number, meters: number, flies: number) => void;
}

const GRAVITY = 1080;
const FROG_FOOT_OFFSET = 18;
const MAX_PARTICLES = 90;
const MAX_RIPPLES = 24;

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
  private resizeObserver: ResizeObserver | null = null;
  private lastTime = 0;
  private clock = 0;

  private frogX = 125;
  private frogY = 260;
  private vx = 0;
  private vy = 0;
  private grounded = true;
  private canDoubleHop = true;
  private charging = false;
  private chargeRatio = 0;
  private chargeDir = 1;
  private dead = false;
  private splashed = false;

  // Elastic squash & stretch state
  private squashY = 1;
  private squashVel = 0;

  // Input guards
  private activePointerId: number | null = null;
  private keyHeld = false;

  // Grapple state
  private grappling = false;
  private grappleTarget: GrappleHook | null = null;
  private grappleAngle = 0;
  private grappleAngVel = 0;
  private grappleLen = 110;
  private grappleTime = 0;

  // Scoring & camera
  private cameraX = 0;
  private startX = 125;
  private maxMeters = 0;
  private flies = 0;
  private combo = 1;
  private bonusPoints = 0;

  // World entities
  private platforms: Platform[] = [];
  private hooks: GrappleHook[] = [];
  private dragonflies: Dragonfly[] = [];
  private popups: Popup[] = [];
  private particles: Particle[] = [];
  private ripples: WaterRipple[] = [];
  private clouds: Cloud[] = [];
  private ambientFireflies: AmbientFirefly[] = [];
  private generatedUpToX = 0;
  private ambientRippleTimer = 0;

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

    this.initScenery();

    this.handleResize = this.handleResize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlurOrHide = this.onBlurOrHide.bind(this);
    this.loop = this.loop.bind(this);
  }

  private initScenery(): void {
    this.clouds = [
      { x: 90, yFrac: 0.14, scale: 1.05, speed: 9, alpha: 0.24 },
      { x: 340, yFrac: 0.22, scale: 0.8, speed: 6.5, alpha: 0.18 },
      { x: 640, yFrac: 0.11, scale: 1.25, speed: 11, alpha: 0.2 },
      { x: 930, yFrac: 0.26, scale: 0.9, speed: 7.5, alpha: 0.16 },
    ];
    this.ambientFireflies = Array.from({ length: 16 }, (_, i) => ({
      x: i * 110 + (i % 3) * 37,
      yFrac: 0.22 + ((i * 19) % 52) / 100,
      phase: i * 1.37,
      speed: 8 + (i % 4) * 4,
      size: 2.2 + (i % 3) * 0.9,
    }));
  }

  public setAppearance(opts: { skin: FrogSkin; accessory: FrogAccessoryId }): void {
    this.skin = opts.skin;
    this.accessory = opts.accessory;
  }

  public resetGame(): void {
    const baseH = Math.max(420, this.height || 640);
    const startY = baseH * 0.68;
    this.platforms = [
      {
        x: 40,
        y: startY,
        prevY: startY,
        w: 170,
        h: 22,
        kind: 'rock',
        moveAmp: 0,
        baseY: startY,
        phase: 0,
        sinking: 0,
        touched: true,
        bobOffset: 0,
        bobVel: 0,
        lotusSide: 1,
      },
    ];
    this.hooks = [];
    this.dragonflies = [];
    this.popups = [];
    this.particles = [];
    this.ripples = [];
    this.generatedUpToX = 210;

    this.frogX = 125;
    this.startX = 125;
    this.frogY = startY - FROG_FOOT_OFFSET;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.canDoubleHop = true;
    this.charging = false;
    this.chargeRatio = 0;
    this.chargeDir = 1;
    this.squashY = 1;
    this.squashVel = 0;
    this.activePointerId = null;
    this.keyHeld = false;
    this.grappling = false;
    this.grappleTarget = null;
    this.grappleTime = 0;
    this.dead = false;
    this.splashed = false;

    this.cameraX = 0;
    this.maxMeters = 0;
    this.flies = 0;
    this.combo = 1;
    this.bonusPoints = 0;

    this.ensureWorldGenerated();
    this.callbacks.onHudUpdate(0, 0, 0, 1);
  }

  private ensureWorldGenerated(): void {
    const targetX = this.cameraX + Math.max(900, (this.width || 400) + 600);
    const baseH = Math.max(420, this.height || 640);
    while (this.generatedUpToX < targetX) {
      const prev = this.platforms[this.platforms.length - 1];
      const gap = 85 + Math.random() * 145;
      const nx = prev.x + prev.w + gap;
      const ny = Math.max(
        baseH * 0.38,
        Math.min(baseH * 0.76, prev.baseY + (Math.random() - 0.5) * 140)
      );
      const nw = Math.max(72, 130 - this.maxMeters * 0.18 + Math.random() * 45);
      const roll = Math.random();
      const kind: PlatformKind =
        roll < 0.24 ? 'bouncy' : roll < 0.45 ? 'moving' : roll < 0.72 ? 'lily' : 'rock';

      this.platforms.push({
        x: nx,
        y: ny,
        prevY: ny,
        w: nw,
        h: 20,
        kind,
        moveAmp: kind === 'moving' ? 26 + Math.random() * 22 : 0,
        baseY: ny,
        phase: Math.random() * Math.PI * 2,
        sinking: 0,
        touched: false,
        bobOffset: 0,
        bobVel: 0,
        lotusSide: Math.random() < 0.5 ? 1 : -1,
      });

      // Place a grapple lotus hook above wide gaps (clamped below HUD)
      if (gap > 140) {
        this.hooks.push({
          x: prev.x + prev.w + gap * 0.5,
          y: Math.max(105, Math.min(prev.baseY, ny) - 130),
          used: false,
          phase: Math.random() * Math.PI * 2,
        });
      }

      if (Math.random() < 0.75) {
        this.dragonflies.push({
          x: prev.x + prev.w + gap * 0.55,
          y: Math.max(88, Math.min(prev.baseY, ny) - 55 - Math.random() * 55),
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

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    window.addEventListener('blur', this.onBlurOrHide);
    document.addEventListener('visibilitychange', this.onBlurOrHide);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas);
    }

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.active = false;
    this.charging = false;
    this.activePointerId = null;
    this.keyHeld = false;

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    window.removeEventListener('blur', this.onBlurOrHide);
    document.removeEventListener('visibilitychange', this.onBlurOrHide);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = this.canvas.clientWidth || rect.width;
    const h = this.canvas.clientHeight || rect.height;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;

    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.round(w * nextDpr));
    const targetH = Math.max(1, Math.round(h * nextDpr));

    this.dpr = nextDpr;
    this.width = w;
    this.height = h;
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
  }

  private onBlurOrHide(): void {
    this.lastTime = performance.now();
    this.activePointerId = null;
    this.keyHeld = false;
    if (this.charging) {
      this.charging = false;
      this.chargeRatio = 0;
    }
  }

  private beginAction(): void {
    if (!this.active || this.dead) return;
    if (this.grounded) {
      this.charging = true;
      this.chargeRatio = 0.15;
      this.chargeDir = 1;
      return;
    }

    // Mid-air: try tongue grapple to nearest unused hook ahead/above!
    if (!this.grappling) {
      let bestHook: GrappleHook | null = null;
      let bestDist = 235;
      for (const h of this.hooks) {
        if (h.used) continue;
        const d = Math.hypot(h.x - this.frogX, h.y - this.frogY);
        if (d < bestDist && h.y < this.frogY + 45) {
          bestDist = d;
          bestHook = h;
        }
      }
      if (bestHook) {
        this.grappling = true;
        this.grappleTarget = bestHook;
        this.grappleTime = 0;
        bestHook.used = true;
        this.grappleLen = Math.max(70, Math.min(165, bestDist));
        this.grappleAngle = Math.atan2(this.frogX - bestHook.x, this.frogY - bestHook.y);
        const curSpeed = Number.isFinite(this.vx) && Number.isFinite(this.vy) ? Math.hypot(this.vx, this.vy) : 280;
        this.grappleAngVel = Math.max(2.6, Math.min(6.2, curSpeed / this.grappleLen));
        this.squashY = 1.24;
        this.spawnSparkles(bestHook.x, bestHook.y, '#fbcfe8', 10);
        this.callbacks.onTongue();
        return;
      }

      // Otherwise mid-air double hop!
      if (this.canDoubleHop) {
        this.canDoubleHop = false;
        this.vx = Math.max(this.vx, 225);
        this.vy = -445;
        this.squashY = 1.3;
        this.squashVel = 0;
        this.spawnRing(this.frogX, this.frogY + 14, '#bae6fd');
        this.spawnSparkles(this.frogX, this.frogY + 12, '#e0f2fe', 8);
        this.popups.push({
          x: this.frogX,
          y: this.frogY - 24,
          text: 'DOUBLE HOP!',
          color: '#bae6fd',
          life: 0,
        });
        this.callbacks.onJump();
      }
    }
  }

  private endAction(): void {
    if (!this.active || this.dead) return;
    if (this.grappling) {
      this.grappling = false;
      this.grappleTarget = null;
      const safeVx = Number.isFinite(this.vx) ? this.vx : 240;
      const safeVy = Number.isFinite(this.vy) ? this.vy : -220;
      this.vx = Math.max(260, Math.min(620, safeVx + 120));
      this.vy = Math.min(-340, Math.max(-780, safeVy - 120));
      this.canDoubleHop = true;
      this.squashY = 1.32;
      this.squashVel = 0;
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
      this.squashY = 1.34;
      this.squashVel = 0;

      // Kick current platform downward gently on takeoff
      const plat = this.findSupportingPlatform();
      if (plat) {
        plat.bobVel += 120 + power * 90;
        if (plat.kind === 'lily') {
          this.spawnRipple(this.frogX, this.getWaterY() + 8, 42, 'rgba(186, 230, 253, 0.55)');
        }
      }
      this.spawnSparkles(this.frogX, this.frogY + 16, '#bbf7d0', 7);
      this.callbacks.onJump();
    }
  }

  private onPointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    if (!this.active || this.dead) return;
    if (this.activePointerId !== null) return;
    this.activePointerId = ev.pointerId;
    this.beginAction();
  }

  private onPointerUp(ev: PointerEvent): void {
    if (this.activePointerId !== null && ev.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.endAction();
  }

  private onKeyDown(ev: KeyboardEvent): void {
    if (!this.active || this.dead || ev.repeat) return;
    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.code === 'KeyW') {
      ev.preventDefault();
      if (this.keyHeld) return;
      this.keyHeld = true;
      this.beginAction();
    }
  }

  private onKeyUp(ev: KeyboardEvent): void {
    if (ev.code === 'Space' || ev.code === 'ArrowUp' || ev.code === 'KeyW') {
      if (!this.keyHeld) return;
      this.keyHeld = false;
      this.endAction();
    }
  }

  private getWaterY(): number {
    return (this.height || 640) - 40;
  }

  private findSupportingPlatform(): Platform | undefined {
    let best: Platform | undefined;
    for (const p of this.platforms) {
      const surfaceY = p.y + p.bobOffset;
      if (
        this.frogX >= p.x - 12 &&
        this.frogX <= p.x + p.w + 12 &&
        Math.abs(this.frogY + FROG_FOOT_OFFSET - surfaceY) < 35
      ) {
        if (!best || surfaceY < best.y + best.bobOffset) {
          best = p;
        }
      }
    }
    return best;
  }

  private spawnRipple(x: number, y: number, maxRadius = 46, color = 'rgba(186, 230, 253, 0.55)'): void {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({
      x,
      y,
      radius: 4,
      maxRadius,
      life: 0,
      maxLife: 0.95,
      color,
    });
  }

  private spawnWaterSplash(x: number, y: number, count = 16): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const angle = -Math.PI * (0.12 + Math.random() * 0.76);
      const speed = 130 + Math.random() * 240;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        radius: 2.5 + Math.random() * 3.5,
        color: i % 3 === 0 ? '#e0f2fe' : '#38bdf8',
        alpha: 0.95,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.35,
        gravity: 680,
        kind: 'water',
      });
    }
  }

  private spawnSparkles(x: number, y: number, color: string, count = 8): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 55 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        radius: 2 + Math.random() * 2.5,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.36 + Math.random() * 0.25,
        gravity: 220,
        kind: 'sparkle',
      });
    }
  }

  private spawnRing(x: number, y: number, color: string): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 10,
      color,
      alpha: 0.9,
      life: 0,
      maxLife: 0.35,
      gravity: 0,
      kind: 'ring',
    });
  }

  private currentScore(): number {
    const raw = this.maxMeters * 10 + this.bonusPoints;
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }

  private loop(now: number): void {
    if (!this.active) return;

    const rawDt = (now - this.lastTime) / 1000;
    const dt = Number.isFinite(rawDt) ? Math.max(0, Math.min(rawDt, 0.05)) : 0;
    this.lastTime = now;
    this.clock += dt;

    // Gentle ambient pond raindrops/ripples
    this.ambientRippleTimer += dt;
    if (this.ambientRippleTimer > 0.75) {
      this.ambientRippleTimer = 0;
      const rx = this.cameraX + Math.random() * Math.max(320, this.width);
      this.spawnRipple(rx, this.getWaterY() + 10 + Math.random() * 22, 24, 'rgba(186, 230, 253, 0.35)');
    }

    // Spring-damper for frog squash & stretch
    if (this.charging && this.grounded) {
      const targetSquash = 1 - this.chargeRatio * 0.32;
      this.squashY += (targetSquash - this.squashY) * Math.min(1, dt * 18);
      this.squashVel = 0;
    } else {
      const springForce = (1 - this.squashY) * 140;
      this.squashVel = (this.squashVel + springForce * dt) * Math.exp(-11 * dt);
      this.squashY = Math.max(0.62, Math.min(1.38, this.squashY + this.squashVel * dt));
    }

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

      // Update moving/sinking platforms and spring bobbing
      for (const p of this.platforms) {
        p.prevY = p.y + p.bobOffset;
        if (p.kind === 'moving') {
          p.y = p.baseY + Math.sin(this.clock * 2.1 + p.phase) * p.moveAmp;
        }
        if (p.touched && p.kind === 'lily') {
          p.sinking += dt * 16;
          p.y += dt * 16;
        }
        // Damped spring bob on all platforms
        const bobForce = -p.bobOffset * 130;
        p.bobVel = (p.bobVel + bobForce * dt) * Math.exp(-8 * dt);
        p.bobOffset += p.bobVel * dt;
      }

      if (this.grappling && this.grappleTarget) {
        this.grappleTime += dt;
        const gAcc = -9.8 * Math.sin(this.grappleAngle);
        this.grappleAngVel += gAcc * dt;
        this.grappleAngle += this.grappleAngVel * dt;

        const nextX = this.grappleTarget.x + Math.sin(this.grappleAngle) * this.grappleLen;
        const nextY = this.grappleTarget.y + Math.cos(this.grappleAngle) * this.grappleLen;

        // Analytical pendulum tangent velocity (frame-rate independent)
        this.vx = Math.cos(this.grappleAngle) * this.grappleAngVel * this.grappleLen;
        this.vy = -Math.sin(this.grappleAngle) * this.grappleAngVel * this.grappleLen;
        this.frogX = nextX;
        this.frogY = nextY;

        if (this.grappleAngle > 0.95 || this.grappleAngle < -1.35 || this.grappleTime > 2.4) {
          this.endAction();
        }
      } else if (!this.grounded) {
        const prevY = this.frogY;
        this.vy += GRAVITY * dt;
        this.frogX += this.vx * dt;
        this.frogY += this.vy * dt;

        // Landing check (pick highest matching platform)
        if (this.vy > 0) {
          let landedPlat: Platform | null = null;
          let bestSurfaceY = Infinity;
          const footPrev = prevY + FROG_FOOT_OFFSET;
          const footNow = this.frogY + FROG_FOOT_OFFSET;

          for (const p of this.platforms) {
            const surfaceY = p.y + p.bobOffset;
            if (
              this.frogX >= p.x - 10 &&
              this.frogX <= p.x + p.w + 10 &&
              footPrev <= p.prevY + 14 &&
              footNow >= surfaceY - 2 &&
              surfaceY < bestSurfaceY
            ) {
              bestSurfaceY = surfaceY;
              landedPlat = p;
            }
          }

          if (landedPlat) {
            const impactSpeed = this.vy;
            this.frogY = bestSurfaceY - FROG_FOOT_OFFSET;
            landedPlat.bobVel += Math.min(260, 90 + impactSpeed * 0.25);

            if (landedPlat.kind === 'bouncy') {
              this.vy = -720;
              this.vx = Math.max(255, this.vx);
              this.grounded = false;
              this.canDoubleHop = true;
              this.squashY = 1.35;
              this.squashVel = 0;
              if (!landedPlat.touched) {
                landedPlat.touched = true;
                this.combo = Math.min(10, this.combo + 1);
                this.bonusPoints += 15 * this.combo;
              }
              this.spawnSparkles(this.frogX, bestSurfaceY, '#f472b6', 12);
              this.popups.push({
                x: this.frogX,
                y: this.frogY - 22,
                text: 'BOING!!',
                color: '#f472b6',
                life: 0,
              });
              if (this.callbacks.onBounce) this.callbacks.onBounce();
              else this.callbacks.onJump();
            } else {
              this.vy = 0;
              this.vx = 0;
              this.grounded = true;
              this.canDoubleHop = true;
              this.squashY = 0.72;
              this.squashVel = 0;

              if (landedPlat.kind === 'lily') {
                this.spawnRipple(this.frogX, bestSurfaceY + 16, 48, 'rgba(186, 230, 253, 0.65)');
                this.spawnWaterSplash(this.frogX, bestSurfaceY + 8, 6);
              } else {
                this.spawnSparkles(this.frogX, bestSurfaceY, '#bbf7d0', 5);
              }

              if (!landedPlat.touched) {
                landedPlat.touched = true;
                this.combo = Math.min(10, this.combo + 1);
                this.bonusPoints += 15 * this.combo;
              }
            }
          }
        }
      } else {
        // Keep frog resting on current platform if moving/sinking/bobbing
        const currentPlat = this.findSupportingPlatform();
        if (currentPlat) {
          this.frogY = currentPlat.y + currentPlat.bobOffset - FROG_FOOT_OFFSET;
        } else {
          this.grounded = false;
        }
      }

      // NaN / Infinity safety recovery
      if (
        !Number.isFinite(this.frogX) ||
        !Number.isFinite(this.frogY) ||
        !Number.isFinite(this.vx) ||
        !Number.isFinite(this.vy)
      ) {
        this.vx = 0;
        this.vy = 0;
        this.frogX = Number.isFinite(this.frogX) ? this.frogX : this.startX;
        this.frogY = this.getWaterY() + 30;
      }

      // Collect golden dragonflies
      for (const f of this.dragonflies) {
        if (!f.collected && Math.hypot(f.x - this.frogX, f.y - this.frogY) < 38) {
          f.collected = true;
          this.flies++;
          const pts = 35 * this.combo;
          this.bonusPoints += pts;
          this.spawnSparkles(f.x, f.y, '#fde047', 12);
          this.popups.push({ x: f.x, y: f.y - 14, text: `+${pts}`, color: '#fde047', life: 0 });
          this.callbacks.onFlyCollect();
        }
      }

      // Track distance
      const metersNow = Math.max(0, (this.frogX - this.startX) / 36);
      if (Number.isFinite(metersNow) && metersNow > this.maxMeters) {
        this.maxMeters = Math.round(metersNow * 10) / 10;
      }

      const viewW = this.width || 400;
      const targetCam = Math.max(0, this.frogX - viewW * 0.28);
      this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 8);
      this.ensureWorldGenerated();

      // Cull old objects
      const cullX = this.cameraX - 300;
      if (this.platforms.length > 18) this.platforms = this.platforms.filter((p) => p.x + p.w > cullX);
      if (this.hooks.length > 12) this.hooks = this.hooks.filter((h) => h.x > cullX);
      if (this.dragonflies.length > 20) {
        this.dragonflies = this.dragonflies.filter((f) => !f.collected && f.x > cullX);
      }

      this.callbacks.onHudUpdate(this.currentScore(), this.maxMeters, this.flies, this.combo);

      // Water splash droplets when crossing water surface
      const waterY = this.getWaterY();
      if (!this.splashed && this.frogY >= waterY - 4) {
        this.splashed = true;
        this.spawnWaterSplash(this.frogX, waterY, 20);
        this.spawnRipple(this.frogX, waterY + 8, 65, 'rgba(224, 242, 254, 0.85)');
      }

      // Game over splash check
      if (this.frogY > (this.height || 640) + 18) {
        this.dead = true;
        this.charging = false;
        this.grappling = false;
        this.activePointerId = null;
        this.keyHeld = false;
        this.callbacks.onGameOver(this.currentScore(), this.maxMeters, this.flies);
      }
    }

    // Update popups
    this.popups = this.popups.filter((p) => {
      p.life += dt;
      p.y -= 42 * dt;
      return p.life < 0.75;
    });

    // Update particles
    this.particles = this.particles.filter((pt) => {
      pt.life += dt;
      if (pt.kind === 'ring') {
        pt.radius += 110 * dt;
      } else {
        pt.vy += pt.gravity * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
      }
      return pt.life < pt.maxLife;
    });

    // Update water ripples
    this.ripples = this.ripples.filter((r) => {
      r.life += dt;
      r.radius = 4 + (r.life / r.maxLife) * r.maxRadius;
      return r.life < r.maxLife;
    });

    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private draw(): void {
    const { ctx, width, height } = this;
    if (width <= 0 || height <= 0) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 1. Enchanted twilight/morning pond sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#071b2e');
    skyGrad.addColorStop(0.32, '#0b3b49');
    skyGrad.addColorStop(0.62, '#115e59');
    skyGrad.addColorStop(0.84, '#2d6a5b');
    skyGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Horizon dawn glow behind hills
    const horizonGrad = ctx.createRadialGradient(
      width * 0.72,
      height * 0.68,
      20,
      width * 0.72,
      height * 0.68,
      Math.max(width, height) * 0.55
    );
    horizonGrad.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
    horizonGrad.addColorStop(0.5, 'rgba(52, 211, 153, 0.08)');
    horizonGrad.addColorStop(1, 'rgba(7, 27, 46, 0)');
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, 0, width, height);

    // Luminous moon / enchanted orb
    const orbX = width * 0.78 - ((this.cameraX * 0.015) % 90);
    const orbY = height * 0.19;
    ctx.fillStyle = 'rgba(254, 240, 138, 0.12)';
    ctx.beginPath();
    ctx.arc(orbX, orbY, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(254, 249, 195, 0.24)';
    ctx.beginPath();
    ctx.arc(orbX, orbY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(orbX, orbY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Soft twinkling upper canopy stars
    ctx.fillStyle = 'rgba(254, 249, 195, 0.65)';
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 137 - this.cameraX * 0.03) % (width + 40) + width + 40) % (width + 40) - 20;
      const sy = 22 + ((i * 53) % Math.max(80, height * 0.34));
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.clock * 2.2 + i * 1.9));
      ctx.globalAlpha = twinkle * 0.65;
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 2) + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 2. Drifting parallax clouds
    for (const c of this.clouds) {
      const span = width + 260;
      const cx = (((c.x - this.cameraX * 0.06 - this.clock * c.speed) % span) + span) % span - 130;
      const cy = height * c.yFrac;
      const cs = c.scale;
      ctx.fillStyle = `rgba(226, 252, 244, ${c.alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 22 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 22 * cs, cy - 6 * cs, 26 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 48 * cs, cy, 20 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 22 * cs, cy + 7 * cs, 22 * cs, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Distant layered hills
    const waterY = this.getWaterY();
    ctx.fillStyle = 'rgba(6, 52, 56, 0.72)';
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    for (let x = 0; x <= width + 32; x += 32) {
      const wx = x + this.cameraX * 0.1;
      const hy =
        waterY - 95 - Math.sin(wx * 0.0055) * 34 - Math.cos(wx * 0.013) * 16;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(width, waterY);
    ctx.closePath();
    ctx.fill();

    // Closer misty hills & jungle mounds
    ctx.fillStyle = 'rgba(6, 78, 59, 0.78)';
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    for (let x = 0; x <= width + 24; x += 24) {
      const wx = x + this.cameraX * 0.2;
      const hy =
        waterY - 54 - Math.sin(wx * 0.009 + 1.2) * 24 - Math.cos(wx * 0.022) * 12;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(width, waterY);
    ctx.closePath();
    ctx.fill();

    // Ambient floating fireflies in misty midground
    for (const af of this.ambientFireflies) {
      const span = width + 180;
      const ax =
        (((af.x - this.cameraX * 0.26 + Math.sin(this.clock * 0.8 + af.phase) * 18) % span) + span) %
          span -
        90;
      const ay = height * af.yFrac + Math.cos(this.clock * 1.3 + af.phase) * 12;
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.clock * 2.8 + af.phase));
      ctx.fillStyle = `rgba(190, 242, 100, ${0.22 * pulse})`;
      ctx.beginPath();
      ctx.arc(ax, ay, af.size * 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(254, 240, 138, ${0.85 * pulse})`;
      ctx.beginPath();
      ctx.arc(ax, ay, af.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Swaying reeds & cattails along pond bank
    const reedSpan = width + 180;
    for (let i = 0; i < 20; i++) {
      const rx = (((i * 88 - this.cameraX * 0.34) % reedSpan) + reedSpan) % reedSpan - 90;
      const sway = Math.sin(this.clock * 1.9 + i * 0.85) * 6;
      const reedH = 42 + (i % 4) * 15;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(22, 101, 52, 0.78)' : 'rgba(21, 128, 61, 0.68)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rx, waterY + 6);
      ctx.quadraticCurveTo(
        rx + sway * 0.5,
        waterY + 6 - reedH * 0.55,
        rx + sway,
        waterY + 6 - reedH
      );
      ctx.stroke();

      // Side leaf blade
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(rx, waterY + 4);
      ctx.quadraticCurveTo(
        rx + (i % 2 === 0 ? 10 : -10) + sway * 0.4,
        waterY - reedH * 0.35,
        rx + (i % 2 === 0 ? 16 : -16) + sway * 0.7,
        waterY - reedH * 0.52
      );
      ctx.stroke();

      if (i % 3 === 0) {
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.ellipse(
          rx + sway * 0.9,
          waterY + 6 - reedH + 10,
          3.5,
          9,
          sway * 0.02,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // 5. Shimmering Pond Water & Concentric Ripples
    const waterGrad = ctx.createLinearGradient(0, waterY, 0, height);
    waterGrad.addColorStop(0, 'rgba(20, 184, 166, 0.55)');
    waterGrad.addColorStop(0.35, 'rgba(14, 165, 233, 0.72)');
    waterGrad.addColorStop(1, 'rgba(8, 47, 73, 0.94)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterY, width, height - waterY);

    // Rippling water surface crest
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.68)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const wy =
        waterY +
        Math.sin(x * 0.055 + this.clock * 3.4 - this.cameraX * 0.02) * 2.4 +
        Math.cos(x * 0.028 - this.clock * 2.1) * 1.2;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();

    // Inner water shimmer streaks
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.3)';
    ctx.lineWidth = 2;
    const streakSpan = width + 180;
    for (let i = 0; i < 9; i++) {
      const sx =
        (((i * 135 - this.cameraX * 0.45 + this.clock * 22) % streakSpan) + streakSpan) %
          streakSpan -
        90;
      const sy = waterY + 11 + (i % 3) * 9;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 34 + (i % 2) * 18, sy);
      ctx.stroke();
    }

    // World space rendering
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // Concentric expanding water ripples in world space
    for (const r of this.ripples) {
      const alpha = Math.max(0, 1 - r.life / r.maxLife);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = alpha * 0.75;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (r.radius > 14) {
        ctx.globalAlpha = alpha * 0.45;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.radius * 0.62, r.radius * 0.17, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Grapple hooks (swaying vines + multi-petal lotus blooms)
    for (const h of this.hooks) {
      if (h.x < this.cameraX - 80 || h.x > this.cameraX + width + 80) continue;
      const swayX = Math.sin(this.clock * 2 + h.phase) * 4;
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(h.x + swayX * 0.2, 0);
      ctx.quadraticCurveTo(h.x + swayX, h.y * 0.5, h.x, h.y);
      ctx.stroke();

      // Tiny vine leaves
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(h.x + 6 + swayX * 0.5, h.y * 0.45, 7, 3.5, 0.5, 0, Math.PI * 2);
      ctx.ellipse(h.x - 6 + swayX * 0.7, h.y * 0.72, 7, 3.5, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // In-range grapple hint ring
      const distToFrog = Math.hypot(h.x - this.frogX, h.y - this.frogY);
      if (!h.used && !this.grounded && distToFrog < 235 && h.y < this.frogY + 45) {
        const pulse = 0.5 + 0.5 * Math.sin(this.clock * 8);
        ctx.strokeStyle = `rgba(244, 114, 182, ${0.45 + pulse * 0.4})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 19 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Lotus flower petals
      ctx.fillStyle = h.used ? '#64748b' : '#f472b6';
      ctx.strokeStyle = h.used ? '#cbd5e1' : '#fce7f3';
      ctx.lineWidth = 1.6;
      for (const a of [-0.55, 0, 0.55]) {
        ctx.beginPath();
        ctx.ellipse(h.x + Math.sin(a) * 8, h.y + Math.cos(a) * 2, 7, 11, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = h.used ? '#94a3b8' : '#fde047';
      ctx.beginPath();
      ctx.arc(h.x, h.y + 1, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Platforms
    for (const p of this.platforms) {
      if (p.x + p.w < this.cameraX - 60 || p.x > this.cameraX + width + 60) continue;
      const py = p.y + p.bobOffset;

      if (p.kind === 'lily') {
        // Textured lilypad with organic bevel, notch, veins & blooming lotus
        const padGrad = ctx.createLinearGradient(p.x, py, p.x, py + p.h);
        padGrad.addColorStop(0, '#4ade80');
        padGrad.addColorStop(1, '#16a34a');
        ctx.fillStyle = padGrad;
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.roundRect(p.x, py, p.w, p.h, 11);
        ctx.fill();
        ctx.stroke();

        // Top specular rim
        ctx.strokeStyle = 'rgba(220, 252, 231, 0.55)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(p.x + 12, py + 3);
        ctx.lineTo(p.x + p.w - 14, py + 3);
        ctx.stroke();

        // Radial veins
        ctx.strokeStyle = 'rgba(20, 83, 45, 0.35)';
        ctx.lineWidth = 1.5;
        const midX = p.x + p.w * 0.5;
        const midY = py + p.h * 0.55;
        for (const vx of [-0.34, -0.14, 0.14, 0.34]) {
          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(midX + p.w * vx, py + 4);
          ctx.stroke();
        }

        // V-notch on pad edge
        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.moveTo(p.x + p.w * 0.25, py + p.h);
        ctx.lineTo(p.x + p.w * 0.25 - 4, py + p.h - 7);
        ctx.lineTo(p.x + p.w * 0.25 + 4, py + p.h - 7);
        ctx.closePath();
        ctx.fill();

        // Blooming lotus flower
        const fx = p.lotusSide > 0 ? p.x + p.w - 18 : p.x + 18;
        const fy = py;
        ctx.fillStyle = '#f472b6';
        ctx.strokeStyle = '#be185d';
        ctx.lineWidth = 1.2;
        for (const pa of [-0.6, 0, 0.6]) {
          ctx.beginPath();
          ctx.ellipse(fx + pa * 6, fy - 4, 5.5, 3.6, pa, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(fx, fy - 5, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'bouncy') {
        const bGrad = ctx.createLinearGradient(p.x, py, p.x, py + p.h);
        bGrad.addColorStop(0, '#f472b6');
        bGrad.addColorStop(1, '#db2777');
        ctx.fillStyle = bGrad;
        ctx.strokeStyle = '#fce7f3';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.roundRect(p.x, py, p.w, p.h, 11);
        ctx.fill();
        ctx.stroke();

        // Cushion dots & bounce highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.roundRect(p.x + 12, py + 3.5, p.w - 24, 4, 2);
        ctx.fill();
        for (let dx = p.x + 18; dx < p.x + p.w - 14; dx += 18) {
          ctx.beginPath();
          ctx.arc(dx, py + p.h * 0.62, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.kind === 'moving') {
        // Driftwood log with bark & moss
        const logGrad = ctx.createLinearGradient(p.x, py, p.x, py + p.h);
        logGrad.addColorStop(0, '#b45309');
        logGrad.addColorStop(1, '#78350f');
        ctx.fillStyle = logGrad;
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(p.x, py, p.w, p.h, 10);
        ctx.fill();
        ctx.stroke();

        // Bark grain lines
        ctx.strokeStyle = 'rgba(254, 243, 199, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x + 12, py + 8);
        ctx.lineTo(p.x + p.w * 0.55, py + 8);
        ctx.moveTo(p.x + p.w * 0.35, py + 13);
        ctx.lineTo(p.x + p.w - 14, py + 13);
        ctx.stroke();

        // Moss patch
        ctx.fillStyle = 'rgba(74, 222, 128, 0.55)';
        ctx.beginPath();
        ctx.roundRect(p.x + 10, py + 1.5, p.w * 0.32, 5, 3);
        ctx.fill();
      } else {
        // Sculpted mossy pond stone
        const rockGrad = ctx.createLinearGradient(p.x, py, p.x, py + p.h);
        rockGrad.addColorStop(0, '#64748b');
        rockGrad.addColorStop(1, '#334155');
        ctx.fillStyle = rockGrad;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(p.x, py, p.w, p.h, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(74, 222, 128, 0.45)';
        ctx.beginPath();
        ctx.roundRect(p.x + 8, py + 2, p.w * 0.46, 5.5, 3);
        ctx.fill();
      }
    }

    // Golden Shimmering Dragonflies (multi-part segmented body, compound eyes, 4 veined wings)
    for (const f of this.dragonflies) {
      if (f.collected) continue;
      if (f.x < this.cameraX - 50 || f.x > this.cameraX + width + 50) continue;

      const fx = f.x + Math.cos(this.clock * 2.5 + f.phase) * 5;
      const fy = f.y + Math.sin(this.clock * 4.2 + f.phase) * 7;
      const foreFlap = Math.sin(this.clock * 36 + f.phase);
      const hindFlap = Math.sin(this.clock * 36 + f.phase + 0.9);
      const hoverTilt = Math.sin(this.clock * 3.1 + f.phase) * 0.1;

      // Soft golden-iridescent aura (no expensive shadowBlur)
      ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
      ctx.beginPath();
      ctx.arc(fx, fy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(103, 232, 249, 0.22)';
      ctx.beginPath();
      ctx.arc(fx, fy, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(hoverTilt);

      // 4 multi-wing translucent iridescent wings (hindwings then forewings)
      for (const side of [-1, 1]) {
        // Hindwing (slightly smaller, trailing)
        const hwAngle = side * (-0.85 + hindFlap * 0.34);
        ctx.save();
        ctx.translate(-2.5, side * 1.2);
        ctx.rotate(hwAngle);
        ctx.fillStyle = 'rgba(165, 243, 252, 0.62)';
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.78)';
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.ellipse(0, side * 6.5, 3.1, 7.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Delicate hindwing veins
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, side * 1.5);
        ctx.lineTo(0, side * 12);
        ctx.moveTo(0, side * 5);
        ctx.lineTo(1.8, side * 8.5);
        ctx.moveTo(0, side * 7.5);
        ctx.lineTo(-1.6, side * 10.5);
        ctx.stroke();
        ctx.restore();

        // Forewing (larger, leading)
        const fwAngle = side * (-0.42 + foreFlap * 0.38);
        ctx.save();
        ctx.translate(1.5, side * 1.4);
        ctx.rotate(fwAngle);
        ctx.fillStyle = 'rgba(224, 242, 254, 0.76)';
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, side * 8.2, 3.5, 9.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Delicate forewing veins & iridescent shimmer tip
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(0, side * 1.5);
        ctx.lineTo(0.4, side * 16);
        ctx.moveTo(0.2, side * 6);
        ctx.lineTo(2.2, side * 10);
        ctx.moveTo(0.2, side * 9.5);
        ctx.lineTo(-2.0, side * 13);
        ctx.stroke();
        ctx.restore();
      }

      // Segmented metallic/iridescent banded abdomen (5 segments)
      for (let seg = 4; seg >= 0; seg--) {
        const sx = -4 - seg * 3.1;
        const sy = Math.sin(this.clock * 5 + f.phase + seg * 0.4) * 0.4;
        const srX = 2.1 - seg * 0.22;
        const srY = 1.65 - seg * 0.16;
        ctx.fillStyle = seg % 2 === 0 ? '#f59e0b' : '#0d9488';
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(sx, sy, srX, srY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Metallic glint dot
        ctx.fillStyle = seg % 2 === 0 ? '#fef08a' : '#5eead4';
        ctx.beginPath();
        ctx.arc(sx, sy - srY * 0.35, srY * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Twin tail cerci
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-17.5, 0);
      ctx.lineTo(-20.2, -1.4);
      ctx.moveTo(-17.5, 0);
      ctx.lineTo(-20.2, 1.4);
      ctx.stroke();

      // Metallic Thorax
      ctx.fillStyle = '#0f766e';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(1.2, 0, 4.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#5eead4';
      ctx.beginPath();
      ctx.ellipse(0.8, -1.1, 2.3, 1.0, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Head & Big Compound Eyes
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(6.2, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (const side of [-1, 1]) {
        ctx.fillStyle = '#be123c';
        ctx.beginPath();
        ctx.arc(6.9, side * 1.9, 1.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(7.4, side * 1.6 - 0.5, 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Glossy animated pink sticky tongue curve with sparkle droplets
    if (this.grappling && this.grappleTarget) {
      const mx = this.frogX + 6;
      const my = this.frogY - 4;
      const tx = this.grappleTarget.x;
      const ty = this.grappleTarget.y;
      const midX = (mx + tx) * 0.5;
      const midY = (my + ty) * 0.5 + Math.sin(this.clock * 20) * 8 + 10;

      // Outer pink tongue
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(midX, midY, tx, ty);
      ctx.stroke();

      // Inner bright pink core
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(midX, midY, tx, ty);
      ctx.stroke();

      // Glossy highlight ribbon
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(mx, my - 1.5);
      ctx.quadraticCurveTo(midX, midY - 1.5, tx, ty - 1.5);
      ctx.stroke();

      // Sticky tip bulb on lotus
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(tx, ty, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle droplets along tongue curve
      for (const t of [0.25, 0.5, 0.75]) {
        const omt = 1 - t;
        const dx = omt * omt * mx + 2 * omt * t * midX + t * t * tx;
        const dy = omt * omt * my + 2 * omt * t * midY + t * t * ty;
        const pulse = 1.8 + Math.sin(this.clock * 14 + t * 10) * 0.8;
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.arc(dx, dy + 3, pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Charge power arc meter & trajectory preview around the frog
    if (this.charging && this.grounded) {
      const meterR = 35;
      const startA = -Math.PI * 0.85;
      const fullSpan = Math.PI * 0.7;
      const endA = startA + fullSpan * this.chargeRatio;

      // Background track
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(this.frogX, this.frogY, meterR, startA, startA + fullSpan);
      ctx.stroke();

      // Color-shifting charge arc
      const arcColor =
        this.chargeRatio > 0.78 ? '#fb7185' : this.chargeRatio > 0.45 ? '#facc15' : '#4ade80';
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(this.frogX, this.frogY, meterR, startA, endA);
      ctx.stroke();

      // Glowing tip dot
      const tipX = this.frogX + Math.cos(endA) * meterR;
      const tipY = this.frogY + Math.sin(endA) * meterR;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3.6, 0, Math.PI * 2);
      ctx.fill();

      // Trajectory dots
      const power = 0.25 + this.chargeRatio * 0.75;
      const pvx = 185 + power * 270;
      const pvy = -(380 + power * 430);
      for (let t = 0.08; t <= 0.72; t += 0.08) {
        const px = this.frogX + pvx * t;
        const py = this.frogY + pvy * t + 0.5 * GRAVITY * t * t;
        ctx.fillStyle = `rgba(253, 224, 71, ${Math.max(0.2, 0.9 - t)})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(2, 4.4 - t * 2.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dynamic Frog tilt & eye look direction
    let tilt = 0;
    let eyeLookX = 0.03;
    let eyeLookY = 0;
    if (this.grappling && this.grappleTarget) {
      tilt = Math.max(-0.4, Math.min(0.4, -this.grappleAngle * 0.45));
      eyeLookX = 0.04;
      eyeLookY = -0.04;
    } else if (!this.grounded) {
      tilt = Math.max(-0.35, Math.min(0.42, this.vy / 1500));
      eyeLookX = 0.05;
      eyeLookY = this.vy < 0 ? -0.03 : 0.03;
    } else if (this.charging) {
      tilt = -0.1 * this.chargeRatio;
      eyeLookX = 0.06;
      eyeLookY = -0.04;
    }

    const idleBlink = this.grounded && !this.charging && this.clock % 3.8 > 3.66;

    // Frog
    drawCartoonFrog(ctx, this.frogX, this.frogY, 24, {
      skin: this.skin,
      accessory: this.accessory,
      squashY: this.squashY,
      airborne: !this.grounded,
      tilt,
      eyeLookX,
      eyeLookY,
      charging: this.charging,
      chargeRatio: this.chargeRatio,
      mouthOpen: this.grappling,
      blink: idleBlink,
    });

    // Particles (water splash droplets, sparkles, double-hop rings)
    for (const pt of this.particles) {
      const alpha = Math.max(0, 1 - pt.life / pt.maxLife) * pt.alpha;
      ctx.globalAlpha = alpha;
      if (pt.kind === 'ring') {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, pt.radius, pt.radius * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Popups
    for (const pop of this.popups) {
      const pProgress = pop.life / 0.75;
      ctx.globalAlpha = Math.max(0, 1 - pProgress);
      ctx.font = '800 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.75)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}
