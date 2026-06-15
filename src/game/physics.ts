import type { Character, GameState, Particle } from './types';
import { wrapPos, trackDelta, getTrackGeometry, trackToScreen } from './track';
import { audio } from './audio';
import { TURBO_DURATION_MS, TURBO_COOLDOWN_MS } from './gameState';

const JAMMER_SPEED = 0.000126; // ~30% slower
const BLOCKER_SPEED = 0.00012;
const AI_JAMMER_SPEED = 0.000100;
const REF_SPEED = 0.00010;
const STUN_DURATION = 1400;
const COLLISION_TRACK = 0.025;
const COLLISION_LANE = 0.18;
const POWERUP_COLLECT_RADIUS = 0.04;
const POWERUP_COLLECT_LANE = 0.22;
const POWERUP_RESPAWN_MS = 10_000;
const SPEED_EFFECT_MS = 8_000;
const MULTIPLIER_EFFECT_MS = 12_000;
const PUSH_COOLDOWN_MS = 4_000;
const PUSH_RANGE_TRACK = 0.06;
const PUSH_RANGE_LANE = 0.35;
const PUSH_STUN_MS = 1200;

// ── Particle helpers ────────────────────────────────────────────

function burst(
  x: number, y: number,
  count: number,
  colors: string[],
  speed = 3,
  life = 0.9,
  size = 8,
  emojis?: string[]
): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const spd = speed * (0.5 + Math.random());
    return {
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life,
      color: colors[i % colors.length],
      size: size * (0.6 + Math.random() * 0.8),
      emoji: emojis ? emojis[Math.floor(Math.random() * emojis.length)] : undefined,
    };
  });
}

// ── AI helpers ──────────────────────────────────────────────────

function aiBlockerMove(blocker: Character, playerJammer: Character, dt: number): Character {
  if (blocker.stunned > 0) {
    // Animate shove: apply laneVelocity and decay it during stun
    const newLane = Math.max(0.05, Math.min(0.95, blocker.lane + blocker.laneVelocity * dt));
    const newVelocity = blocker.laneVelocity * (1 - 0.006 * dt);
    return {
      ...blocker,
      stunned: blocker.stunned - dt,
      lane: newLane,
      laneVelocity: Math.abs(newVelocity) < 0.00001 ? 0 : newVelocity,
    };
  }
  const isOpposing = blocker.team !== playerJammer.team;
  const targetPos = isOpposing
    ? wrapPos(playerJammer.trackPos + 0.025)
    : wrapPos(playerJammer.trackPos + 0.015);
  const targetLane = isOpposing ? playerJammer.lane : blocker.lane;
  const dPos = trackDelta(blocker.trackPos, targetPos);
  const dLane = targetLane - blocker.lane;
  return {
    ...blocker,
    trackPos: wrapPos(blocker.trackPos + Math.sign(dPos) * BLOCKER_SPEED * dt * 0.5),
    lane: Math.max(0.05, Math.min(0.95, blocker.lane + Math.sign(dLane) * 0.001 * dt * 0.3)),
    laneVelocity: 0,
  };
}

function aiJammerMove(jammer: Character, dt: number): Character {
  if (jammer.stunned > 0) return { ...jammer, stunned: jammer.stunned - dt };
  return {
    ...jammer,
    trackPos: wrapPos(jammer.trackPos + AI_JAMMER_SPEED * dt),
    lane: jammer.lane + (0.5 - jammer.lane) * 0.001 * dt,
  };
}

function refMove(ref: Character, dt: number): Character {
  return { ...ref, trackPos: wrapPos(ref.trackPos + REF_SPEED * dt) };
}

function checkCollision(a: Character, b: Character): boolean {
  return (
    Math.abs(trackDelta(a.trackPos, b.trackPos)) < COLLISION_TRACK &&
    Math.abs(a.lane - b.lane) < COLLISION_LANE
  );
}

// ── Main physics update ──────────────────────────────────────────

export function updatePhysics(
  state: GameState,
  dt: number,
  joyX: number,
  joyY: number,
  canvasW = 800,
  canvasH = 400,
  activateTurbo = false,
  activatePush = false
): GameState {
  let chars = [...state.characters];
  const geo = getTrackGeometry(canvasW, canvasH);
  const playerJammer = chars.find(c => c.team === state.playerTeam && c.role === 'jammer')!;
  const aiJammerTeam = state.playerTeam === 'kitty' ? 'unicorn' : 'kitty';

  let score = { ...state.score };
  let message = state.message;
  let messageTtl = state.messageTtl - dt;
  let initialPassDone = state.initialPassDone;
  let leadJammer = state.leadJammer;
  let powerUps = state.powerUps.map(p => ({ ...p, pulse: p.pulse + dt }));
  let effects = {
    speed: Math.max(0, state.activeEffects.speed - dt),
    multiplier: Math.max(0, state.activeEffects.multiplier - dt),
  };
  let particles = state.particles
    .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.12, life: p.life - dt / 900 }))
    .filter(p => p.life > 0);
  let grandSlam = { ...state.grandSlam, timer: state.grandSlam.timer - dt };
  if (grandSlam.timer <= 0) grandSlam = { active: false, timer: 0, x: 0, y: 0 };
  let screenFlash = Math.max(0, state.screenFlash - dt / 300);

  // ── Turbo ──
  let turbo = { ...state.turbo };
  if (turbo.active) {
    turbo.duration -= dt;
    if (turbo.duration <= 0) { turbo.active = false; turbo.duration = 0; turbo.cooldown = TURBO_COOLDOWN_MS; }
  } else if (turbo.cooldown > 0) {
    turbo.cooldown = Math.max(0, turbo.cooldown - dt);
  }
  if (activateTurbo && !turbo.active && turbo.cooldown === 0) {
    turbo = { active: true, duration: TURBO_DURATION_MS, cooldown: 0 };
    audio.turbo();
  }

  // ── Push cooldown ──
  let pushCooldown = Math.max(0, state.pushCooldown - dt);

  // ── Push action: shove nearby opposing blockers away ──
  if (activatePush && pushCooldown === 0) {
    const jammer = chars.find(c => c.id === playerJammer.id)!;
    let pushedAny = false;
    chars = chars.map(c => {
      if (c.team !== aiJammerTeam || (c.role !== 'blocker' && c.role !== 'pivot')) return c;
      if (c.stunned > 0) return c;
      const dTrack = Math.abs(trackDelta(jammer.trackPos, c.trackPos));
      const dLane = Math.abs(jammer.lane - c.lane);
      if (dTrack < PUSH_RANGE_TRACK && dLane < PUSH_RANGE_LANE) {
        const pos = trackToScreen(c.trackPos, c.lane, geo);
        const pushDir = c.lane > 0.5 ? 1 : -1;
        particles = [...particles, ...burst(pos.x, pos.y, 5, ['#ff6b6b', '#ffd700', '#ffffff', '#ff4444'], 4, 0.6, 6)];
        pushedAny = true;
        // laneVelocity drives the smooth shove animation in aiBlockerMove during stun
        return { ...c, laneVelocity: pushDir * 0.0018, stunned: PUSH_STUN_MS };
      }
      return c;
    });
    if (pushedAny) {
      audio.push();
      pushCooldown = PUSH_COOLDOWN_MS;
      message = '💪 SHOVE!';
      messageTtl = 700;
    }
  }

  const speedMult =
    (turbo.active ? 2.5 : 1) *
    (effects.speed > 0 ? 2.0 : 1);

  // ── Move player jammer (auto-skates clockwise; joystick steers) ──
  chars = chars.map(c => {
    if (c.id !== playerJammer.id) return c;
    if (c.stunned > 0) return { ...c, stunned: c.stunned - dt };

    // Base clockwise speed + joystick up/down to speed up / brake
    const baseSpeed = JAMMER_SPEED * 0.55;
    const boost = Math.max(0, -joyY);   // joystick up   → go faster
    const brake = Math.max(0, joyY);    // joystick down → slow down
    const moveSpeed = baseSpeed + boost * JAMMER_SPEED * 0.8 - brake * JAMMER_SPEED * 0.45;
    const finalSpeed = Math.max(JAMMER_SPEED * 0.08, moveSpeed) * speedMult;

    const newPos = wrapPos(c.trackPos + finalSpeed * dt);
    // Joystick left/right changes lane (left = inner, right = outer)
    const newLane = Math.max(0.05, Math.min(0.95, c.lane + joyX * 0.002 * dt));
    return { ...c, trackPos: newPos, lane: newLane };
  });

  // ── Move AI ──
  const currentPlayer = chars.find(c => c.id === playerJammer.id)!;
  chars = chars.map(c => {
    if (c.team === state.playerTeam && c.role === 'jammer') return c;
    if (c.role === 'ref') return refMove(c, dt);
    if (c.role === 'jammer') return aiJammerMove(c, dt);
    return aiBlockerMove(c, currentPlayer, dt);
  });

  // ── Turbo trail particles ──
  if (turbo.active) {
    const pPos = chars.find(c => c.id === playerJammer.id)!;
    const pos = trackToScreen(pPos.trackPos, pPos.lane, geo);
    if (Math.random() < 0.6) {
      particles = [
        ...particles,
        ...burst(pos.x, pos.y, 1, ['#ff8800', '#ffff00'], 2, 0.4, 4),
      ];
    }
  }

  // ── Collision: player jammer vs opposing blockers ──
  const updatedPlayer = chars.find(c => c.id === playerJammer.id)!;
  if (updatedPlayer.stunned === 0) {
    chars = chars.map(c => {
      if (c.team !== aiJammerTeam || (c.role !== 'blocker' && c.role !== 'pivot')) return c;
      if (c.stunned > 0) return c;
      if (checkCollision(updatedPlayer, c)) {
        const pos = trackToScreen(updatedPlayer.trackPos, updatedPlayer.lane, geo);
        {
          audio.hit();
          chars = chars.map(p => p.id === playerJammer.id ? { ...p, stunned: 400 } : p);
          particles = [...particles, ...burst(pos.x, pos.y, 3, ['#ff4444', '#ff8800'], 3, 0.5, 5)];
        }
        return { ...c, lane: Math.min(0.95, c.lane + 0.2), stunned: STUN_DURATION };
      }
      return c;
    });
  }

  // ── Power-up collection ──
  const jammPos = chars.find(c => c.id === playerJammer.id)!;
  powerUps = powerUps.map(pu => {
    if (pu.respawnIn > 0) return { ...pu, respawnIn: Math.max(0, pu.respawnIn - dt) };
    // Symmetric circular distance so jammer can collect whether slightly before or after the pickup
    const rawD = Math.abs(jammPos.trackPos - pu.trackPos);
    const dPos = Math.min(rawD, 1 - rawD);
    const dLane = Math.abs(jammPos.lane - pu.lane);
    if (dPos < POWERUP_COLLECT_RADIUS && dLane < POWERUP_COLLECT_LANE) {
      const pos = trackToScreen(pu.trackPos, pu.lane, geo);
      switch (pu.type) {
        case 'speed':
          effects = { ...effects, speed: SPEED_EFFECT_MS };
          audio.speedBoost();
          message = '⚡ Speed Boost!';
          particles = [...particles, ...burst(pos.x, pos.y, 4, ['#fbbf24', '#f59e0b'], 4, 0.6, 6)];
          break;
        case 'multiplier':
          effects = { ...effects, multiplier: MULTIPLIER_EFFECT_MS };
          audio.powerUp();
          message = '⭐ 2× Score!';
          particles = [...particles, ...burst(pos.x, pos.y, 4, ['#a78bfa', '#7c3aed'], 4, 0.6, 6)];
          break;
      }
      messageTtl = 1500;
      // Respawn at a new random position
      const newPos = wrapPos(pu.trackPos + 0.3 + Math.random() * 0.2);
      return { ...pu, trackPos: newPos, lane: 0.2 + Math.random() * 0.6, respawnIn: POWERUP_RESPAWN_MS };
    }
    return pu;
  });

  // ── Scoring: 1 point per opposing blocker passed, after initial pass ──
  const passMultiplier = effects.multiplier > 0 ? 2 : 1;

  if (initialPassDone) {
    const jammer = chars.find(c => c.id === playerJammer.id)!;
    chars = chars.map(c => {
      if (c.team !== aiJammerTeam || (c.role !== 'blocker' && c.role !== 'pivot')) return c;
      if (c.passedThisTrip) return c; // already scored this trip
      const delta = trackDelta(c.trackPos, jammer.trackPos);
      if (delta > 0.03 && delta < 0.5) {
        const pts = passMultiplier;
        score = { ...score, [state.playerTeam]: score[state.playerTeam] + pts };
        audio.score();
        message = `+${pts}`;
        messageTtl = 600;
        return { ...c, passedThisTrip: true };
      }
      return c;
    });
  }

  // Lap sensor: when player jammer crosses the start line (trackPos wraps 0.99→0.01)
  // reset all opposing blockers so they can be scored again next trip.
  // This replaces the unreliable delta > 0.65 approach: blockers chase the jammer at
  // nearly the same speed so the gap rarely exceeds 0.65 within a 2-minute jam.
  if (initialPassDone) {
    const prevJammerPos = state.characters.find(c => c.id === playerJammer.id)?.trackPos ?? 0;
    const currJammerPos = chars.find(c => c.id === playerJammer.id)!.trackPos;
    if (prevJammerPos > 0.85 && currJammerPos < 0.15) {
      chars = chars.map(c => {
        if (c.team !== aiJammerTeam || (c.role !== 'blocker' && c.role !== 'pivot')) return c;
        return { ...c, passedThisTrip: false };
      });
    }
  }

  // ── Initial pass detection ──
  // Requires jammer to be GENUINELY ahead (delta 0.02–0.5), not just wrap-around large.
  // At jam start the jammer is behind the pack so wrap-around gives delta ≈ 0.9 — we
  // must reject those false positives or initialPassDone fires on frame 1.
  if (!initialPassDone) {
    const jammer = chars.find(c => c.id === playerJammer.id)!;
    const opposingBlockers = chars.filter(c => c.team === aiJammerTeam && (c.role === 'blocker' || c.role === 'pivot'));
    if (opposingBlockers.every(b => {
      const d = trackDelta(b.trackPos, jammer.trackPos);
      return d > 0.02 && d < 0.5;
    })) {
      initialPassDone = true;
      // Mark blockers as already-passed so the first SCORING trip happens on the NEXT lap
      chars = chars.map(c => {
        if (c.team !== aiJammerTeam || (c.role !== 'blocker' && c.role !== 'pivot')) return c;
        return { ...c, passedThisTrip: true };
      });
      if (!leadJammer) {
        leadJammer = state.playerTeam;
        audio.whistle();
        message = '⭐ LEAD JAMMER! Tap 🛑 to call it off!';
        messageTtl = 3000;
      }
    }
  }

  // ── AI jammer scoring ──
  const aiJammer = chars.find(c => c.team === aiJammerTeam && c.role === 'jammer')!;
  chars = chars.map(c => {
    if (c.team !== state.playerTeam || (c.role !== 'blocker' && c.role !== 'pivot')) return c;
    if (c.passedThisTrip) return c;
    const delta = trackDelta(c.trackPos, aiJammer.trackPos);
    if (delta > 0.03 && delta < 0.5) {
      score = { ...score, [aiJammerTeam]: score[aiJammerTeam] + 1 };
      return { ...c, passedThisTrip: true };
    }
    return c;
  });
  // AI lap sensor: reset player blockers when AI jammer crosses the start line
  {
    const prevAiPos = state.characters.find(c => c.team === aiJammerTeam && c.role === 'jammer')?.trackPos ?? 0;
    const currAiPos = aiJammer.trackPos;
    if (prevAiPos > 0.85 && currAiPos < 0.15) {
      chars = chars.map(c => {
        if (c.team !== state.playerTeam || (c.role !== 'blocker' && c.role !== 'pivot')) return c;
        return { ...c, passedThisTrip: false };
      });
    }
  }

  return {
    ...state,
    characters: chars,
    score,
    leadJammer,
    message: messageTtl > 0 ? message : '',
    messageTtl: Math.max(0, messageTtl),
    initialPassDone,
    turbo,
    powerUps,
    activeEffects: effects,
    particles,
    grandSlam,
    screenFlash,
    pushCooldown,
  };
}
