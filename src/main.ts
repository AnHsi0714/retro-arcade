import { AudioManager, MAX_VOLUME } from "./engine/audio";
import { BootScene } from "./engine/bootScene";
import type { GameInfo, GameServices } from "./engine/game";
import { GameScene } from "./engine/gameScene";
import { toggleLang } from "./engine/i18n";
import { Input, Keys } from "./engine/input";
import { GameLoop } from "./engine/loop";
import { SceneManager } from "./engine/scene";
import { createScreen } from "./engine/screen";
import { drawVolumeIndicator } from "./engine/ui";
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

  /** Seconds left to show the volume indicator after a sound setting changes. */
  let volumeShown = 0;
  const loop = new GameLoop(
    (dt) => {
      input.beginStep();
      volumeShown = Math.max(0, volumeShown - dt);
      // global sound keys work in every scene and are consumed so scenes don't react to them
      const volumeDelta = (input.wasPressed(Keys.volumeUp) ? 1 : 0) - (input.wasPressed(Keys.volumeDown) ? 1 : 0);
      if (input.wasPressed(Keys.mute) || volumeDelta !== 0) {
        if (volumeDelta !== 0) {
          audio.changeVolume(volumeDelta);
          audio.play("select");
        } else {
          audio.toggleMute();
        }
        volumeShown = 1.5;
        input.consume();
      }
      if (input.wasPressed(Keys.language)) {
        toggleLang();
        audio.play("select");
        input.consume();
      }
      scenes.update(dt);
    },
    () => {
      scenes.render(g);
      if (volumeShown > 0) drawVolumeIndicator(g, audio.volume, MAX_VOLUME, audio.muted);
    },
  );
  loop.start();
}

try {
  main();
} catch (err) {
  showError(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
}
