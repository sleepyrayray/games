import Phaser from "phaser";
import { GAME_VIEWPORT } from "./gameRules";
import { BootScene } from "../scenes/BootScene";
import { TowerLobbyScene } from "../scenes/TowerLobbyScene";

export const buildPhaserConfig = (
  parent: HTMLElement,
): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width: GAME_VIEWPORT.width,
  height: GAME_VIEWPORT.height,
  backgroundColor: "#0e1e2f",
  render: {
    antialias: true,
    pixelArt: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TowerLobbyScene],
});
