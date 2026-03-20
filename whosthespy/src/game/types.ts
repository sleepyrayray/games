export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;

export type ThemeId = 'foods' | 'animals' | 'countries' | 'jobs' | 'household';
export type PlayerRole = 'spy' | 'civilian';
export type VotePhase = 'standard' | 'revote';
export type GameResult = 'spy' | 'non-spies';

export type ScreenId =
  | 'title'
  | 'instructions'
  | 'themeSelection'
  | 'playerEntry'
  | 'revealHandoff'
  | 'revealWord'
  | 'hintRound'
  | 'voteHandoff'
  | 'vote'
  | 'tie'
  | 'elimination'
  | 'spyGuessHandoff'
  | 'spyGuess'
  | 'result';

export interface Theme {
  id: ThemeId;
  name: string;
  words: string[];
}

export interface Player {
  id: string;
  name: string;
  eliminated: boolean;
}

export interface Assignment {
  playerId: string;
  role: PlayerRole;
  word: string;
}

export interface RoundSession {
  theme: Theme;
  players: Player[];
  revealOrder: string[];
  assignments: Record<string, Assignment>;
  spyPlayerId: string;
  commonWord: string;
  spyWord: string;
  roundNumber: number;
}

export interface SetupDraft {
  selectedThemeId: ThemeId | null;
  playerNames: string[];
  themeOrder: ThemeId[];
}

export interface VotingSession {
  phase: VotePhase;
  voterOrder: string[];
  currentVoterIndex: number;
  votes: Record<string, string>;
  tiedPlayerIds: string[];
}

export interface AppState {
  screen: ScreenId;
  setup: SetupDraft;
  round: RoundSession | null;
  revealIndex: number;
  voting: VotingSession | null;
  selectedVoteTargetId: string | null;
  tiedPlayerIds: string[];
  tieStage: 1 | 2 | null;
  lastEliminatedPlayerId: string | null;
  spyGuess: string;
  result: GameResult | null;
  notice: string | null;
}
