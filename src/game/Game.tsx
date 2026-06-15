import { useRef, useEffect, useCallback, useState } from 'react';
import type { GameState } from './types';
import { createInitialState, resetJam, JAMS_PER_PERIOD_COUNT } from './gameState';
import { updatePhysics } from './physics';
import { audio } from './audio';
import {
  render,
  renderHUD,
  renderCountdown,
  renderJamEnd,
  renderMenu,
  renderGameOver,
  renderPortraitWarning,
  drawTurboBtn,
  drawPushBtn,
  drawCalloffBtnAbovePush,
  getTeamButtonBounds,
} from './renderer';

const JOYSTICK_RADIUS = 70;
const JOYSTICK_KNOB = 32;

const BTN_PAD = 76;

function isTurboBtn(x: number, y: number, W: number, H: number): boolean {
  const size = Math.min(W, H) * 0.16;
  const pushX = W - size - 16;
  const bx = pushX - size - 10;
  return x >= bx && x <= bx + size && y >= H - size - BTN_PAD && y <= H - BTN_PAD;
}

// Push button — bottom-right corner
function isPushBtn(x: number, y: number, W: number, H: number): boolean {
  const size = Math.min(W, H) * 0.16;
  return x >= W - size - 16 && x <= W - 16 && y >= H - size - BTN_PAD && y <= H - BTN_PAD;
}

// Call-off button — sits above push button
function isCalloffBtn(x: number, y: number, W: number, H: number): boolean {
  const pushSize = Math.min(W, H) * 0.16;
  const size = Math.min(W, H) * 0.14;
  const bx = W - size - 16;
  const by = H - pushSize - BTN_PAD - size - 10;
  return x >= bx && x <= bx + size && y >= by && y <= by + size;
}

function hitTeamBtn(
  x: number, y: number, W: number, H: number
): 'kitty' | 'unicorn' | null {
  const b = getTeamButtonBounds(W, H);
  if (x >= b.kitty.x && x <= b.kitty.x + b.kitty.w && y >= b.kitty.y && y <= b.kitty.y + b.kitty.h) return 'kitty';
  if (x >= b.unicorn.x && x <= b.unicorn.x + b.unicorn.w && y >= b.unicorn.y && y <= b.unicorn.y + b.unicorn.h) return 'unicorn';
  return null;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState('kitty'));
  const animRef = useRef<number>(0);
  const joystickTouchId = useRef<number | null>(null);
  const turboTouchRef = useRef(false);
  const pushTouchRef = useRef(false);
  const [, forceUpdate] = useState(0);

  const getPlayerJammerId = () =>
    stateRef.current.playerTeam === 'kitty' ? 'kitty-jammer' : 'unicorn-jammer';

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
  }, []);

  // Facebook's in-app browser updates layout slowly after rotation — schedule
  // multiple delayed checks so we catch it whenever the WebView settles.
  const scheduleResize = useCallback(() => {
    [50, 150, 350, 700, 1200].forEach(ms => setTimeout(resizeCanvas, ms));
  }, [resizeCanvas]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', scheduleResize);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('orientationchange', scheduleResize);
    };
  }, [resizeCanvas, scheduleResize]);

  const loop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const state = stateRef.current;
    const dt = Math.min(50, state.lastTimestamp ? timestamp - state.lastTimestamp : 16);

    const joy = state.joystick;
    let joyX = 0, joyY = 0;
    if (joy.active) {
      const dx = joy.tipX - joy.baseX;
      const dy = joy.tipY - joy.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const norm = Math.min(dist / JOYSTICK_RADIUS, 1);
        joyX = (dx / dist) * norm;
        joyY = (dy / dist) * norm;
      }
    }

    let next: GameState = { ...state, lastTimestamp: timestamp };
    const isPortrait = H > W * 1.1;

    if (isPortrait) {
      ctx.clearRect(0, 0, W, H);
      renderPortraitWarning(ctx, W, H);
      stateRef.current = next;
      animRef.current = requestAnimationFrame(loop);
      return;
    }

    if (next.phase === 'menu') {
      ctx.clearRect(0, 0, W, H);
      renderMenu(ctx, W, H);
    } else if (next.phase === 'countdown') {
      next.countdownTimer -= dt;
      // Play countdown beeps
      const prevCount = Math.ceil((state.countdownTimer) / 1000);
      const newCount = Math.ceil(next.countdownTimer / 1000);
      if (newCount !== prevCount && next.countdownTimer > 0) audio.beep(newCount === 1);
      if (next.countdownTimer <= -300) { next.phase = 'initial_pass'; audio.whistle(); }
      ctx.clearRect(0, 0, W, H);
      render(ctx, next, timestamp, getPlayerJammerId(), W, H);
      renderHUD(ctx, next, W, H);
      renderCountdown(ctx, next.countdownTimer, W, H);
    } else if (next.phase === 'initial_pass' || next.phase === 'scoring') {
      const activateTurbo = turboTouchRef.current;
      if (activateTurbo) turboTouchRef.current = false;
      const activatePush = pushTouchRef.current;
      if (activatePush) pushTouchRef.current = false;

      next = updatePhysics(next, dt, joyX, joyY, W, H, activateTurbo, activatePush);
      next.jamTimer -= dt;

      if (next.initialPassDone && next.phase === 'initial_pass') next.phase = 'scoring';
      if (next.calloffPressed && next.leadJammer === next.playerTeam && next.phase === 'scoring') {
        audio.whistle();
        next.phase = 'jam_end';
      }
      if (next.jamTimer <= 0) { next.jamTimer = 0; audio.whistle(); next.phase = 'jam_end'; }

      ctx.clearRect(0, 0, W, H);
      render(ctx, next, timestamp, getPlayerJammerId(), W, H);
      renderHUD(ctx, next, W, H);

      // Always show joystick: faint at home when idle, bright when touched
      const joyHomeX = JOYSTICK_RADIUS - 24;
      const joyHomeY = H * 0.58;
      if (joy.active) {
        drawJoystick(ctx, joy.baseX, joy.baseY, joy.tipX, joy.tipY, true);
      } else {
        drawJoystick(ctx, joyHomeX, joyHomeY, joyHomeX, joyHomeY, false);
      }
      drawTurboBtn(ctx, W, H, next.turbo.active, next.turbo.cooldown, next.turbo.duration);
      drawPushBtn(ctx, W, H, next.pushCooldown);
      if (next.leadJammer === next.playerTeam && next.phase === 'scoring') {
        drawCalloffBtnAbovePush(ctx, W, H);
      }
    } else if (next.phase === 'jam_end') {
      ctx.clearRect(0, 0, W, H);
      render(ctx, next, timestamp, getPlayerJammerId(), W, H);
      renderJamEnd(ctx, next, W, H);
    } else if (next.phase === 'game_over') {
      ctx.clearRect(0, 0, W, H);
      renderGameOver(ctx, next, W, H);
    }

    stateRef.current = next;
    animRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [loop]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    audio.unlock();

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    // Portrait mode: any tap schedules a resize burst in case the user just rotated.
    // Facebook's WebView won't have fired a proper resize yet — this is the manual trigger.
    if (H > W * 1.1) {
      scheduleResize();
      e.preventDefault();
      return;
    }

    const state = stateRef.current;
    const rect = canvas.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;

      if (state.phase === 'menu') {
        const team = hitTeamBtn(x, y, W, H);
        if (team) startGame(team);
        return;
      }
      if (['jam_end', 'game_over'].includes(state.phase)) {
        advancePhase(); return;
      }

      if (state.phase === 'initial_pass' || state.phase === 'scoring') {
        if (isTurboBtn(x, y, W, H)) {
          turboTouchRef.current = true;
        } else if (isPushBtn(x, y, W, H)) {
          pushTouchRef.current = true;
        } else if (isCalloffBtn(x, y, W, H)) {
          stateRef.current = { ...stateRef.current, calloffPressed: true };
        } else if (x < W * 0.65 && joystickTouchId.current === null) {
          joystickTouchId.current = t.identifier;
          // Clamp base so joystick ring is never cut off by screen edge
          const clampedX = Math.max(JOYSTICK_RADIUS + 10, Math.min(W * 0.6 - JOYSTICK_RADIUS - 10, x));
          const clampedY = Math.max(JOYSTICK_RADIUS + 10, Math.min(H - JOYSTICK_RADIUS - 10, y));
          stateRef.current = {
            ...stateRef.current,
            joystick: { active: true, baseX: clampedX, baseY: clampedY, tipX: clampedX, tipY: clampedY },
          };
        }
      }
    }
    e.preventDefault();
  }, [scheduleResize]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickTouchId.current) {
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        const joy = stateRef.current.joystick;
        const dx = x - joy.baseX, dy = y - joy.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clamp = Math.min(dist, JOYSTICK_RADIUS);
        stateRef.current = {
          ...stateRef.current,
          joystick: {
            ...joy,
            tipX: dist > 0 ? joy.baseX + (dx / dist) * clamp : joy.baseX,
            tipY: dist > 0 ? joy.baseY + (dy / dist) * clamp : joy.baseY,
          },
        };
      }
    }
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        stateRef.current = {
          ...stateRef.current,
          joystick: { active: false, baseX: 0, baseY: 0, tipX: 0, tipY: 0 },
          calloffPressed: false,
        };
      }
    }
    e.preventDefault();
  }, []);

  // Keyboard controls
  useEffect(() => {
    const held: Record<string, boolean> = {};
    const update = () => {
      let x = 0, y = 0;
      if (held['ArrowLeft'] || held['a'] || held['A']) x = -1;
      if (held['ArrowRight'] || held['d'] || held['D']) x = 1;
      if (held['ArrowUp'] || held['w'] || held['W']) y = -1;
      if (held['ArrowDown'] || held['s'] || held['S']) y = 1;
      const active = x !== 0 || y !== 0;
      const cx = 100, cy = (canvasRef.current?.offsetHeight ?? 400) - 100;
      stateRef.current = {
        ...stateRef.current,
        joystick: active
          ? { active: true, baseX: cx, baseY: cy, tipX: cx + x * JOYSTICK_RADIUS, tipY: cy + y * JOYSTICK_RADIUS }
          : { active: false, baseX: 0, baseY: 0, tipX: 0, tipY: 0 },
      };
    };
    const onKeyDown = (e: KeyboardEvent) => {
      audio.unlock();
      held[e.key] = true;
      update();
      if (e.key === ' ' || e.key === 'Enter') {
        const s = stateRef.current;
        if (['jam_end', 'game_over'].includes(s.phase)) advancePhase();
        else if (s.leadJammer === s.playerTeam && s.phase === 'scoring') {
          stateRef.current = { ...stateRef.current, calloffPressed: true };
        }
      }
      if (e.key === 'Shift' || e.key === 'z' || e.key === 'Z') {
        turboTouchRef.current = true;
      }
      if (e.key === 'x' || e.key === 'X') {
        pushTouchRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      held[e.key] = false;
      update();
      if (e.key === ' ') stateRef.current = { ...stateRef.current, calloffPressed: false };
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  function startGame(team: 'kitty' | 'unicorn') {
    stateRef.current = { ...createInitialState(team), phase: 'countdown', countdownTimer: 3000 };
    audio.whistle();
    forceUpdate(n => n + 1);
  }

  function advancePhase() {
    const state = stateRef.current;
    if (state.phase === 'jam_end') {
      const totalJams = state.jam;
      if (totalJams >= JAMS_PER_PERIOD_COUNT * 2) {
        stateRef.current = { ...state, phase: 'game_over' };
      } else if (totalJams >= JAMS_PER_PERIOD_COUNT && state.period === 1) {
        stateRef.current = { ...resetJam(state), period: 2, jam: JAMS_PER_PERIOD_COUNT + 1 };
      } else {
        stateRef.current = resetJam(state);
      }
    } else if (state.phase === 'game_over') {
      stateRef.current = createInitialState(state.playerTeam); // back to menu, same team pre-selected context
    }
    forceUpdate(n => n + 1);
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        audio.unlock();
        const s = stateRef.current;
        const canvas = canvasRef.current;
        if (s.phase === 'menu' && canvas) {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const team = hitTeamBtn(x, y, canvas.offsetWidth, canvas.offsetHeight);
          if (team) startGame(team);
        } else if (['jam_end', 'game_over'].includes(s.phase)) {
          advancePhase();
        }
      }}
    />
  );
}

function drawJoystick(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, tx: number, ty: number,
  active: boolean
) {
  ctx.save();

  // Outer ring
  ctx.globalAlpha = active ? 0.55 : 0.18;
  ctx.beginPath();
  ctx.arc(bx, by, JOYSTICK_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = active ? 3 : 2;
  ctx.stroke();

  // Dashed inner guide ring (only when idle, to hint at directions)
  if (!active) {
    ctx.setLineDash([6, 6]);
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(bx, by, JOYSTICK_RADIUS * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Knob
  ctx.globalAlpha = active ? 0.88 : 0.25;
  ctx.beginPath();
  ctx.arc(tx, ty, JOYSTICK_KNOB, 0, Math.PI * 2);
  ctx.fillStyle = active ? '#7c3aed' : '#4c1d95';
  ctx.fill();
  ctx.strokeStyle = active ? '#c4b5fd' : '#7c3aed';
  ctx.lineWidth = active ? 3 : 2;
  ctx.stroke();

  ctx.restore();
}

