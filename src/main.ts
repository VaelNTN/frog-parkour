import './style.css';
import {
  GlobalFrogEntry,
  fetchGlobalFrogHighscores,
  submitGlobalFrogScore,
} from './api/highscores';
import { FROG_ACCESSORIES, FROG_SKINS, getFrogSkin } from './data/frogs';
import { drawCartoonFrog } from './game/frogRenderer';
import { FrogParkourStage } from './game/FrogParkourStage';
import { soundFX } from './game/SoundFX';
import {
  FrogState,
  loadFrogState,
  recordFrogScore,
  resolveDeviceId,
  saveFrogState,
} from './storage/state';

type ScreenName = 'home' | 'options' | 'game' | 'highscores';
type HsMode = 'global' | 'local';

let state: FrogState;
let hsMode: HsMode = 'global';
let optionsFromPlay = false;
let stage: FrogParkourStage | null = null;
let homeAnimId: number | null = null;
let hsPollInterval: number | null = null;

function renderFrogThumb(canvas: HTMLCanvasElement, skinId: number, size: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  drawCartoonFrog(ctx, size / 2, size * 0.56, size * 0.26, {
    skin: getFrogSkin(skinId),
    accessory: state.accessory,
  });
}

function buildApp(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <section id="screen-home" class="screen home-screen">
      <div class="home-hero">
        <canvas id="home-frog-canvas" class="preview-canvas"></canvas>
        <h1 class="game-title">Frog Parkour</h1>
        <p class="game-subtitle">
          Houd ingedrukt om je kikker-sprong op te laden, tik in de lucht voor tong-grapple of dubbel-hop!
        </p>
        <div id="home-best-pill" class="best-pill hidden"></div>
      </div>
      <div class="home-actions">
        <button id="btn-home-play" class="btn btn-primary">Play Parkour</button>
        <button id="btn-home-options" class="btn btn-secondary">Kikker Skins</button>
        <button id="btn-home-highscores" class="btn btn-secondary">Highscores</button>
      </div>
    </section>

    <section id="screen-options" class="screen hidden">
      <div class="top-nav">
        <button id="btn-options-back" class="btn btn-small">← Terug</button>
        <h2 class="screen-heading">Kies je Kikker</h2>
        <span style="width:60px"></span>
      </div>
      <div class="options-scroll">
        <div>
          <p class="section-label">Jouw Naam (voor Highscores)</p>
          <input id="player-name-input" class="name-input" type="text" maxlength="20" placeholder="Kikkerkoning" />
        </div>
        <div>
          <p class="section-label">Kikkerkleur</p>
          <div id="frog-skin-grid" class="skin-grid"></div>
        </div>
        <div>
          <p class="section-label">Accessoire</p>
          <div id="acc-chips" class="chip-row"></div>
        </div>
        <button id="btn-options-start" class="btn btn-primary">Start Springen</button>
      </div>
    </section>

    <section id="screen-game" class="screen game-screen hidden">
      <div class="game-top-bar">
        <button id="btn-game-menu" class="btn btn-small">← Menu</button>
        <div style="display:flex;gap:8px;">
          <button id="btn-game-options" class="btn btn-small">Kikker</button>
          <button id="btn-game-sound" class="btn btn-small">Geluid: Aan</button>
        </div>
      </div>
      <div class="hud-overlay">
        <div id="hud-score" class="hud-score">0 pts</div>
        <div id="hud-sub" class="hud-sub">0.0 m • 0 vliegjes • Combo x1</div>
      </div>
      <canvas id="game-canvas" class="game-canvas"></canvas>
      <div id="gameover-card" class="gameover-card hidden">
        <div id="gameover-text" style="font-weight:800;font-size:1.1rem;">Plons in de vijver!</div>
        <button id="btn-retry" class="btn btn-primary" style="padding:12px;">Opnieuw Proberen</button>
      </div>
    </section>

    <section id="screen-highscores" class="screen hidden">
      <div class="top-nav">
        <button id="btn-hs-back" class="btn btn-small">← Terug</button>
        <h2 class="screen-heading">Highscores</h2>
        <button id="btn-hs-refresh" class="btn btn-small">Ververs</button>
      </div>
      <div class="hs-tabs">
        <button id="tab-hs-global" class="hs-tab active">Online Wereldwijd</button>
        <button id="tab-hs-local" class="hs-tab">Lokaal (Top 50)</button>
      </div>
      <div id="server-box" class="server-box hidden">
        <p class="section-label" style="margin:0;">Highscore Server URL</p>
        <div style="display:flex;gap:8px;">
          <input id="server-url-input" class="name-input" type="url" placeholder="https://arcade-highscores-worker...workers.dev" />
          <button id="btn-save-server" class="btn btn-small">Opslaan</button>
        </div>
      </div>
      <div id="hs-list" class="hs-list"></div>
    </section>
  `;
}

function showScreen(name: ScreenName): void {
  document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`screen-${name}`)?.classList.remove('hidden');

  if (name === 'game') startStage();
  else stopStage();

  if (name === 'home') startHomePreview();
  else stopHomePreview();

  if (name === 'highscores') {
    refreshHighscoresView();
    hsPollInterval = window.setInterval(() => refreshHighscoresView(), 12000);
  } else if (hsPollInterval !== null) {
    clearInterval(hsPollInterval);
    hsPollInterval = null;
  }
}

function startHomePreview(): void {
  stopHomePreview();
  const canvas = document.getElementById('home-frog-canvas') as HTMLCanvasElement;
  const pill = document.getElementById('home-best-pill')!;
  if (state.bestScore > 0) {
    pill.textContent = `Record: ${state.bestScore} pts (${state.bestMeters.toFixed(1)} m)`;
    pill.classList.remove('hidden');
  } else {
    pill.classList.add('hidden');
  }

  let phase = 0;
  const draw = () => {
    phase += 0.04;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 150 * dpr;
    canvas.height = 150 * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawCartoonFrog(ctx, 75, 84 - Math.abs(Math.sin(phase)) * 18, 34, {
        skin: getFrogSkin(state.skinId),
        accessory: state.accessory,
        airborne: Math.abs(Math.sin(phase)) > 0.35,
      });
    }
    homeAnimId = requestAnimationFrame(draw);
  };
  draw();
}

function stopHomePreview(): void {
  if (homeAnimId !== null) {
    cancelAnimationFrame(homeAnimId);
    homeAnimId = null;
  }
}

function renderOptions(): void {
  (document.getElementById('player-name-input') as HTMLInputElement).value = state.playerName;
  const grid = document.getElementById('frog-skin-grid')!;
  grid.innerHTML = '';
  for (const s of FROG_SKINS) {
    const btn = document.createElement('button');
    btn.className = `skin-card ${state.skinId === s.id ? 'selected' : ''}`;
    btn.innerHTML = `<canvas width="48" height="48"></canvas><span style="font-weight:700;font-size:0.9rem;">${s.name}</span>`;
    renderFrogThumb(btn.querySelector('canvas')!, s.id, 48);
    btn.onclick = () => {
      state.skinId = s.id;
      saveFrogState(state);
      renderOptions();
    };
    grid.appendChild(btn);
  }

  const acc = document.getElementById('acc-chips')!;
  acc.innerHTML = '';
  for (const a of FROG_ACCESSORIES) {
    const chip = document.createElement('button');
    chip.className = `chip ${state.accessory === a.id ? 'selected' : ''}`;
    chip.textContent = a.label;
    chip.onclick = () => {
      state.accessory = a.id;
      saveFrogState(state);
      renderOptions();
    };
    acc.appendChild(chip);
  }
}

function startStage(): void {
  document.getElementById('gameover-card')!.classList.add('hidden');
  document.getElementById('btn-game-sound')!.textContent = `Geluid: ${state.soundEnabled ? 'Aan' : 'Uit'}`;

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!stage) {
    stage = new FrogParkourStage(
      canvas,
      { skin: getFrogSkin(state.skinId), accessory: state.accessory },
      {
        onHudUpdate: (score, meters, flies, combo) => {
          document.getElementById('hud-score')!.textContent = `${score} pts`;
          document.getElementById('hud-sub')!.textContent = `${meters.toFixed(1)} m • ${flies} vliegjes • Combo x${combo}`;
        },
        onJump: () => soundFX.playJump(),
        onTongue: () => soundFX.playTongue(),
        onFlyCollect: () => soundFX.playFly(),
        onGameOver: (score, meters, flies) => {
          soundFX.playSplash();
          recordFrogScore(state, score, meters, flies);
          document.getElementById('gameover-text')!.textContent =
            score >= state.bestScore ? `Nieuw record: ${score} pts (${meters.toFixed(1)}m)!` : `Score: ${score} pts (${meters.toFixed(1)}m)`;
          document.getElementById('gameover-card')!.classList.remove('hidden');
          if (state.apiBaseUrl && score > 0) {
            submitGlobalFrogScore(state.apiBaseUrl, {
              deviceId: state.deviceId,
              playerName: state.playerName,
              score,
              meters,
              flies,
              skinId: state.skinId,
              accessory: state.accessory,
            });
          }
        },
      }
    );
  } else {
    stage.setAppearance({ skin: getFrogSkin(state.skinId), accessory: state.accessory });
    stage.resetGame();
  }
  stage.start();
}

function stopStage(): void {
  stage?.stop();
}

async function refreshHighscoresView(): Promise<void> {
  const list = document.getElementById('hs-list')!;
  const serverBox = document.getElementById('server-box')!;
  (document.getElementById('server-url-input') as HTMLInputElement).value = state.apiBaseUrl;

  document.getElementById('tab-hs-global')?.classList.toggle('active', hsMode === 'global');
  document.getElementById('tab-hs-local')?.classList.toggle('active', hsMode === 'local');

  if (hsMode === 'local') {
    serverBox.classList.add('hidden');
    if (state.highscores.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--muted);margin-top:30px;">Nog geen parkour-scores. Spring erop los!</p>`;
      return;
    }
    list.innerHTML = state.highscores
      .map(
        (h, i) => `
        <div class="hs-row">
          <div class="hs-left">
            <span class="hs-rank">#${i + 1}</span>
            <div>
              <div class="hs-name">${h.playerName}</div>
              <div class="hs-meta">${getFrogSkin(h.skinId).name} • ${h.meters.toFixed(1)} m</div>
            </div>
          </div>
          <div class="hs-score">${h.score} pts</div>
        </div>`
      )
      .join('');
    return;
  }

  serverBox.classList.toggle('hidden', Boolean(state.apiBaseUrl));
  if (!state.apiBaseUrl) {
    list.innerHTML = `<p style="text-align:center;color:var(--muted);margin-top:24px;">Vul je Worker-URL in voor online wereldranglijsten (lokaal werkt altijd offline).</p>`;
    return;
  }

  try {
    const res = await fetchGlobalFrogHighscores(state.apiBaseUrl, state.deviceId, 50);
    const entries: GlobalFrogEntry[] = res.entries || [];
    if (entries.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--muted);margin-top:30px;">Nog geen online scores. Word de eerste!</p>`;
      return;
    }
    list.innerHTML = entries
      .map(
        (e) => `
        <div class="hs-row ${e.deviceId === state.deviceId ? 'me' : ''}">
          <div class="hs-left">
            <span class="hs-rank">#${e.rank}</span>
            <div>
              <div class="hs-name">${e.playerName}</div>
              <div class="hs-meta">${getFrogSkin(e.skinId).name} • ${e.meters.toFixed(1)} m</div>
            </div>
          </div>
          <div class="hs-score">${e.score} pts</div>
        </div>`
      )
      .join('');
  } catch {
    list.innerHTML = `<p style="text-align:center;color:#fca5a5;margin-top:24px;">Offline of server niet bereikbaar. Bekijk tab Lokaal!</p>`;
  }
}

async function init(): Promise<void> {
  const deviceId = await resolveDeviceId();
  state = loadFrogState(deviceId);
  soundFX.enabled = state.soundEnabled;
  buildApp();
  renderOptions();

  document.getElementById('btn-home-play')!.onclick = () => showScreen('game');
  document.getElementById('btn-home-options')!.onclick = () => {
    optionsFromPlay = false;
    renderOptions();
    showScreen('options');
  };
  document.getElementById('btn-home-highscores')!.onclick = () => showScreen('highscores');

  document.getElementById('btn-options-back')!.onclick = () => showScreen(optionsFromPlay ? 'game' : 'home');
  document.getElementById('btn-options-start')!.onclick = () => showScreen('game');
  document.getElementById('player-name-input')!.addEventListener('input', (e) => {
    state.playerName = (e.target as HTMLInputElement).value.slice(0, 20) || 'Kikkerkoning';
    saveFrogState(state);
  });

  document.getElementById('btn-game-menu')!.onclick = () => showScreen('home');
  document.getElementById('btn-game-options')!.onclick = () => {
    optionsFromPlay = true;
    renderOptions();
    showScreen('options');
  };
  document.getElementById('btn-game-sound')!.onclick = () => {
    state.soundEnabled = !state.soundEnabled;
    soundFX.enabled = state.soundEnabled;
    saveFrogState(state);
    document.getElementById('btn-game-sound')!.textContent = `Geluid: ${state.soundEnabled ? 'Aan' : 'Uit'}`;
  };
  document.getElementById('btn-retry')!.onclick = () => {
    document.getElementById('gameover-card')!.classList.add('hidden');
    stage?.resetGame();
  };

  document.getElementById('btn-hs-back')!.onclick = () => showScreen('home');
  document.getElementById('btn-hs-refresh')!.onclick = () => refreshHighscoresView();
  document.getElementById('tab-hs-global')!.onclick = () => {
    hsMode = 'global';
    refreshHighscoresView();
  };
  document.getElementById('tab-hs-local')!.onclick = () => {
    hsMode = 'local';
    refreshHighscoresView();
  };
  document.getElementById('btn-save-server')!.onclick = () => {
    state.apiBaseUrl = (document.getElementById('server-url-input') as HTMLInputElement).value.trim().replace(/\/+$/, '');
    saveFrogState(state);
    refreshHighscoresView();
  };

  showScreen('home');
}

init();
