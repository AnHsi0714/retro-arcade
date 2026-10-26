import type { GameInfo } from "../engine/game";
import { BREAKOUT_LEGEND, BreakoutGame } from "./breakout/BreakoutGame";
import { DEFENDER_LEGEND, DefenderGame } from "./defender/DefenderGame";
import { MAZE_LEGEND, MazeGame } from "./maze/MazeGame";
import { METEOR_LEGEND, MeteorGame } from "./meteor/MeteorGame";
import { SNAKE_LEGEND, SnakeGame } from "./snake/SnakeGame";
import { TestGame } from "./test/TestGame";

export const GAMES: GameInfo[] = [
  {
    id: "test",
    title: "Test Unit",
    tagline: "Diagnostics cabinet",
    controls: "ARROWS move  X end run",
    howTo: ["Checks that cabinets start and exit correctly.", "Pick up the yellow coins. Press X to end the run."],
    color: "#7a7a8c",
    create: () => new TestGame(),
  },
  {
    id: "snake",
    title: "Snake",
    tagline: "Eat, grow, don't bite",
    controls: "ARROWS steer",
    howTo: [
      "Eat apples to grow and score.",
      "Hitting a wall, a block or your own tail ends the run.",
      "Power apples appear for a few seconds: grab them fast.",
    ],
    legend: SNAKE_LEGEND,
    color: "#3fbf5a",
    create: () => new SnakeGame(),
  },
  {
    id: "breakout",
    title: "Breakout",
    tagline: "Smash every brick",
    controls: "< > paddle  SPACE launch",
    howTo: [
      "Bounce the ball to break every brick (steel excluded).",
      "Where the ball hits the paddle sets its angle.",
      "Catch falling capsules. Stage 4 has a boss: its shots stun you.",
    ],
    legend: BREAKOUT_LEGEND,
    color: "#d9573b",
    create: () => new BreakoutGame(),
  },
  {
    id: "defender",
    title: "Star Defender",
    tagline: "Hold the line",
    controls: "< > move  SPACE fire (hold)",
    howTo: [
      "Destroy every invader before they reach the ground.",
      "Divers leave the formation and swoop at you: double points.",
      "Getting hit costs a life and one gun level.",
    ],
    legend: DEFENDER_LEGEND,
    color: "#4a6bdc",
    create: () => new DefenderGame(),
  },
  {
    id: "meteor",
    title: "Meteor Drift",
    tagline: "Drift. Shoot. Survive.",
    controls: "< > turn  ^ thrust  SPACE fire",
    howTo: [
      "Shoot meteors: big ones split into smaller, faster ones.",
      "Your ship drifts: thrust to move, there are no brakes.",
      "Edges wrap around. From wave 3 a gravity well appears.",
    ],
    legend: METEOR_LEGEND,
    color: "#c48a2c",
    create: () => new MeteorGame(),
  },
  {
    id: "maze",
    title: "Maze Chomper",
    tagline: "Clear the maze",
    controls: "ARROWS move  SPACE drop trap",
    howTo: [
      "Eat every dot to clear the maze. Avoid the four chasers.",
      "After a big dot, chasers flee: catch them for bonus points.",
      "3 traps per maze. Side tunnels wrap around.",
    ],
    legend: MAZE_LEGEND,
    color: "#d6c22f",
    create: () => new MazeGame(),
  },
];

export function getGame(id: string): GameInfo {
  const info = GAMES.find((g) => g.id === id);
  if (!info) throw new Error(`Unknown game id "${id}"`);
  return info;
}
