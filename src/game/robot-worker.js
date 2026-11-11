import { BoardSize } from "../config";
import { Board } from "./board";
import { BoardTopology } from "./board-topology";
import { Robot } from "./robots";

const models = new Map();
const robots = new Map();

function modelFor(size) {
  if (!models.has(size)) {
    models.set(size, new BoardTopology(size));
  }
  return models.get(size);
}

self.onmessage = ({ data }) => {
  const size = Number.isInteger(data.size) ? data.size : BoardSize;
  const model = modelFor(size);
  const board = new Board(model);
  for (const edge of data.board.moves) {
    board.add(edge);
  }

  const robotKey = `${size}:${board.turn}`;
  let robot = robots.get(robotKey);
  if (!robot) {
    robot = new Robot(model);
    robots.set(robotKey, robot);
  }

  self.postMessage({
    requestId: data.requestId,
    edge: robot.move(board),
  });
};
