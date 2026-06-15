import type { GameState, PowerUp, Particle } from './types';
import { getTrackGeometry, trackToScreen } from './track';

function charSize(W: number) { return Math.max(24, Math.min(W * 0.055, 42)); }

const POWERUP_EMOJI: Record<string, string> = {
  speed: '⚡',
  multiplier: '⭐',
};
const POWERUP_COLOR: Record<string, string> = {
  speed: '#fbbf24',
  multiplier: '#a78bfa',
};

// ── Track ──────────────────────────────────────────────────────

function drawTrack(ctx: CanvasRenderingContext2D, geo: ReturnType<typeof getTrackGeometry>) {
  ctx.save();

  ctx.beginPath();
  ctx.ellipse(geo.cx, geo.cy, geo.rx - geo.width, geo.ry - geo.width, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e'; ctx.fill();

  ctx.beginPath();
  ctx.ellipse(geo.cx, geo.cy, geo.rx, geo.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2d1b69'; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(geo.cx, geo.cy, geo.rx - geo.width, geo.ry - geo.width, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e'; ctx.fill();

  ctx.beginPath();
  ctx.ellipse(geo.cx, geo.cy, geo.rx, geo.ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(geo.cx, geo.cy, geo.rx - geo.width, geo.ry - geo.width, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 3; ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(geo.cx, geo.cy, geo.rx - geo.width / 2, geo.ry - geo.width / 2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);

  const jp1 = trackToScreen(0.08, 0, geo); const jp2 = trackToScreen(0.08, 1, geo);
  ctx.beginPath(); ctx.moveTo(jp1.x, jp1.y); ctx.lineTo(jp2.x, jp2.y);
  ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2; ctx.stroke();

  const pp1 = trackToScreen(0.15, 0, geo); const pp2 = trackToScreen(0.15, 1, geo);
  ctx.beginPath(); ctx.moveTo(pp1.x, pp1.y); ctx.lineTo(pp2.x, pp2.y);
  ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2; ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.font = `bold ${Math.floor(geo.ry * 0.35)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ROLLER', geo.cx, geo.cy - geo.ry * 0.12);
  ctx.fillText('DERBY', geo.cx, geo.cy + geo.ry * 0.12);
  ctx.restore();
}

// ── Power-ups ──────────────────────────────────────────────────

function drawPowerUps(ctx: CanvasRenderingContext2D, powerUps: PowerUp[], geo: ReturnType<typeof getTrackGeometry>, W: number) {
  const cs = charSize(W) * 0.85;
  for (const pu of powerUps) {
    if (pu.respawnIn > 0) continue;
    const pos = trackToScreen(pu.trackPos, pu.lane, geo);
    const scale = 1 + 0.15 * Math.sin(pu.pulse / 300);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(scale, scale);

    // Glow ring
    ctx.beginPath();
    ctx.arc(0, 0, cs * 0.75, 0, Math.PI * 2);
    ctx.strokeStyle = POWERUP_COLOR[pu.type];
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(pu.pulse / 200);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.font = `${cs}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = POWERUP_COLOR[pu.type];
    ctx.shadowBlur = 12;
    ctx.fillText(POWERUP_EMOJI[pu.type], 0, 0);
    ctx.restore();
  }
}

// ── Characters ────────────────────────────────────────────────

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  emoji: string, x: number, y: number,
  size: number, stunned: boolean, isPlayer = false,
  turboActive = false
) {
  ctx.save();
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isPlayer && turboActive) {
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 22;
  } else if (isPlayer) {
    ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 14;
  }

  if (stunned) ctx.globalAlpha = 0.4;
  ctx.fillText(emoji, x, y);

  if (isPlayer) {
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.9);
    ctx.lineTo(x - 7, y - size * 1.3);
    ctx.lineTo(x + 7, y - size * 1.3);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ── Particles ─────────────────────────────────────────────────

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = p.life * 0.9;
    if (p.emoji) {
      ctx.font = `${p.size * 1.6}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── Grand Slam overlay ────────────────────────────────────────

function drawGrandSlam(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number, _timestamp: number) {
  if (!state.grandSlam.active) return;
  const alpha = Math.min(1, state.grandSlam.timer / 300);
  ctx.save();
  ctx.font = `bold ${Math.min(W * 0.045, 26)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd700';
  ctx.globalAlpha = alpha;
  ctx.fillText('+4 SLAM', W * 0.38, H * 0.12);
  ctx.restore();
}

// ── HUD effects indicators ────────────────────────────────────

function drawEffectIndicators(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const icons: string[] = [];
  if (state.activeEffects.speed > 0) icons.push('⚡');
  if (state.activeEffects.multiplier > 0) icons.push('⭐×2');
  if (icons.length === 0) return;
  ctx.save();
  ctx.font = `${Math.min(W * 0.035, 18)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y = H * 0.91;
  const spacing = W * 0.07;
  const startX = W / 2 - (icons.length - 1) * spacing / 2;
  for (let i = 0; i < icons.length; i++) {
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(Date.now() / 200 + i);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(icons[i], startX + i * spacing, y);
  }
  ctx.restore();
}

// ── Main exports ──────────────────────────────────────────────

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timestamp: number,
  playerJammerId: string,
  W: number,
  H: number
) {
  const geo = getTrackGeometry(W, H);
  const cs = charSize(W);

  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const sx = W * (0.3 + 0.4 * Math.sin(i * 1.7 + 0.3));
    const sy = H * (0.35 + 0.3 * Math.cos(i * 2.3 + 1.1));
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(timestamp / 500 + i);
    ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✦', sx, sy);
  }
  ctx.restore();

  drawTrack(ctx, geo);
  drawPowerUps(ctx, state.powerUps, geo, W);

  const refs = state.characters.filter(c => c.role === 'ref');
  const blockers = state.characters.filter(c => c.role === 'blocker' || c.role === 'pivot');
  const jammers = state.characters.filter(c => c.role === 'jammer');

  for (const c of [...refs, ...blockers, ...jammers]) {
    const pos = trackToScreen(c.trackPos, c.lane, geo);
    const isPlayer = c.id === playerJammerId;
    drawCharacter(
      ctx, c.emoji, pos.x, pos.y, cs, c.stunned > 0, isPlayer,
      isPlayer && state.turbo.active,
    );
  }

  drawParticles(ctx, state.particles);
  drawGrandSlam(ctx, state, W, H, timestamp);

  // Floating message
  if (state.message && state.messageTtl > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.messageTtl / 350);
    ctx.font = `bold ${Math.floor(W * 0.055)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffff00'; ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 10;
    ctx.fillText(state.message, W / 2, H * 0.44);
    ctx.restore();
  }

  // Screen flash (disabled — was too disruptive)
  if (false && state.screenFlash > 0) {
    ctx.save();
    ctx.globalAlpha = state.screenFlash * 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

export function renderHUD(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  const hudH = Math.max(44, H * 0.10);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, hudH);
  const mid = hudH * 0.48;
  const fs = Math.max(14, Math.min(W * 0.042, 22));

  ctx.font = `bold ${fs}px monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff69b4'; ctx.textAlign = 'left';
  ctx.fillText(`🐱 ${state.score.kitty}`, W * 0.04, mid);

  const secs = Math.ceil(state.jamTimer / 1000);
  const timeStr = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const lastTen = state.jamTimer < 10_000;
  ctx.fillStyle = lastTen ? '#ff4444' : '#ffffff';
  if (lastTen) { ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 8; }
  ctx.textAlign = 'center';
  ctx.fillText(timeStr, W / 2, mid);
  ctx.shadowBlur = 0;

  ctx.font = `${Math.max(10, fs * 0.65)}px monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`P${state.period} · J${state.jam}`, W / 2, mid + fs * 0.9);

  ctx.font = `bold ${fs}px monospace`;
  ctx.fillStyle = '#a78bfa'; ctx.textAlign = 'right';
  ctx.fillText(`${state.score.unicorn} 🦄`, W * 0.96, mid);

  if (state.leadJammer) {
    ctx.fillStyle = '#ffd700';
    ctx.font = `${Math.max(11, fs * 0.68)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(state.leadJammer === 'kitty' ? '⭐ Lead: 🐱' : '⭐ Lead: 🦄', W / 2, hudH - 5);
  }

  if (!state.initialPassDone) {
    ctx.font = `${Math.max(11, fs * 0.68)}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,100,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('⬆️ Speed up · ⬅️➡️ Change lane · Skate through the pack!', W / 2, hudH + 16);
  }

  drawEffectIndicators(ctx, state, W, H);
  ctx.restore();
}

export function renderCountdown(ctx: CanvasRenderingContext2D, timer: number, W: number, H: number) {
  const count = Math.ceil(timer / 1000);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffff00';
  ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.28)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 24;
  ctx.fillText(count > 0 ? String(count) : 'GO!', W / 2, H / 2);
  ctx.restore();
}

export function renderJamEnd(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
  const fs = Math.min(W * 0.09, 48);
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('JAM OVER!', W / 2, H * 0.34);
  ctx.font = `${fs * 0.75}px sans-serif`;
  ctx.fillStyle = '#ff69b4';
  ctx.fillText(`🐱 Kitties: ${state.score.kitty}`, W / 2, H * 0.50);
  ctx.fillStyle = '#a78bfa';
  ctx.fillText(`🦄 Unicorns: ${state.score.unicorn}`, W / 2, H * 0.62);
  ctx.font = `${fs * 0.48}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Tap to continue...', W / 2, H * 0.78);
  ctx.restore();
}

export function getTeamButtonBounds(W: number, H: number) {
  const btnW = Math.min(W * 0.36, 210);
  const btnH = Math.max(56, H * 0.14);
  const gap = W * 0.05;
  const totalW = btnW * 2 + gap;
  const startX = (W - totalW) / 2;
  const btnY = H * 0.72;
  return {
    kitty:   { x: startX,              y: btnY, w: btnW, h: btnH },
    unicorn: { x: startX + btnW + gap, y: btnY, w: btnW, h: btnH },
  };
}

export function renderMenu(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, W, H);
  const fs = Math.min(W * 0.10, 56);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.fillStyle = '#ff00ff'; ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 20;
  ctx.fillText('ROLLER DERBY!', W / 2, H * 0.18);
  ctx.shadowBlur = 0;
  ctx.font = `${fs * 1.1}px sans-serif`;
  ctx.fillText('🐱 vs 🦄', W / 2, H * 0.34);
  ctx.font = `bold ${fs * 0.44}px sans-serif`;
  ctx.fillStyle = '#aaaaff';
  ctx.fillText('Choose your team!', W / 2, H * 0.50);
  ctx.fillStyle = '#777799'; ctx.font = `${fs * 0.32}px sans-serif`;
  ctx.fillText('🐶 Dogs are referees  ·  Collect ⚡🛡️⭐ power-ups!', W / 2, H * 0.60);
  ctx.fillText('⬆️ Speed up  ·  ⬅️➡️ Change lane  ·  ⬇️ Brake', W / 2, H * 0.66);
  ctx.fillText('🚀 TURBO  ·  💪 PUSH blockers out of the way', W / 2, H * 0.72 - 8);

  // Team selection buttons
  const bounds = getTeamButtonBounds(W, H);
  const labelFs = Math.min(bounds.kitty.h * 0.38, fs * 0.52);

  // Kitties button (pink)
  const k = bounds.kitty;
  ctx.beginPath(); ctx.roundRect(k.x, k.y, k.w, k.h, 14);
  ctx.fillStyle = '#be185d'; ctx.fill();
  ctx.strokeStyle = '#f9a8d4'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `${labelFs * 1.3}px sans-serif`;
  ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 0;
  ctx.fillText('🐱', k.x + k.w / 2, k.y + k.h * 0.38);
  ctx.font = `bold ${labelFs}px sans-serif`;
  ctx.fillText('KITTIES', k.x + k.w / 2, k.y + k.h * 0.76);

  // Unicorns button (purple)
  const u = bounds.unicorn;
  ctx.beginPath(); ctx.roundRect(u.x, u.y, u.w, u.h, 14);
  ctx.fillStyle = '#6d28d9'; ctx.fill();
  ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `${labelFs * 1.3}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('🦄', u.x + u.w / 2, u.y + u.h * 0.38);
  ctx.font = `bold ${labelFs}px sans-serif`;
  ctx.fillText('UNICORNS', u.x + u.w / 2, u.y + u.h * 0.76);

  ctx.restore();
}

export function renderGameOver(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, W, H);
  const kittyWins = state.score.kitty > state.score.unicorn;
  const tie = state.score.kitty === state.score.unicorn;
  const fs = Math.min(W * 0.08, 44);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14;
  ctx.fillText('GAME OVER', W / 2, H * 0.20);
  ctx.shadowBlur = 0;
  ctx.font = `${fs * 1.4}px sans-serif`;
  ctx.fillText(tie ? '🤝' : kittyWins ? '🐱🏆' : '🦄🏆', W / 2, H * 0.40);
  ctx.font = `bold ${fs * 0.8}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(tie ? "It's a tie!" : kittyWins ? 'Kitties WIN!' : 'Unicorns WIN!', W / 2, H * 0.55);
  ctx.font = `${fs * 0.7}px sans-serif`;
  ctx.fillStyle = '#ff69b4';
  ctx.fillText(`🐱 ${state.score.kitty}   🦄 ${state.score.unicorn}`, W / 2, H * 0.67);
  ctx.font = `${fs * 0.48}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Tap to play again!', W / 2, H * 0.82);
  ctx.restore();
}

export function renderPortraitWarning(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // Big rotating phone icon
  ctx.font = `${Math.min(W * 0.22, 80)}px sans-serif`;
  ctx.fillText('📱', W / 2, H * 0.30);

  ctx.font = `bold ${Math.min(W * 0.08, 26)}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Rotate your phone', W / 2, H * 0.50);

  ctx.font = `${Math.min(W * 0.065, 20)}px sans-serif`;
  ctx.fillStyle = '#a78bfa';
  ctx.fillText('🔄 Landscape mode for best play', W / 2, H * 0.62);

  // Tap-to-refresh hint — critical for Facebook in-app browser
  ctx.font = `${Math.min(W * 0.055, 17)}px sans-serif`;
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('Tap here after rotating ☝️', W / 2, H * 0.78);

  ctx.restore();
}

// Extra bottom padding so buttons clear Safari's bottom chrome (~49px) plus original 16px margin
const BTN_PAD = 76;

// Push button — always visible during jam (bottom-right)
export function drawPushBtn(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  pushCooldown: number
) {
  const size = Math.min(W, H) * 0.16;
  const x = W - size - 16;
  const y = H - size - BTN_PAD;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 12);
  ctx.fillStyle = pushCooldown > 0 ? '#374151' : '#b45309';
  ctx.fill();
  ctx.strokeStyle = pushCooldown > 0 ? '#6b7280' : '#fbbf24';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cooldown arc
  if (pushCooldown > 0) {
    const progress = 1 - pushCooldown / 4000;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size * 0.44, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.font = `${size * 0.38}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('💪', x + size / 2, y + size * 0.37);
  ctx.font = `bold ${size * 0.16}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(pushCooldown > 0 ? `${Math.ceil(pushCooldown / 1000)}s` : 'PUSH', x + size / 2, y + size * 0.74);
  ctx.restore();
}

// Call-off button — sits ABOVE push button when lead jammer
export function drawCalloffBtnAbovePush(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const pushSize = Math.min(W, H) * 0.16;
  const size = Math.min(W, H) * 0.14;
  const x = W - size - 16;
  const y = H - pushSize - BTN_PAD - size - 10;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 12);
  ctx.fillStyle = '#dc2626'; ctx.fill();
  ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `${size * 0.36}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1;
  ctx.fillText('🛑', x + size / 2, y + size * 0.37);
  ctx.font = `bold ${size * 0.16}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CALL OFF', x + size / 2, y + size * 0.70);
  ctx.fillText('JAM', x + size / 2, y + size * 0.86);
  ctx.restore();
}

// Draw turbo button with cooldown arc
export function drawTurboBtn(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  turboActive: boolean,
  turboCooldown: number,
  turboDuration: number
) {
  const size = Math.min(W, H) * 0.16;
  const pushX = W - size - 16;
  const x = pushX - size - 10;   // sit directly left of push button
  const y = H - size - BTN_PAD;
  ctx.save();

  // Button background
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 12);
  ctx.fillStyle = turboActive ? '#ea580c' : turboCooldown > 0 ? '#374151' : '#7c3aed';
  ctx.fill();
  ctx.strokeStyle = turboActive ? '#fdba74' : turboCooldown > 0 ? '#6b7280' : '#a78bfa';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cooldown arc
  if (turboCooldown > 0) {
    const progress = 1 - turboCooldown / 6000;
    const cx = x + size / 2; const cy = y + size / 2;
    const r = size * 0.44;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 3; ctx.stroke();
  }

  // Active pulse ring
  if (turboActive) {
    const pulse = 1 + 0.2 * Math.sin(Date.now() / 80);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, (size / 2) * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = '#fdba74'; ctx.lineWidth = 2; ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.font = `${size * 0.38}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🚀', x + size / 2, y + size * 0.38);

  const label = turboActive
    ? `${Math.ceil(turboDuration / 1000)}s`
    : turboCooldown > 0
    ? `${Math.ceil(turboCooldown / 1000)}s`
    : 'TURBO';
  ctx.font = `bold ${size * 0.17}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + size / 2, y + size * 0.75);
  ctx.restore();
}
