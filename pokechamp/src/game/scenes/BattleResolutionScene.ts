import Phaser from "phaser";
import { FLOOR_COUNT, TYPE_LABELS } from "../config/gameRules";
import {
  deriveBattleStats,
  resolveBattle,
  selectBattleMove,
  type BattleCombatantContext,
  type BattleResolutionContext,
  type BattleResolutionResult,
  type BattleTurnLog,
} from "../run/battleResolution";
import { RunRuntimeService } from "../run/runRuntimeService";
import { DoorChoiceScene } from "./DoorChoiceScene";
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
} from "./shared/phaseThreeUi";

interface BattleResolutionSceneData {
  battleContext?: BattleResolutionContext;
  resolution?: BattleResolutionResult;
}

export class BattleResolutionScene extends Phaser.Scene {
  public static readonly KEY = "battle-resolution";

  private battleContextFromData: BattleResolutionContext | null = null;
  private resolutionFromData: BattleResolutionResult | null = null;

  public constructor() {
    super(BattleResolutionScene.KEY);
  }

  public init(data: BattleResolutionSceneData = {}): void {
    this.battleContextFromData = data.battleContext ?? null;
    this.resolutionFromData = data.resolution ?? null;
  }

  public create(): void {
    const runtime = RunRuntimeService.getInstance();
    const battleContext =
      this.battleContextFromData ?? runtime.getBattleContext();

    if (!battleContext) {
      this.scene.start(TowerLobbyScene.KEY);

      return;
    }

    if (this.resolutionFromData) {
      this.renderResolvedBattle(battleContext, this.resolutionFromData);

      return;
    }

    this.renderBattlePreview(battleContext);
  }

  private renderBattlePreview(context: BattleResolutionContext): void {
    const playerStats = deriveBattleStats(context.player.record, context.floorLevel);
    const enemyStats = deriveBattleStats(context.enemy.record, context.floorLevel);
    const playerPlan = selectBattleMove({
      attacker: context.player,
      attackerStats: playerStats,
      defender: context.enemy,
      defenderStats: enemyStats,
    });
    const enemyPlan = selectBattleMove({
      attacker: context.enemy,
      attackerStats: enemyStats,
      defender: context.player,
      defenderStats: playerStats,
    });
    const layout = drawSceneShell(this, {
      eyebrow: `BATTLE FLOOR ${context.floorNumber} OF ${FLOOR_COUNT}`,
      title: `${TYPE_LABELS[context.floorType]} Showdown`,
      subtitle:
        "Simplified deterministic combat: legal move lists, scaled stats, priority, accuracy, and STAB. Type effectiveness and status systems come later.",
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: layout.bodyWidth,
      height: 74,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(
        layout.bodyX + 24,
        layout.bodyY + 18,
        `Run ${context.runId} • ${context.usedSpeciesCount} species already locked • Floor level ${context.floorLevel}`,
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
        `Winning here keeps the saved run alive and unlocks rewards. Losing clears the run and sends you back to floor 1.`,
        {
          color: PHASE_THREE_COLORS.muted,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "16px",
          wordWrap: { width: layout.bodyWidth - 48 },
        },
      )
      .setOrigin(0, 0);

    this.drawCombatantCard({
      combatant: context.player,
      planLabel: `${context.playerName}'s lead`,
      projectedMove: playerPlan.moveName,
      stats: playerStats,
      width: 352,
      x: layout.bodyX,
      y: layout.bodyY + 96,
    });

    this.drawCombatantCard({
      combatant: context.enemy,
      planLabel: `${TYPE_LABELS[context.floorType]} floor trainer`,
      projectedMove: enemyPlan.moveName,
      stats: enemyStats,
      width: 352,
      x: layout.bodyX + 370,
      y: layout.bodyY + 96,
    });

    drawPanel(this, {
      x: layout.bodyX + 740,
      y: layout.bodyY + 96,
      width: 376,
      height: 292,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 764, layout.bodyY + 118, "Resolver Notes", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const previewLines = [
      `${context.player.generated.name} projects into ${playerPlan.moveName}${playerPlan.isFallback ? " via fallback strike" : ""}.`,
      `${context.enemy.generated.name} projects into ${enemyPlan.moveName}${enemyPlan.isFallback ? " via fallback strike" : ""}.`,
      "The resolver uses only data already available in the runtime datasets.",
      "Fallback Strike appears only when a legal move list has no direct-damage option yet.",
    ];

    previewLines.forEach((line, index) => {
      this.add.circle(
        layout.bodyX + 772,
        layout.bodyY + 172 + index * 42,
        5,
        PHASE_THREE_COLORS.accent,
        1,
      );
      this.add
        .text(layout.bodyX + 788, layout.bodyY + 160 + index * 42, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          wordWrap: { width: 308 },
        })
        .setOrigin(0, 0);
    });

    createActionButton(this, {
      x: layout.bodyX,
      y: layout.bodyY + 412,
      width: 340,
      height: 86,
      label: "Resolve Battle",
      description: "Run the simplified deterministic battle and reveal the result.",
      accentColor: 0x67c5b8,
      onPress: () => {
        const resolution = resolveBattle(context);

        if (resolution.outcome === "enemy-win") {
          RunRuntimeService.getInstance().clearRunState();
        }

        this.scene.restart({
          battleContext: context,
          resolution,
        });
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 360,
      y: layout.bodyY + 412,
      width: 280,
      height: 86,
      label: "Back To Floor",
      description: "Return to the active floor room without resolving the battle.",
      accentColor: 0x5ab9d4,
      onPress: () => {
        this.scene.start(FloorScene.KEY);
      },
    });

    createActionButton(this, {
      x: layout.bodyX + 660,
      y: layout.bodyY + 412,
      width: 280,
      height: 86,
      label: "Return To Lobby",
      description: "Keep the run saved and come back to this battle later.",
      accentColor: 0xf3c969,
      onPress: () => {
        this.scene.start(TowerLobbyScene.KEY);
      },
    });
  }

  private renderResolvedBattle(
    context: BattleResolutionContext,
    resolution: BattleResolutionResult,
  ): void {
    const runtime = RunRuntimeService.getInstance();
    const didPlayerWin = resolution.outcome === "player-win";
    const layout = drawSceneShell(this, {
      eyebrow: didPlayerWin ? "VICTORY" : "DEFEAT",
      title: didPlayerWin ? "Battle Won" : "Run Lost",
      subtitle: resolution.summary,
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: 352,
      height: 270,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 22, layout.bodyY + 22, "Battle Outcome", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const outcomeLines = [
      `Player HP left: ${resolution.playerRemainingHp} / ${resolution.playerStats.hp}`,
      `Enemy HP left: ${resolution.enemyRemainingHp} / ${resolution.enemyStats.hp}`,
      `Turns resolved: ${resolution.turnsResolved}`,
      `Player move plan: ${resolution.playerPlan.moveName}`,
      `Enemy move plan: ${resolution.enemyPlan.moveName}`,
    ];

    outcomeLines.forEach((line, index) => {
      this.add
        .text(layout.bodyX + 22, layout.bodyY + 72 + index * 34, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "19px",
          wordWrap: { width: 308 },
        })
        .setOrigin(0, 0);
    });

    drawPanel(this, {
      x: layout.bodyX + 372,
      y: layout.bodyY,
      width: layout.bodyWidth - 372,
      height: 270,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(layout.bodyX + 396, layout.bodyY + 22, "Battle Log", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const turnLines = this.flattenTurnLog(
      resolution.turns.slice(0, 6),
      context.player.generated.name,
      context.enemy.generated.name,
    );

    turnLines.forEach((line, index) => {
      this.add
        .text(layout.bodyX + 396, layout.bodyY + 70 + index * 28, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "17px",
          wordWrap: { width: layout.bodyWidth - 420 },
        })
        .setOrigin(0, 0);
    });

    if (didPlayerWin) {
      createActionButton(this, {
        x: layout.bodyX,
        y: layout.bodyY + 296,
        width: 340,
        height: 88,
        label:
          context.floorNumber === FLOOR_COUNT ? "Claim Tower Win" : "Collect Reward",
        description:
          context.floorNumber === FLOOR_COUNT
            ? "Complete the run and archive the final victory."
            : "Move to the legal reward draft for the next floor.",
        accentColor: 0x67c5b8,
        onPress: () => {
          if (context.floorNumber === FLOOR_COUNT) {
            const completed = runtime.completeCurrentRun();

            if (!completed) {
              throw new Error("Expected a completed run after final-floor victory");
            }

            this.scene.start(DoorChoiceScene.KEY, {
              completedFloor: completed.currentFloor,
              completedRun: completed.completedRun,
              mode: "completed",
            });

            return;
          }

          const rewardContext = runtime.getRewardDraftContext();

          if (!rewardContext) {
            throw new Error("Expected reward context after a victorious battle");
          }

          this.scene.start(RewardDraftScene.KEY, { rewardContext });
        },
      });

      createActionButton(this, {
        x: layout.bodyX + 360,
        y: layout.bodyY + 296,
        width: 300,
        height: 88,
        label: "Return To Floor",
        description: "Keep the run as-is and reopen the active floor room.",
        accentColor: 0x5ab9d4,
        onPress: () => {
          this.scene.start(FloorScene.KEY);
        },
      });
    } else {
      createActionButton(this, {
        x: layout.bodyX,
        y: layout.bodyY + 296,
        width: 340,
        height: 88,
        label: "Draft New Starter",
        description: "The run is over. Generate a fresh starter trio and begin again.",
        accentColor: 0x67c5b8,
        onPress: () => {
          const draft = runtime.beginStarterDraft({
            clearSavedRun: true,
            forceNew: true,
            playerName: context.playerName,
          });

          this.scene.start(StarterDraftScene.KEY, { draft });
        },
      });
    }

    createActionButton(this, {
      x: layout.bodyX + 680,
      y: layout.bodyY + 296,
      width: 300,
      height: 88,
      label: "Return To Lobby",
      description: didPlayerWin
        ? "Leave the run saved and resume from the lobby later."
        : "Head back to the lobby after the defeat summary.",
      accentColor: 0xf3c969,
      onPress: () => {
        this.scene.start(TowerLobbyScene.KEY);
      },
    });
  }

  private drawCombatantCard(options: {
    combatant: BattleCombatantContext;
    planLabel: string;
    projectedMove: string;
    stats: ReturnType<typeof deriveBattleStats>;
    width: number;
    x: number;
    y: number;
  }): void {
    drawPanel(this, {
      x: options.x,
      y: options.y,
      width: options.width,
      height: 292,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(options.x + 20, options.y + 18, options.planLabel, {
        color: PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "15px",
        letterSpacing: 1.5,
      })
      .setOrigin(0, 0);

    this.add
      .text(options.x + 20, options.y + 42, options.combatant.generated.name, {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "32px",
        fontStyle: "bold",
        wordWrap: { width: options.width - 40 },
      })
      .setOrigin(0, 0);

    renderTypeBadges(this, {
      x: options.x + 20,
      y: options.y + 92,
      typeIds: options.combatant.generated.types,
    });

    this.add
      .text(
        options.x + 20,
        options.y + 142,
        `Projected opener: ${options.projectedMove}\nMoves: ${options.combatant.moveRecords.map((move) => move.name).join(", ")}`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          lineSpacing: 6,
          wordWrap: { width: options.width - 40 },
        },
      )
      .setOrigin(0, 0);

    const statText = [
      `HP ${options.stats.hp}`,
      `Atk ${options.stats.attack}`,
      `Def ${options.stats.defense}`,
      `SpA ${options.stats.specialAttack}`,
      `SpD ${options.stats.specialDefense}`,
      `Spe ${options.stats.speed}`,
    ].join("  •  ");

    this.add
      .text(options.x + 20, options.y + 238, statText, {
        color: PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "14px",
        wordWrap: { width: options.width - 40 },
      })
      .setOrigin(0, 0);
  }

  private flattenTurnLog(
    turns: BattleTurnLog[],
    playerName: string,
    enemyName: string,
  ): string[] {
    const lines: string[] = [];

    turns.forEach((turn) => {
      turn.actions.forEach((action) => {
        const actorName = action.actorSide === "player" ? playerName : enemyName;
        const targetName = action.actorSide === "player" ? enemyName : playerName;
        const actionSummary = action.hit
          ? `${actorName} used ${action.moveName}${action.usedFallback ? " (fallback)" : ""} for ${action.damage} damage. ${targetName} fell to ${action.remainingHp} HP.`
          : `${actorName} used ${action.moveName}${action.usedFallback ? " (fallback)" : ""} and missed.`;

        lines.push(`Turn ${turn.turnNumber}: ${actionSummary}`);
      });
    });

    if (lines.length === 0) {
      return ["No actions were resolved."];
    }

    return lines;
  }
}
