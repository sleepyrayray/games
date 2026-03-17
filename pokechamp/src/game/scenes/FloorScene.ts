import Phaser from "phaser";
import typeMetadataDataset from "../../../data/runtime/types.json";
import {
  FLOOR_COUNT,
  TYPE_BADGE_COLORS,
  TYPE_LABELS,
} from "../config/gameRules";
import type { TypeMetadataRecord } from "../../types/pokechamp-data";
import {
  RunRuntimeService,
  type CurrentFloorContext,
} from "../run/runRuntimeService";
import { BattleResolutionScene } from "./BattleResolutionScene";
import { TowerLobbyScene } from "./TowerLobbyScene";
import {
  PHASE_THREE_COLORS,
  PHASE_THREE_FONTS,
  drawPanel,
  renderTypeBadges,
  toDisplayLabel,
} from "./shared/phaseThreeUi";

const FLOOR_MARGIN = 84;
const PLAYER_SPEED = 220;
const TRAINER_INTERACTION_DISTANCE = 92;
const TYPE_METADATA_BY_ID = new Map(
  (typeMetadataDataset as TypeMetadataRecord[]).map((record) => [
    record.typeId,
    record,
  ]),
);

interface FloorSceneData {
  currentFloor?: CurrentFloorContext;
}

interface MovementKeys {
  a: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  enter: Phaser.Input.Keyboard.Key;
  esc: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
}

export class FloorScene extends Phaser.Scene {
  public static readonly KEY = "floor";

  private currentFloorFromData: CurrentFloorContext | null = null;
  private currentFloor: CurrentFloorContext | null = null;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private movementKeys: MovementKeys | null = null;
  private playerMarker: Phaser.GameObjects.Container | null = null;
  private promptText: Phaser.GameObjects.Text | null = null;
  private trainerMarker: Phaser.GameObjects.Container | null = null;
  private transitionLocked = false;

  public constructor() {
    super(FloorScene.KEY);
  }

  public init(data: FloorSceneData = {}): void {
    this.currentFloorFromData = data.currentFloor ?? null;
  }

  public create(): void {
    const runtime = RunRuntimeService.getInstance();
    const currentFloor =
      this.currentFloorFromData ?? runtime.getCurrentFloorContext();

    if (!currentFloor) {
      this.scene.start(TowerLobbyScene.KEY);

      return;
    }

    const theme =
      TYPE_METADATA_BY_ID.get(currentFloor.state.currentFloorType) ??
      TYPE_METADATA_BY_ID.get("normal");

    if (!theme) {
      throw new Error("Expected normal type metadata to exist");
    }

    this.currentFloor = currentFloor;
    this.transitionLocked = false;
    this.drawThemedBackdrop(theme);
    this.drawHud(theme, currentFloor);
    this.createActors(theme);
    this.configureInputs();
  }

  public update(_time: number, delta: number): void {
    if (
      !this.currentFloor ||
      !this.cursors ||
      !this.movementKeys ||
      !this.playerMarker ||
      !this.trainerMarker
    ) {
      return;
    }

    if (!this.transitionLocked) {
      this.updatePlayerMovement(delta);
      this.updateTrainerPrompt();

      if (
        Phaser.Input.Keyboard.JustDown(this.movementKeys.space) ||
        Phaser.Input.Keyboard.JustDown(this.movementKeys.enter)
      ) {
        this.handleTrainerInteraction();
      }

      if (Phaser.Input.Keyboard.JustDown(this.movementKeys.esc)) {
        this.transitionLocked = true;
        this.scene.start(TowerLobbyScene.KEY);
      }
    }
  }

  private configureInputs(): void {
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null;

    if (!this.input.keyboard) {
      return;
    }

    this.movementKeys = this.input.keyboard.addKeys({
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    }) as MovementKeys;
  }

  private createActors(theme: TypeMetadataRecord): void {
    const { width, height } = this.scale;
    const trainerColor = toColorNumber(theme.uiAccent);
    const playerColor = TYPE_BADGE_COLORS[
      this.currentFloor?.playerPokemon.types[0] ?? "normal"
    ];
    const playerShadow = this.add.ellipse(0, 26, 52, 18, 0x000000, 0.24);
    const playerBody = this.add.circle(0, 0, 22, playerColor, 1);
    const playerRing = this.add.circle(0, 0, 28);
    const playerLabel = this.add
      .text(0, -44, "YOU", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "16px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const trainerShadow = this.add.ellipse(0, 28, 58, 20, 0x000000, 0.3);
    const trainerBody = this.add.circle(0, 0, 26, trainerColor, 1);
    const trainerRing = this.add.circle(0, 0, 34);
    const trainerLabel = this.add
      .text(0, -48, "TRAINER", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "16px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    playerRing.setStrokeStyle(2, toColorNumber(PHASE_THREE_COLORS.title), 0.42);
    trainerRing.setStrokeStyle(2, toColorNumber(PHASE_THREE_COLORS.title), 0.54);

    this.playerMarker = this.add.container(width / 2, height - 118, [
      playerShadow,
      playerRing,
      playerBody,
      playerLabel,
    ]);
    this.trainerMarker = this.add.container(width / 2, 242, [
      trainerShadow,
      trainerRing,
      trainerBody,
      trainerLabel,
    ]);
    this.promptText = this.add
      .text(width / 2, 316, "Press SPACE or ENTER to challenge", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "18px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.tweens.add({
      targets: trainerBody,
      alpha: { from: 0.82, to: 1 },
      scale: { from: 0.96, to: 1.04 },
      duration: 880,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 0.45, to: 1 },
      duration: 720,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private drawHud(
    theme: TypeMetadataRecord,
    currentFloor: CurrentFloorContext,
  ): void {
    const { width, height } = this.scale;
    const floorCardWidth = 328;
    const partnerCardWidth = 374;
    const floorCardX = 36;
    const topY = 28;
    const trainerCardWidth = 374;
    const trainerCardX = width - trainerCardWidth - 36;

    drawPanel(this, {
      x: floorCardX,
      y: topY,
      width: floorCardWidth,
      height: 154,
      fillColor: PHASE_THREE_COLORS.panel,
    });
    drawPanel(this, {
      x: trainerCardX,
      y: topY,
      width: partnerCardWidth,
      height: 154,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });
    drawPanel(this, {
      x: 36,
      y: height - 160,
      width: 346,
      height: 120,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });
    drawPanel(this, {
      x: width - 382,
      y: height - 160,
      width: 346,
      height: 120,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(floorCardX + 22, topY + 18, `FLOOR ${currentFloor.state.currentFloor}`, {
        color: PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "15px",
        letterSpacing: 2,
      })
      .setOrigin(0, 0);
    this.add
      .text(
        floorCardX + 22,
        topY + 40,
        `${TYPE_LABELS[currentFloor.state.currentFloorType]} Hall`,
        {
          color: PHASE_THREE_COLORS.title,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "34px",
          fontStyle: "bold",
        },
      )
      .setOrigin(0, 0);
    this.add
      .text(
        floorCardX + 22,
        topY + 84,
        `Level ${currentFloor.floorLevel} • ${currentFloor.state.currentFloor} / ${FLOOR_COUNT}\nTheme props: ${theme.floorTheme.propTags.map(toDisplayLabel).join(", ")}`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          lineSpacing: 6,
          wordWrap: { width: floorCardWidth - 44 },
        },
      )
      .setOrigin(0, 0);
    renderTypeBadges(this, {
      x: floorCardX + 22,
      y: topY + 120,
      typeIds: [currentFloor.state.currentFloorType],
    });

    this.add
      .text(trainerCardX + 22, topY + 18, "Current Partner", {
        color: PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "15px",
        letterSpacing: 2,
      })
      .setOrigin(0, 0);
    this.add
      .text(trainerCardX + 22, topY + 40, currentFloor.playerPokemon.name, {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "34px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.add
      .text(
        trainerCardX + 22,
        topY + 84,
        `Lv. ${currentFloor.playerPokemon.level}\nMoves: ${currentFloor.playerPokemon.moves
          .map(toDisplayLabel)
          .join(", ")}`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          lineSpacing: 6,
          wordWrap: { width: partnerCardWidth - 44 },
        },
      )
      .setOrigin(0, 0);
    renderTypeBadges(this, {
      x: trainerCardX + 22,
      y: topY + 120,
      typeIds: currentFloor.playerPokemon.types,
    });

    this.add
      .text(58, height - 142, "Room Brief", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.add
      .text(
        58,
        height - 108,
        `Move with arrow keys or WASD.\nApproach the trainer and press SPACE or ENTER.\nPress ESC to return to the lobby with this run still saved.`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          lineSpacing: 6,
          wordWrap: { width: 300 },
        },
      )
      .setOrigin(0, 0);

    this.add
      .text(width - 360, height - 142, "Trainer Brief", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.add
      .text(
        width - 360,
        height - 108,
        `A ${TYPE_LABELS[currentFloor.state.currentFloorType]} specialist guards this floor.\nTheir Pokemon is already locked in the runtime rules sandbox.\nWinning unlocks the next legal reward draft.`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          lineSpacing: 6,
          wordWrap: { width: 300 },
        },
      )
      .setOrigin(0, 0);
  }

  private drawThemedBackdrop(theme: TypeMetadataRecord): void {
    const { width, height } = this.scale;
    const graphics = this.add.graphics();
    const backgroundColor = theme.floorTheme.palette[0] ?? "#07131f";
    const [primary, secondary, accent] = resolveThemePalette(theme);
    const accentSoft = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(accent),
      Phaser.Display.Color.ValueToColor(0xffffff),
      100,
      20,
    );
    const walkwayColor = Phaser.Display.Color.GetColor(
      accentSoft.r,
      accentSoft.g,
      accentSoft.b,
    );

    this.cameras.main.setBackgroundColor(backgroundColor);

    graphics.fillGradientStyle(primary, primary, secondary, accent, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.fillStyle(accent, 0.08);
    graphics.fillCircle(160, 112, 180);
    graphics.fillCircle(width - 160, height - 128, 210);
    graphics.fillStyle(secondary, 0.16);
    graphics.fillRoundedRect(width / 2 - 164, 132, 328, height - 260, 42);
    graphics.fillStyle(walkwayColor, 0.84);
    graphics.fillRoundedRect(width / 2 - 118, 154, 236, height - 304, 30);
    graphics.fillStyle(0x000000, 0.1);
    graphics.fillRect(0, 0, width, 18);
    graphics.fillRect(0, height - 18, width, 18);

    for (let index = 0; index < 6; index += 1) {
      const x = 118 + index * 176;

      graphics.fillStyle(accent, 0.12);
      graphics.fillRoundedRect(x, 206, 34, 240, 10);
      graphics.fillStyle(secondary, 0.16);
      graphics.fillRoundedRect(x + 10, 224, 14, 204, 8);
    }

    theme.floorTheme.materialTags.forEach((materialTag, index) => {
      const x = 64 + index * 126;

      this.add
        .text(x, 202, toDisplayLabel(materialTag), {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          fontStyle: "italic",
        })
        .setOrigin(0.5, 0);
      this.add
        .text(width - x, 202, toDisplayLabel(materialTag), {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          fontStyle: "italic",
        })
        .setOrigin(0.5, 0);
    });
  }

  private handleTrainerInteraction(): void {
    if (!this.currentFloor || !this.playerMarker || !this.trainerMarker) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.playerMarker.x,
      this.playerMarker.y,
      this.trainerMarker.x,
      this.trainerMarker.y,
    );

    if (distance > TRAINER_INTERACTION_DISTANCE) {
      return;
    }

    const battleContext = RunRuntimeService.getInstance().getBattleContext();

    if (!battleContext) {
      throw new Error("Expected battle context for the current floor");
    }

    this.transitionLocked = true;
    this.scene.start(BattleResolutionScene.KEY, { battleContext });
  }

  private updatePlayerMovement(delta: number): void {
    if (!this.playerMarker || !this.cursors || !this.movementKeys) {
      return;
    }

    let moveX = 0;
    let moveY = 0;

    if (this.cursors.left.isDown || this.movementKeys.a.isDown) {
      moveX -= 1;
    }
    if (this.cursors.right.isDown || this.movementKeys.d.isDown) {
      moveX += 1;
    }
    if (this.cursors.up.isDown || this.movementKeys.w.isDown) {
      moveY -= 1;
    }
    if (this.cursors.down.isDown || this.movementKeys.s.isDown) {
      moveY += 1;
    }

    if (moveX === 0 && moveY === 0) {
      return;
    }

    const magnitude = Math.hypot(moveX, moveY) || 1;
    const movementStep = (PLAYER_SPEED * delta) / 1000;
    const { width, height } = this.scale;

    this.playerMarker.x = Phaser.Math.Clamp(
      this.playerMarker.x + (moveX / magnitude) * movementStep,
      FLOOR_MARGIN,
      width - FLOOR_MARGIN,
    );
    this.playerMarker.y = Phaser.Math.Clamp(
      this.playerMarker.y + (moveY / magnitude) * movementStep,
      204,
      height - 92,
    );
  }

  private updateTrainerPrompt(): void {
    if (!this.playerMarker || !this.promptText || !this.trainerMarker) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.playerMarker.x,
      this.playerMarker.y,
      this.trainerMarker.x,
      this.trainerMarker.y,
    );

    this.promptText.setVisible(distance <= TRAINER_INTERACTION_DISTANCE);
  }
}

function toColorNumber(color: string): number {
  return Number.parseInt(color.replace("#", ""), 16);
}

function resolveThemePalette(theme: TypeMetadataRecord): [number, number, number] {
  const primary = theme.floorTheme.palette[0] ?? "#07131f";
  const secondary = theme.floorTheme.palette[1] ?? "#173449";
  const accent = theme.floorTheme.palette[2] ?? "#5ab9d4";

  return [toColorNumber(primary), toColorNumber(secondary), toColorNumber(accent)];
}
