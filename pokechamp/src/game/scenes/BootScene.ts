import Phaser from "phaser";
import { GAME_TITLE } from "../config/gameRules";
import { IntroScene } from "./IntroScene";

export class BootScene extends Phaser.Scene {
  public static readonly KEY = "boot";

  public constructor() {
    super(BootScene.KEY);
  }

  public create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#102033");

    this.add
      .text(width / 2, height / 2 - 24, GAME_TITLE, {
        color: "#f7f0d8",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "56px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 34, "Booting the tower prototype...", {
        color: "#d4e1df",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "20px",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: this.add.rectangle(width / 2, height / 2 + 92, 260, 6, 0xffd166),
      scaleX: { from: 0.4, to: 1.15 },
      alpha: { from: 0.4, to: 1 },
      duration: 450,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.time.delayedCall(700, () => {
      this.scene.start(IntroScene.KEY);
    });
  }
}
