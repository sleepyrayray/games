import { useEffect, useReducer, useState } from 'react';
import {
  createRound,
  eliminatePlayer,
  getActivePlayers,
  getAssignment,
  getVoteOptions,
  incrementRound,
  isSpyGuessCorrect,
  normalizeInput,
  normalizeForCompare,
  resolveVotes,
  shuffleItems,
  validatePlayerNames,
  shouldSpyWinBySurvival,
} from './game/logic';
import { getThemeById, THEMES } from './game/themes';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type AppState,
  type GameResult,
  type Player,
  type ScreenId,
  type Theme,
  type ThemeId,
  type VotePhase,
  type VotingSession,
} from './game/types';

type Action =
  | { type: 'openPlay' }
  | { type: 'openInstructions' }
  | { type: 'goHome' }
  | { type: 'selectTheme'; themeId: ThemeId }
  | { type: 'continueFromTheme' }
  | { type: 'backToTheme' }
  | { type: 'setPlayerName'; index: number; value: string }
  | { type: 'addPlayer' }
  | { type: 'removePlayer'; index: number }
  | { type: 'startGame' }
  | { type: 'showWord' }
  | { type: 'hideWord' }
  | { type: 'continueToVoting' }
  | { type: 'showVoteOptions' }
  | { type: 'selectVoteTarget'; playerId: string }
  | { type: 'submitVote' }
  | { type: 'startRevote' }
  | { type: 'backToHintRound' }
  | { type: 'continueAfterElimination' }
  | { type: 'showSpyGuess' }
  | { type: 'setSpyGuess'; value: string }
  | { type: 'submitSpyGuess' }
  | { type: 'playAgain' };

const INSTRUCTION_STEPS = [
  {
    step: '1',
    title: 'Set up the round',
    body: 'Pick a theme and add 3 to 10 names to get the round ready.',
  },
  {
    step: '2',
    title: 'Pass and peek',
    body: 'Players check their words one at a time, hide them again, and pass it along.',
  },
  {
    step: '3',
    title: 'Drop a clue',
    body: 'Everyone says one clue out loud. That is when the odd word should start to show.',
  },
  {
    step: '4',
    title: 'Vote in private',
    body: 'Each active player votes in private. Catch the spy and they get one last guess.',
  },
];

const WORD_REVEAL_DURATION_MS = 2000;
const createThemeOrder = () => shuffleItems(THEMES.map((theme) => theme.id));

function createInitialState(): AppState {
  return {
    screen: 'title',
    setup: {
      selectedThemeId: null,
      playerNames: ['', '', ''],
      themeOrder: createThemeOrder(),
    },
    round: null,
    revealIndex: 0,
    voting: null,
    selectedVoteTargetId: null,
    tiedPlayerIds: [],
    tieStage: null,
    lastEliminatedPlayerId: null,
    spyGuess: '',
    result: null,
    notice: null,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'openPlay':
      return {
        ...state,
        screen: 'themeSelection',
        setup: {
          ...state.setup,
          themeOrder: createThemeOrder(),
        },
        notice: null,
      };

    case 'openInstructions':
      return {
        ...state,
        screen: 'instructions',
        notice: null,
      };

    case 'goHome':
      return {
        ...state,
        screen: 'title',
        round: null,
        revealIndex: 0,
        voting: null,
        selectedVoteTargetId: null,
        tiedPlayerIds: [],
        tieStage: null,
        lastEliminatedPlayerId: null,
        spyGuess: '',
        result: null,
        notice: null,
      };

    case 'selectTheme':
      return {
        ...state,
        setup: {
          ...state.setup,
          selectedThemeId: action.themeId,
        },
        notice: null,
      };

    case 'continueFromTheme':
      if (!state.setup.selectedThemeId) {
        return {
          ...state,
          notice: 'Choose a theme to continue.',
        };
      }

      return {
        ...state,
        screen: 'playerEntry',
        notice: null,
      };

    case 'backToTheme':
      return {
        ...state,
        screen: 'themeSelection',
        setup: {
          ...state.setup,
          themeOrder: createThemeOrder(),
        },
        notice: null,
      };

    case 'setPlayerName':
      return {
        ...state,
        setup: {
          ...state.setup,
          playerNames: state.setup.playerNames.map((name, index) =>
            index === action.index ? action.value : name,
          ),
        },
        notice: null,
      };

    case 'addPlayer':
      if (state.setup.playerNames.length >= MAX_PLAYERS) {
        return {
          ...state,
          notice: `You can add up to ${MAX_PLAYERS} players.`,
        };
      }

      return {
        ...state,
        setup: {
          ...state.setup,
          playerNames: [...state.setup.playerNames, ''],
        },
        notice: null,
      };

    case 'removePlayer':
      if (state.setup.playerNames.length <= MIN_PLAYERS) {
        return state;
      }

      return {
        ...state,
        setup: {
          ...state.setup,
          playerNames: state.setup.playerNames.filter((_, index) => index !== action.index),
        },
        notice: null,
      };

    case 'startGame': {
      if (!state.setup.selectedThemeId) {
        return {
          ...state,
          screen: 'themeSelection',
          notice: 'Choose a theme to continue.',
        };
      }

      const theme = getThemeById(state.setup.selectedThemeId);

      if (!theme) {
        return {
          ...state,
          notice: 'Theme not found.',
        };
      }

      const { sanitizedNames, error } = validatePlayerNames(state.setup.playerNames);

      if (error) {
        return {
          ...state,
          notice: error,
        };
      }

      return {
        ...state,
        screen: 'revealHandoff',
        setup: {
          ...state.setup,
          playerNames: sanitizedNames,
        },
        round: createRound(theme, sanitizedNames),
        revealIndex: 0,
        voting: null,
        selectedVoteTargetId: null,
        tiedPlayerIds: [],
        tieStage: null,
        lastEliminatedPlayerId: null,
        spyGuess: '',
        result: null,
        notice: null,
      };
    }

    case 'showWord':
      return {
        ...state,
        screen: 'revealWord',
        notice: null,
      };

    case 'hideWord':
      if (!state.round) {
        return state;
      }

      if (state.revealIndex < state.round.revealOrder.length - 1) {
        return {
          ...state,
          revealIndex: state.revealIndex + 1,
          screen: 'revealHandoff',
          notice: null,
        };
      }

      return {
        ...state,
        screen: 'hintRound',
        notice: null,
      };

    case 'continueToVoting':
      if (!state.round) {
        return state;
      }

      return {
        ...state,
        screen: 'voteHandoff',
        voting: buildVotingSession(state.round, 'standard'),
        selectedVoteTargetId: null,
        tiedPlayerIds: [],
        tieStage: null,
        notice: null,
      };

    case 'showVoteOptions':
      return {
        ...state,
        screen: 'vote',
        selectedVoteTargetId: null,
        notice: null,
      };

    case 'selectVoteTarget':
      return {
        ...state,
        selectedVoteTargetId: action.playerId,
        notice: null,
      };

    case 'submitVote': {
      if (!state.round || !state.voting) {
        return state;
      }

      const voterId = state.voting.voterOrder[state.voting.currentVoterIndex];
      const voter = state.round.players.find((player) => player.id === voterId);

      if (!voter || !state.selectedVoteTargetId) {
        return {
          ...state,
          notice: 'Choose a player to continue.',
        };
      }

      const voteOptions = getVoteOptions(
        state.round.players,
        voter.id,
        state.voting.phase === 'revote' ? state.voting.tiedPlayerIds : [],
      );

      if (!voteOptions.some((player) => player.id === state.selectedVoteTargetId)) {
        return {
          ...state,
          notice: 'That vote is not allowed.',
        };
      }

      const nextVotes = {
        ...state.voting.votes,
        [voter.id]: state.selectedVoteTargetId,
      };

      const hasMoreVoters = state.voting.currentVoterIndex < state.voting.voterOrder.length - 1;

      if (hasMoreVoters) {
        return {
          ...state,
          screen: 'voteHandoff',
          voting: {
            ...state.voting,
            currentVoterIndex: state.voting.currentVoterIndex + 1,
            votes: nextVotes,
          },
          selectedVoteTargetId: null,
          notice: null,
        };
      }

      const resolution = resolveVotes(nextVotes);

      if (resolution.kind === 'tie') {
        return {
          ...state,
          screen: 'tie',
          voting: {
            ...state.voting,
            votes: nextVotes,
          },
          selectedVoteTargetId: null,
          tiedPlayerIds: resolution.tiedPlayerIds,
          tieStage: state.voting.phase === 'standard' ? 1 : 2,
          notice: null,
        };
      }

      const updatedPlayers = eliminatePlayer(state.round.players, resolution.eliminatedPlayerId);
      const updatedRound = {
        ...state.round,
        players: updatedPlayers,
      };

      const eliminatedSpy = resolution.eliminatedPlayerId === state.round.spyPlayerId;

      if (!eliminatedSpy && shouldSpyWinBySurvival(updatedPlayers, state.round.spyPlayerId)) {
        return {
          ...state,
          round: updatedRound,
          screen: 'result',
          voting: null,
          selectedVoteTargetId: null,
          tiedPlayerIds: [],
          tieStage: null,
          lastEliminatedPlayerId: resolution.eliminatedPlayerId,
          result: 'spy',
          notice: null,
        };
      }

      return {
        ...state,
        round: updatedRound,
        screen: 'elimination',
        voting: null,
        selectedVoteTargetId: null,
        tiedPlayerIds: [],
        tieStage: null,
        lastEliminatedPlayerId: resolution.eliminatedPlayerId,
        notice: null,
      };
    }

    case 'startRevote':
      if (!state.round || state.tiedPlayerIds.length === 0) {
        return state;
      }

      return {
        ...state,
        screen: 'voteHandoff',
        voting: buildVotingSession(state.round, 'revote', state.tiedPlayerIds),
        selectedVoteTargetId: null,
        notice: null,
      };

    case 'backToHintRound':
      if (!state.round) {
        return state;
      }

      return {
        ...state,
        round: incrementRound(state.round),
        screen: 'hintRound',
        voting: null,
        selectedVoteTargetId: null,
        tiedPlayerIds: [],
        tieStage: null,
        notice: null,
      };

    case 'continueAfterElimination':
      if (!state.round || !state.lastEliminatedPlayerId) {
        return state;
      }

      if (state.lastEliminatedPlayerId === state.round.spyPlayerId) {
        return {
          ...state,
          screen: 'spyGuessHandoff',
          spyGuess: '',
          notice: null,
        };
      }

      return {
        ...state,
        round: incrementRound(state.round),
        screen: 'hintRound',
        lastEliminatedPlayerId: null,
        notice: null,
      };

    case 'showSpyGuess':
      return {
        ...state,
        screen: 'spyGuess',
        notice: null,
      };

    case 'setSpyGuess':
      return {
        ...state,
        spyGuess: action.value,
        notice: null,
      };

    case 'submitSpyGuess': {
      if (!state.round) {
        return state;
      }

      if (!state.spyGuess.trim()) {
        return {
          ...state,
          notice: 'Enter a guess to continue.',
        };
      }

      const result: GameResult = isSpyGuessCorrect(state.spyGuess, state.round.commonWord)
        ? 'spy'
        : 'non-spies';

      return {
        ...state,
        screen: 'result',
        result,
        notice: null,
      };
    }

    case 'playAgain':
      return {
        ...state,
        screen: 'playerEntry',
        round: null,
        revealIndex: 0,
        voting: null,
        selectedVoteTargetId: null,
        tiedPlayerIds: [],
        tieStage: null,
        lastEliminatedPlayerId: null,
        spyGuess: '',
        result: null,
        notice: null,
      };

    default:
      return state;
  }
}

function buildVotingSession(
  round: NonNullable<AppState['round']>,
  phase: VotePhase,
  tiedPlayerIds: string[] = [],
): VotingSession {
  return {
    phase,
    voterOrder: shuffleItems(getActivePlayers(round.players).map((player) => player.id)),
    currentVoterIndex: 0,
    votes: {},
    tiedPlayerIds,
  };
}

function getCurrentRevealPlayer(state: AppState) {
  if (!state.round) {
    return null;
  }

  const currentRevealPlayerId = state.round.revealOrder[state.revealIndex];
  return state.round.players.find((player) => player.id === currentRevealPlayerId) ?? null;
}

function getCurrentVotingPlayer(state: AppState) {
  if (!state.round || !state.voting) {
    return null;
  }

  const currentVoterId = state.voting.voterOrder[state.voting.currentVoterIndex];
  return state.round.players.find((player) => player.id === currentVoterId) ?? null;
}

function getPlayerName(players: Player[], playerId: string | null) {
  if (!playerId) {
    return null;
  }

  return players.find((player) => player.id === playerId)?.name ?? null;
}

function formatNames(players: Player[], playerIds: string[]) {
  return playerIds
    .map((playerId) => players.find((player) => player.id === playerId)?.name)
    .filter((name): name is string => Boolean(name))
    .join(', ');
}

function getDuplicateNameKeys(playerNames: string[]) {
  const counts = new Map<string, number>();

  for (const playerName of playerNames) {
    const normalizedName = normalizeInput(playerName);

    if (!normalizedName) {
      continue;
    }

    const key = normalizeForCompare(normalizedName);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );
}

function getEyebrowLabel(screen: ScreenId) {
  switch (screen) {
    case 'title':
      return 'Local multiplayer party game';
    case 'instructions':
      return 'Rules';
    case 'themeSelection':
    case 'playerEntry':
      return 'Setup';
    case 'revealHandoff':
    case 'revealWord':
      return 'Reveal';
    case 'hintRound':
      return 'Live play';
    case 'voteHandoff':
    case 'vote':
    case 'tie':
      return 'Voting';
    case 'elimination':
      return 'Elimination';
    case 'spyGuessHandoff':
    case 'spyGuess':
      return 'Final guess';
    case 'result':
      return 'Result';
    default:
      return 'Game';
  }
}

function getScreenLabel(screen: ScreenId) {
  switch (screen) {
    case 'title':
      return "Who's the Spy?";
    case 'instructions':
      return 'How to Play';
    case 'themeSelection':
      return 'Choose a Theme';
    case 'playerEntry':
      return 'Add Players';
    case 'revealHandoff':
    case 'revealWord':
      return 'Reveal';
    case 'hintRound':
      return 'Hint Round';
    case 'voteHandoff':
    case 'vote':
    case 'tie':
      return 'Voting';
    case 'elimination':
      return 'Elimination';
    case 'spyGuessHandoff':
    case 'spyGuess':
      return 'Spy Guess';
    case 'result':
      return 'Result';
    default:
      return 'Game';
  }
}

function getResultDetail(
  result: GameResult,
  round: NonNullable<AppState['round']>,
  lastEliminatedPlayerId: string | null,
) {
  if (result === 'spy') {
    if (lastEliminatedPlayerId === round.spyPlayerId) {
      return {
        chip: 'Final guess',
        noteKind: 'spyGuessedCorrectly',
      };
    }

    return {
      chip: 'Last two players',
      noteKind: 'spySurvived',
    };
  }

  if (lastEliminatedPlayerId === round.spyPlayerId) {
    return {
      chip: 'Final guess missed',
      noteKind: 'spyMissed',
    };
  }

  return {
    chip: 'Round complete',
    noteKind: 'crewClosedItOut',
  };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [canHideRevealedWord, setCanHideRevealedWord] = useState(true);
  const [isRevealWordVisible, setIsRevealWordVisible] = useState(true);

  const selectedTheme = state.setup.selectedThemeId
    ? getThemeById(state.setup.selectedThemeId)
    : null;
  const orderedThemes = state.setup.themeOrder
    .map((themeId) => getThemeById(themeId))
    .filter((theme): theme is Theme => theme !== null);
  const normalizedPlayerNames = state.setup.playerNames.map(normalizeInput);
  const duplicateNameKeys = getDuplicateNameKeys(state.setup.playerNames);
  const filledPlayerCount = normalizedPlayerNames.filter(Boolean).length;
  const readyPlayerCount = normalizedPlayerNames.filter((playerName) => {
    if (!playerName) {
      return false;
    }

    return !duplicateNameKeys.has(normalizeForCompare(playerName));
  }).length;
  const setupValidation = validatePlayerNames(state.setup.playerNames);
  const canContinueFromTheme = Boolean(selectedTheme);
  const canAddPlayer = state.setup.playerNames.length < MAX_PLAYERS;
  const canStartGame = Boolean(selectedTheme) && !setupValidation.error;
  const hasSetupProgress = Boolean(selectedTheme) || filledPlayerCount > 0;
  const currentRevealPlayer = getCurrentRevealPlayer(state);
  const currentVotingPlayer = getCurrentVotingPlayer(state);
  const currentAssignment =
    state.round && currentRevealPlayer
      ? getAssignment(state.round, currentRevealPlayer.id)
      : null;
  const voteOptions =
    state.round && currentVotingPlayer && state.voting
      ? getVoteOptions(
          state.round.players,
          currentVotingPlayer.id,
          state.voting.phase === 'revote' ? state.voting.tiedPlayerIds : [],
        )
      : [];
  const revotePlayerNames =
    state.round && state.voting?.phase === 'revote'
      ? formatNames(state.round.players, state.voting.tiedPlayerIds)
      : null;
  const roundPlayers = state.round?.players ?? [];
  const tiedPlayerCards = state.tiedPlayerIds.map((playerId) => ({
    id: playerId,
    name: getPlayerName(roundPlayers, playerId) ?? 'Unknown player',
  }));
  const spyPlayerName = state.round
    ? getPlayerName(state.round.players, state.round.spyPlayerId)
    : null;
  const resultDetail =
    state.round && state.result
      ? getResultDetail(state.result, state.round, state.lastEliminatedPlayerId)
      : null;
  const eliminatedPlayerName = state.round
    ? getPlayerName(state.round.players, state.lastEliminatedPlayerId)
    : null;
  const topStatusItems = state.round
    ? [state.round.theme.name, `Round ${state.round.roundNumber}`]
    : state.screen === 'playerEntry' && selectedTheme
      ? [selectedTheme.name, `${state.setup.playerNames.length} seats`]
      : [];
  const resultNote = (() => {
    if (!resultDetail || !spyPlayerName) {
      return 'The round is over. Review the final reveal below, then start again.';
    }

    switch (resultDetail.noteKind) {
      case 'spyGuessedCorrectly':
        return (
          <>
            <span className="inline-name">{spyPlayerName}</span> nailed the common word and stole the round.
          </>
        );
      case 'spySurvived':
        return (
          <>
            <span className="inline-name">{spyPlayerName}</span> made it to the final two and took the round.
          </>
        );
      case 'spyMissed':
        return (
          <>
            <span className="inline-name">{spyPlayerName}</span> got caught and missed the last guess.
          </>
        );
      case 'crewClosedItOut':
      default:
        return 'The crew closed it out.';
    }
  })();

  useEffect(() => {
    if (state.screen !== 'revealWord' || !currentRevealPlayer) {
      setCanHideRevealedWord(true);
      setIsRevealWordVisible(true);
      return;
    }

    setCanHideRevealedWord(false);
    setIsRevealWordVisible(false);

    const timeoutId = window.setTimeout(() => {
      setIsRevealWordVisible(true);
      setCanHideRevealedWord(true);
    }, WORD_REVEAL_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [state.screen, currentRevealPlayer?.id]);

  return (
    <div className="app-shell">
      <div className="phone-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">{getEyebrowLabel(state.screen)}</p>
            <h1>{getScreenLabel(state.screen)}</h1>
          </div>
          {topStatusItems.length > 0 ? (
            <div className="status-stack">
              {topStatusItems.map((item) => (
                <span key={item} className="status-pill">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <main className="screen-card">
          {state.notice ? <p className="notice">{state.notice}</p> : null}

          {state.screen === 'title' ? (
            <>
              <section className="hero hero-title">
                <p className="hero-copy hero-copy-compact">Quick clues, one odd word.</p>
              </section>
              <div className="button-stack">
                <button className="button button-primary" onClick={() => dispatch({ type: 'openPlay' })}>
                  {hasSetupProgress ? 'Keep Setting Up' : 'Start a Game'}
                </button>
                <button className="button button-secondary" onClick={() => dispatch({ type: 'openInstructions' })}>
                  How to Play
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'instructions' ? (
            <>
              <section className="section-copy">
                <p>Read this once and you are good to go.</p>
              </section>
              <section className="instruction-list">
                {INSTRUCTION_STEPS.map((item) => (
                  <article key={item.step} className="instruction-card">
                    <span className="instruction-step">{item.step}</span>
                    <div className="instruction-copy">
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </section>
              <div className="button-row">
                <button className="button button-secondary" onClick={() => dispatch({ type: 'goHome' })}>
                  Back
                </button>
                <button className="button button-primary" onClick={() => dispatch({ type: 'openPlay' })}>
                  Start a Game
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'themeSelection' ? (
            <>
              <section className="section-copy">
                <p>Pick a theme for this round.</p>
              </section>
              <div className="theme-grid">
                {orderedThemes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    className={
                      state.setup.selectedThemeId === theme.id
                        ? 'choice-card choice-card-theme choice-card-active'
                        : 'choice-card choice-card-theme'
                    }
                    aria-pressed={state.setup.selectedThemeId === theme.id}
                    onClick={() => dispatch({ type: 'selectTheme', themeId: theme.id })}
                  >
                    <span>{theme.name}</span>
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button className="button button-secondary" onClick={() => dispatch({ type: 'goHome' })}>
                  Back
                </button>
                <button
                  className="button button-primary"
                  disabled={!canContinueFromTheme}
                  onClick={() => dispatch({ type: 'continueFromTheme' })}
                >
                  Next
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'playerEntry' ? (
            <>
              <section className="section-copy">
                <p>Add everyone who is in.</p>
              </section>
              <section className="setup-summary">
                <article className="summary-card">
                  <span>Theme</span>
                  <strong>{selectedTheme?.name ?? 'No theme selected'}</strong>
                </article>
                <article className="summary-card">
                  <span>Players ready</span>
                  <strong>
                    {readyPlayerCount} / {state.setup.playerNames.length}
                  </strong>
                </article>
              </section>
              <div className="field-list">
                {state.setup.playerNames.map((playerName, index) => (
                  <label key={`player-field-${index}`} className="field-row">
                    <div className="field-label-row">
                      <span>Player {index + 1}</span>
                      <em
                        className={
                          !normalizedPlayerNames[index]
                            ? 'field-badge field-badge-warning'
                            : duplicateNameKeys.has(normalizeForCompare(normalizedPlayerNames[index]))
                              ? 'field-badge field-badge-warning'
                              : 'field-badge field-badge-ready'
                        }
                      >
                        {!normalizedPlayerNames[index]
                          ? 'Missing'
                          : duplicateNameKeys.has(normalizeForCompare(normalizedPlayerNames[index]))
                            ? 'Duplicate'
                            : 'Ready'}
                      </em>
                    </div>
                    <div className="field-control">
                      <input
                        className="input"
                        type="text"
                        value={playerName}
                        placeholder={`Player ${index + 1}`}
                        autoCapitalize="words"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(event) =>
                          dispatch({
                            type: 'setPlayerName',
                            index,
                            value: event.target.value,
                          })
                        }
                      />
                      {state.setup.playerNames.length > MIN_PLAYERS ? (
                        <button
                          className="icon-button icon-button-danger"
                          type="button"
                          onClick={() => dispatch({ type: 'removePlayer', index })}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
              <div className="button-stack">
                <button
                  className="button button-secondary"
                  disabled={!canAddPlayer}
                  onClick={() => dispatch({ type: 'addPlayer' })}
                >
                  {canAddPlayer ? 'Add Player' : 'Player Limit Reached'}
                </button>
                <button
                  className="button button-primary"
                  disabled={!canStartGame}
                  onClick={() => dispatch({ type: 'startGame' })}
                >
                  Start Round
                </button>
                <button className="button button-ghost" onClick={() => dispatch({ type: 'backToTheme' })}>
                  Back
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'revealHandoff' && currentRevealPlayer ? (
            <section className="card-scene">
              <section className="phase-hero phase-hero-lock">
                <h2>
                  Pass it to <span className="inline-name">{currentRevealPlayer.name}</span>
                </h2>
                <p>
                  Only <span className="inline-name">{currentRevealPlayer.name}</span> should peek at the screen.
                </p>
              </section>
              <div className="card-slot">
                <button
                  className="tap-card handoff-card handoff-card-dark attention-card"
                  onClick={() => dispatch({ type: 'showWord' })}
                >
                  <span className="handoff-label">Up next</span>
                  <strong>
                    <span className="inline-name">{currentRevealPlayer.name}</span>
                  </strong>
                  <small>Tap to peek at your word</small>
                </button>
              </div>
            </section>
          ) : null}

          {state.screen === 'revealWord' && currentRevealPlayer && currentAssignment ? (
            <section className="card-scene">
              <section className="phase-hero phase-hero-lock">
                <h2>Lock it in.</h2>
                <p>When you are ready, tap the card and pass it on.</p>
              </section>
              <div className="card-slot">
                <button
                  className={
                    canHideRevealedWord
                      ? `word-card word-card-light reveal-card ${isRevealWordVisible ? 'reveal-card-revealed attention-card' : 'reveal-card-revealing'}`
                      : `word-card word-card-light reveal-card ${isRevealWordVisible ? 'reveal-card-revealed' : 'reveal-card-revealing'}`
                  }
                  disabled={!canHideRevealedWord}
                  onClick={() => dispatch({ type: 'hideWord' })}
                >
                  <span className="word-card-label">Your word</span>
                  <div className="reveal-stage">
                    <strong className="word-card-value">{currentAssignment.word}</strong>
                  </div>
                  <small className="word-card-note">
                    {isRevealWordVisible ? 'Tap to hide and pass it on' : 'Hang on...'}
                  </small>
                </button>
              </div>
            </section>
          ) : null}

          {state.screen === 'hintRound' ? (
            <>
              <section className="phase-hero">
                <h2>Everyone drops one clue.</h2>
                <p>One clue each, out loud.</p>
              </section>
              <section className="checklist-card">
                <span>Keep it simple</span>
                <div className="checklist-list">
                  <p>One clue each.</p>
                  <p>No more app taps until the table is ready.</p>
                  <p>Vote when everyone feels locked in.</p>
                </div>
              </section>
              <div className="button-stack">
                <button className="button button-primary" onClick={() => dispatch({ type: 'continueToVoting' })}>
                  Start Voting
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'voteHandoff' && currentVotingPlayer ? (
            <section className="card-scene">
              <section className="phase-hero phase-hero-lock">
                <h2>
                  Pass it to <span className="inline-name">{currentVotingPlayer.name}</span>
                </h2>
                <p>
                  Only <span className="inline-name">{currentVotingPlayer.name}</span> should peek while making the
                  pick.
                </p>
              </section>
              {state.voting?.phase === 'revote' && revotePlayerNames ? (
                <section className="detail-note">
                  <span>Tied players</span>
                  <strong>{revotePlayerNames}</strong>
                </section>
              ) : null}
              <div className="card-slot">
                <button className="tap-card handoff-card attention-card" onClick={() => dispatch({ type: 'showVoteOptions' })}>
                  <span className="handoff-label">
                    {state.voting?.phase === 'revote' ? 'Open revote' : 'Open vote'}
                  </span>
                  <strong>
                    <span className="inline-name">{currentVotingPlayer.name}</span>
                  </strong>
                  <small>Tap to make your pick</small>
                </button>
              </div>
            </section>
          ) : null}

          {state.screen === 'vote' && currentVotingPlayer ? (
            <>
              <section className="phase-hero">
                <h2>
                  <span className="inline-name">{currentVotingPlayer.name}</span>, who is your pick?
                </h2>
                <p>
                  {state.voting?.phase === 'revote'
                    ? 'Only the tied players are up this time. Nobody sees the result until every vote is in.'
                    : 'Your pick stays private until everybody is done.'}
                </p>
              </section>
              {state.voting?.phase === 'revote' && revotePlayerNames ? (
                <section className="detail-note">
                  <span>Tied players</span>
                  <strong>{revotePlayerNames}</strong>
                </section>
              ) : null}
              <div className="vote-grid">
                {voteOptions.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    className={
                      state.selectedVoteTargetId === player.id
                        ? 'choice-card choice-card-vote choice-card-active'
                        : 'choice-card choice-card-vote'
                    }
                    onClick={() => dispatch({ type: 'selectVoteTarget', playerId: player.id })}
                  >
                    <span>{player.name}</span>
                  </button>
                ))}
              </div>
              <div className="button-stack">
                <button
                  className="button button-primary"
                  disabled={!state.selectedVoteTargetId}
                  onClick={() => dispatch({ type: 'submitVote' })}
                >
                  {state.voting?.phase === 'revote' ? 'Lock In Revote' : 'Lock In Vote'}
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'tie' && state.round ? (
            <>
              <section className="phase-hero">
                <h2>{state.tieStage === 1 ? "It's a tie." : 'Still tied.'}</h2>
                {state.tieStage === 1 ? (
                  <p>One more quick vote between the tied players.</p>
                ) : (
                  <p>Nobody is out. Same words, another clue round.</p>
                )}
              </section>
              {tiedPlayerCards.length > 0 ? (
                <section className="detail-note tied-players-card">
                  <span>Tied players</span>
                  <div className="tied-player-list">
                    {tiedPlayerCards.map((player) => (
                      <p key={player.id}>
                        <span className="inline-name">{player.name}</span>
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
              <p className="phase-followup">
                {state.tieStage === 1
                  ? 'Everyone votes again in private. Only the tied players show up on the ballot.'
                  : 'Nobody is out. Go back to clues, then vote again with the same words.'}
              </p>
              <div className="button-stack">
                {state.tieStage === 1 ? (
                  <button className="button button-primary" onClick={() => dispatch({ type: 'startRevote' })}>
                    Start Revote
                  </button>
                ) : (
                  <button className="button button-primary" onClick={() => dispatch({ type: 'backToHintRound' })}>
                    Back to Hint Round
                  </button>
                )}
              </div>
            </>
          ) : null}

          {state.screen === 'elimination' && state.round && eliminatedPlayerName ? (
            <>
              <section className="phase-hero">
                <h2>
                  <span className="inline-name">{eliminatedPlayerName}</span> is out.
                </h2>
                {state.lastEliminatedPlayerId === state.round.spyPlayerId ? (
                  <p>
                    And yep, <span className="inline-name">{eliminatedPlayerName}</span> was the spy.
                  </p>
                ) : (
                  <p>Not the spy. Keep the clues coming.</p>
                )}
              </section>
              <div className="summary-grid">
                <article className="summary-card">
                  <span>Out</span>
                  <strong>
                    <span className="inline-name">{eliminatedPlayerName}</span>
                  </strong>
                </article>
              </div>
              <p className="phase-followup">
                {state.lastEliminatedPlayerId === state.round.spyPlayerId ? (
                  <>
                    <span className="inline-name">{eliminatedPlayerName}</span> gets one last shot to guess the common
                    word.
                  </>
                ) : (
                  `Round ${state.round.roundNumber + 1} starts with the remaining players.`
                )}
              </p>
              <div className="button-stack">
                <button
                  className="button button-primary"
                  onClick={() => dispatch({ type: 'continueAfterElimination' })}
                >
                  {state.lastEliminatedPlayerId === state.round.spyPlayerId ? 'Continue' : 'Keep Going'}
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'spyGuessHandoff' && eliminatedPlayerName ? (
            <section className="card-scene">
              <section className="phase-hero phase-hero-lock">
                <h2>
                  Pass it to <span className="inline-name">{eliminatedPlayerName}</span>
                </h2>
                <p>
                  Only <span className="inline-name">{eliminatedPlayerName}</span> gets this last shot.
                </p>
              </section>
              <div className="card-slot">
                <button className="tap-card handoff-card attention-card" onClick={() => dispatch({ type: 'showSpyGuess' })}>
                  <span className="handoff-label">Final guess</span>
                  <strong>
                    <span className="inline-name">{eliminatedPlayerName}</span>
                  </strong>
                  <small>Tap to take the guess</small>
                </button>
              </div>
            </section>
          ) : null}

          {state.screen === 'spyGuess' ? (
            <>
              <section className="phase-hero">
                <h2>Guess the common word</h2>
                <p>You were the spy. Type the word or a known variant. Case does not matter.</p>
              </section>
              <section className="detail-note">
                <span>Private guess</span>
                <strong>Keep this one hidden until you lock it in.</strong>
              </section>
              <label className="field-row">
                <span>Your guess</span>
                <div className="field-control">
                  <input
                    className="input"
                    type="text"
                    value={state.spyGuess}
                    placeholder="Type the word"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) =>
                      dispatch({
                        type: 'setSpyGuess',
                        value: event.target.value,
                      })
                    }
                  />
                </div>
              </label>
              <div className="button-stack">
                <button
                  className="button button-primary"
                  disabled={!state.spyGuess.trim()}
                  onClick={() => dispatch({ type: 'submitSpyGuess' })}
                >
                  Lock In Guess
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'result' && state.round && state.result ? (
            <>
              <section className="phase-hero">
                <h2>{state.result === 'spy' ? 'Spy wins' : 'Crew wins'}</h2>
                <p>{resultNote}</p>
              </section>
              <div className="summary-grid">
                {eliminatedPlayerName ? (
                  <article className="summary-card">
                    <span>Out last</span>
                    <strong>
                      <span className="inline-name">{eliminatedPlayerName}</span>
                    </strong>
                  </article>
                ) : null}
                <article className="summary-card">
                  <span>Spy</span>
                  <strong>
                    <span className="inline-name">{spyPlayerName}</span>
                  </strong>
                </article>
                <article className="summary-card">
                  <span>Common word</span>
                  <strong>{state.round.commonWord}</strong>
                </article>
                <article className="summary-card">
                  <span>Spy word</span>
                  <strong>{state.round.spyWord}</strong>
                </article>
              </div>
              <div className="button-stack">
                <button className="button button-primary" onClick={() => dispatch({ type: 'playAgain' })}>
                  Play Again
                </button>
                <button className="button button-secondary" onClick={() => dispatch({ type: 'goHome' })}>
                  Main Menu
                </button>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
