import Phaser from "phaser";
import {
  FLOOR_COUNT,
  GAME_SUBTITLE,
  GAME_TITLE,
  TYPE_LABELS,
} from "../config/gameRules";
import { RunRuntimeService } from "../run/runRuntimeService";
import { FloorScene } from "./FloorScene";
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
    const savedRun = runtime.getRunState();
    const currentFloor = savedRun ? runtime.getCurrentFloorContext() : null;
    const layout = drawSceneShell(this, {
      eyebrow: "PHASE 4 VERTICAL SLICE",
      title: GAME_TITLE,
      subtitle: `${GAME_SUBTITLE} • Saved run state now lives in local storage and flows through starter, reward, and door scenes.`,
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
      "The active RunStateRecord is saved in local storage for resume support.",
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
          `Partner: ${currentFloor.playerPokemon.name} (Lv. ${currentFloor.playerPokemon.level})`,
          `Enemy preview: ${currentFloor.encounter.enemy.name}`,
          `Species already locked: ${currentFloor.state.usedSpecies.length}`,
        ].join("\n")
      : "No saved run yet.\nStart a new run to generate a starter trio and persist the first RunStateRecord.";

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
      description: "Clear any saved run, generate a fresh starter trio, and enter the runtime sandbox.",
      accentColor: 0x67c5b8,
      onPress: () => {
        const draft = runtime.beginStarterDraft({
          clearSavedRun: true,
          forceNew: true,
        });

        this.scene.start(StarterDraftScene.KEY, { draft });
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 710,
      y: layout.bodyY + 276,
      width: 184,
      height: 92,
      label: currentFloor ? "Resume Run" : "No Save Yet",
      description: currentFloor
        ? "Load the active floor room from the saved RunStateRecord."
        : "An active floor room will appear here after you begin a run.",
      accentColor: currentFloor ? 0x5ab9d4 : 0x4d8193,
      onPress: () => {
        if (!currentFloor) {
          return;
        }

        this.scene.start(FloorScene.KEY, { currentFloor });
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 910,
      y: layout.bodyY + 276,
      width: 184,
      height: 92,
      label: "Reset Save",
      description: "Clear the pending draft and the saved RunStateRecord from local storage.",
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
