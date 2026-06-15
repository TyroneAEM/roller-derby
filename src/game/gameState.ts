import type { Character, GameState, PowerUp, Team } from './types';

export const JAM_DURATION_MS = 120_000;
export const JAMS_PER_PERIOD_COUNT = 5;
const TURBO_DURATION = 2000;
const TURBO_COOLDOWN = 6000;

function makeBlockers(team: Team, startPos: number): Character[] {
  const isKitty = team === 'kitty';
  return [0, 1, 2, 3].map(i => ({
    id: `${team}-blocker-${i}`,
    team,
    role: i === 0 ? 'pivot' : 'blocker',
    trackPos: startPos + i * 0.015,
    lane: 0.25 + (i % 2) * 0.5,
    speed: 0,
    emoji: isKitty ? '🐱' : '🦄',
    label: i === 0 ? 'Pivot' : `B${i}`,
    stunned: 0,
    laneVelocity: 0,
    passedThisTrip: false,
    scored: false,
  }));
}

function makePowerUps(): PowerUp[] {
  return [
    { id: 'pu-0', type: 'speed',      trackPos: 0.30, lane: 0.5, pulse: 0, respawnIn: 0 },
    { id: 'pu-1', type: 'multiplier', trackPos: 0.55, lane: 0.3, pulse: 0, respawnIn: 0 },
    { id: 'pu-2', type: 'multiplier', trackPos: 0.80, lane: 0.7, pulse: 0, respawnIn: 0 },
  ];
}

export function createInitialState(playerTeam: Team): GameState {
  const packPos = 0.15;
  const jammerOffset = 0.06;

  const kittyJammer: Character = {
    id: 'kitty-jammer', team: 'kitty', role: 'jammer',
    trackPos: packPos - jammerOffset, lane: 0.3, speed: 0,
    emoji: '⭐🐱', label: 'Jammer',
    stunned: 0, laneVelocity: 0, passedThisTrip: false, scored: false,
  };
  const unicornJammer: Character = {
    id: 'unicorn-jammer', team: 'unicorn', role: 'jammer',
    trackPos: packPos - jammerOffset + 0.01, lane: 0.7, speed: 0,
    emoji: '⭐🦄', label: 'Jammer',
    stunned: 0, laneVelocity: 0, passedThisTrip: false, scored: false,
  };
  const refs: Character[] = [0, 1].map(i => ({
    id: `ref-${i}`, team: 'ref' as const, role: 'ref' as const,
    trackPos: 0.5 + i * 0.08, lane: 0.5, speed: 0,
    emoji: '🐶', label: 'Ref',
    stunned: 0, laneVelocity: 0, passedThisTrip: false, scored: false,
  }));

  return {
    phase: 'menu',
    jamTimer: JAM_DURATION_MS,
    countdownTimer: 3000,
    period: 1, jam: 1,
    score: { kitty: 0, unicorn: 0 },
    leadJammer: null,
    playerTeam,
    characters: [
      kittyJammer, unicornJammer,
      ...makeBlockers('kitty', packPos),
      ...makeBlockers('unicorn', packPos + 0.025),
      ...refs,
    ],
    joystick: { active: false, baseX: 0, baseY: 0, tipX: 0, tipY: 0 },
    calloffPressed: false,
    initialPassDone: false,
    lastTimestamp: 0,
    message: '', messageTtl: 0,
    turbo: { active: false, duration: 0, cooldown: 0 },
    powerUps: makePowerUps(),
    activeEffects: { speed: 0, multiplier: 0 },
    particles: [],
    grandSlam: { active: false, timer: 0, x: 0, y: 0 },
    screenFlash: 0,
    pushCooldown: 0,
  };
}

export function resetJam(state: GameState): GameState {
  const next = createInitialState(state.playerTeam);
  return {
    ...next,
    phase: 'countdown',
    countdownTimer: 3000,
    period: state.period,
    jam: state.jam + 1,
    score: state.score,
  };
}

export const TURBO_DURATION_MS = TURBO_DURATION;
export const TURBO_COOLDOWN_MS = TURBO_COOLDOWN;
