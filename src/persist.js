// Saves the online game (move list + restart counter) in this browser so a
// reload or a re-opened tab continues where the game was.

const Prefix = "dnb-game-";
const MaxAgeMs = 24 * 60 * 60 * 1000;

export function loadGame(room) {
  try {
    const value = JSON.parse(localStorage.getItem(Prefix + room));
    if (
      value &&
      Number.isInteger(value.epoch) &&
      Array.isArray(value.moves) &&
      value.moves.every(Number.isInteger)
    ) {
      return { epoch: value.epoch, moves: value.moves };
    }
  } catch {
    // missing, corrupt or storage blocked
  }
  return { epoch: 0, moves: [] };
}

export function saveGame(room, game) {
  try {
    localStorage.setItem(
      Prefix + room,
      JSON.stringify({ epoch: game.epoch, moves: game.moves, t: Date.now() }),
    );
  } catch {
    // storage blocked: the game still works, it just can't be restored
  }
}

// Drop old rooms so storage doesn't grow forever.
export function pruneGames() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const name = localStorage.key(i);
      if (name?.startsWith(Prefix)) {
        const value = JSON.parse(localStorage.getItem(name) || "null");
        if (!value || Date.now() - (value.t || 0) > MaxAgeMs) {
          localStorage.removeItem(name);
        }
      }
    }
  } catch {
    // ignore
  }
}
