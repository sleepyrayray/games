import Phaser from "phaser";
import {
  FLOOR_COUNT,
  GAME_SUBTITLE,
  GAME_TITLE,
  TYPE_LABELS,
} from "../config/gameRules";
import {
  RunRuntimeService,
  type RunCheckpointSummary,
} from "../run/runRuntimeService";
import { BattleResolutionScene } from "./BattleResolutionScene";
import { DoorChoiceScene } from "./DoorChoiceScene";
import { FloorScene } from "./FloorScene";
import { IntroScene } from "./IntroScene";
import { RewardDraftScene } from "./RewardDraftScene";
import { StarterDraftScene } from "./StarterDraftScene";
import {
  PHASE_THREE_COLORS,
  PHASE_THREE_FONTS,
  createActionButton,
  drawPanel,
  drawSceneShell,
  toDisplayLabel,
} from "./shared/phaseThreeUi";

export class TowerLobbyScene extends Phaser.Scene {
  public static readonly KEY = "tower-lobby";

  public constructor() {
    super(TowerLobbyScene.KEY);
  }

  public create(): void {
    const runtime = RunRuntimeService.getInstance();
    const checkpoint = runtime.getCheckpointSummary();
    const savedRun = runtime.getRunState();
    const currentFloor = checkpoint.currentFloor;
    const preferredPlayerName = runtime.getPreferredPlayerName();
    const activeTrainerName = currentFloor?.state.playerName ?? preferredPlayerName;
    const resumeState = getResumeState(checkpoint);
    const layout = drawSceneShell(this, {
      eyebrow: "PHASE 4 VERTICAL SLICE",
      title: GAME_TITLE,
      subtitle: `${GAME_SUBTITLE} • Trainer ${activeTrainerName} can launch, save, and resume the full Phase 4 slice across intro, floor, battle, reward, and door scenes.`,
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: 460,
      height: 406,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 24, layout.bodyY + 22, "Rules Runtime", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const overviewLines = [
      "Starter offers are randomized from the validated starter trio pool.",
      "Enemy encounters are generated from legal floor type and floor level pools.",
      "Rewards always produce exactly 3 legal next-floor choices when the run can continue.",
      "Species duplication is blocked run-wide, including alternate forms.",
      "The active RunStateRecord and current Phase 4 checkpoint are saved in local storage for resume support.",
    ];

    overviewLines.forEach((line, index) => {
      this.add.circle(
        layout.bodyX + 30,
        layout.bodyY + 86 + index * 52,
        5,
        PHASE_THREE_COLORS.accent,
        1,
      );
      this.add
        .text(layout.bodyX + 46, layout.bodyY + 72 + index * 52, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "19px",
          wordWrap: { width: 390 },
        })
        .setOrigin(0, 0);
    });

    drawPanel(this, {
      x: layout.bodyX + 486,
      y: layout.bodyY,
      width: layout.bodyWidth - 486,
      height: 184,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(layout.bodyX + 510, layout.bodyY + 22, "Saved Run Snapshot", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const snapshotText = currentFloor
      ? [
          `Run id: ${currentFloor.state.runId}`,
          `Current floor: ${currentFloor.state.currentFloor} / ${FLOOR_COUNT}`,
          `Floor type: ${TYPE_LABELS[currentFloor.state.currentFloorType]}`,
          `Active trainer: ${currentFloor.state.playerName}`,
          `Preferred default: ${preferredPlayerName}`,
          `Partner: ${currentFloor.playerPokemon.name} (Lv. ${currentFloor.playerPokemon.level})`,
          `Enemy preview: ${currentFloor.encounter.enemy.name}`,
          `Resume checkpoint: ${resumeState.summary}`,
          `Species already locked: ${currentFloor.state.usedSpecies.length}`,
        ].join("\n")
      : checkpoint.starterDraft
        ? [
            `Pending starter draft for: ${checkpoint.starterDraft.playerName}`,
            `Draft seed: ${checkpoint.starterDraft.seed}`,
            `Starter trio level: ${checkpoint.starterDraft.starterOffer.level}`,
            `Resume checkpoint: ${resumeState.summary}`,
            `Preferred default: ${preferredPlayerName}`,
          ].join("\n")
      : `Preferred trainer: ${preferredPlayerName}\nNo saved run yet.\nStart a new run to generate a starter trio and persist the first RunStateRecord.`;

    this.add
      .text(layout.bodyX + 510, layout.bodyY + 72, snapshotText, {
        color: PHASE_THREE_COLORS.copy,
        fontFamily: PHASE_THREE_FONTS.accent,
        fontSize: "19px",
        lineSpacing: 8,
        wordWrap: { width: layout.bodyWidth - 534 },
      })
      .setOrigin(0, 0);

    drawPanel(this, {
      x: layout.bodyX + 486,
      y: layout.bodyY + 208,
      width: layout.bodyWidth - 486,
      height: 198,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 510, layout.bodyY + 230, "Actions", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    createActionButton(this, {
      x: layout.bodyX + 510,
      y: layout.bodyY + 276,
      width: 184,
      height: 92,
      label: "Start New Run",
      description: "Review the trainer intro, then generate a fresh starter trio and run seed.",
      accentColor: 0x67c5b8,
      onPress: () => {
        this.scene.start(IntroScene.KEY, {
          playerName: preferredPlayerName,
        });
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 710,
      y: layout.bodyY + 276,
      width: 184,
      height: 92,
      label: resumeState.label,
      description: resumeState.description,
      accentColor:
        checkpoint.stage === "none" ? 0x4d8193 : 0x5ab9d4,
      onPress: () => {
        if (checkpoint.stage === "starter-draft" && checkpoint.starterDraft) {
          this.scene.start(StarterDraftScene.KEY, {
            draft: checkpoint.starterDraft,
          });

          return;
        }

        if (checkpoint.stage === "door" && checkpoint.pendingDoorChoice) {
          this.scene.start(DoorChoiceScene.KEY, {
            mode: "choose-next-floor",
            pendingChoice: checkpoint.pendingDoorChoice,
          });

          return;
        }

        if (checkpoint.stage === "reward" && checkpoint.rewardContext) {
          this.scene.start(RewardDraftScene.KEY, {
            rewardContext: checkpoint.rewardContext,
          });

          return;
        }

        if (
          (checkpoint.stage === "battle" ||
            checkpoint.stage === "final-victory") &&
          checkpoint.battleSession
        ) {
          this.scene.start(BattleResolutionScene.KEY, checkpoint.battleSession);

          return;
        }

        if (checkpoint.stage === "floor" && checkpoint.currentFloor) {
          this.scene.start(FloorScene.KEY, {
            currentFloor: checkpoint.currentFloor,
          });
        }
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 910,
      y: layout.bodyY + 276,
      width: 184,
      height: 92,
      label: "Reset Save",
      description: "Clear the pending draft plus saved run, battle, and door checkpoints from local storage.",
      accentColor: 0xf3c969,
      onPress: () => {
        runtime.clearRunState();
        this.scene.restart();
      },
    });

    this.add
      .text(
        layout.bodyX,
        layout.bodyY + 430,
        currentFloor
          ? `Resume will reopen floor ${currentFloor.state.currentFloor} with ${currentFloor.playerPokemon.name} directly inside the active room. Reward and door choices are still derived from the same saved run state when you win.`
          : checkpoint.starterDraft
            ? `A starter trio is already waiting in memory for ${checkpoint.starterDraft.playerName}. Resume Draft picks up exactly where the intro handed off.`
          : `The current vertical slice now includes starter drafting, a type-themed floor room, an interactive battle prototype, reward selection, and next-door choice on top of the same runtime service.`,
        {
          color: PHASE_THREE_COLORS.muted,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          fontStyle: "italic",
          wordWrap: { width: layout.bodyWidth },
        },
      )
      .setOrigin(0, 0);

    if (savedRun && !currentFloor) {
      this.add
        .text(
          layout.bodyX,
          layout.bodyY + 382,
          `Saved run metadata was present, but the current floor could not be rebuilt cleanly. Partner lock: ${toDisplayLabel(savedRun.currentPokemon.speciesId)}.`,
          {
            color: "#ffd9a3",
            fontFamily: PHASE_THREE_FONTS.title,
            fontSize: "16px",
            wordWrap: { width: layout.bodyWidth },
          },
        )
        .setOrigin(0, 0);
    }
  }
}

function getResumeState(checkpoint: RunCheckpointSummary): {
  description: string;
  label: string;
  summary: string;
} {
  if (checkpoint.stage === "starter-draft") {
    return {
      description: "Return to the in-progress starter trio before a run has been locked in.",
      label: "Resume Draft",
      summary: "Starter draft pending",
    };
  }

  if (checkpoint.stage === "none") {
    return {
      description: "An active floor room will appear here after you begin a run.",
      label: "No Save Yet",
      summary: "None",
    };
  }

  if (checkpoint.stage === "door") {
    return {
      description: "Resume the saved door-choice checkpoint after locking in a reward.",
      label: "Resume Door",
      summary: "Door choice pending",
    };
  }

  if (checkpoint.stage === "floor") {
    return {
      description: "Load the active floor room from the saved RunStateRecord.",
      label: "Resume Run",
      summary: "Floor room ready",
    };
  }

  if (checkpoint.stage === "reward") {
    return {
      description: "Resume from the saved victory checkpoint and continue into rewards.",
      label: "Resume Reward",
      summary: "Victory checkpoint",
    };
  }

  if (checkpoint.stage === "final-victory") {
    return {
      description:
        "Resume the saved final victory checkpoint and claim the tower clear.",
      label: "Claim Win",
      summary: "Final victory checkpoint",
    };
  }

  return {
    description: "Resume the saved battle checkpoint exactly where the current fight stopped.",
    label: "Resume Battle",
    summary: "Battle in progress",
  };
}
