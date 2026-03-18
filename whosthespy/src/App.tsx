import { useReducer } from 'react';
import {
  createRound,
  eliminatePlayer,
  getActivePlayers,
  getAssignment,
  getVoteOptions,
  incrementRound,
  normalizeForCompare,
  resolveVotes,
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

const initialState: AppState = {
  screen: 'title',
  setup: {
    selectedThemeId: null,
    playerNames: ['', '', ''],
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

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'openPlay':
      return {
        ...state,
        screen: 'themeSelection',
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

      if (state.revealIndex < state.round.players.length - 1) {
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

      const result: GameResult =
        normalizeForCompare(state.spyGuess) === normalizeForCompare(state.round.commonWord)
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
    voterOrder: getActivePlayers(round.players).map((player) => player.id),
    currentVoterIndex: 0,
    votes: {},
    tiedPlayerIds,
  };
}

function getCurrentRevealPlayer(state: AppState) {
  return state.round?.players[state.revealIndex] ?? null;
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

function getScreenLabel(screen: ScreenId) {
  switch (screen) {
    case 'title':
      return 'Title';
    case 'instructions':
      return 'Instructions';
    case 'themeSelection':
      return 'Theme';
    case 'playerEntry':
      return 'Players';
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

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

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
  const eliminatedPlayerName = state.round
    ? getPlayerName(state.round.players, state.lastEliminatedPlayerId)
    : null;

  return (
    <div className="app-shell">
      <div className="phone-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">Who's the Spy?</p>
            <h1>{getScreenLabel(state.screen)}</h1>
          </div>
          {state.round ? (
            <div className="status-stack">
              <span className="status-pill">{state.round.theme.name}</span>
              <span className="status-pill">Round {state.round.roundNumber}</span>
            </div>
          ) : null}
        </header>

        <main className="screen-card">
          {state.notice ? <p className="notice">{state.notice}</p> : null}

          {state.screen === 'title' ? (
            <>
              <section className="hero">
                <p className="hero-kicker">Local multiplayer party game</p>
                <h2>One device. Hidden words. Fast rounds.</h2>
                <p className="hero-copy">
                  Built mobile-first for quick pass-the-device play, with the same clean flow on
                  desktop.
                </p>
              </section>
              <div className="button-stack">
                <button className="button button-primary" onClick={() => dispatch({ type: 'openPlay' })}>
                  Play
                </button>
                <button className="button button-secondary" onClick={() => dispatch({ type: 'openInstructions' })}>
                  Instructions
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'instructions' ? (
            <>
              <section className="section-copy">
                <h2>How to Play</h2>
                <p>Choose a theme, add players, and pass the device so each person can see their word in private.</p>
                <p>The app only shows each player's word, so players figure out whether they might be the spy during the spoken hint round.</p>
                <p>Everyone gives one spoken hint in real life, then each active player votes in private on the same device.</p>
                <p>If the spy is found, they get one final chance to guess the common word and steal the win.</p>
              </section>
              <div className="button-stack">
                <button className="button button-secondary" onClick={() => dispatch({ type: 'goHome' })}>
                  Back
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'themeSelection' ? (
            <>
              <section className="section-copy">
                <h2>Choose a Theme</h2>
                <p>Pick one theme for this round.</p>
              </section>
              <div className="theme-grid">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className={
                      state.setup.selectedThemeId === theme.id
                        ? 'choice-card choice-card-active'
                        : 'choice-card'
                    }
                    onClick={() => dispatch({ type: 'selectTheme', themeId: theme.id })}
                  >
                    <span>{theme.name}</span>
                    <small>{theme.words.length} starter words</small>
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button className="button button-secondary" onClick={() => dispatch({ type: 'goHome' })}>
                  Back
                </button>
                <button className="button button-primary" onClick={() => dispatch({ type: 'continueFromTheme' })}>
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'playerEntry' ? (
            <>
              <section className="section-copy">
                <h2>Add Players</h2>
                <p>
                  {MIN_PLAYERS} to {MAX_PLAYERS} players. Keep the names short so they are easy to scan
                  on mobile.
                </p>
              </section>
              <div className="field-list">
                {state.setup.playerNames.map((playerName, index) => (
                  <label key={`player-field-${index}`} className="field-row">
                    <span>Player {index + 1}</span>
                    <div className="field-control">
                      <input
                        className="input"
                        type="text"
                        value={playerName}
                        placeholder={`Player ${index + 1}`}
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
                          className="icon-button"
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
                <button className="button button-secondary" onClick={() => dispatch({ type: 'addPlayer' })}>
                  Add Player
                </button>
                <button className="button button-primary" onClick={() => dispatch({ type: 'startGame' })}>
                  Start Game
                </button>
                <button className="button button-ghost" onClick={() => dispatch({ type: 'backToTheme' })}>
                  Back
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'revealHandoff' && currentRevealPlayer ? (
            <>
              <section className="section-copy">
                <h2>{currentRevealPlayer.name}</h2>
                <p>Tap to view your word.</p>
              </section>
              <button className="tap-card" onClick={() => dispatch({ type: 'showWord' })}>
                Tap to continue
              </button>
            </>
          ) : null}

          {state.screen === 'revealWord' && currentRevealPlayer && currentAssignment ? (
            <>
              <section className="section-copy">
                <h2>Your word</h2>
                <p>Tap the word to hide it and pass the device.</p>
              </section>
              <button className="word-card" onClick={() => dispatch({ type: 'hideWord' })}>
                {currentAssignment.word}
              </button>
            </>
          ) : null}

          {state.screen === 'hintRound' ? (
            <>
              <section className="section-copy">
                <h2>Hint Round</h2>
                <p>Everyone gives one spoken hint.</p>
                <p>Continue when the group is ready to vote.</p>
              </section>
              <div className="button-stack">
                <button className="button button-primary" onClick={() => dispatch({ type: 'continueToVoting' })}>
                  Continue to Voting
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'voteHandoff' && currentVotingPlayer ? (
            <>
              <section className="section-copy">
                <h2>{currentVotingPlayer.name}</h2>
                <p>Tap to vote.</p>
              </section>
              <button className="tap-card" onClick={() => dispatch({ type: 'showVoteOptions' })}>
                Tap to continue
              </button>
            </>
          ) : null}

          {state.screen === 'vote' && currentVotingPlayer ? (
            <>
              <section className="section-copy">
                <h2>Choose who to eliminate</h2>
                <p>{state.voting?.phase === 'revote' ? 'Revote between tied players only.' : 'Vote in private.'}</p>
              </section>
              <div className="theme-grid">
                {voteOptions.map((player) => (
                  <button
                    key={player.id}
                    className={
                      state.selectedVoteTargetId === player.id
                        ? 'choice-card choice-card-active'
                        : 'choice-card'
                    }
                    onClick={() => dispatch({ type: 'selectVoteTarget', playerId: player.id })}
                  >
                    <span>{player.name}</span>
                  </button>
                ))}
              </div>
              <div className="button-stack">
                <button className="button button-primary" onClick={() => dispatch({ type: 'submitVote' })}>
                  Submit Vote
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'tie' && state.round ? (
            <>
              <section className="section-copy">
                <h2>{state.tieStage === 1 ? 'Tie Vote' : 'No Elimination'}</h2>
                {state.tieStage === 1 ? (
                  <p>Revote between {formatNames(state.round.players, state.tiedPlayerIds)}.</p>
                ) : (
                  <>
                    <p>The revote tied again.</p>
                    <p>Start another hint round.</p>
                  </>
                )}
              </section>
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
              <section className="section-copy">
                <h2>{eliminatedPlayerName} was eliminated</h2>
                {state.lastEliminatedPlayerId === state.round.spyPlayerId ? (
                  <p>{eliminatedPlayerName} was the spy.</p>
                ) : (
                  <p>The game continues.</p>
                )}
              </section>
              <div className="button-stack">
                <button
                  className="button button-primary"
                  onClick={() => dispatch({ type: 'continueAfterElimination' })}
                >
                  {state.lastEliminatedPlayerId === state.round.spyPlayerId ? 'Continue' : 'Next Round'}
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'spyGuessHandoff' && eliminatedPlayerName ? (
            <>
              <section className="section-copy">
                <h2>Pass the device to {eliminatedPlayerName}</h2>
                <p>Tap to enter your guess.</p>
              </section>
              <button className="tap-card" onClick={() => dispatch({ type: 'showSpyGuess' })}>
                Tap to continue
              </button>
            </>
          ) : null}

          {state.screen === 'spyGuess' ? (
            <>
              <section className="section-copy">
                <p className="eyebrow">You were the spy.</p>
                <h2>Guess the common word</h2>
                <p>Use the exact word. Case does not matter.</p>
              </section>
              <label className="field-row">
                <span>Your guess</span>
                <div className="field-control">
                  <input
                    className="input"
                    type="text"
                    value={state.spyGuess}
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
                <button className="button button-primary" onClick={() => dispatch({ type: 'submitSpyGuess' })}>
                  Submit Guess
                </button>
              </div>
            </>
          ) : null}

          {state.screen === 'result' && state.round && state.result ? (
            <>
              <section className="section-copy">
                <h2>{state.result === 'spy' ? 'Spy wins' : 'Non-spies win'}</h2>
                <p>The round is over. Review the final reveal below, then start again.</p>
              </section>
              <div className="summary-grid">
                <article className="summary-card">
                  <span>Spy</span>
                  <strong>{getPlayerName(state.round.players, state.round.spyPlayerId)}</strong>
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
