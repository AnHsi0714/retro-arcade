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
    tagline: { en: "Diagnostics cabinet", zh: "診斷用機台" },
    controls: { en: "ARROWS move  X end run", zh: "方向鍵 移動　X 結束" },
    howTo: [
      { en: "Checks that cabinets start and exit correctly.", zh: "確認機台能正常進入與離開。" },
      { en: "Pick up the yellow coins. Press X to end the run.", zh: "撿黃色金幣，按 X 結束這局。" },
    ],
    color: "#7a7a8c",
    create: () => new TestGame(),
  },
  {
    id: "snake",
    title: "Snake",
    tagline: { en: "Eat, grow, don't bite", zh: "吃、變長、別咬到自己" },
    controls: { en: "ARROWS steer", zh: "方向鍵 轉向" },
    howTo: [
      { en: "Eat apples to grow and score.", zh: "吃蘋果變長並得分。" },
      { en: "Hitting a wall, a block or your own tail ends the run.", zh: "撞到牆、障礙或自己的尾巴就結束。" },
      { en: "Power apples appear for a few seconds: grab them fast.", zh: "道具蘋果只出現幾秒，要快點吃。" },
    ],
    legend: SNAKE_LEGEND,
    color: "#3fbf5a",
    create: () => new SnakeGame(),
  },
  {
    id: "breakout",
    title: "Breakout",
    tagline: { en: "Smash every brick", zh: "打碎所有磚塊" },
    controls: { en: "< > paddle  SPACE launch", zh: "< > 球拍　SPACE 發球" },
    howTo: [
      { en: "Bounce the ball to break every brick (steel excluded).", zh: "反彈球打碎所有磚塊（鋼磚不用）。" },
      { en: "Where the ball hits the paddle sets its angle.", zh: "球打在球拍的位置決定反彈角度。" },
      { en: "Catch falling capsules. Stage 4 has a boss: its shots stun you.", zh: "接住掉落的膠囊。第 4 關有魔王，被它打中會暫時不能動。" },
    ],
    legend: BREAKOUT_LEGEND,
    color: "#d9573b",
    create: () => new BreakoutGame(),
  },
  {
    id: "defender",
    title: "Star Defender",
    tagline: { en: "Hold the line", zh: "守住防線" },
    controls: { en: "< > move  SPACE fire (hold)", zh: "< > 移動　SPACE 射擊（可按住）" },
    howTo: [
      { en: "Destroy every invader before they reach the ground.", zh: "在入侵者抵達地面前把它們全部消滅。" },
      { en: "Divers leave the formation and swoop at you: double points.", zh: "俯衝的敵人會脫離隊形衝向你，擊落得雙倍分數。" },
      { en: "Getting hit costs a life and one gun level.", zh: "被擊中會少一條命，武器降一級。" },
    ],
    legend: DEFENDER_LEGEND,
    color: "#4a6bdc",
    create: () => new DefenderGame(),
  },
  {
    id: "meteor",
    title: "Meteor Drift",
    tagline: { en: "Drift. Shoot. Survive.", zh: "漂移、射擊、活下去" },
    controls: { en: "< > turn  ^ thrust  SPACE fire", zh: "< > 轉向　^ 推進　SPACE 射擊" },
    howTo: [
      { en: "Shoot meteors: big ones split into smaller, faster ones.", zh: "擊碎隕石：大的會裂成更小更快的碎塊。" },
      { en: "Your ship drifts: thrust to move, there are no brakes.", zh: "飛船有慣性：靠推進移動，沒有煞車。" },
      { en: "Edges wrap around. From wave 3 a gravity well appears.", zh: "畫面邊緣會互通。第 3 波起會出現重力井。" },
    ],
    legend: METEOR_LEGEND,
    color: "#c48a2c",
    create: () => new MeteorGame(),
  },
  {
    id: "maze",
    title: "Maze Chomper",
    tagline: { en: "Clear the maze", zh: "吃光整座迷宮" },
    controls: { en: "ARROWS move  SPACE drop trap", zh: "方向鍵 移動　SPACE 放陷阱" },
    howTo: [
      { en: "Eat every dot to clear the maze. Avoid the four chasers.", zh: "吃光所有豆子過關，避開四隻追逐者。" },
      { en: "After a big dot, chasers flee: catch them for bonus points.", zh: "吃到大豆子後追逐者會逃跑，抓到有額外分數。" },
      { en: "3 traps per maze. Side tunnels wrap around.", zh: "每座迷宮有 3 個陷阱。兩側通道會互通。" },
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
