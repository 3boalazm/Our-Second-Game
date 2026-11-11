import { parsePlayerType } from "./game/robots";

// Board size = boxes per side (5 means 5 x 5 boxes). The compact topology and
// move buffers support 1-6; 2-6 is offered in the UI.
export const MinBoardSize = 2;
export const MaxBoardSize = 6;
export const DefaultBoardSize = 5;
export const BoardSize = DefaultBoardSize;

export function parseBoardSize(value) {
  const size = Number(value);
  return Number.isInteger(size) && size >= MinBoardSize && size <= MaxBoardSize
    ? size
    : null;
}

// ?size=4 -> 4 x 4 boxes
export function readBoardSize() {
  const params = new URLSearchParams(window.location.search);
  return parseBoardSize(params.get("size")) ?? DefaultBoardSize;
}

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
