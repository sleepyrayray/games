import Phaser from "phaser";
import {
  FLOOR_COUNT,
  FLOOR_LEVEL_BY_NUMBER,
  FLOOR_THEME_ROTATION,
  GAME_SUBTITLE,
  GAME_TITLE,
  PHASE_ONE_CHECKLIST,
  PHASE_ONE_SUMMARY,
  TYPE_BADGE_COLORS,
  TYPE_LABELS,
} from "../config/gameRules";
import { BootScene } from "./BootScene";

const COLORS = {
  background: 0x08131f,
  shell: 0x0c1b2b,
  frame: 0x10273c,
  hero: 0x254f68,
  panel: 0x10253a,
  panelAlt: 0x132d45,
  ink: "#102033",
  title: "#fff3cf",
  copy: "#d9ebe4",
  muted: "#95b7bc",
  outline: 0x4d8193,
  gold: 0xf3c969,
  mint: 0x67c5b8,
  sky: 0x5ab9d4,
} as const;

const TITLE_FONT = '"Avenir Next", "Trebuchet MS", sans-serif';
const ACCENT_FONT = '"Palatino Linotype", "Book Antiqua", Georgia, serif';

export class TowerLobbyScene extends Phaser.Scene {
  public static readonly KEY = "tower-lobby";

  public constructor() {
    super(TowerLobbyScene.KEY);
  }

  public create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#08131f");

    this.drawBackdrop(width, height);
    this.drawFrame(width, height);
    this.drawHeader();
    this.drawTypeHall();
    this.drawBriefingColumn();
    this.drawFloorRibbon();
    this.drawFooter(width, height);

    this.input.keyboard?.on("keydown-SPACE", () => {
      this.scene.start(BootScene.KEY);
    });
  }

  private drawBackdrop(width: number, height: number): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(COLORS.background, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.fillStyle(COLORS.gold, 0.08);
    graphics.fillCircle(180, 120, 170);

    graphics.fillStyle(COLORS.sky, 0.08);
    graphics.fillCircle(width - 180, 150, 150);

    graphics.fillStyle(COLORS.mint, 0.08);
    graphics.fillCircle(150, height - 110, 110);

    graphics.fillStyle(COLORS.sky, 0.05);
    graphics.fillCircle(width - 240, height - 88, 160);

    graphics.lineStyle(1, 0x5f8798, 0.09);

    for (let x = -220; x < width + 260; x += 52) {
      graphics.lineBetween(x, 0, x + 240, height);
    }
  }

  private drawFrame(width: number, height: number): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x000000, 0.28);
    graphics.fillRoundedRect(44, 42, width - 88, height - 84, 30);

    graphics.fillStyle(COLORS.shell, 1);
    graphics.fillRoundedRect(30, 28, width - 60, height - 56, 30);

    graphics.fillStyle(COLORS.frame, 1);
    graphics.fillRoundedRect(60, 52, width - 120, height - 104, 26);

    graphics.lineStyle(2, 0x2b5060, 1);
    graphics.strokeRoundedRect(30, 28, width - 60, height - 56, 30);

    graphics.lineStyle(2, COLORS.outline, 0.35);
    graphics.strokeRoundedRect(60, 52, width - 120, height - 104, 26);
  }

  private drawHeader(): void {
    const leftX = 86;
    const topY = 76;
    const heroWidth = 760;
    const heroHeight = 138;
    const sealX = 870;
    const sealWidth = 330;

    this.drawPanel(leftX, topY, heroWidth, heroHeight, COLORS.hero, 0.98);
    this.drawPanel(sealX, topY, sealWidth, heroHeight, COLORS.panelAlt, 0.96);

    this.add
      .text(leftX + 26, topY + 18, "POKECHAMP TOWER DOSSIER", {
        color: COLORS.muted,
        fontFamily: ACCENT_FONT,
        fontSize: "17px",
        letterSpacing: 3,
      })
      .setOrigin(0, 0);

    this.add
      .text(leftX + 26, topY + 38, GAME_TITLE, {
        color: COLORS.title,
        fontFamily: TITLE_FONT,
        fontSize: "64px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.add
      .text(leftX + 28, topY + 98, GAME_SUBTITLE, {
        color: COLORS.copy,
        fontFamily: ACCENT_FONT,
        fontSize: "24px",
        fontStyle: "italic",
      })
      .setOrigin(0, 0);

    this.add
      .text(
        leftX + 28,
        topY + 124,
        "18 floors  •  one partner per fight  •  no second chances",
        {
          color: COLORS.muted,
          fontFamily: TITLE_FONT,
          fontSize: "16px",
          letterSpacing: 1.2,
        },
      )
      .setOrigin(0, 0);

    this.drawTag(
      leftX + heroWidth - 190,
      topY + 18,
      164,
      30,
      "DATA-FIRST BUILD",
      0xffd166,
    );
    this.drawPhaseSeal(sealX + sealWidth / 2, topY + heroHeight / 2);
  }

  private drawPhaseSeal(centerX: number, centerY: number): void {
    const glow = this.add.circle(centerX, centerY, 78, COLORS.gold, 0.08);
    const outerRing = this.add.circle(centerX, centerY, 66);
    outerRing.setStrokeStyle(2, COLORS.outline, 0.85);

    const innerRing = this.add.circle(centerX, centerY, 52);
    innerRing.setStrokeStyle(1, COLORS.gold, 0.9);

    this.add.circle(centerX, centerY, 42, 0x173449, 1);
    this.add.circle(centerX, centerY, 28, COLORS.gold, 0.18);

    this.add
      .text(centerX, centerY - 12, "PHASE 1", {
        color: COLORS.title,
        fontFamily: TITLE_FONT,
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY + 16, "Scaffold", {
        color: COLORS.copy,
        fontFamily: ACCENT_FONT,
        fontSize: "18px",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY + 54, "Pages-ready  •  Phaser shell", {
        color: COLORS.muted,
        fontFamily: TITLE_FONT,
        fontSize: "13px",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.06, to: 0.14 },
      scale: { from: 0.95, to: 1.06 },
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private drawTypeHall(): void {
    const panelX = 86;
    const panelY = 236;
    const panelWidth = 720;
    const panelHeight = 316;
    const chipHeight = 32;
    const chipGapX = 12;
    const chipGapY = 8;
    const chipWidth = 213;
    const chipStartX = panelX + 26;
    const chipStartY = panelY + 88;

    this.drawPanel(panelX, panelY, panelWidth, panelHeight, COLORS.panel, 0.96);

    this.add
      .text(panelX + 26, panelY + 22, "Type Hall", {
        color: COLORS.title,
        fontFamily: TITLE_FONT,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.add
      .text(
        panelX + 26,
        panelY + 56,
        "Each floor borrows its mood, palette, and trainer identity from one headline type.",
        {
          color: COLORS.muted,
          fontFamily: ACCENT_FONT,
          fontSize: "18px",
          wordWrap: { width: panelWidth - 52 },
        },
      )
      .setOrigin(0, 0);

    FLOOR_THEME_ROTATION.forEach((typeId, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = chipStartX + column * (chipWidth + chipGapX);
      const y = chipStartY + row * (chipHeight + chipGapY);
      const fillColor = TYPE_BADGE_COLORS[typeId];
      const textColor = this.getReadableChipText(fillColor);
      const graphics = this.add.graphics();

      graphics.fillStyle(0x000000, 0.15);
      graphics.fillRoundedRect(x, y + 3, chipWidth, chipHeight, 15);
      graphics.fillStyle(fillColor, 0.98);
      graphics.fillRoundedRect(x, y, chipWidth, chipHeight, 15);
      graphics.lineStyle(1, 0xffffff, 0.15);
      graphics.strokeRoundedRect(x, y, chipWidth, chipHeight, 15);

      this.add.circle(x + 19, y + chipHeight / 2, 11, 0x102033, 0.18);

      this.add
        .text(x + 19, y + chipHeight / 2, String(index + 1), {
          color: textColor,
          fontFamily: TITLE_FONT,
          fontSize: "12px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      this.add
        .text(x + 38, y + chipHeight / 2, TYPE_LABELS[typeId], {
          color: textColor,
          fontFamily: TITLE_FONT,
          fontSize: "18px",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);
    });
  }

  private drawBriefingColumn(): void {
    const columnX = 832;
    const topCardY = 236;
    const bottomCardY = 396;
    const cardWidth = 368;

    this.drawSummaryCard(columnX, topCardY, cardWidth, 146);
    this.drawPrototypeCard(columnX, bottomCardY, cardWidth, 156);
  }

  private drawSummaryCard(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.drawPanel(x, y, width, height, COLORS.panelAlt, 0.96);

    this.add
      .text(x + 24, y + 18, "Challenge Brief", {
        color: COLORS.title,
        fontFamily: TITLE_FONT,
        fontSize: "28px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const metrics = [
      { label: "Floors", value: String(FLOOR_COUNT) },
      {
        label: "Levels",
        value: `${PHASE_ONE_SUMMARY.starterFloorLevel} → ${PHASE_ONE_SUMMARY.finalFloorLevel}`,
      },
      { label: "Types", value: String(PHASE_ONE_SUMMARY.typeCount) },
    ] as const;

    metrics.forEach((metric, index) => {
      const metricWidth = 96;
      const metricGap = 12;
      const metricX = x + 24 + index * (metricWidth + metricGap);
      const metricY = y + 58;

      this.drawPanel(metricX, metricY, metricWidth, 54, COLORS.panel, 0.92);

      this.add
        .text(metricX + 14, metricY + 10, metric.label.toUpperCase(), {
          color: COLORS.muted,
          fontFamily: TITLE_FONT,
          fontSize: "12px",
          letterSpacing: 1.5,
        })
        .setOrigin(0, 0);

      this.add
        .text(metricX + 14, metricY + 28, metric.value, {
          color: COLORS.title,
          fontFamily: TITLE_FONT,
          fontSize: "19px",
          fontStyle: "bold",
        })
        .setOrigin(0, 0);
    });

    this.add
      .text(
        x + 24,
        y + 122,
        "Next build pass: import, filter, and normalize the battle-ready roster.",
        {
          color: COLORS.copy,
          fontFamily: ACCENT_FONT,
          fontSize: "17px",
          wordWrap: { width: width - 48 },
        },
      )
      .setOrigin(0, 0);
  }

  private drawPrototypeCard(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.drawPanel(x, y, width, height, COLORS.panel, 0.96);

    this.add
      .text(x + 24, y + 18, "Prototype Focus", {
        color: COLORS.title,
        fontFamily: TITLE_FONT,
        fontSize: "28px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    PHASE_ONE_CHECKLIST.forEach((item, index) => {
      const lineY = y + 62 + index * 22;

      this.add.circle(x + 28, lineY + 9, 4, COLORS.gold, 1);

      this.add
        .text(x + 42, lineY, item, {
          color: COLORS.copy,
          fontFamily: TITLE_FONT,
          fontSize: "17px",
          wordWrap: { width: width - 66 },
        })
        .setOrigin(0, 0);
    });

    this.drawTag(x + 24, y + height - 34, 86, 26, "PHASER", COLORS.sky);
    this.drawTag(x + 120, y + height - 34, 100, 26, "SCHEMAS", COLORS.mint);
    this.drawTag(x + 232, y + height - 34, 110, 26, "PAGES", COLORS.gold);
  }

  private drawFloorRibbon(): void {
    const panelX = 86;
    const panelY = 572;
    const panelWidth = 1114;
    const panelHeight = 108;
    const tileWidth = 48;
    const tileHeight = 46;
    const tileGap = 8;
    const tileStartX = panelX + 24;
    const tileY = panelY + 42;

    this.drawPanel(
      panelX,
      panelY,
      panelWidth,
      panelHeight,
      COLORS.panelAlt,
      0.97,
    );

    this.add
      .text(panelX + 24, panelY + 14, "Climb Preview", {
        color: COLORS.title,
        fontFamily: TITLE_FONT,
        fontSize: "22px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.add
      .text(
        panelX + panelWidth - 24,
        panelY + 16,
        "Starter opens at 8. Final duel peaks at 70.",
        {
          color: COLORS.muted,
          fontFamily: ACCENT_FONT,
          fontSize: "16px",
          fontStyle: "italic",
        },
      )
      .setOrigin(1, 0);

    FLOOR_LEVEL_BY_NUMBER.forEach(({ floorNumber, level }, index) => {
      const x = tileStartX + index * (tileWidth + tileGap);
      const accentType = FLOOR_THEME_ROTATION[index] ?? "normal";
      const accentColor = TYPE_BADGE_COLORS[accentType];
      const graphics = this.add.graphics();

      graphics.fillStyle(0x091726, 0.96);
      graphics.fillRoundedRect(x, tileY, tileWidth, tileHeight, 16);
      graphics.fillStyle(accentColor, 0.92);
      graphics.fillRoundedRect(x, tileY, tileWidth, 7, 16);
      graphics.lineStyle(1, 0xffffff, 0.12);
      graphics.strokeRoundedRect(x, tileY, tileWidth, tileHeight, 16);

      this.add
        .text(x + tileWidth / 2, tileY + 13, `F${floorNumber}`, {
          color: COLORS.muted,
          fontFamily: TITLE_FONT,
          fontSize: "11px",
          letterSpacing: 0.8,
        })
        .setOrigin(0.5);

      this.add
        .text(x + tileWidth / 2, tileY + 30, String(level), {
          color: COLORS.title,
          fontFamily: TITLE_FONT,
          fontSize: "18px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    });
  }

  private drawFooter(width: number, height: number): void {
    this.add
      .text(width - 88, height - 28, "Press SPACE to replay the boot flow", {
        color: COLORS.title,
        fontFamily: TITLE_FONT,
        fontSize: "16px",
      })
      .setOrigin(1, 0.5);
  }

  private drawPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number,
    alpha: number,
  ): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x000000, 0.16);
    graphics.fillRoundedRect(x, y + 4, width, height, 24);

    graphics.fillStyle(fillColor, alpha);
    graphics.fillRoundedRect(x, y, width, height, 24);

    graphics.lineStyle(2, COLORS.outline, 0.34);
    graphics.strokeRoundedRect(x, y, width, height, 24);
  }

  private drawTag(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fillColor: number,
  ): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(fillColor, 1);
    graphics.fillRoundedRect(x, y, width, height, 13);
    graphics.lineStyle(1, 0xffffff, 0.18);
    graphics.strokeRoundedRect(x, y, width, height, 13);

    this.add
      .text(x + width / 2, y + height / 2, label, {
        color: COLORS.ink,
        fontFamily: TITLE_FONT,
        fontSize: "13px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
  }

  private getReadableChipText(fillColor: number): string {
    const red = (fillColor >> 16) & 0xff;
    const green = (fillColor >> 8) & 0xff;
    const blue = fillColor & 0xff;
    const brightness = red * 0.299 + green * 0.587 + blue * 0.114;

    return brightness > 160 ? COLORS.ink : COLORS.title;
  }
}
