import './style.css';
import {
  GlobalFrogEntry,
  fetchGlobalFrogHighscores,
  flushPendingFrogScores,
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
let activeScreen: ScreenName = 'home';
let optionsFromPlay = false;
let confirmQuitArmed = false;
let stage: FrogParkourStage | null = null;
let homeAnimId: number | null = null;
let hsPollInterval: number | null = null;
let hsRequestId = 0;
let hsHeadingTapCount = 0;
let hsHeadingTapTimer: number | null = null;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFrogThumb(canvas: HTMLCanvasElement, skinId: number, size: number): void {
  if (size <= 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const target = Math.round(size * dpr);
  if (canvas.width !== target || canvas.height !== target) {
    canvas.width = target;
    canvas.height = target;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  drawCartoonFrog(ctx, size / 2, size * 0.56, size * 0.26, {
    skin: getFrogSkin(skinId),
    accessory: state.accessory,
  });
}

function buildApp(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <section id="screen-home" class="screen home-screen">
      <div class="home-topbar">
        <button id="btn-home-more" class="btn btn-small">✨ More Games</button>
        <button id="btn-home-sound" class="btn btn-small" aria-label="Toggle sound">🔊</button>
      </div>
      <div class="home-content">
        <div class="home-hero">
          <canvas id="home-frog-canvas" class="preview-canvas"></canvas>
          <h1 class="game-title">Frog Parkour</h1>
          <p class="game-subtitle">Hold to leap, tap mid-air to double-hop or tongue grapple!</p>
          <div id="home-best-pill" class="best-pill hidden"></div>
        </div>
        <div class="home-actions">
          <button id="btn-home-play" class="btn btn-primary">▶ Play</button>
          <div class="home-secondary-row">
            <button id="btn-home-options" class="btn btn-secondary">🐸 Skins</button>
            <button id="btn-home-highscores" class="btn btn-secondary">🏆 Ranks</button>
          </div>
        </div>
      </div>
    </section>

    <section id="screen-options" class="screen hidden">
      <div class="top-nav">
        <button id="btn-options-back" class="btn btn-small">← Back</button>
        <h2 class="screen-heading">Frog Skins</h2>
        <span style="width:60px"></span>
      </div>
      <div class="options-scroll">
        <div>
          <p class="section-label">Player Name</p>
          <input id="player-name-input" class="name-input" type="text" maxlength="20" placeholder="FrogKing" />
        </div>
        <div>
          <p class="section-label">Frog Color</p>
          <div id="frog-skin-grid" class="skin-grid"></div>
        </div>
        <div>
          <p class="section-label">Accessory</p>
          <div id="acc-chips" class="chip-row"></div>
        </div>
        <button id="btn-options-start" class="btn btn-primary">Start Jumping</button>
      </div>
    </section>

    <section id="screen-game" class="screen game-screen hidden">
      <div class="game-top-bar">
        <button id="btn-game-pause" class="btn btn-small">⏸ Pause</button>
        <div style="display:flex;gap:8px;">
          <button id="btn-game-options" class="btn btn-small">🐸 Skins</button>
          <button id="btn-game-sound" class="btn btn-small" aria-label="Toggle sound">🔊</button>
        </div>
      </div>
      <div class="hud-overlay">
        <div id="hud-score" class="hud-score">0 pts</div>
        <div id="hud-sub" class="hud-sub">0.0 m • 0 flies • Combo x1</div>
      </div>
      <canvas id="game-canvas" class="game-canvas"></canvas>
      <div id="gameover-card" class="gameover-card hidden">
        <div id="gameover-text" style="font-weight:800;font-size:1.1rem;">Splash!</div>
        <button id="btn-retry" class="btn btn-primary" style="padding:12px;">↻ Retry</button>
        <div class="gameover-actions-row">
          <button id="btn-go-menu" class="btn btn-secondary" style="padding:10px;font-size:0.9rem;">Menu</button>
          <button id="btn-go-hs" class="btn btn-secondary" style="padding:10px;font-size:0.9rem;">Leaderboard</button>
        </div>
      </div>
    </section>

    <section id="screen-highscores" class="screen hidden">
      <div class="top-nav">
        <button id="btn-hs-back" class="btn btn-small">← Back</button>
        <h2 id="hs-heading" class="screen-heading">🏆 Leaderboard</h2>
        <button id="btn-hs-refresh" class="btn btn-small">↻</button>
      </div>
      <div id="hs-status-banner" class="hs-status-banner">📱 Offline Mode — Local Highscores</div>
      <div class="hs-tabs">
        <button id="tab-hs-global" class="hs-tab active">🌍 Global</button>
        <button id="tab-hs-local" class="hs-tab">📱 Local</button>
      </div>
      <div id="server-box" class="server-box hidden">
        <p class="section-label" style="margin:0;">Developer Endpoint URL</p>
        <div style="display:flex;gap:8px;">
          <input id="server-url-input" class="name-input" type="url" placeholder="https://example.com" />
          <button id="btn-save-server" class="btn btn-small">Save</button>
        </div>
      </div>
      <div id="hs-list" class="hs-list"></div>
    </section>

    <div id="pause-modal" class="modal-backdrop hidden">
      <div class="modal-card">
        <h3 class="modal-title">⏸ Paused</h3>
        <p class="modal-sub">Take a breather on the lilypad.</p>
        <button id="btn-pause-resume" class="btn btn-primary" style="padding:13px;">▶ Resume</button>
        <button id="btn-pause-skins" class="btn btn-secondary">🐸 Change Frog Skin</button>
        <button id="btn-pause-restart" class="btn btn-secondary">↻ Restart Run</button>
        <button id="btn-pause-quit" class="btn btn-danger">🚪 Quit to Menu</button>
      </div>
    </div>

    <div id="more-games-modal" class="modal-backdrop hidden">
      <div class="modal-card">
        <h3 class="modal-title">✨ More by VaelNTN</h3>
        <p class="modal-sub">Explore more handcrafted games from VaelNTN Studios.</p>
        <div class="more-games-list">
          <a class="more-game-item featured" href="https://github.com/VaelNTN/starforge-survivors/releases/latest" target="_blank" rel="noopener noreferrer">
            <div>
              <div class="more-game-name">⭐ Starforge Survivors</div>
              <div class="more-game-desc">Flagship sci-fi roguelite — 6 heroes, 6 bosses & zero ads</div>
            </div>
            <span class="more-game-badge">FLAGSHIP</span>
          </a>
          <a class="more-game-item" href="https://github.com/VaelNTN/one-walk-fighter/releases/latest" target="_blank" rel="noopener noreferrer">
            <div>
              <div class="more-game-name">🥋 One Walk Fighter</div>
              <div class="more-game-desc">Fast one-button samurai arena brawler</div>
            </div>
          </a>
          <a class="more-game-item" href="https://github.com/VaelNTN/pocket-tanks-duel/releases/latest" target="_blank" rel="noopener noreferrer">
            <div>
              <div class="more-game-name">💥 Matey Tanks</div>
              <div class="more-game-desc">Artillery physics with wind & mana arsenal</div>
            </div>
          </a>
          <a class="more-game-item" href="https://github.com/VaelNTN/arcade-100-hub/releases/latest" target="_blank" rel="noopener noreferrer">
            <div>
              <div class="more-game-name">🕹️ Arcade 100 Hub</div>
              <div class="more-game-desc">100 instant retro mini-games in one app</div>
            </div>
          </a>
        </div>
        <button id="btn-more-close" class="btn btn-secondary">Close</button>
      </div>
    </div>
  `;
}

function syncSoundButton(): void {
  const icon = state.soundEnabled ? '🔊' : '🔇';
  const btn = document.getElementById('btn-game-sound');
  if (btn) btn.textContent = icon;
  const homeBtn = document.getElementById('btn-home-sound');
  if (homeBtn) homeBtn.textContent = icon;
}

function toggleSound(): void {
  state.soundEnabled = !state.soundEnabled;
  soundFX.enabled = state.soundEnabled;
  saveFrogState(state);
  syncSoundButton();
}

function openPauseModal(): void {
  if (!stage || stage.isDead()) return;
  stage.setPaused(true);
  confirmQuitArmed = false;
  const quitBtn = document.getElementById('btn-pause-quit');
  if (quitBtn) quitBtn.textContent = '🚪 Quit to Menu';
  document.getElementById('pause-modal')?.classList.remove('hidden');
}

function closePauseModal(resume = true): void {
  document.getElementById('pause-modal')?.classList.add('hidden');
  confirmQuitArmed = false;
  if (resume && stage && !stage.isDead()) {
    stage.setPaused(false);
  }
}

function clearHighscoresTimers(): void {
  if (hsPollInterval !== null) {
    clearInterval(hsPollInterval);
    hsPollInterval = null;
  }
  if (hsHeadingTapTimer !== null) {
    clearTimeout(hsHeadingTapTimer);
    hsHeadingTapTimer = null;
  }
  hsHeadingTapCount = 0;
}

function showScreen(name: ScreenName, opts?: { resumeRun?: boolean }): void {
  activeScreen = name;
  closePauseModal(false);
  document.getElementById('more-games-modal')?.classList.add('hidden');
  document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`screen-${name}`)?.classList.remove('hidden');

  if (name === 'game') startStage(Boolean(opts?.resumeRun));
  else stopStage();

  if (name === 'home') startHomePreview();
  else stopHomePreview();

  clearHighscoresTimers();
  if (name === 'highscores') {
    if (state.apiBaseUrl) void flushPendingFrogScores(state.apiBaseUrl);
    refreshHighscoresView();
    hsPollInterval = window.setInterval(() => refreshHighscoresView(), 12000);
  }
}

function startHomePreview(): void {
  stopHomePreview();
  syncSoundButton();
  const canvas = document.getElementById('home-frog-canvas') as HTMLCanvasElement;
  const pill = document.getElementById('home-best-pill')!;
  if (state.bestScore > 0) {
    pill.textContent = `Best: ${state.bestScore} pts (${state.bestMeters.toFixed(1)} m)`;
    pill.classList.remove('hidden');
  } else {
    pill.classList.add('hidden');
  }

  const size = 150;
  const ctx = canvas.getContext('2d');
  let phase = 0;
  let lastTime = performance.now();

  const draw = (now: number) => {
    if (activeScreen !== 'home') {
      homeAnimId = null;
      return;
    }
    const dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.05));
    lastTime = now;
    phase += dt * 2.4;

    const currentDpr = Math.min(window.devicePixelRatio || 1, 2);
    const desired = Math.round(size * currentDpr);
    if (canvas.width !== desired || canvas.height !== desired) {
      canvas.width = desired;
      canvas.height = desired;
    }
    if (ctx) {
      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const bounce = Math.abs(Math.sin(phase));
      const blink = bounce < 0.25 && (phase % (Math.PI * 3)) > Math.PI * 2.78;
      drawCartoonFrog(ctx, 75, 84 - bounce * 18, 34, {
        skin: getFrogSkin(state.skinId),
        accessory: state.accessory,
        airborne: bounce > 0.35,
        squashY: bounce < 0.14 ? 0.88 + bounce * 0.85 : 1 + bounce * 0.08,
        eyeLookX: 0.03,
        eyeLookY: bounce > 0.35 ? -0.02 : 0.01,
        blink,
      });
    }
    homeAnimId = requestAnimationFrame(draw);
  };
  homeAnimId = requestAnimationFrame(draw);
}

function stopHomePreview(): void {
  if (homeAnimId !== null) {
    cancelAnimationFrame(homeAnimId);
    homeAnimId = null;
  }
}

function renderOptions(): void {
  (document.getElementById('player-name-input') as HTMLInputElement).value = state.playerName;
  const startBtn = document.getElementById('btn-options-start');
  if (startBtn) {
    startBtn.textContent = optionsFromPlay && stage && !stage.isDead() ? '▶ Resume Run' : 'Start Jumping';
  }
  const grid = document.getElementById('frog-skin-grid')!;
  grid.innerHTML = '';
  for (const s of FROG_SKINS) {
    const btn = document.createElement('button');
    btn.className = `skin-card ${state.skinId === s.id ? 'selected' : ''}`;
    btn.innerHTML = `<canvas width="48" height="48"></canvas><span style="font-weight:700;font-size:0.9rem;">${escapeHtml(s.name)}</span>`;
    renderFrogThumb(btn.querySelector('canvas')!, s.id, 48);
    btn.onclick = () => {
      state.skinId = s.id;
      saveFrogState(state);
      stage?.setAppearance({ skin: getFrogSkin(state.skinId), accessory: state.accessory });
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
      stage?.setAppearance({ skin: getFrogSkin(state.skinId), accessory: state.accessory });
      renderOptions();
    };
    acc.appendChild(chip);
  }
}

function normalizePlayerNameInput(): void {
  const input = document.getElementById('player-name-input') as HTMLInputElement | null;
  if (!input) return;
  const clean = input.value.trim().slice(0, 20) || 'FrogKing';
  state.playerName = clean;
  input.value = clean;
  saveFrogState(state);
}

function startStage(resumeRun = false): void {
  syncSoundButton();

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!stage) {
    document.getElementById('gameover-card')!.classList.add('hidden');
    stage = new FrogParkourStage(
      canvas,
      { skin: getFrogSkin(state.skinId), accessory: state.accessory },
      {
        onHudUpdate: (score, meters, flies, combo) => {
          document.getElementById('hud-score')!.textContent = `${score} pts`;
          document.getElementById('hud-sub')!.textContent = `${meters.toFixed(1)} m • ${flies} flies • Combo x${combo}`;
        },
        onJump: () => soundFX.playJump(),
        onBounce: () => soundFX.playBounce(),
        onTongue: () => soundFX.playTongue(),
        onFlyCollect: () => soundFX.playFly(),
        onGameOver: (score, meters, flies) => {
          soundFX.playSplash();
          recordFrogScore(state, score, meters, flies);
          document.getElementById('gameover-text')!.textContent =
            score >= state.bestScore && score > 0
              ? `New Record: ${score} pts (${meters.toFixed(1)}m)!`
              : `Score: ${score} pts (${meters.toFixed(1)}m)`;
          document.getElementById('gameover-card')!.classList.remove('hidden');
          if (state.apiBaseUrl && score > 0) {
            void submitGlobalFrogScore(state.apiBaseUrl, {
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
    if (!resumeRun || stage.isDead()) {
      document.getElementById('gameover-card')!.classList.add('hidden');
      stage.resetGame();
    } else {
      stage.setPaused(false);
    }
  }
  stage.start();
}

function stopStage(): void {
  stage?.stop();
}

function updateHsStatusBanner(online: boolean): void {
  const banner = document.getElementById('hs-status-banner');
  if (!banner) return;
  banner.textContent = online ? '🌐 Online Leaderboard' : '📱 Offline Mode — Local Highscores';
}

async function refreshHighscoresView(): Promise<void> {
  const requestId = ++hsRequestId;
  const list = document.getElementById('hs-list')!;
  (document.getElementById('server-url-input') as HTMLInputElement).value = state.apiBaseUrl;

  document.getElementById('tab-hs-global')?.classList.toggle('active', hsMode === 'global');
  document.getElementById('tab-hs-local')?.classList.toggle('active', hsMode === 'local');

  if (hsMode === 'local') {
    updateHsStatusBanner(Boolean(state.apiBaseUrl));
    if (state.highscores.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--muted);margin-top:30px;">No scores yet. Start hopping!</p>`;
      return;
    }
    list.innerHTML = state.highscores
      .map(
        (h, i) => `
        <div class="hs-row">
          <div class="hs-left">
            <span class="hs-rank">#${i + 1}</span>
            <div>
              <div class="hs-name">${escapeHtml(h.playerName)}</div>
              <div class="hs-meta">${escapeHtml(getFrogSkin(h.skinId).name)} • ${h.meters.toFixed(1)} m</div>
            </div>
          </div>
          <div class="hs-score">${h.score} pts</div>
        </div>`
      )
      .join('');
    return;
  }

  if (!state.apiBaseUrl) {
    updateHsStatusBanner(false);
    list.innerHTML = `<p style="text-align:center;color:var(--muted);margin-top:24px;">Playing offline. Switch to Local to view your personal records!</p>`;
    return;
  }

  try {
    const res = await fetchGlobalFrogHighscores(state.apiBaseUrl, state.deviceId, 50);
    if (requestId !== hsRequestId || hsMode !== 'global' || activeScreen !== 'highscores') return;

    updateHsStatusBanner(true);
    const entries: GlobalFrogEntry[] = res.entries || [];
    if (entries.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--muted);margin-top:30px;">No online scores yet. Be the first!</p>`;
      return;
    }
    list.innerHTML = entries
      .map(
        (e) => `
        <div class="hs-row ${e.deviceId === state.deviceId ? 'me' : ''}">
          <div class="hs-left">
            <span class="hs-rank">#${Number(e.rank) || 0}</span>
            <div>
              <div class="hs-name">${escapeHtml(String(e.playerName || 'FrogKing'))}</div>
              <div class="hs-meta">${escapeHtml(getFrogSkin(Number(e.skinId)).name)} • ${Number(e.meters || 0).toFixed(1)} m</div>
            </div>
          </div>
          <div class="hs-score">${Number(e.score) || 0} pts</div>
        </div>`
      )
      .join('');
  } catch {
    if (requestId !== hsRequestId || hsMode !== 'global' || activeScreen !== 'highscores') return;
    updateHsStatusBanner(false);
    list.innerHTML = `<p style="text-align:center;color:#fca5a5;margin-top:24px;">Offline or leaderboard unreachable. Check the Local tab!</p>`;
  }
}

async function init(): Promise<void> {
  const deviceId = await resolveDeviceId();
  state = loadFrogState(deviceId);
  soundFX.enabled = state.soundEnabled;
  if (state.apiBaseUrl) void flushPendingFrogScores(state.apiBaseUrl);
  buildApp();
  renderOptions();

  document.getElementById('btn-home-play')!.onclick = () => showScreen('game');
  document.getElementById('btn-home-sound')!.onclick = () => toggleSound();
  document.getElementById('btn-home-more')!.onclick = () => {
    document.getElementById('more-games-modal')?.classList.remove('hidden');
  };
  document.getElementById('btn-more-close')!.onclick = () => {
    document.getElementById('more-games-modal')?.classList.add('hidden');
  };
  document.getElementById('more-games-modal')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('more-games-modal')?.classList.add('hidden');
    }
  });
  document.getElementById('btn-home-options')!.onclick = () => {
    optionsFromPlay = false;
    renderOptions();
    showScreen('options');
  };
  document.getElementById('btn-home-highscores')!.onclick = () => showScreen('highscores');

  document.getElementById('btn-options-back')!.onclick = () => {
    normalizePlayerNameInput();
    if (optionsFromPlay) showScreen('game', { resumeRun: true });
    else showScreen('home');
  };
  document.getElementById('btn-options-start')!.onclick = () => {
    normalizePlayerNameInput();
    showScreen('game', { resumeRun: optionsFromPlay });
  };

  const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
  nameInput.addEventListener('input', (e) => {
    state.playerName = (e.target as HTMLInputElement).value.slice(0, 20);
    saveFrogState(state);
  });
  nameInput.addEventListener('blur', () => {
    normalizePlayerNameInput();
  });

  document.getElementById('btn-game-pause')!.onclick = () => openPauseModal();
  document.getElementById('btn-game-options')!.onclick = () => {
    optionsFromPlay = true;
    stage?.setPaused(true);
    renderOptions();
    showScreen('options');
  };
  document.getElementById('btn-game-sound')!.onclick = () => toggleSound();

  document.getElementById('btn-pause-resume')!.onclick = () => closePauseModal(true);
  document.getElementById('btn-pause-skins')!.onclick = () => {
    closePauseModal(false);
    optionsFromPlay = true;
    renderOptions();
    showScreen('options');
  };
  document.getElementById('btn-pause-restart')!.onclick = () => {
    closePauseModal(false);
    document.getElementById('gameover-card')!.classList.add('hidden');
    stage?.resetGame();
    stage?.start();
  };
  document.getElementById('btn-pause-quit')!.onclick = () => {
    const quitBtn = document.getElementById('btn-pause-quit')!;
    if (!confirmQuitArmed) {
      confirmQuitArmed = true;
      quitBtn.textContent = '⚠ Tap again to Quit';
      return;
    }
    showScreen('home');
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && activeScreen === 'game' && stage && !stage.isDead()) {
      if (stage.isPaused()) closePauseModal(true);
      else openPauseModal();
    }
  });

  document.getElementById('btn-retry')!.onclick = () => {
    document.getElementById('gameover-card')!.classList.add('hidden');
    stage?.resetGame();
    stage?.start();
  };
  document.getElementById('btn-go-menu')!.onclick = () => showScreen('home');
  document.getElementById('btn-go-hs')!.onclick = () => showScreen('highscores');

  document.getElementById('btn-hs-back')!.onclick = () => showScreen('home');
  document.getElementById('btn-hs-refresh')!.onclick = () => refreshHighscoresView();
  document.getElementById('hs-heading')!.onclick = () => {
    hsHeadingTapCount += 1;
    if (hsHeadingTapTimer !== null) window.clearTimeout(hsHeadingTapTimer);
    hsHeadingTapTimer = window.setTimeout(() => {
      hsHeadingTapCount = 0;
    }, 1500);
    if (hsHeadingTapCount >= 5) {
      hsHeadingTapCount = 0;
      document.getElementById('server-box')?.classList.toggle('hidden');
    }
  };
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

