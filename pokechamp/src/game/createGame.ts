import Phaser from "phaser";
import { buildPhaserConfig } from "./config/phaserConfig";

let game: Phaser.Game | null = null;

export const createGame = (parent: HTMLElement): Phaser.Game => {
  if (game) {
    game.destroy(true);
  }

  game = new Phaser.Game(buildPhaserConfig(parent));

  return game;
};
