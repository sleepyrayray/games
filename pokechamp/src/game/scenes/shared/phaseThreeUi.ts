import type Phaser from "phaser";
import { TYPE_BADGE_COLORS, TYPE_LABELS } from "../../config/gameRules";
import type { PokemonTypeId } from "../../../types/pokechamp-data";

export const PHASE_THREE_COLORS = {
  accent: 0xf3c969,
  background: 0x07131f,
  border: 0x4d8193,
  button: 0x173449,
  buttonHover: 0x21506f,
  copy: "#d8ebe6",
  ink: "#102033",
  muted: "#8fb0b5",
  panel: 0x0f2436,
  panelAlt: 0x132c43,
  shell: 0x0c1c2d,
  title: "#fff3cf",
} as const;

export const PHASE_THREE_FONTS = {
  accent: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
  title: '"Avenir Next", "Trebuchet MS", sans-serif',
} as const;

export interface SceneShellLayout {
  bodyHeight: number;
  bodyWidth: number;
  bodyX: number;
  bodyY: number;
}

export function drawPanel(
  scene: Phaser.Scene,
  options: {
    alpha?: number;
    fillColor?: number;
    height: number;
    width: number;
    x: number;
    y: number;
  },
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();

  graphics.fillStyle(0x000000, 0.18);
  graphics.fillRoundedRect(options.x, options.y + 4, options.width, options.height, 24);
  graphics.fillStyle(options.fillColor ?? PHASE_THREE_COLORS.panelAlt, options.alpha ?? 1);
  graphics.fillRoundedRect(options.x, options.y, options.width, options.height, 24);
  graphics.lineStyle(2, PHASE_THREE_COLORS.border, 0.34);
  graphics.strokeRoundedRect(options.x, options.y, options.width, options.height, 24);

  return graphics;
}

export function drawBadge(
  scene: Phaser.Scene,
  options: {
    fillColor: number;
    label: string;
    textColor?: string;
    width: number;
    x: number;
    y: number;
  },
): Phaser.GameObjects.Container {
  const container = scene.add.container(options.x, options.y);
  const background = scene.add
    .rectangle(0, 0, options.width, 30, options.fillColor, 1)
    .setOrigin(0)
    .setStrokeStyle(1, 0xffffff, 0.16);
  const label = scene.add
    .text(options.width / 2, 15, options.label, {
      color: options.textColor ?? PHASE_THREE_COLORS.ink,
      fontFamily: PHASE_THREE_FONTS.title,
      fontSize: "13px",
      fontStyle: "bold",
    })
    .setOrigin(0.5);

  container.add([background, label]);

  return container;
}

export function renderTypeBadges(
  scene: Phaser.Scene,
  options: {
    typeIds: readonly PokemonTypeId[];
    x: number;
    y: number;
  },
): Phaser.GameObjects.Container {
  const container = scene.add.container(options.x, options.y);

  options.typeIds.forEach((typeId, index) => {
    const fillColor = TYPE_BADGE_COLORS[typeId];
    const badge = drawBadge(scene, {
      fillColor,
      label: TYPE_LABELS[typeId],
      textColor: getReadableBadgeText(fillColor),
      width: 104,
      x: index * 114,
      y: 0,
    });

    container.add(badge);
  });

  return container;
}

export function toDisplayLabel(value: string): string {
  return value
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function createActionButton(
  scene: Phaser.Scene,
  options: {
    accentColor?: number;
    description?: string;
    height: number;
    label: string;
    onPress: () => void;
    width: number;
    x: number;
    y: number;
  },
): Phaser.GameObjects.Container {
  const container = scene.add.container(options.x, options.y);
  const shouldRenderDescription =
    (options.description?.trim().length ?? 0) > 0 && options.height >= 84;
  const background = scene.add
    .rectangle(0, 0, options.width, options.height, PHASE_THREE_COLORS.button, 1)
    .setOrigin(0)
    .setStrokeStyle(2, PHASE_THREE_COLORS.border, 0.34)
    .setInteractive({ useHandCursor: true });
  const accent = scene.add
    .rectangle(0, 0, options.width, 7, options.accentColor ?? PHASE_THREE_COLORS.accent, 1)
    .setOrigin(0);
  const label = scene.add
    .text(20, shouldRenderDescription ? 16 : options.height / 2, options.label, {
      color: PHASE_THREE_COLORS.title,
      fontFamily: PHASE_THREE_FONTS.title,
      fontSize: shouldRenderDescription ? "24px" : "22px",
      fontStyle: "bold",
    })
    .setOrigin(0, shouldRenderDescription ? 0 : 0.5);
  const description = shouldRenderDescription
    ? scene.add
        .text(20, 52, options.description ?? "", {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          wordWrap: { width: options.width - 40 },
        })
        .setOrigin(0, 0)
    : null;

  background.on("pointerover", () => {
    background.setFillStyle(PHASE_THREE_COLORS.buttonHover, 1);
  });
  background.on("pointerout", () => {
    background.setFillStyle(PHASE_THREE_COLORS.button, 1);
  });
  background.on("pointerdown", () => {
    options.onPress();
  });

  container.add(
    description ? [background, accent, label, description] : [background, accent, label],
  );

  return container;
}

export function drawSceneShell(
  scene: Phaser.Scene,
  options: {
    eyebrow: string;
    subtitle: string;
    title: string;
  },
): SceneShellLayout {
  const { width, height } = scene.scale;
  const shellX = 48;
  const shellY = 36;
  const shellWidth = width - 96;
  const shellHeight = height - 72;
  const bodyX = shellX + 34;
  const bodyY = shellY + 132;
  const bodyWidth = shellWidth - 68;
  const bodyHeight = shellHeight - 166;
  const background = scene.add.graphics();

  scene.cameras.main.setBackgroundColor("#07131f");

  background.fillStyle(PHASE_THREE_COLORS.background, 1);
  background.fillRect(0, 0, width, height);
  background.fillStyle(PHASE_THREE_COLORS.accent, 0.06);
  background.fillCircle(160, 120, 160);
  background.fillStyle(0x5ab9d4, 0.05);
  background.fillCircle(width - 180, height - 140, 180);
  background.fillStyle(0x67c5b8, 0.04);
  background.fillCircle(width - 220, 140, 120);

  background.fillStyle(0x000000, 0.28);
  background.fillRoundedRect(shellX + 8, shellY + 8, shellWidth, shellHeight, 30);
  background.fillStyle(PHASE_THREE_COLORS.shell, 1);
  background.fillRoundedRect(shellX, shellY, shellWidth, shellHeight, 30);
  background.fillStyle(PHASE_THREE_COLORS.panel, 1);
  background.fillRoundedRect(bodyX - 12, bodyY - 18, bodyWidth + 24, bodyHeight + 24, 26);
  background.lineStyle(2, PHASE_THREE_COLORS.border, 0.34);
  background.strokeRoundedRect(shellX, shellY, shellWidth, shellHeight, 30);

  scene.add
    .text(bodyX, shellY + 22, options.eyebrow, {
      color: PHASE_THREE_COLORS.muted,
      fontFamily: PHASE_THREE_FONTS.accent,
      fontSize: "17px",
      letterSpacing: 3,
    })
    .setOrigin(0, 0);

  scene.add
    .text(bodyX, shellY + 44, options.title, {
      color: PHASE_THREE_COLORS.title,
      fontFamily: PHASE_THREE_FONTS.title,
      fontSize: "52px",
      fontStyle: "bold",
    })
    .setOrigin(0, 0);

  scene.add
    .text(bodyX, shellY + 102, options.subtitle, {
      color: PHASE_THREE_COLORS.copy,
      fontFamily: PHASE_THREE_FONTS.accent,
      fontSize: "21px",
      fontStyle: "italic",
    })
    .setOrigin(0, 0);

  return {
    bodyHeight,
    bodyWidth,
    bodyX,
    bodyY,
  };
}

function getReadableBadgeText(fillColor: number): string {
  const red = (fillColor >> 16) & 0xff;
  const green = (fillColor >> 8) & 0xff;
  const blue = fillColor & 0xff;
  const brightness = red * 0.299 + green * 0.587 + blue * 0.114;

  return brightness > 160 ? PHASE_THREE_COLORS.ink : PHASE_THREE_COLORS.title;
}
