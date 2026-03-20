import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Assignment,
  type Player,
  type RoundSession,
  type Theme,
} from './types';

export function normalizeInput(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeForCompare(value: string) {
  return normalizeInput(value).toLowerCase();
}

export function normalizeSpyGuess(value: string) {
  return normalizeInput(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SPY_GUESS_ALIASES = new Map(
  Object.entries({
    'united states': ['us', 'usa', 'united states of america', 'america'],
    'south korea': ['korea'],
    'police officer': ['cop'],
    'mail carrier': ['mailman', 'postman'],
    omelet: ['omelette'],
    donut: ['doughnut'],
    soda: ['pop'],
  }).map(([word, aliases]) => [
    normalizeSpyGuess(word),
    new Set(aliases.map((alias) => normalizeSpyGuess(alias))),
  ]),
);

export function isSpyGuessCorrect(guess: string, commonWord: string) {
  const normalizedGuess = normalizeSpyGuess(guess);
  const normalizedCommonWord = normalizeSpyGuess(commonWord);

  if (normalizedGuess === normalizedCommonWord) {
    return true;
  }

  return SPY_GUESS_ALIASES.get(normalizedCommonWord)?.has(normalizedGuess) ?? false;
}

export function validatePlayerNames(playerNames: string[]) {
  const sanitizedNames = playerNames.map(normalizeInput);

  if (sanitizedNames.some((name) => !name)) {
    return { sanitizedNames, error: 'Each player needs a name.' };
  }

  if (sanitizedNames.length < MIN_PLAYERS) {
    return { sanitizedNames, error: `Add at least ${MIN_PLAYERS} players.` };
  }

  if (sanitizedNames.length > MAX_PLAYERS) {
    return { sanitizedNames, error: `You can add up to ${MAX_PLAYERS} players.` };
  }

  const uniqueNames = new Set(sanitizedNames.map(normalizeForCompare));

  if (uniqueNames.size !== sanitizedNames.length) {
    return { sanitizedNames, error: 'Player names must be unique.' };
  }

  return { sanitizedNames, error: null };
}

export function createPlayers(playerNames: string[]) {
  return playerNames.map<Player>((name, index) => ({
    id: `player-${index + 1}`,
    name,
    eliminated: false,
  }));
}

export function createRound(theme: Theme, playerNames: string[], random = Math.random): RoundSession {
  if (theme.words.length < 2) {
    throw new Error('Each theme needs at least two words.');
  }

  const players = createPlayers(playerNames);
  const revealOrder = shuffleItems(players.map((player) => player.id), random);
  const spyPlayer = players[randomIndex(players, random)];
  const [commonWord, spyWord] = pickTwoDistinctWords(theme.words, random);

  const assignments = Object.fromEntries(
    players.map((player) => {
      const assignment: Assignment = {
        playerId: player.id,
        role: player.id === spyPlayer.id ? 'spy' : 'civilian',
        word: player.id === spyPlayer.id ? spyWord : commonWord,
      };

      return [player.id, assignment];
    }),
  );

  return {
    theme,
    players,
    revealOrder,
    assignments,
    spyPlayerId: spyPlayer.id,
    commonWord,
    spyWord,
    roundNumber: 1,
  };
}

export function getActivePlayers(players: Player[]) {
  return players.filter((player) => !player.eliminated);
}

export function getAssignment(round: RoundSession, playerId: string) {
  return round.assignments[playerId];
}

export function getVoteOptions(
  players: Player[],
  voterId: string,
  tiedPlayerIds: string[] = [],
) {
  const allowedIds = tiedPlayerIds.length > 0 ? new Set(tiedPlayerIds) : null;

  return getActivePlayers(players).filter((player) => {
    if (player.id === voterId) {
      return false;
    }

    if (allowedIds && !allowedIds.has(player.id)) {
      return false;
    }

    return true;
  });
}

export function resolveVotes(votes: Record<string, string>) {
  const tallies = Object.values(votes).reduce<Record<string, number>>((map, playerId) => {
    map[playerId] = (map[playerId] ?? 0) + 1;
    return map;
  }, {});

  const highestVoteTotal = Math.max(...Object.values(tallies));
  const highestPlayers = Object.entries(tallies)
    .filter(([, total]) => total === highestVoteTotal)
    .map(([playerId]) => playerId);

  if (highestPlayers.length > 1) {
    return {
      kind: 'tie' as const,
      tiedPlayerIds: highestPlayers,
    };
  }

  return {
    kind: 'elimination' as const,
    eliminatedPlayerId: highestPlayers[0],
  };
}

export function eliminatePlayer(players: Player[], eliminatedPlayerId: string) {
  return players.map((player) =>
    player.id === eliminatedPlayerId
      ? { ...player, eliminated: true }
      : player,
  );
}

export function shouldSpyWinBySurvival(players: Player[], spyPlayerId: string) {
  const activePlayers = getActivePlayers(players);
  const spyStillActive = activePlayers.some((player) => player.id === spyPlayerId);
  return spyStillActive && activePlayers.length <= 2;
}

export function incrementRound(round: RoundSession) {
  return {
    ...round,
    roundNumber: round.roundNumber + 1,
  };
}

export function shuffleItems<T>(items: T[], random = Math.random) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function pickTwoDistinctWords(words: string[], random: () => number) {
  const firstIndex = randomIndex(words, random);
  let secondIndex = randomIndex(words, random);

  while (secondIndex === firstIndex) {
    secondIndex = randomIndex(words, random);
  }

  return [words[firstIndex], words[secondIndex]] as const;
}

function randomIndex<T>(items: T[], random: () => number) {
  return Math.floor(random() * items.length);
}
