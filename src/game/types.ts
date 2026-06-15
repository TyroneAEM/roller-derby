export type Team = 'kitty' | 'unicorn';
export type Role = 'jammer' | 'blocker' | 'pivot' | 'ref';
export type GamePhase = 'menu' | 'countdown' | 'initial_pass' | 'scoring' | 'jam_end' | 'game_over';
export type PowerUpType = 'speed' | 'multiplier';

export interface Character {
  id: string;
  team: Team | 'ref';
  role: Role;
  trackPos: number;
  lane: number;
  speed: number;
  emoji: string;
  label: string;
  stunned: number;
  laneVelocity: number;
  passedThisTrip: boolean;
  scored: boolean;
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  trackPos: number;
  lane: number;
  pulse: number; // animation clock
  respawnIn: number; // ms until it appears (0 = visible)
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;   // 0..1, decreasing
  color: string;
  size: number;
  emoji?: string;
}

export interface Joystick {
  active: boolean;
  baseX: number;
  baseY: number;
  tipX: number;
  tipY: number;
}

export interface ActiveEffects {
  speed: number;       // ms remaining (2× speed)
  multiplier: number;  // ms remaining (2× points)
}

export interface GrandSlamState {
  active: boolean;
  timer: number;
  x: number;
  y: number;
}

export interface TurboState {
  active: boolean;
  duration: number;   // ms remaining in boost
  cooldown: number;   // ms remaining before usable again
}

export interface GameState {
  phase: GamePhase;
  jamTimer: number;
  countdownTimer: number;
  period: number;
  jam: number;
  score: Record<Team, number>;
  leadJammer: Team | null;
  playerTeam: Team;
  characters: Character[];
  joystick: Joystick;
  calloffPressed: boolean;
  initialPassDone: boolean;
  lastTimestamp: number;
  message: string;
  messageTtl: number;
  turbo: TurboState;
  powerUps: PowerUp[];
  activeEffects: ActiveEffects;
  particles: Particle[];
  grandSlam: GrandSlamState;
  screenFlash: number; // alpha of white overlay (0 = off)
  pushCooldown: number; // ms remaining before push is usable again
  sinBin: number;      // ms remaining in penalty box (0 = not in penalty)
}
