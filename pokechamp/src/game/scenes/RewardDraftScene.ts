import Phaser from "phaser";
import { TYPE_LABELS } from "../config/gameRules";
import {
  RunRuntimeService,
  type RewardDraftContext,
} from "../run/runRuntimeService";
import type { GeneratedBattlePokemon } from "../run/rulesSandbox";
import { BattleResolutionScene } from "./BattleResolutionScene";
import { DoorChoiceScene } from "./DoorChoiceScene";
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

interface RewardDraftSceneData {
  rewardContext?: RewardDraftContext;
}

export class RewardDraftScene extends Phaser.Scene {
  public static readonly KEY = "reward-draft";

  private rewardContextFromData: RewardDraftContext | null = null;

  public constructor() {
    super(RewardDraftScene.KEY);
  }

  public init(data: RewardDraftSceneData = {}): void {
    this.rewardContextFromData = data.rewardContext ?? null;
  }

  public create(): void {
    const runtime = RunRuntimeService.getInstance();
    const rewardContext =
      this.rewardContextFromData ?? runtime.getRewardDraftContext();

    if (!rewardContext) {
      this.scene.start(TowerLobbyScene.KEY);

      return;
    }

    const layout = drawSceneShell(this, {
      eyebrow: `FLOOR ${rewardContext.currentFloor.state.currentFloor} CLEARED`,
      title: "Choose Your Reward",
      subtitle: `All three rewards are legal for floor ${rewardContext.rewardOffer.nextFloorNumber} at Lv. ${rewardContext.rewardOffer.nextFloorLevel}.`,
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: layout.bodyWidth,
      height: 94,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(
        layout.bodyX + 24,
        layout.bodyY + 16,
        `You won the ${TYPE_LABELS[rewardContext.currentFloor.state.currentFloorType]} floor with ${rewardContext.currentFloor.playerPokemon.name}.`,
        {
          color: PHASE_THREE_COLORS.title,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "24px",
          fontStyle: "bold",
        },
      )
      .setOrigin(0, 0);

    this.add
      .text(
        layout.bodyX + 24,
        layout.bodyY + 50,
        `${rewardContext.rewardOffer.availableSpeciesCount} legal reward species remain across ${rewardContext.rewardOffer.availableFormCount} forms. Choose one partner to carry into the next floor, or leave this reward checkpoint saved for later.`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          wordWrap: { width: layout.bodyWidth - 48 },
        },
      )
      .setOrigin(0, 0);

    const cardWidth = 346;
    const cardHeight = 276;
    const cardGap = 18;
    const cardY = layout.bodyY + 116;

    rewardContext.rewardOffer.choices.forEach((choice, index) => {
      const cardX = layout.bodyX + index * (cardWidth + cardGap);

      this.drawRewardCard(choice, cardX, cardY, cardWidth, cardHeight);
    });

    createActionButton(this, {
      x: layout.bodyX,
      y: layout.bodyY + 404,
      width: 280,
      height: 72,
      label: "Back To Victory",
      description: "Return to the saved victory summary without committing a reward.",
      accentColor: 0x5ab9d4,
      onPress: () => {
        const savedBattle = runtime.getBattleSession();

        if (!savedBattle) {
          this.scene.start(FloorScene.KEY, {
            currentFloor: rewardContext.currentFloor,
          });

          return;
        }

        this.scene.start(BattleResolutionScene.KEY, savedBattle);
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 300,
      y: layout.bodyY + 404,
      width: 280,
      height: 72,
      label: "Return To Lobby",
      description: "Keep the reward checkpoint saved and choose later from the lobby.",
      accentColor: 0xf3c969,
      onPress: () => {
        this.scene.start(TowerLobbyScene.KEY);
      },
    });
  }

  private drawRewardCard(
    choice: GeneratedBattlePokemon,
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
      .text(x + 20, y + 20, choice.name, {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "32px",
        fontStyle: "bold",
        wordWrap: { width: width - 40 },
      })
      .setOrigin(0, 0);

    renderTypeBadges(this, {
      x: x + 20,
      y: y + 70,
      typeIds: choice.types,
    });

    this.add
      .text(
        x + 20,
        y + 116,
        `Lv. ${choice.level} • Species lock ${toDisplayLabel(choice.speciesId)}\nFloor tags: ${choice.floorTypes.map((typeId) => TYPE_LABELS[typeId]).join(", ")}`,
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
        y + 182,
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
      label: `Take ${choice.name}`,
      description: "Commit this partner, then choose the next floor door.",
      accentColor: PHASE_THREE_COLORS.accent,
      onPress: () => {
        const pendingChoice = runtime.chooseReward(choice.battlePokemonId);

        this.scene.start(DoorChoiceScene.KEY, {
          mode: "choose-next-floor",
          pendingChoice,
        });
      },
    });
  }
}
