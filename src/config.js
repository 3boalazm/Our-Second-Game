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

// Room codes are 4 digits, like in "Our First Game".
const RoomPattern = /^\d{4}$/;

// ?online=host            -> create a new room and share the invite link
// ?online=host&id=<room>  -> reopen your own room (the page adds this itself,
//                            so reloading keeps the same invite link)
// ?room=<room id>         -> join a friend's room
export function readOnlineConfig() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  if (room && RoomPattern.test(room)) {
    return { role: "guest", room };
  }
  if (params.get("online") === "host") {
    const id = params.get("id");
    return { role: "host", room: id && RoomPattern.test(id) ? id : null };
  }
  return null;
}
