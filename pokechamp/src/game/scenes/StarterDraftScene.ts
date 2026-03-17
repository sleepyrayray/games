import Phaser from "phaser";
import { FLOOR_COUNT } from "../config/gameRules";
import {
  RunRuntimeService,
  type StarterDraftContext,
} from "../run/runRuntimeService";
import type { GeneratedStarterChoice } from "../run/rulesSandbox";
import { FloorScene } from "./FloorScene";
import { TowerLobbyScene } from "./TowerLobbyScene";
import {
  PHASE_THREE_COLORS,
  PHASE_THREE_FONTS,
  createActionButton,
  drawPanel,
  drawSceneShell,
  renderTypeBadges,
  toDisplayLabel,
} from "./shared/phaseThreeUi";

interface StarterDraftSceneData {
  draft?: StarterDraftContext;
}

export class StarterDraftScene extends Phaser.Scene {
  public static readonly KEY = "starter-draft";

  private draftFromData: StarterDraftContext | null = null;

  public constructor() {
    super(StarterDraftScene.KEY);
  }

  public init(data: StarterDraftSceneData = {}): void {
    this.draftFromData = data.draft ?? null;
  }

  public create(): void {
    const runtime = RunRuntimeService.getInstance();
    const draft =
      this.draftFromData ??
      runtime.getStarterDraft() ??
      runtime.beginStarterDraft({
        clearSavedRun: runtime.hasSavedRun(),
        forceNew: true,
      });
    const layout = drawSceneShell(this, {
      eyebrow: "PHASE 4 VERTICAL SLICE",
      title: "Choose Your Starter",
      subtitle: "A random Grass, Fire, and Water trio from the validated starter pool.",
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: layout.bodyWidth,
      height: 82,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(
        layout.bodyX + 24,
        layout.bodyY + 18,
        `Run seed ${draft.seed} • Floor 1 starts at Lv. ${draft.starterOffer.level} • Climb all ${FLOOR_COUNT} floors without repeating a species.`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "20px",
          wordWrap: { width: layout.bodyWidth - 48 },
        },
      )
      .setOrigin(0, 0);

    this.add
      .text(
        layout.bodyX + 24,
        layout.bodyY + 48,
        "Choosing a starter immediately blocks every other form of that species for the rest of the run.",
        {
          color: PHASE_THREE_COLORS.muted,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "16px",
        },
      )
      .setOrigin(0, 0);

    const cardWidth = 346;
    const cardHeight = 272;
    const cardGap = 18;
    const cardY = layout.bodyY + 108;

    draft.starterOffer.choices.forEach((choice, index) => {
      const cardX = layout.bodyX + index * (cardWidth + cardGap);

      this.drawStarterCard(choice, cardX, cardY, cardWidth, cardHeight);
    });

    createActionButton(this, {
      x: layout.bodyX,
      y: layout.bodyY + 400,
      width: 260,
      height: 76,
      label: "Reroll Trio",
      description: "Generate a fresh random starter offer and seed.",
      accentColor: 0x67c5b8,
      onPress: () => {
        const nextDraft = runtime.beginStarterDraft({
          clearSavedRun: runtime.hasSavedRun(),
          forceNew: true,
          playerName: draft.playerName,
        });

        this.scene.restart({ draft: nextDraft });
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 280,
      y: layout.bodyY + 400,
      width: 260,
      height: 76,
      label: "Back To Lobby",
      description: "Return without locking in a new run yet.",
      accentColor: 0x5ab9d4,
      onPress: () => {
        this.scene.start(TowerLobbyScene.KEY);
      },
    });
  }

  private drawStarterCard(
    choice: GeneratedStarterChoice,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const runtime = RunRuntimeService.getInstance();

    drawPanel(this, {
      x,
      y,
      width,
      height,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(x + 20, y + 18, `${toDisplayLabel(choice.starterType)} Draft`, {
        color: PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "15px",
        letterSpacing: 1.5,
      })
      .setOrigin(0, 0);

    this.add
      .text(x + 20, y + 42, choice.name, {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "32px",
        fontStyle: "bold",
        wordWrap: { width: width - 40 },
      })
      .setOrigin(0, 0);

    renderTypeBadges(this, {
      x: x + 20,
      y: y + 92,
      typeIds: choice.types,
    });

    this.add
      .text(
        x + 20,
        y + 138,
        `Species lock: ${toDisplayLabel(choice.speciesId)}\nBattle id: ${choice.battlePokemonId}`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "17px",
          lineSpacing: 6,
          wordWrap: { width: width - 40 },
        },
      )
      .setOrigin(0, 0);

    this.add
      .text(
        x + 20,
        y + 196,
        `Moves: ${choice.moves.map(toDisplayLabel).join(", ")}`,
        {
          color: PHASE_THREE_COLORS.muted,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "15px",
          wordWrap: { width: width - 40 },
        },
      )
      .setOrigin(0, 0);

    createActionButton(this, {
      x: x + 20,
      y: y + height - 78,
      width: width - 40,
      height: 58,
      label: `Choose ${choice.name}`,
      description: `Start the run with ${choice.name} at Lv. ${choice.level}.`,
      accentColor: PHASE_THREE_COLORS.accent,
      onPress: () => {
        runtime.startRunFromStarter(choice.battlePokemonId);

        const currentFloor = runtime.getCurrentFloorContext();

        if (!currentFloor) {
          throw new Error("Expected a current floor after choosing a starter");
        }

        this.scene.start(FloorScene.KEY, { currentFloor });
      },
    });
  }
}
