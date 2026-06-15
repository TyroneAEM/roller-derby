import Game from './game/Game';

export default function App() {
  return (
    // position:fixed + inset:0 guarantees full-screen on every Safari version —
    // avoids the dvh/vh height-resolution bugs on iOS WebKit.
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', background: '#0d0d1a' }}>
      <Game />
    </div>
  );
}
