import { parsePlayerType } from "./game/robots";

// Supported range: 1-6 for the compact topology and move buffers.
export const BoardSize = 6;

export function readPlayerConfig() {
  const params = new URLSearchParams(window.location.search);
  return {
    player1Type: parsePlayerType(params.get("player1")),
    player2Type: parsePlayerType(params.get("player2")),
  };
}

// ?online=host      -> create a room and share the invite link
// ?room=<room id>   -> join a friend's room
export function readOnlineConfig() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  if (room && /^[a-z0-9-]{4,40}$/i.test(room)) {
    return { role: "guest", room };
  }
  if (params.get("online") === "host") {
    return { role: "host", room: null };
  }
  return null;
}
