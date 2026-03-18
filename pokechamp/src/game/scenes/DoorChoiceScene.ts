import Phaser from "phaser";
import {
  FLOOR_COUNT,
  TYPE_BADGE_COLORS,
  TYPE_LABELS,
} from "../config/gameRules";
import {
  RunRuntimeService,
  type CurrentFloorContext,
  type PendingDoorChoiceContext,
} from "../run/runRuntimeService";
import type { CompletedRunRecord } from "../run/runState";
import type {
  GeneratedBattlePokemon,
  GeneratedDoorChoice,
} from "../run/rulesSandbox";
import { BattleResolutionScene } from "./BattleResolutionScene";
import { FloorScene } from "./FloorScene";
import { RewardDraftScene } from "./RewardDraftScene";
import { StarterDraftScene } from "./StarterDraftScene";
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

type DoorChoiceSceneMode = "choose-next-floor" | "completed" | "current-floor";

interface DoorChoiceSceneData {
  completedFloor?: CurrentFloorContext;
  completedRun?: CompletedRunRecord;
  currentFloor?: CurrentFloorContext;
  mode?: DoorChoiceSceneMode;
  pendingChoice?: PendingDoorChoiceContext;
}

export class DoorChoiceScene extends Phaser.Scene {
  public static readonly KEY = "door-choice";

  private completedFloorFromData: CurrentFloorContext | null = null;
  private completedRunFromData: CompletedRunRecord | null = null;
  private currentFloorFromData: CurrentFloorContext | null = null;
  private mode: DoorChoiceSceneMode = "current-floor";
  private pendingChoiceFromData: PendingDoorChoiceContext | null = null;

  public constructor() {
    super(DoorChoiceScene.KEY);
  }

  public init(data: DoorChoiceSceneData = {}): void {
    this.completedFloorFromData = data.completedFloor ?? null;
    this.completedRunFromData = data.completedRun ?? null;
    this.currentFloorFromData = data.currentFloor ?? null;
    this.mode = data.mode ?? "current-floor";
    this.pendingChoiceFromData = data.pendingChoice ?? null;
  }

  public create(): void {
    if (this.mode === "choose-next-floor") {
      this.renderNextDoorChoice();

      return;
    }

    if (this.mode === "completed") {
      this.renderCompletedRun();

      return;
    }

    this.renderCurrentFloor();
  }

  private renderCurrentFloor(): void {
    const runtime = RunRuntimeService.getInstance();
    const currentFloor =
      this.currentFloorFromData ?? runtime.getCurrentFloorContext();

    if (!currentFloor) {
      this.scene.start(TowerLobbyScene.KEY);

      return;
    }

    const layout = drawSceneShell(this, {
      eyebrow: `FLOOR ${currentFloor.state.currentFloor} OF ${FLOOR_COUNT}`,
      title: `${TYPE_LABELS[currentFloor.state.currentFloorType]} Floor`,
      subtitle: `Your active partner and enemy encounter are both generated straight from the runtime data.`,
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: layout.bodyWidth,
      height: 72,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(
        layout.bodyX + 24,
        layout.bodyY + 18,
        `Run ${currentFloor.state.runId} • Seed ${currentFloor.state.seed} • ${currentFloor.state.usedSpecies.length} species locked so far`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "19px",
          wordWrap: { width: layout.bodyWidth - 48 },
        },
      )
      .setOrigin(0, 0);

    this.add
      .text(
        layout.bodyX + 24,
        layout.bodyY + 44,
        `Current floor level: ${currentFloor.floorLevel} • Enemy level: ${currentFloor.encounter.enemy.level} • Encounter pool: ${currentFloor.encounter.availableSpeciesCount} species / ${currentFloor.encounter.availableFormCount} forms`,
        {
          color: PHASE_THREE_COLORS.muted,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "16px",
        },
      )
      .setOrigin(0, 0);

    this.drawPokemonPanel({
      pokemon: currentFloor.playerPokemon,
      x: layout.bodyX,
      y: layout.bodyY + 92,
      width: 350,
      height: 274,
      heading: "Your Partner",
      subheading: `Lv. ${currentFloor.playerPokemon.level} entering floor ${currentFloor.state.currentFloor}`,
    });

    this.drawPokemonPanel({
      pokemon: currentFloor.encounter.enemy,
      x: layout.bodyX + 370,
      y: layout.bodyY + 92,
      width: 350,
      height: 274,
      heading: "Trainer Encounter",
      subheading: `Lv. ${currentFloor.encounter.enemy.level} • Must match the ${TYPE_LABELS[currentFloor.state.currentFloorType]} floor in at least one type slot`,
    });

    drawPanel(this, {
      x: layout.bodyX + 740,
      y: layout.bodyY + 92,
      width: 376,
      height: 274,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 764, layout.bodyY + 112, "Sandbox Checks", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const checks = [
      `Species lock applies across the full run, not just the current floor.`,
      `Floor type is ${TYPE_LABELS[currentFloor.state.currentFloorType]}.`,
      `Enemy floor tags: ${currentFloor.encounter.enemy.floorTypes
        .map((typeId) => TYPE_LABELS[typeId])
        .join(", ")}.`,
      currentFloor.state.currentFloor < FLOOR_COUNT
        ? `Winning here produces exactly 3 legal reward choices for floor ${currentFloor.state.currentFloor + 1}.`
        : "This is the final floor, so the run completes after victory.",
    ];

    checks.forEach((line, index) => {
      this.add.circle(
        layout.bodyX + 772,
        layout.bodyY + 166 + index * 42,
        5,
        PHASE_THREE_COLORS.accent,
        1,
      );
      this.add
        .text(layout.bodyX + 788, layout.bodyY + 154 + index * 42, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          wordWrap: { width: 308 },
        })
        .setOrigin(0, 0);
    });

    createActionButton(this, {
      x: layout.bodyX,
      y: layout.bodyY + 390,
      width: 360,
      height: 86,
      label:
        currentFloor.state.currentFloor === FLOOR_COUNT
          ? "Enter Final Battle"
          : "Enter Battle",
      description:
        currentFloor.state.currentFloor === FLOOR_COUNT
          ? "Resolve the final showdown before claiming the tower."
          : "Open the battle-resolution scene for this floor encounter.",
      accentColor: 0x67c5b8,
      onPress: () => {
        this.scene.start(BattleResolutionScene.KEY, {
          entryMode: "challenge",
        });
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 382,
      y: layout.bodyY + 390,
      width: 300,
      height: 86,
      label: "Return To Lobby",
      description: "Keep this run saved and come back later from the lobby.",
      accentColor: 0x5ab9d4,
      onPress: () => {
        this.scene.start(TowerLobbyScene.KEY);
      },
    });
  }

  private renderNextDoorChoice(): void {
    const runtime = RunRuntimeService.getInstance();
    const pendingChoice =
      this.pendingChoiceFromData ?? runtime.getPendingDoorChoiceContext();

    if (!pendingChoice) {
      const rewardContext = runtime.getRewardDraftContext();

      if (rewardContext) {
        this.scene.start(RewardDraftScene.KEY, { rewardContext });
      } else {
        this.scene.start(TowerLobbyScene.KEY);
      }

      return;
    }

    const layout = drawSceneShell(this, {
      eyebrow: `NEXT FLOOR ${pendingChoice.doorOffer.nextFloorNumber}`,
      title: "Pick The Next Door",
      subtitle: `Your chosen reward is already fixed at Lv. ${pendingChoice.rewardOffer.nextFloorLevel}; now choose the next floor type.`,
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: 400,
      height: 354,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 24, layout.bodyY + 22, "Chosen Reward", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.drawCompactPokemonSummary(
      pendingChoice.chosenReward,
      layout.bodyX + 24,
      layout.bodyY + 70,
      352,
    );

    drawPanel(this, {
      x: layout.bodyX + 424,
      y: layout.bodyY,
      width: layout.bodyWidth - 424,
      height: 354,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(layout.bodyX + 448, layout.bodyY + 22, "Available Doors", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.add
      .text(
        layout.bodyX + 448,
        layout.bodyY + 58,
        `${pendingChoice.doorOffer.viableTypeCount} floor types stay legal after taking ${pendingChoice.chosenReward.name}. Each shown door keeps the run alive.`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          wordWrap: { width: layout.bodyWidth - 472 },
        },
      )
      .setOrigin(0, 0);

    pendingChoice.doorOffer.choices.forEach((choice, index) => {
      this.drawDoorOptionCard(
        choice,
        layout.bodyX + 448 + index * 260,
        layout.bodyY + 116,
        228,
        192,
      );
    });

    createActionButton(this, {
      x: layout.bodyX,
      y: layout.bodyY + 384,
      width: 300,
      height: 92,
      label: "Back To Rewards",
      description: "Return to the three reward choices and pick a different partner.",
      accentColor: 0x5ab9d4,
      onPress: () => {
        const rewardContext = runtime.getRewardDraftContext();

        if (!rewardContext) {
          this.scene.start(TowerLobbyScene.KEY);

          return;
        }

        this.scene.start(RewardDraftScene.KEY, { rewardContext });
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 320,
      y: layout.bodyY + 384,
      width: 300,
      height: 92,
      label: "Return To Lobby",
      description: "Keep the current run state saved and choose the door later.",
      accentColor: 0xf3c969,
      onPress: () => {
        this.scene.start(TowerLobbyScene.KEY);
      },
    });
  }

  private renderCompletedRun(): void {
    const runtime = RunRuntimeService.getInstance();
    const completedRun = this.completedRunFromData;
    const completedFloor = this.completedFloorFromData;

    if (!completedRun || !completedFloor) {
      this.scene.start(TowerLobbyScene.KEY);

      return;
    }

    const layout = drawSceneShell(this, {
      eyebrow: "RUN COMPLETE",
      title: "Tower Cleared",
      subtitle: `${completedRun.playerName} made it through all ${FLOOR_COUNT} floors with ${completedFloor.playerPokemon.name}.`,
    });

    this.drawPokemonPanel({
      pokemon: completedFloor.playerPokemon,
      x: layout.bodyX,
      y: layout.bodyY,
      width: 420,
      height: 318,
      heading: "Winning Partner",
      subheading: `Final floor type: ${TYPE_LABELS[completedRun.finalFloorType]}`,
    });

    drawPanel(this, {
      x: layout.bodyX + 444,
      y: layout.bodyY,
      width: layout.bodyWidth - 444,
      height: 318,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(layout.bodyX + 468, layout.bodyY + 22, "Run Summary", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const summaryLines = [
      `Run id: ${completedRun.runId}`,
      `Seed: ${completedRun.seed}`,
      `Species used: ${completedRun.usedSpecies.length}`,
      `Battle forms used: ${completedRun.usedBattlePokemon.length}`,
      `Final partner lock: ${toDisplayLabel(completedRun.winningPokemon.speciesId)}`,
      `Recorded floor history entries: ${completedRun.playerHistory.length}`,
    ];

    summaryLines.forEach((line, index) => {
      this.add
        .text(layout.bodyX + 468, layout.bodyY + 76 + index * 34, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "20px",
        })
        .setOrigin(0, 0);
    });

    createActionButton(this, {
      x: layout.bodyX,
      y: layout.bodyY + 348,
      width: 280,
      height: 88,
      label: "Back To Lobby",
      description: "Return to the runtime sandbox home screen.",
      accentColor: 0x5ab9d4,
      onPress: () => {
        this.scene.start(TowerLobbyScene.KEY);
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 300,
      y: layout.bodyY + 348,
      width: 320,
      height: 88,
      label: "Start Fresh Run",
      description: "Generate a brand-new starter trio and begin again.",
      accentColor: 0x67c5b8,
      onPress: () => {
        const draft = runtime.beginStarterDraft({
          clearSavedRun: true,
          forceNew: true,
          playerName: completedRun.playerName,
        });

        this.scene.start(StarterDraftScene.KEY, { draft });
      },
    });
  }

  private drawDoorOptionCard(
    choice: GeneratedDoorChoice,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const runtime = RunRuntimeService.getInstance();
    const accentColor = TYPE_BADGE_COLORS[choice.typeId];

    drawPanel(this, {
      x,
      y,
      width,
      height,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(x + 18, y + 18, TYPE_LABELS[choice.typeId], {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "28px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.add
      .text(
        x + 18,
        y + 58,
        `${choice.availableEncounterSpeciesCount} legal encounter species\n${choice.availableEncounterFormCount} legal encounter forms`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          lineSpacing: 6,
        },
      )
      .setOrigin(0, 0);

    createActionButton(this, {
      x: x + 18,
      y: y + height - 86,
      width: width - 36,
      height: 66,
      label: `Choose ${TYPE_LABELS[choice.typeId]}`,
      description: "Advance the saved run state to the next floor.",
      accentColor,
      onPress: () => {
        runtime.advanceToNextFloor(choice.typeId);

        const currentFloor = runtime.getCurrentFloorContext();

        if (!currentFloor) {
          throw new Error("Expected a current floor after advancing the run");
        }

        this.scene.start(FloorScene.KEY, { currentFloor });
      },
    });
  }

  private drawPokemonPanel(options: {
    heading: string;
    height: number;
    pokemon: GeneratedBattlePokemon;
    subheading: string;
    width: number;
    x: number;
    y: number;
  }): void {
    drawPanel(this, {
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(options.x + 20, options.y + 20, options.heading, {
        color: PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "15px",
        letterSpacing: 1.5,
      })
      .setOrigin(0, 0);

    this.add
      .text(options.x + 20, options.y + 42, options.pokemon.name, {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "34px",
        fontStyle: "bold",
        wordWrap: { width: options.width - 40 },
      })
      .setOrigin(0, 0);

    renderTypeBadges(this, {
      x: options.x + 20,
      y: options.y + 96,
      typeIds: options.pokemon.types,
    });

    this.add
      .text(options.x + 20, options.y + 144, options.subheading, {
        color: PHASE_THREE_COLORS.copy,
        fontFamily: PHASE_THREE_FONTS.accent,
        fontSize: "17px",
        wordWrap: { width: options.width - 40 },
      })
      .setOrigin(0, 0);

    this.add
      .text(
        options.x + 20,
        options.y + 198,
        `Battle id: ${options.pokemon.battlePokemonId}\nMoves: ${options.pokemon.moves
          .map(toDisplayLabel)
          .join(", ")}`,
        {
          color: PHASE_THREE_COLORS.muted,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "15px",
          lineSpacing: 6,
          wordWrap: { width: options.width - 40 },
        },
      )
      .setOrigin(0, 0);
  }

  private drawCompactPokemonSummary(
    pokemon: GeneratedBattlePokemon,
    x: number,
    y: number,
    width: number,
  ): void {
    this.add
      .text(x, y, pokemon.name, {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "32px",
        fontStyle: "bold",
        wordWrap: { width },
      })
      .setOrigin(0, 0);

    renderTypeBadges(this, {
      x,
      y: y + 48,
      typeIds: pokemon.types,
    });

    this.add
      .text(
        x,
        y + 94,
        `Lv. ${pokemon.level} • Floor tags: ${pokemon.floorTypes
          .map((typeId) => TYPE_LABELS[typeId])
          .join(", ")}\nMoves: ${pokemon.moves.map(toDisplayLabel).join(", ")}`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          lineSpacing: 6,
          wordWrap: { width },
        },
      )
      .setOrigin(0, 0);
  }
}
