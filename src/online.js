import Peer from "peerjs";

const IdPrefix = "dnb-";
const IdAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";

function randomRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return IdPrefix + Array.from(bytes, (b) => IdAlphabet[b % IdAlphabet.length]).join("");
}

/**
 * Peer-to-peer session over WebRTC (PeerJS cloud is used only for the
 * handshake; moves travel directly between the two browsers).
 *
 * role "host"  -> creates a room, plays Blue (player 1)
 * role "guest" -> joins `room`, plays Red (player 2)
 */
export function createOnlineSession({ role, room, onStatus, onMessage }) {
  let destroyed = false;
  let conn = null;
  const roomId = role === "host" ? randomRoomId() : room;
  const peer = role === "host" ? new Peer(roomId) : new Peer();

  function status(state, detail = "") {
    if (!destroyed) {
      onStatus(state, detail);
    }
  }

  function attach(connection) {
    conn = connection;
    connection.on("open", () => status("connected"));
    connection.on("data", (data) => {
      if (!destroyed && data && typeof data === "object") {
        onMessage(data);
      }
    });
    connection.on("close", () => {
      if (conn === connection) {
        conn = null;
        status("disconnected");
      }
    });
    connection.on("error", () => status("error", "Connection error"));
  }

  peer.on("error", (error) => {
    if (error.type === "peer-unavailable") {
      status("error", "Room not found. Ask your friend for a new link.");
    } else if (error.type === "unavailable-id") {
      status("error", "Room id is already taken. Reload the page.");
    } else {
      status("error", error.message || "Network error");
    }
  });

  peer.on("disconnected", () => {
    if (!destroyed && !peer.destroyed) {
      peer.reconnect();
    }
  });

  // Deferred so the caller has the session object before the first status.
  if (role === "host") {
    queueMicrotask(() => status("waiting"));
    peer.on("connection", (connection) => {
      if (conn) {
        // Room is full: only one opponent.
        connection.on("open", () => connection.close());
        return;
      }
      attach(connection);
    });
  } else {
    queueMicrotask(() => status("connecting"));
    peer.on("open", () => {
      attach(peer.connect(roomId, { reliable: true }));
    });
  }

  return {
    roomId,
    isConnected: () => Boolean(conn?.open),
    send(message) {
      if (conn?.open) {
        conn.send(message);
      }
    },
    destroy() {
      destroyed = true;
      conn?.close();
      peer.destroy();
    },
  };
}
