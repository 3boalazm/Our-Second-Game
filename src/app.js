import { BoardSize, readOnlineConfig, readPlayerConfig } from "./config";
import { Board, Owner } from "./game/board";
import { BoardTopology } from "./game/board-topology";
import { PlayerType } from "./game/robots";
import { createOnlineSession, createRoomId } from "./online";
import { loadGame, pruneGames, saveGame } from "./persist";

const DefaultUnitSize = 8;

function ownerClass(owner) {
  switch (owner) {
    case Owner.Player1:
      return "owner-player-1";
    case Owner.Player2:
      return "owner-player-2";
    default:
      return "owner-none";
  }
}

function createBoardView(model, onEdgeClick) {
  const element = document.createElement("div");
  element.className = "board-stage";
  const logicalWindowSize = model.size * 10 + 18;
  const percent = (value) => `${(value / logicalWindowSize) * 100}%`;

  function addElement(tag, className, left, top, width, height) {
    const child = document.createElement(tag);
    child.className = className;
    Object.assign(child.style, {
      left: percent(left),
      top: percent(top),
      width: percent(width),
      height: percent(height),
    });
    element.append(child);
    return child;
  }

  const boxes = Array.from({ length: model.boxCount }, (_, box) =>
    addElement(
      "div", "box",
      model.boxX(box) * 10 + 10, model.boxY(box) * 10 + 10,
      8, 8,
    ),
  );
  const edges = Array.from({ length: model.edgeCount }, (_, edge) => {
    const dot = model.edgeDot1[edge];
    const rotated = model.edgeRotated(edge);
    const button = addElement(
      "button", "edge",
      8 + model.dotX(dot) * 10 + (rotated ? 0 : 1),
      8 + model.dotY(dot) * 10 + (rotated ? 1 : 0),
      rotated ? 2 : 10, rotated ? 10 : 2,
    );
    button.type = "button";
    button.setAttribute("aria-label", `Edge ${edge}`);
    button.addEventListener("click", () => onEdgeClick(edge));
    return button;
  });
  for (let dot = 0; dot < model.dotCount; dot += 1) {
    addElement(
      "div", "dot",
      8 + model.dotX(dot) * 10, 8 + model.dotY(dot) * 10,
      2, 2,
    );
  }

  return {
    element,
    render(board, interactive, thinking, unitSize) {
      element.setAttribute("aria-busy", String(thinking));
      element.dataset.turn = board.isPlayer1Turn() ? "1" : "2";
      element.dataset.over = String(!board.gaming());
      element.style.setProperty(
        "--preferred-size",
        `${logicalWindowSize * unitSize}px`,
      );
      document.documentElement.style.setProperty(
        "--preferred-size",
        `${logicalWindowSize * unitSize}px`,
      );
      boxes.forEach((box, index) => {
        box.className = `box ${ownerClass(board.boxOwner(index))}`;
      });
      const lastEdge = board.lastEdge();
      edges.forEach((edge, index) => {
        edge.className = `edge ${ownerClass(board.edgeOwner(index))}${
          index === lastEdge ? " edge-last" : ""
        }`;
        edge.setAttribute(
          "aria-disabled",
          String(!interactive || board.contains(index)),
        );
      });
    },
  };
}

function createResultDialog(title, detail, onRestart) {
  const backdrop = document.createElement("div");
  backdrop.className = "dialog-backdrop";
  backdrop.innerHTML = `
    <section class="result-dialog" role="dialog" aria-modal="true"
      aria-labelledby="result-title">
      <h2 id="result-title"></h2>
      <p id="result-detail"></p>
      <div class="dialog-actions">
        <button type="button" class="primary" data-action="restart">Play again</button>
        <a class="button" data-action="menu">Menu</a>
      </div>
    </section>
  `;
  backdrop.querySelector("#result-title").textContent = title;
  backdrop.querySelector("#result-detail").textContent = detail;
  backdrop.querySelector('[data-action="menu"]').href = window.location.pathname;
  backdrop.querySelector('[data-action="restart"]').addEventListener("click", onRestart);
  return backdrop;
}

function createMenu(root) {
  const base = window.location.pathname;
  const main = document.createElement("main");
  main.className = "menu-shell";
  main.innerHTML = `
    <section class="menu-card">
      <div class="menu-logo" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </div>
      <h1>Dots &amp; Boxes</h1>
      <p class="menu-sub">Draw lines, close boxes, keep the turn.</p>
      <a class="menu-button primary" href="${base}?online=host">
        <strong>Play with a friend online</strong>
        <span>Get an invite link and send it to anyone</span>
      </a>
      <a class="menu-button" href="${base}?player1=human&amp;player2=robot">
        <strong>Play against the robot</strong>
        <span>You are Blue and move first</span>
      </a>
      <a class="menu-button" href="${base}?player1=human&amp;player2=human">
        <strong>Two players, one device</strong>
        <span>Take turns on the same screen</span>
      </a>
      <a class="menu-button subtle" href="${base}?player1=robot&amp;player2=robot">
        <strong>Watch two robots play</strong>
      </a>
    </section>
  `;
  root.replaceChildren(main);
  return () => {};
}

export function createApp(root) {
  const params = new URLSearchParams(window.location.search);
  if (!readOnlineConfig() && !params.has("player1") && !params.has("player2")) {
    return createMenu(root);
  }
  const model = new BoardTopology(BoardSize);
  const board = new Board(model);
  const online = readOnlineConfig();
  const { player1Type, player2Type } = online
    ? { player1Type: PlayerType.Human, player2Type: PlayerType.Human }
    : readPlayerConfig();
  const main = document.createElement("main");
  main.className = "app-shell";
  const boardView = createBoardView(model, handleEdgeClick);
  const hud = document.createElement("header");
  hud.className = "hud";
  hud.innerHTML = `
    <a class="menu-link" data-role="menu">&larr; Menu</a>
    <div class="scoreboard">
      <div class="score-card blue" data-side="1">
        <span class="player-name"></span><span class="score">0</span>
      </div>
      <div class="score-card red" data-side="2">
        <span class="score">0</span><span class="player-name"></span>
      </div>
    </div>
    <p class="status" role="status"></p>
    <div class="invite" hidden>
      <input type="text" readonly aria-label="Invite link">
      <button type="button" data-role="copy">Copy link</button>
      <button type="button" data-role="share" hidden>Share</button>
    </div>
  `;
  hud.querySelector('[data-role="menu"]').href = window.location.pathname;
  const hudCards = [...hud.querySelectorAll(".score-card")];
  const hudStatus = hud.querySelector(".status");
  const hudInvite = hud.querySelector(".invite");
  const inviteInput = hudInvite.querySelector("input");
  main.append(hud, boardView.element);
  root.replaceChildren(main);

  let worker = null;
  let pendingRequest = 0;
  let thinking = false;
  let closed = false;
  let unitSize = DefaultUnitSize;
  let resultDialog = null;

  // Online play: host is Blue (player 1), guest is Red (player 2).
  const localIsPlayer1 = online?.role === "host";
  let netState = online ? "connecting" : "offline";
  let netDetail = "";
  let roomId = online ? online.room ?? createRoomId() : null;
  // The game is saved as a move list + restart counter ("epoch"), so it can be
  // restored after a reload and re-synced with the friend after a reconnect.
  let epoch = 0;
  let moves = [];

  function persist() {
    if (online) {
      saveGame(roomId, { epoch, moves });
    }
  }

  function validEdge(edge) {
    return Number.isInteger(edge) && edge >= 0 && edge < model.edgeCount;
  }

  function resetGame(nextEpoch, list) {
    board.reset();
    moves = [];
    for (const edge of list) {
      if (!board.gaming() || !validEdge(edge) || board.contains(edge)) {
        break;
      }
      board.add(edge);
      moves.push(edge);
    }
    epoch = nextEpoch;
    resultDialog?.remove();
    resultDialog = null;
    persist();
  }

  // After sending a move we expect any reply (ack) from the friend soon. If it
  // never comes, our link is probably half-dead: re-open it and re-sync.
  let ackTimer = null;
  function expectAck() {
    clearTimeout(ackTimer);
    ackTimer = setTimeout(() => session?.reconnect(), 4000);
  }

  function sendHello() {
    session?.send({ type: "hello", epoch, moves });
  }

  // Decide who has the newer game after a (re)connect.
  function compare(remote) {
    if (remote.epoch !== epoch) {
      return remote.epoch > epoch ? "adopt" : "reply";
    }
    const common = Math.min(remote.moves.length, moves.length);
    for (let i = 0; i < common; i += 1) {
      if (remote.moves[i] !== moves[i]) {
        // Diverged (should not happen): the host's game wins.
        return online.role === "guest" ? "adopt" : "reply";
      }
    }
    if (remote.moves.length > moves.length) {
      return "adopt";
    }
    return remote.moves.length < moves.length ? "reply" : "same";
  }

  function handleMessage(message) {
    clearTimeout(ackTimer);
    if (message.type === "ack") {
      return;
    }
    if (message.type === "hello") {
      if (
        !Number.isInteger(message.epoch) || !Array.isArray(message.moves) ||
        message.moves.length > model.edgeCount || !message.moves.every(Number.isInteger)
      ) {
        return;
      }
      const result = compare(message);
      if (result === "adopt") {
        resetGame(message.epoch, message.moves);
        render();
      } else if (result === "reply") {
        sendHello();
      }
    } else if (message.type === "move") {
      session.send({ type: "ack", n: message.n });
      if (message.n === moves.length) {
        // Only accept a move when it is the opponent's turn.
        if (board.isPlayer1Turn() !== localIsPlayer1) {
          applyMove(message.edge);
        }
      } else if (message.n > moves.length) {
        sendHello(); // we missed something: ask for a re-sync
      }
    } else if (message.type === "restart") {
      if (Number.isInteger(message.epoch) && message.epoch > epoch) {
        resetGame(message.epoch, []);
        render();
      }
    }
  }

  if (online) {
    pruneGames();
    if (online.role === "host") {
      // keep the invite link stable across reloads
      window.history.replaceState(null, "", `?online=host&id=${roomId}`);
    }
    const saved = loadGame(roomId);
    resetGame(saved.epoch, saved.moves);
  }

  const session = online
    ? createOnlineSession({
        role: online.role,
        roomId,
        onStatus(state, detail) {
          netState = state;
          netDetail = detail;
          render();
        },
        onOpen: sendHello,
        onMessage: handleMessage,
        onRoomChange(next) {
          roomId = next;
          window.history.replaceState(null, "", `?online=host&id=${next}`);
          const saved = loadGame(next);
          resetGame(saved.epoch, saved.moves);
          inviteInput.value = inviteUrl();
          render();
        },
      })
    : null;

  function isLocalTurn() {
    return board.isPlayer1Turn() === localIsPlayer1;
  }

  function inviteUrl() {
    return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  }

  const bothHuman = player1Type === PlayerType.Human && player2Type === PlayerType.Human;
  const bothRobot = player1Type === PlayerType.Robot && player2Type === PlayerType.Robot;

  function playerLabel(isPlayer1) {
    if (online) {
      return isPlayer1 === localIsPlayer1 ? "You" : "Friend";
    }
    const type = isPlayer1 ? player1Type : player2Type;
    if (type === PlayerType.Robot) {
      return bothRobot ? (isPlayer1 ? "Robot 1" : "Robot 2") : "Robot";
    }
    return bothHuman ? (isPlayer1 ? "Player 1" : "Player 2") : "You";
  }

  function statusText() {
    if (online) {
      if (netState === "waiting") {
        return "Waiting for your friend to join...";
      }
      if (netState === "connecting") {
        return "Connecting...";
      }
      if (netState === "reconnecting") {
        return "Connection lost. Reconnecting...";
      }
      if (netState === "away") {
        return "Your friend left. Waiting for them to come back...";
      }
      if (netState === "error") {
        return netDetail || "Connection problem.";
      }
      if (!board.gaming()) {
        return "Game over";
      }
      return isLocalTurn() ? "Your turn" : "Friend's turn...";
    }
    if (!board.gaming()) {
      return "Game over";
    }
    if (isRobotTurn()) {
      return bothRobot ? "Robots are playing..." : "Robot is thinking...";
    }
    return bothHuman ? `${board.isPlayer1Turn() ? "Blue" : "Red"}'s turn` : "Your turn";
  }

  function renderHud() {
    const live = board.gaming() && (!online || netState === "connected");
    hudCards.forEach((card, index) => {
      const isPlayer1 = index === 0;
      card.querySelector(".player-name").textContent = playerLabel(isPlayer1);
      card.querySelector(".score").textContent = String(
        isPlayer1 ? board.player1Score() : board.player2Score(),
      );
      card.classList.toggle("active", live && board.isPlayer1Turn() === isPlayer1);
    });
    hudStatus.textContent = statusText();
    hudStatus.dataset.state = online ? netState : "offline";
    hudInvite.hidden = !(online?.role === "host" && (netState === "waiting" || netState === "away"));
  }

  if (session) {
    inviteInput.value = online.role === "host" ? inviteUrl() : "";
    inviteInput.addEventListener("focus", () => inviteInput.select());
    const copyButton = hudInvite.querySelector('[data-role="copy"]');
    const shareButton = hudInvite.querySelector('[data-role="share"]');
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(inviteInput.value);
        copyButton.textContent = "Copied!";
        setTimeout(() => { copyButton.textContent = "Copy link"; }, 1800);
      } catch {
        inviteInput.select();
      }
    });
    if (navigator.share) {
      shareButton.hidden = false;
      shareButton.addEventListener("click", () => {
        navigator.share({ title: "Dots & Boxes", url: inviteInput.value }).catch(() => {});
      });
    }
  }

  function isRobotTurn() {
    return (board.isPlayer1Turn() ? player1Type : player2Type) === PlayerType.Robot;
  }

  function render() {
    if (closed) {
      return;
    }
    renderHud();
    const robotTurn = isRobotTurn();
    const onlineReady = !online || (netState === "connected" && isLocalTurn());
    if (!thinking && board.gaming() && robotTurn && worker) {
      thinking = true;
      worker.postMessage({
        requestId: ++pendingRequest,
        board: board.toSnapshot(),
      });
    }
    boardView.render(
      board,
      !thinking && board.gaming() && !robotTurn && onlineReady,
      thinking,
      unitSize,
    );
    if (!board.gaming() && !resultDialog) {
      const score = `${board.player1Score()} : ${board.player2Score()}`;
      let title = "It's a draw!";
      if (board.relativeScore !== 0) {
        const player1Won = board.relativeScore > 0;
        if (online) {
          title = player1Won === localIsPlayer1 ? "You won!" : "Your friend won";
        } else {
          title = `${player1Won ? "Blue" : "Red"} wins!`;
        }
      }
      resultDialog = createResultDialog(title, `Final score ${score}`, () => restart());
      main.append(resultDialog);
    }
  }

  function applyMove(edge) {
    if (
      closed || !board.gaming() ||
      !Number.isInteger(edge) || edge < 0 || edge >= model.edgeCount ||
      board.contains(edge)
    ) {
      return;
    }
    board.add(edge);
    if (online) {
      moves.push(edge);
      persist();
    }
    render();
  }

  function handleEdgeClick(edge) {
    if (thinking || isRobotTurn()) {
      return;
    }
    if (online) {
      if (netState !== "connected" || !isLocalTurn() || !board.gaming() || board.contains(edge)) {
        return;
      }
      session.send({ type: "move", edge, n: moves.length });
      expectAck();
    }
    applyMove(edge);
  }

  function startWorker() {
    if (online) {
      return;
    }
    const nextWorker = new Worker(
      new URL("./game/robot-worker.js", import.meta.url),
      { type: "module" },
    );
    worker = nextWorker;
    nextWorker.onmessage = ({ data }) => {
      if (closed || worker !== nextWorker || data.requestId !== pendingRequest) {
        return;
      }
      thinking = false;
      applyMove(data.edge);
    };
  }

  function restart(notifyPeer = true) {
    if (closed) {
      return;
    }
    if (online) {
      resetGame(epoch + 1, []);
      if (notifyPeer) {
        session.send({ type: "restart", epoch });
      }
    }
    pendingRequest += 1;
    worker?.terminate();
    if (!online) {
      board.reset();
    }
    thinking = false;
    resultDialog?.remove();
    resultDialog = null;
    startWorker();
    render();
  }

  function destroy() {
    closed = true;
    clearTimeout(ackTimer);
    pendingRequest += 1;
    worker?.terminate();
    worker = null;
    session?.destroy();
    window.removeEventListener("keydown", handleKeyDown);
  }

  function handleKeyDown(event) {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    if (event.code === "Minus") {
      event.preventDefault();
      unitSize = Math.max(1, Math.min(unitSize - 1, Math.floor(unitSize * 0.9)));
    } else if (event.code === "Equal") {
      event.preventDefault();
      unitSize = Math.max(unitSize + 1, Math.floor(unitSize * 1.1));
    } else if (event.code === "Digit0") {
      event.preventDefault();
      unitSize = DefaultUnitSize;
    } else {
      return;
    }
    render();
  }

  window.addEventListener("keydown", handleKeyDown);
  startWorker();
  render();
  return destroy;
}
