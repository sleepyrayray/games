import Phaser from "phaser";
import { FLOOR_COUNT, TYPE_BADGE_COLORS, TYPE_LABELS } from "../config/gameRules";
import {
  BATTLE_TURN_LIMIT,
  buildBattleMoveChoices,
  createBattleSession,
  resolveBattleTurn,
  type BattleCombatantContext,
  type BattleMoveChoice,
  type BattleResolutionContext,
  type BattleSessionState,
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
  toDisplayLabel,
} from "./shared/phaseThreeUi";

interface BattleResolutionSceneData {
  battleContext?: BattleResolutionContext;
  battleState?: BattleSessionState;
}

export class BattleResolutionScene extends Phaser.Scene {
  public static readonly KEY = "battle-resolution";

  private battleContextFromData: BattleResolutionContext | null = null;
  private battleStateFromData: BattleSessionState | null = null;

  public constructor() {
    super(BattleResolutionScene.KEY);
  }

  public init(data: BattleResolutionSceneData = {}): void {
    this.battleContextFromData = data.battleContext ?? null;
    this.battleStateFromData = data.battleState ?? null;
  }

  public create(): void {
    const runtime = RunRuntimeService.getInstance();
    const battleContext =
      this.battleContextFromData ?? runtime.getBattleContext();

    if (!battleContext) {
      this.scene.start(TowerLobbyScene.KEY);

      return;
    }

    const battleState =
      this.battleStateFromData ?? createBattleSession(battleContext);

    if (battleState.outcome) {
      this.renderResolvedBattle(battleContext, battleState);

      return;
    }

    this.renderInteractiveBattle(battleContext, battleState);
  }

  private renderInteractiveBattle(
    context: BattleResolutionContext,
    battleState: BattleSessionState,
  ): void {
    const layout = drawSceneShell(this, {
      eyebrow: `BATTLE FLOOR ${context.floorNumber} OF ${FLOOR_COUNT}`,
      title: `${TYPE_LABELS[context.floorType]} Battle`,
      subtitle:
        "Phase 4 combat prototype: pick one direct-damage move each turn. Priority, accuracy, and STAB are live; type effectiveness and status systems still wait for a later phase.",
    });
    const moveChoices = buildBattleMoveChoices({
      attacker: context.player,
      attackerStats: battleState.playerStats,
      defender: context.enemy,
      defenderStats: battleState.enemyStats,
    });
    const infoBarY = layout.bodyY;
    const cardsY = layout.bodyY + 70;
    const lowerPanelsY = layout.bodyY + 264;
    const logPanelWidth = 518;
    const movePanelWidth = layout.bodyWidth - logPanelWidth - 18;

    drawPanel(this, {
      x: layout.bodyX,
      y: infoBarY,
      width: layout.bodyWidth,
      height: 58,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(
        layout.bodyX + 20,
        infoBarY + 14,
        `Run ${context.runId} • Turn ${battleState.turnsResolved + 1} / ${BATTLE_TURN_LIMIT} • Floor level ${context.floorLevel} • ${context.usedSpeciesCount} species already locked`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
          wordWrap: { width: 640 },
        },
      )
      .setOrigin(0, 0);

    this.add
      .text(
        layout.bodyX + 20,
        infoBarY + 34,
        "Retreating leaves the run saved, but this prototype restarts the current battle when you re-enter.",
        {
          color: PHASE_THREE_COLORS.muted,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "13px",
          wordWrap: { width: 640 },
        },
      )
      .setOrigin(0, 0);

    this.createCompactButton({
      accentColor: 0x5ab9d4,
      label: "Retreat To Floor",
      onPress: () => {
        this.scene.start(FloorScene.KEY);
      },
      width: 160,
      x: layout.bodyX + layout.bodyWidth - 338,
      y: infoBarY + 9,
    });

    this.createCompactButton({
      accentColor: 0xf3c969,
      label: "Return To Lobby",
      onPress: () => {
        this.scene.start(TowerLobbyScene.KEY);
      },
      width: 158,
      x: layout.bodyX + layout.bodyWidth - 170,
      y: infoBarY + 9,
    });

    this.drawCombatantStatusCard({
      combatant: context.enemy,
      currentHp: battleState.enemyCurrentHp,
      label: `${TYPE_LABELS[context.floorType]} floor trainer`,
      stats: battleState.enemyStats,
      width: 548,
      x: layout.bodyX,
      y: cardsY,
    });

    this.drawCombatantStatusCard({
      combatant: context.player,
      currentHp: battleState.playerCurrentHp,
      label: `${context.playerName}'s partner`,
      stats: battleState.playerStats,
      width: 548,
      x: layout.bodyX + 568,
      y: cardsY,
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: lowerPanelsY,
      width: logPanelWidth,
      height: layout.bodyHeight - 264,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(layout.bodyX + 18, lowerPanelsY + 14, "Battle Log", {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "28px",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    const logLines = this.getBattleLogLines(
      battleState.turns,
      context.player.generated.name,
      context.enemy.generated.name,
      6,
    );

    logLines.forEach((line, index) => {
      this.add
        .text(layout.bodyX + 18, lowerPanelsY + 52 + index * 26, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
          wordWrap: { width: logPanelWidth - 36 },
        })
        .setOrigin(0, 0);
    });

    drawPanel(this, {
      x: layout.bodyX + logPanelWidth + 18,
      y: lowerPanelsY,
      width: movePanelWidth,
      height: layout.bodyHeight - 264,
      fillColor: PHASE_THREE_COLORS.panelAlt,
    });

    this.add
      .text(
        layout.bodyX + logPanelWidth + 36,
        lowerPanelsY + 14,
        `Choose ${context.player.generated.name}'s move`,
        {
          color: PHASE_THREE_COLORS.title,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "28px",
          fontStyle: "bold",
          wordWrap: { width: movePanelWidth - 36 },
        },
      )
      .setOrigin(0, 0);

    moveChoices.forEach((choice, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);

      this.drawMoveChoiceButton({
        choice,
        height: 48,
        onPress: () => {
          if (!choice.isSelectable) {
            return;
          }

          const nextState = resolveBattleTurn({
            context,
            playerMoveId: choice.plan.moveId,
            state: battleState,
          });

          if (nextState.outcome === "enemy-win") {
            RunRuntimeService.getInstance().clearRunState();
          }

          this.scene.restart({
            battleContext: context,
            battleState: nextState,
          });
        },
        width: 260,
        x: layout.bodyX + logPanelWidth + 38 + column * 280,
        y: lowerPanelsY + 50 + row * 54,
      });
    });
  }

  private renderResolvedBattle(
    context: BattleResolutionContext,
    battleState: BattleSessionState,
  ): void {
    if (!battleState.outcome || !battleState.summary) {
      throw new Error("Expected a completed battle state");
    }

    const runtime = RunRuntimeService.getInstance();
    const didPlayerWin = battleState.outcome === "player-win";
    const layout = drawSceneShell(this, {
      eyebrow: didPlayerWin ? "VICTORY" : "DEFEAT",
      title: didPlayerWin ? "Battle Won" : "Run Lost",
      subtitle: battleState.summary,
    });

    drawPanel(this, {
      x: layout.bodyX,
      y: layout.bodyY,
      width: 352,
      height: 272,
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
      `Player HP left: ${battleState.playerCurrentHp} / ${battleState.playerStats.hp}`,
      `Enemy HP left: ${battleState.enemyCurrentHp} / ${battleState.enemyStats.hp}`,
      `Turns resolved: ${battleState.turnsResolved}`,
      `Player finisher: ${battleState.playerLastPlan?.moveName ?? "None"}`,
      `Enemy finisher: ${battleState.enemyLastPlan?.moveName ?? "None"}`,
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
      height: 272,
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

    const turnLines = this.getBattleLogLines(
      battleState.turns,
      context.player.generated.name,
      context.enemy.generated.name,
      8,
    );

    turnLines.forEach((line, index) => {
      this.add
        .text(layout.bodyX + 396, layout.bodyY + 70 + index * 24, line, {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "16px",
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
      createActionButton(this, {
        x: layout.bodyX + 356,
        y: layout.bodyY + 296,
        width: 300,
        height: 88,
        label: "Return To Lobby",
        description: "Head back to the lobby after the defeat summary.",
        accentColor: 0xf3c969,
        onPress: () => {
          this.scene.start(TowerLobbyScene.KEY);
        },
      });
    }
  }

  private createCompactButton(options: {
    accentColor: number;
    label: string;
    onPress: () => void;
    width: number;
    x: number;
    y: number;
  }): void {
    const background = this.add
      .rectangle(
        options.x,
        options.y,
        options.width,
        40,
        PHASE_THREE_COLORS.button,
        1,
      )
      .setOrigin(0)
      .setStrokeStyle(2, PHASE_THREE_COLORS.border, 0.34)
      .setInteractive({ useHandCursor: true });

    this.add
      .rectangle(options.x, options.y, options.width, 5, options.accentColor, 1)
      .setOrigin(0);

    this.add
      .text(options.x + options.width / 2, options.y + 23, options.label, {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "15px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    background.on("pointerover", () => {
      background.setFillStyle(PHASE_THREE_COLORS.buttonHover, 1);
    });
    background.on("pointerout", () => {
      background.setFillStyle(PHASE_THREE_COLORS.button, 1);
    });
    background.on("pointerdown", () => {
      options.onPress();
    });
  }

  private drawCombatantStatusCard(options: {
    combatant: BattleCombatantContext;
    currentHp: number;
    label: string;
    stats: BattleSessionState["playerStats"];
    width: number;
    x: number;
    y: number;
  }): void {
    drawPanel(this, {
      x: options.x,
      y: options.y,
      width: options.width,
      height: 184,
      fillColor: PHASE_THREE_COLORS.panel,
    });

    this.add
      .text(options.x + 18, options.y + 16, options.label, {
        color: PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "14px",
        letterSpacing: 1.5,
      })
      .setOrigin(0, 0);

    this.add
      .text(options.x + 18, options.y + 38, options.combatant.generated.name, {
        color: PHASE_THREE_COLORS.title,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "30px",
        fontStyle: "bold",
        wordWrap: { width: options.width - 36 },
      })
      .setOrigin(0, 0);

    renderTypeBadges(this, {
      x: options.x + 18,
      y: options.y + 82,
      typeIds: options.combatant.generated.types,
    });

    this.add
      .text(
        options.x + 18,
        options.y + 122,
        `HP ${options.currentHp} / ${options.stats.hp}`,
        {
          color: PHASE_THREE_COLORS.copy,
          fontFamily: PHASE_THREE_FONTS.accent,
          fontSize: "18px",
        },
      )
      .setOrigin(0, 0);

    this.drawHpBar({
      currentHp: options.currentHp,
      maxHp: options.stats.hp,
      width: options.width - 36,
      x: options.x + 18,
      y: options.y + 150,
    });

    this.add
      .text(
        options.x + 18,
        options.y + 166,
        `Atk ${options.stats.attack} • Def ${options.stats.defense} • SpA ${options.stats.specialAttack} • SpD ${options.stats.specialDefense} • Spe ${options.stats.speed}`,
        {
          color: PHASE_THREE_COLORS.muted,
          fontFamily: PHASE_THREE_FONTS.title,
          fontSize: "12px",
          wordWrap: { width: options.width - 36 },
        },
      )
      .setOrigin(0, 0);
  }

  private drawHpBar(options: {
    currentHp: number;
    maxHp: number;
    width: number;
    x: number;
    y: number;
  }): void {
    const graphics = this.add.graphics();
    const hpRatio =
      options.maxHp === 0 ? 0 : Phaser.Math.Clamp(options.currentHp / options.maxHp, 0, 1);
    let fillColor = 0x67c5b8;

    if (hpRatio <= 0.25) {
      fillColor = 0xe77b65;
    } else if (hpRatio <= 0.5) {
      fillColor = 0xf3c969;
    }

    graphics.fillStyle(0x041018, 0.92);
    graphics.fillRoundedRect(options.x, options.y, options.width, 12, 6);
    graphics.fillStyle(fillColor, 1);
    if (hpRatio > 0) {
      graphics.fillRoundedRect(
        options.x,
        options.y,
        Math.max(12, options.width * hpRatio),
        12,
        6,
      );
    }
    graphics.lineStyle(1, PHASE_THREE_COLORS.border, 0.4);
    graphics.strokeRoundedRect(options.x, options.y, options.width, 12, 6);
  }

  private drawMoveChoiceButton(options: {
    choice: BattleMoveChoice;
    height: number;
    onPress: () => void;
    width: number;
    x: number;
    y: number;
  }): void {
    const fillColor = options.choice.isSelectable
      ? PHASE_THREE_COLORS.button
      : PHASE_THREE_COLORS.panel;
    const background = this.add
      .rectangle(options.x, options.y, options.width, options.height, fillColor, 1)
      .setOrigin(0)
      .setStrokeStyle(2, PHASE_THREE_COLORS.border, options.choice.isSelectable ? 0.34 : 0.18);
    const accentColor = TYPE_BADGE_COLORS[options.choice.plan.typeId];

    this.add
      .rectangle(options.x, options.y, options.width, 5, accentColor, 1)
      .setOrigin(0);

    this.add
      .text(options.x + 14, options.y + 10, options.choice.plan.moveName, {
        color: options.choice.isSelectable
          ? PHASE_THREE_COLORS.title
          : PHASE_THREE_COLORS.muted,
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "16px",
        fontStyle: "bold",
        wordWrap: { width: options.width - 28 },
      })
      .setOrigin(0, 0);

    const metaLine = options.choice.isSelectable
      ? `${TYPE_LABELS[options.choice.plan.typeId]} • ${toDisplayLabel(options.choice.plan.category)} • Pow ${options.choice.plan.power} • Acc ${options.choice.plan.accuracy}`
      : `${TYPE_LABELS[options.choice.plan.typeId]} • ${toDisplayLabel(options.choice.plan.category)}`;

    this.add
      .text(options.x + 14, options.y + 28, metaLine, {
        color: PHASE_THREE_COLORS.copy,
        fontFamily: PHASE_THREE_FONTS.accent,
        fontSize: "11px",
        wordWrap: { width: options.width - 28 },
      })
      .setOrigin(0, 0);

    const detailLine = options.choice.isSelectable
      ? options.choice.plan.isFallback
        ? "Fallback strike covers unsupported movesets."
        : `Estimated damage ${options.choice.plan.expectedDamage}${options.choice.plan.priority !== 0 ? ` • Priority ${options.choice.plan.priority > 0 ? "+" : ""}${options.choice.plan.priority}` : ""}`
      : options.choice.disabledReason ?? "Unavailable";

    this.add
      .text(options.x + 14, options.y + 39, detailLine, {
        color: options.choice.isSelectable
          ? PHASE_THREE_COLORS.muted
          : "#f7c9b4",
        fontFamily: PHASE_THREE_FONTS.title,
        fontSize: "9px",
        fontStyle: options.choice.isSelectable ? "normal" : "italic",
        wordWrap: { width: options.width - 28 },
      })
      .setOrigin(0, 0);

    if (!options.choice.isSelectable) {
      return;
    }

    background.setInteractive({ useHandCursor: true });
    background.on("pointerover", () => {
      background.setFillStyle(PHASE_THREE_COLORS.buttonHover, 1);
    });
    background.on("pointerout", () => {
      background.setFillStyle(PHASE_THREE_COLORS.button, 1);
    });
    background.on("pointerdown", () => {
      options.onPress();
    });
  }

  private getBattleLogLines(
    turns: BattleTurnLog[],
    playerName: string,
    enemyName: string,
    maxLines: number,
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
      return [
        "No turns resolved yet. Choose one of the legal move buttons to start the battle.",
        "Disabled moves are shown for transparency, but only direct-damage actions work in this Phase 4 prototype.",
      ];
    }

    return lines.slice(-maxLines);
  }
}
