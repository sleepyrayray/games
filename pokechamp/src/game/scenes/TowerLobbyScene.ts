import Phaser from "phaser";
import {
  FLOOR_COUNT,
  FLOOR_LEVEL_BY_NUMBER,
  GAME_SUBTITLE,
  GAME_TITLE,
  PHASE_ONE_CHECKLIST,
  PHASE_ONE_SUMMARY,
  TYPE_BADGE_COLORS,
  TYPE_LABELS,
} from "../config/gameRules";
import { POKEMON_TYPES } from "../../types/pokechamp-data";
import { BootScene } from "./BootScene";

export class TowerLobbyScene extends Phaser.Scene {
  public static readonly KEY = "tower-lobby";

  public constructor() {
    super(TowerLobbyScene.KEY);
  }

  public create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#0d1828");

    this.drawBackground(width, height);
    this.drawHeader(width);
    this.drawTypesPanel();
    this.drawStatusPanels(width, height);
    this.drawFooter(width, height);

    this.input.keyboard?.on("keydown-SPACE", () => {
      this.scene.start(BootScene.KEY);
    });
  }

  private drawBackground(width: number, height: number): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x0d1828, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.fillStyle(0x17324a, 1);
    graphics.fillRoundedRect(40, 34, width - 80, height - 68, 28);

    graphics.fillStyle(0x234d63, 1);
    graphics.fillRoundedRect(62, 56, width - 124, 128, 24);

    graphics.fillStyle(0xffd166, 0.18);
    graphics.fillCircle(width - 150, 104, 100);

    graphics.fillStyle(0x2a7f62, 0.18);
    graphics.fillCircle(132, height - 126, 94);
  }

  private drawHeader(width: number): void {
    this.add
      .text(86, 76, GAME_TITLE, {
        color: "#fff4cc",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "58px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.add
      .text(90, 136, GAME_SUBTITLE, {
        color: "#d7ebe5",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "22px",
        letterSpacing: 2,
      })
      .setOrigin(0, 0);

    this.add
      .text(width - 92, 90, "Phase 1 Scaffold", {
        color: "#17324a",
        backgroundColor: "#ffd166",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(1, 0);
  }

  private drawTypesPanel(): void {
    const panelX = 86;
    const panelY = 220;
    const chipWidth = 122;
    const chipHeight = 42;
    const rowGap = 14;
    const colGap = 14;

    this.add
      .text(panelX, panelY - 38, "Tower Type Rotation", {
        color: "#fff4cc",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    POKEMON_TYPES.forEach((typeId, index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const x = panelX + column * (chipWidth + colGap);
      const y = panelY + row * (chipHeight + rowGap);

      const graphics = this.add.graphics();
      graphics.fillStyle(TYPE_BADGE_COLORS[typeId], 1);
      graphics.fillRoundedRect(x, y, chipWidth, chipHeight, 16);

      this.add
        .text(x + chipWidth / 2, y + chipHeight / 2, TYPE_LABELS[typeId], {
          color: "#112132",
          fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
          fontSize: "18px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    });
  }

  private drawStatusPanels(width: number, height: number): void {
    const panelWidth = 414;
    const panelHeight = 190;
    const rightPanelX = width - panelWidth - 86;
    const topPanelY = 220;
    const bottomPanelY = 432;

    this.drawPanel(rightPanelX, topPanelY, panelWidth, panelHeight, 0x102033);
    this.drawPanel(
      rightPanelX,
      bottomPanelY,
      panelWidth,
      panelHeight,
      0x102033,
    );

    this.add
      .text(rightPanelX + 28, topPanelY + 22, "Run Shape", {
        color: "#fff4cc",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const floorRange = `Floors: ${FLOOR_COUNT}`;
    const levelRange = `Levels: ${PHASE_ONE_SUMMARY.starterFloorLevel} -> ${PHASE_ONE_SUMMARY.finalFloorLevel}`;
    const typeCount = `Types represented: ${PHASE_ONE_SUMMARY.typeCount}`;
    const nextStep = "Next milestone: build the Pokemon data importer";

    [floorRange, levelRange, typeCount, nextStep].forEach((line, index) => {
      this.add
        .text(rightPanelX + 28, topPanelY + 66 + index * 28, line, {
          color: "#d7ebe5",
          fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
          fontSize: "18px",
        })
        .setOrigin(0, 0);
    });

    this.add
      .text(rightPanelX + 28, bottomPanelY + 22, "Phase 1 Deliverables", {
        color: "#fff4cc",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    PHASE_ONE_CHECKLIST.forEach((item, index) => {
      this.add
        .text(rightPanelX + 28, bottomPanelY + 64 + index * 28, `• ${item}`, {
          color: "#d7ebe5",
          fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
          fontSize: "18px",
          wordWrap: { width: panelWidth - 56 },
        })
        .setOrigin(0, 0);
    });

    this.add
      .text(86, height - 198, "Floor Level Curve", {
        color: "#fff4cc",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const levelLine = FLOOR_LEVEL_BY_NUMBER.map(
      ({ floorNumber, level }) => `${floorNumber}:${level}`,
    ).join("  ");

    this.add
      .text(86, height - 158, levelLine, {
        color: "#d7ebe5",
        fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
        fontSize: "18px",
        wordWrap: { width: width - 520 },
      })
      .setOrigin(0, 0);
  }

  private drawPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number,
  ): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(fillColor, 0.92);
    graphics.fillRoundedRect(x, y, width, height, 20);
    graphics.lineStyle(2, 0x3d7584, 1);
    graphics.strokeRoundedRect(x, y, width, height, 20);
  }

  private drawFooter(width: number, height: number): void {
    this.add
      .text(
        width / 2,
        height - 52,
        "Press SPACE to replay the boot flow. Next up: data import, normalization, and legal encounter generation.",
        {
          color: "#fff4cc",
          fontFamily: "Trebuchet MS, Gill Sans, sans-serif",
          fontSize: "18px",
        },
      )
      .setOrigin(0.5);
  }
}
