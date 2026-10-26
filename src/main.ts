import { AudioManager } from "./engine/audio";
import { BootScene } from "./engine/bootScene";
import type { GameInfo, GameServices } from "./engine/game";
import { GameScene } from "./engine/gameScene";
import { Input, Keys } from "./engine/input";
import { GameLoop } from "./engine/loop";
import { SceneManager } from "./engine/scene";
import { createScreen } from "./engine/screen";
import { HallwayScene } from "./hallway/HallwayScene";

function showError(message: string): void {
  const el = document.getElementById("error");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}

window.addEventListener("error", (e) => showError(`Error: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => showError(`Error: ${String(e.reason)}`));

/** Loads assets before the title screen accepts input. Empty until stage 9 adds real files. */
async function loadAssets(_audio: AudioManager): Promise<void> {
  // e.g. await audio.load("shoot", `${import.meta.env.BASE_URL}sfx/shoot.wav`);
}

function main(): void {
  const canvas = document.getElementById("screen") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("Missing #screen canvas");
  const g = createScreen(canvas);

  const input = new Input();
  input.attach(window);
  const audio = new AudioManager();
  input.onAnyKey(() => audio.unlock());
  const services: GameServices = { input, audio };

  const scenes = new SceneManager();
  const playGame = (info: GameInfo) => {
    scenes.switchTo(
      new GameScene(info, services, (result) => {
        scenes.switchTo(hallway);
        hallway.onReturn(result);
      }),
    );
  };
  const hallway = new HallwayScene(services, playGame);
  scenes.switchTo(new BootScene(services, loadAssets(audio), () => scenes.switchTo(hallway)));

  const loop = new GameLoop(
    (dt) => {
      input.beginStep();
      if (input.wasPressed(Keys.mute)) audio.toggleMute();
      scenes.update(dt);
    },
    () => scenes.render(g),
  );
  loop.start();
}

try {
  main();
} catch (err) {
  showError(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
}
