import Phaser from "phaser";
import { FLOOR_COUNT, GAME_TITLE } from "../config/gameRules";
import { RunRuntimeService } from "../run/runRuntimeService";
import { StarterDraftScene } from "./StarterDraftScene";
import { TowerLobbyScene } from "./TowerLobbyScene";
import {
  PHASE_THREE_COLORS,
  PHASE_THREE_FONTS,
  createActionButton,
  drawPanel,
  drawSceneShell,
} from "./shared/phaseThreeUi";

const RANDOM_TRAINER_NAMES = [
  "Nova",
  "Atlas",
  "Iris",
  "Kai",
  "Mira",
  "Orion",
  "Skye",
  "Vale",
] as const;
const MAX_PLAYER_NAME_LENGTH = 12;

interface IntroSceneData {
  playerName?: string;
}

export class IntroScene extends Phaser.Scene {
  public static readonly KEY = "intro";

  private helperText: Phaser.GameObjects.Text | null = null;
  private namePreviewText: Phaser.GameObjects.Text | null = null;
  private playerName = "";

  public constructor() {
    super(IntroScene.KEY);
  }

  public init(data: IntroSceneData = {}): void {
    this.playerName = data.playerName ?? "";
  }

  public create(): void {
    const runtime = RunRuntimeService.getInstance();
    const hasSavedRun = runtime.hasSavedRun();

    if (!this.playerName.trim()) {
      this.playerName = runtime.getPreferredPlayerName();
    }

    const layout = drawSceneShell(this, {
      eyebrow: "PHASE 4 VERTICAL SLICE",
      title: `${GAME_TITLE} Intro`,
      subtitle:
        "Name your trainer, then launch the one-floor tower loop with starter draft, floor battle, reward pick, and next-door reveal.",
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: 432,
      height: 344,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 24, layout.bodyY + 22, "Vertical Slice Loop", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const loopLines = [
      `Draft one random starter trio and lock one species for the whole ${FLOOR_COUNT}-floor run.`,
      "Walk a themed floor room, challenge one trainer, and resolve a legal 1v1 battle.",
      "Choose one of three legal rewards, then reveal two next-floor type doors.",
      "Save checkpoints in local storage so you can resume mid-slice from the lobby.",
    ];

    loopLines.forEach((line, index) => {
      this.add.circle(
        layout.bodyX + 30,
        layout.bodyY + 88 + index * 58,
        5,
        PHASE_THREE_COLORS.accent,
        1,
      );
      this.add
        .text(layout.bodyX + 46, layout.bodyY + 74 + index * 58, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "19px",
          wordWrap: { width: 362 },
        })
        .setOrigin(0, 0);
    });

    drawPanel(this, {
      x: layout.bodyX + 456,
      y: layout.bodyY,
      width: layout.bodyWidth - 456,
      height: 344,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(layout.bodyX + 480, layout.bodyY + 22, "Trainer Setup", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.add
      .text(
        layout.bodyX + 480,
        layout.bodyY + 62,
        hasSavedRun
          ? "A saved run already exists. Starting a new run will replace it with a fresh seed after this name step."
          : "Type a trainer name now, or keep the default and head straight into the starter draft.",
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          wordWrap: { width: layout.bodyWidth - 504 },
        },
      )
      .setOrigin(0, 0);

    drawPanel(this, {
      x: layout.bodyX + 480,
      y: layout.bodyY + 116,
      width: layout.bodyWidth - 504,
      height: 126,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 504, layout.bodyY + 136, "Trainer Name", {
        color: PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "15px",
        letterSpacing: 1.5,
      })
      .setOrigin(0, 0);

    this.namePreviewText = this.add
      .text(layout.bodyX + 504, layout.bodyY + 170, "", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "40px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.helperText = this.add
      .text(layout.bodyX + 504, layout.bodyY + 212, "", {
        color: PHASE_THREE_COLORS.copy,
        fontFamily: PHASE_THREE_FONTS.accent,
        fontSize: "16px",
        wordWrap: { width: layout.bodyWidth - 552 },
      })
      .setOrigin(0, 0);

    createActionButton(this, {
      x: layout.bodyX,
      y: layout.bodyY + 372,
      width: 280,
      height: 86,
      label: "Start New Run",
      description: "Save this trainer name, generate a fresh starter trio, and enter the tower slice.",
      accentColor: 0x67c5b8,
      onPress: () => {
        this.startNewRun();
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 298,
      y: layout.bodyY + 372,
      width: 240,
      height: 86,
      label: "Random Name",
      description: "Pick a quick trainer alias if you do not want to type one.",
      accentColor: 0xf3c969,
      onPress: () => {
        this.playerName = Phaser.Utils.Array.GetRandom([...RANDOM_TRAINER_NAMES]);
        this.refreshNamePreview();
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 556,
      y: layout.bodyY + 372,
      width: 280,
      height: 86,
      label: hasSavedRun ? "Open Lobby" : "Skip To Lobby",
      description: hasSavedRun
        ? "Keep this name saved and manage resume, reset, or checkpoint flow from the lobby."
        : "Keep this name saved and head to the runtime lobby instead of starting right away.",
      accentColor: 0x5ab9d4,
      onPress: () => {
        runtime.setPreferredPlayerName(this.playerName);
        this.scene.start(TowerLobbyScene.KEY);
      },
    });

    this.bindKeyboardInput();
    this.refreshNamePreview();
  }

  private bindKeyboardInput(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    keyboard.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off("keydown", this.handleKeyDown, this);
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.startNewRun();

      return;
    }

    if (event.key === "Escape") {
      RunRuntimeService.getInstance().setPreferredPlayerName(this.playerName);
      this.scene.start(TowerLobbyScene.KEY);

      return;
    }

    if (event.key === "Backspace") {
      this.playerName = this.playerName.slice(0, -1);
      this.refreshNamePreview();

      return;
    }

    if (
      event.key.length === 1 &&
      /^[a-zA-Z0-9 -]$/.test(event.key) &&
      this.playerName.length < MAX_PLAYER_NAME_LENGTH
    ) {
      this.playerName += event.key;
      this.refreshNamePreview();
    }
  }

  private refreshNamePreview(): void {
    const normalizedName = this.playerName.trim() || "Player";
    const cursor = this.playerName.length < MAX_PLAYER_NAME_LENGTH ? "_" : "";

    this.namePreviewText?.setText(`${normalizedName}${cursor}`);
    this.helperText?.setText(
      `Type letters, numbers, spaces, or hyphens. Backspace deletes. Enter starts immediately. ${normalizedName.length} / ${MAX_PLAYER_NAME_LENGTH} characters.`,
    );
  }

  private startNewRun(): void {
    const runtime = RunRuntimeService.getInstance();
    const playerName = runtime.setPreferredPlayerName(this.playerName);
    const draft = runtime.beginStarterDraft({
      clearSavedRun: runtime.hasSavedRun(),
      forceNew: true,
      playerName,
    });

    this.scene.start(StarterDraftScene.KEY, { draft });
  }
}
