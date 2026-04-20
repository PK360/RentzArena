const Game = require('./models/Game');
const User = require('./models/User');
const { randomFriendCode } = require('./utils/helpers');
const { generateDeck, shuffle, dealCards } = require('./utils/cards');
const {
  DEFAULT_RULESET_SELECTIONS,
  RULESETS,
  evaluateRulesetForTrick,
  getAvailableRulesets,
  sanitizeRulesetSelections
} = require('./rulesets');

// In-memory lobby management
const lobbies = new Map(); // roomId -> Set(socketIds)
const activeGames = new Map(); // roomId -> game state
const socketToUser = new Map(); // socketId -> { userId, name }
const pendingLobbyDisconnects = new Map(); // roomId:userId -> timeout
const MIN_PLAYERS_TO_START = 2;
const MAX_ACTIVE_PLAYERS = 6;
const DEFAULT_ROOM_VISIBILITY = 'public';
const ROOM_VISIBILITIES = new Set(['public', 'private']);
const DEFAULT_TURN_TIMER_SECONDS = 15;
const TURN_TIMER_RANGE = { min: 5, max: 60 };
const DISCONNECT_GRACE_MS = 120000;
const SUIT_NAMES = {
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
  S: 'Spades'
};

function serializeRoomSettings(lobby) {
  return {
    availableRulesets: getAvailableRulesets(),
    selectedRulesets: sanitizeRulesetSelections(lobby?.selectedRulesets),
    rulesetPermissions: sanitizeRulesetPermissions(
      lobby?.rulesetPermissions,
      lobby?.players || [],
      lobby?.selectedRulesets
    ),
    nvAllowed: lobby?.nvAllowed ?? true,
    turnTimerSeconds: sanitizeTurnTimerSeconds(lobby?.turnTimerSeconds),
    visibility: sanitizeRoomVisibility(lobby?.visibility),
    roomName: lobby?.roomName || ''
  };
}

function buildCardCounts(game) {
  return game.players.reduce((acc, player) => {
    acc[player.userId] = (game.handsReady[player.userId] || []).length;
    return acc;
  }, {});
}

function buildPointTotals(game) {
  return game.players.reduce((acc, player) => {
    acc[player.userId] = game.pointsByPlayer?.[player.userId] || 0;
    return acc;
  }, {});
}

function buildCollectedHands(game) {
  return game.players.reduce((acc, player) => {
    acc[player.userId] = game.collectedByPlayer[player.userId] || [];
    return acc;
  }, {});
}

function buildStandings(game, pointsByPlayer = game.pointsByPlayer) {
  return game.players
    .map((player) => ({
      userId: player.userId,
      name: player.name,
      points: pointsByPlayer?.[player.userId] || 0,
      tricksWon: (game.collectedByPlayer[player.userId] || []).length,
      cardsLeft: (game.handsReady[player.userId] || []).length
    }))
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      if (right.tricksWon !== left.tricksWon) {
        return right.tricksWon - left.tricksWon;
      }

      return left.name.localeCompare(right.name);
    });
}

function bumpGameStateVersion(game) {
  game.stateVersion = (game.stateVersion || 0) + 1;
  return game.stateVersion;
}

function createLobbyMember(user, socketId, { isReady = false, role = 'player' } = {}) {
  return {
    socketId,
    ...user,
    isReady,
    role,
    isConnected: true
  };
}

function serializeLobby(lobby) {
  return {
    roomId: lobby.roomId,
    roomName: lobby.roomName,
    visibility: sanitizeRoomVisibility(lobby.visibility),
    hostId: lobby.hostId,
    players: lobby.players,
    spectators: lobby.spectators,
    rulesetId: lobby.rulesetId,
    roomSettings: serializeRoomSettings(lobby),
    status: lobby.status
  };
}

function emitLobbyUpdate(io, roomId, lobby, message) {
  io.to(roomId).emit('lobby_update', {
    ...serializeLobby(lobby),
    ...(message ? { message } : {})
  });
}

function getAllLobbyMembers(lobby) {
  return [...lobby.players, ...lobby.spectators];
}

function getLobbyDisconnectKey(roomId, userId) {
  return `${roomId}:${userId}`;
}

function clearPendingLobbyDisconnect(roomId, userId) {
  const key = getLobbyDisconnectKey(roomId, userId);
  const timeoutId = pendingLobbyDisconnects.get(key);
  if (timeoutId) {
    clearTimeout(timeoutId);
    pendingLobbyDisconnects.delete(key);
  }
}

function clearLobbyDisconnects(roomId, lobby) {
  getAllLobbyMembers(lobby).forEach((member) => {
    clearPendingLobbyDisconnect(roomId, member.userId);
  });
}

function getNextHostId(lobby) {
  return lobby.players[0]?.userId || lobby.spectators[0]?.userId || null;
}

function sanitizeRoomVisibility(visibility) {
  return ROOM_VISIBILITIES.has(visibility) ? visibility : DEFAULT_ROOM_VISIBILITY;
}

function sanitizeTurnTimerSeconds(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return DEFAULT_TURN_TIMER_SECONDS;
  }

  return Math.min(TURN_TIMER_RANGE.max, Math.max(TURN_TIMER_RANGE.min, Math.round(numberValue)));
}

function getUserDisplayName(user) {
  return user?.displayName || user?.name || 'Player';
}

function getDefaultRoomName(user) {
  return `${getUserDisplayName(user)}'s Room`;
}

function sanitizeRoomName(roomName, user) {
  const trimmedName = String(roomName || '').trim();
  return trimmedName || getDefaultRoomName(user);
}

function getAvatarSource(member) {
  return (
    member?.avatarUrl ||
    member?.avatar ||
    member?.profileImageUrl ||
    member?.profileImage ||
    member?.image ||
    null
  );
}

function createDefaultPermissionsForPlayer() {
  return Object.keys(DEFAULT_RULESET_SELECTIONS).reduce((acc, ruleId) => {
    acc[ruleId] = true;
    return acc;
  }, {});
}

function sanitizeRulesetPermissions(nextPermissions = {}, players = [], selectedRulesets = DEFAULT_RULESET_SELECTIONS) {
  const sanitizedSelections = sanitizeRulesetSelections(selectedRulesets);

  return players.reduce((acc, player) => {
    const playerPermissions = nextPermissions?.[player.userId] || {};

    acc[player.userId] = Object.keys(DEFAULT_RULESET_SELECTIONS).reduce((ruleAcc, ruleId) => {
      ruleAcc[ruleId] = typeof playerPermissions[ruleId] === 'boolean'
        ? playerPermissions[ruleId]
        : true;
      if (!sanitizedSelections[ruleId]) {
        ruleAcc[ruleId] = false;
      }
      return ruleAcc;
    }, {});

    return acc;
  }, {});
}

function ensureRulesetPermissionsForPlayers(lobby) {
  lobby.rulesetPermissions = sanitizeRulesetPermissions(
    lobby.rulesetPermissions,
    lobby.players,
    lobby.selectedRulesets
  );
}

function getMemberByUserId(lobby, userId) {
  return getAllLobbyMembers(lobby).find((member) => member.userId === userId) || null;
}

function getLobbyMemberRole(lobby, userId) {
  if (lobby.players.some((member) => member.userId === userId)) {
    return 'player';
  }

  if (lobby.spectators.some((member) => member.userId === userId)) {
    return 'spectator';
  }

  return null;
}

function updateLobbyMemberSocket(lobby, user, socketId) {
  const member = getMemberByUserId(lobby, user.userId);
  if (!member) {
    return null;
  }

  member.socketId = socketId;
  member.name = user.name || member.name;
  member.displayName = user.displayName || member.displayName;
  member.isConnected = true;
  return member;
}

function findCurrentRoomForUser(user) {
  if (!user?.userId) {
    return null;
  }

  for (const [roomId, lobby] of lobbies.entries()) {
    if (getAllLobbyMembers(lobby).some((member) => member.userId === user.userId)) {
      return { roomId, source: 'lobby', room: lobby };
    }
  }

  for (const [roomId, game] of activeGames.entries()) {
    if (game.players.some((player) => player.userId === user.userId)) {
      return { roomId, source: 'game', room: game };
    }
  }

  return null;
}

function buildPublicRoomSummary(roomId, lobby, viewer = null) {
  const members = getAllLobbyMembers(lobby);
  const viewerFriends = new Set(
    Array.isArray(viewer?.friends)
      ? viewer.friends.map((friend) => (typeof friend === 'object' ? friend.userId || friend._id || friend.id : friend)).filter(Boolean)
      : []
  );

  return {
    roomId,
    roomName: lobby.roomName,
    visibility: sanitizeRoomVisibility(lobby.visibility),
    playerCount: lobby.players.length,
    spectatorCount: lobby.spectators.length,
    maxPlayers: MAX_ACTIVE_PLAYERS,
    avatars: members.slice(0, MAX_ACTIVE_PLAYERS).map((member) => ({
      userId: member.userId,
      name: getUserDisplayName(member),
      avatarUrl: getAvatarSource(member)
    })),
    hasFriend: members.some((member) => viewerFriends.has(member.userId)),
    status: lobby.status
  };
}

function listPublicRoomsForUser(user) {
  return [...lobbies.entries()]
    .filter(([, lobby]) => lobby.status === 'waiting' && sanitizeRoomVisibility(lobby.visibility) === 'public')
    .filter(([, lobby]) => !lobby.bannedUserIds?.includes(user?.userId))
    .map(([roomId, lobby]) => buildPublicRoomSummary(roomId, lobby, user));
}

function addMemberToLobby(lobby, user, socketId, { isReady = false } = {}) {
  const shouldSpectate = lobby.players.length >= MAX_ACTIVE_PLAYERS;
  const role = shouldSpectate ? 'spectator' : 'player';
  const member = createLobbyMember(user, socketId, {
    isReady: role === 'player' ? isReady : false,
    role
  });

  if (role === 'player') {
    lobby.players.push(member);
    lobby.rulesetPermissions[member.userId] = createDefaultPermissionsForPlayer();
    ensureRulesetPermissionsForPlayers(lobby);
  } else {
    lobby.spectators.push(member);
  }

  return {
    assignedRole: role,
    autoSpectator: shouldSpectate
  };
}

function setLobbyMemberRole(lobby, socketId, nextRole) {
  lobby.rulesetPermissions = lobby.rulesetPermissions || {};

  if (!['player', 'spectator'].includes(nextRole)) {
    return { error: 'Invalid lobby role' };
  }

  const playerIndex = lobby.players.findIndex((player) => player.socketId === socketId);
  const spectatorIndex = lobby.spectators.findIndex((spectator) => spectator.socketId === socketId);

  if (playerIndex === -1 && spectatorIndex === -1) {
    return { error: 'You are not in this lobby' };
  }

  if (nextRole === 'player') {
    if (playerIndex !== -1) {
      return { assignedRole: 'player', changed: false };
    }

    if (lobby.players.length >= MAX_ACTIVE_PLAYERS) {
      return { error: `All ${MAX_ACTIVE_PLAYERS} player seats are taken. You can spectate for now.` };
    }

    const [member] = lobby.spectators.splice(spectatorIndex, 1);
    lobby.players.push({
      ...member,
      isReady: false,
      role: 'player'
    });
    lobby.rulesetPermissions[member.userId] = createDefaultPermissionsForPlayer();
    ensureRulesetPermissionsForPlayers(lobby);

    return { assignedRole: 'player', changed: true };
  }

  if (spectatorIndex !== -1) {
    return { assignedRole: 'spectator', changed: false };
  }

  const [member] = lobby.players.splice(playerIndex, 1);
  delete lobby.rulesetPermissions[member.userId];
  lobby.spectators.push({
    ...member,
    isReady: false,
    role: 'spectator'
  });

  return { assignedRole: 'spectator', changed: true };
}

function getStartGameValidationError(lobby, user) {
  if (!lobby) {
    return 'Lobby not found';
  }

  if (!user) {
    return 'Not authenticated';
  }

  if (lobby.hostId !== user.userId) {
    return 'Only host can start the game';
  }

  if (lobby.players.length > MAX_ACTIVE_PLAYERS) {
    return `A lobby can have at most ${MAX_ACTIVE_PLAYERS} active players`;
  }

  if (lobby.players.length < MIN_PLAYERS_TO_START) {
    return `At least ${MIN_PLAYERS_TO_START} players are required to start the game`;
  }

  const allReady = lobby.players.every((player) => player.isReady);
  if (!allReady) {
    return 'Not all players are ready';
  }

  const selectedRulesets = sanitizeRulesetSelections(lobby.selectedRulesets);
  const hasSelectedRuleset = Object.values(selectedRulesets).some(Boolean);
  if (!hasSelectedRuleset) {
    return 'At least one ruleset must be enabled';
  }

  const permissions = sanitizeRulesetPermissions(lobby.rulesetPermissions, lobby.players, selectedRulesets);
  const hasAllowedChoice = lobby.players.some((player) => (
    Object.entries(permissions[player.userId] || {}).some(([ruleId, allowed]) => selectedRulesets[ruleId] && allowed)
  ));
  if (!hasAllowedChoice) {
    return 'At least one player must be allowed to choose an enabled ruleset';
  }

  return null;
}

function getEligibleRuleIdsForPlayer(game, playerId) {
  const selections = sanitizeRulesetSelections(game.selectedRulesets);
  const playerPermissions = game.rulesetPermissions?.[playerId] || {};
  const usedByPlayer = game.usedChoices?.[playerId] || {};

  return Object.keys(selections).filter((ruleId) => (
    selections[ruleId] &&
    RULESETS[ruleId] &&
    playerPermissions[ruleId] !== false &&
    !usedByPlayer[ruleId]
  ));
}

function hasRemainingChoices(game) {
  return game.chooserOrder.some((playerId) => getEligibleRuleIdsForPlayer(game, playerId).length > 0);
}

function findNextChooser(game, startCursor = game.chooserCursor) {
  if (!game.chooserOrder.length) {
    return null;
  }

  for (let offset = 0; offset < game.chooserOrder.length; offset += 1) {
    const cursor = (startCursor + offset) % game.chooserOrder.length;
    const playerId = game.chooserOrder[cursor];
    if (getEligibleRuleIdsForPlayer(game, playerId).length > 0) {
      return { cursor, playerId };
    }
  }

  return null;
}

function serializeChoiceState(game) {
  if (!game) {
    return null;
  }

  return {
    phase: game.phase,
    chooserId: game.chooserId || null,
    chooserOrder: game.chooserOrder || [],
    chooserCursor: game.chooserCursor || 0,
    nvAllowed: Boolean(game.nvAllowed),
    nvSelected: Boolean(game.nvSelected),
    activeRulesetId: game.activeRulesetId || null,
    usedChoices: game.usedChoices || {},
    selectedRulesets: sanitizeRulesetSelections(game.selectedRulesets),
    rulesetPermissions: game.rulesetPermissions || {},
    timerDeadline: game.timerDeadline || null,
    availableRulesets: getAvailableRulesets()
  };
}

function buildGameSessionSnapshot(roomId, game, userId, { isSpectator = false } = {}) {
  const playerIndex = isSpectator
    ? -1
    : game.players.findIndex((player) => player.userId === userId);
  const effectivePlayer = playerIndex >= 0 ? game.players[playerIndex] : null;
  const gameFinished = game.status === 'finished' || game.phase === 'finished';

  return {
    roomId,
    hand: effectivePlayer ? (game.handsReady[effectivePlayer.userId] || []) : [],
    playerIndex,
    isSpectator,
    gameStarted: true,
    gameFinished,
    trickPending: Boolean(game.trickPending),
    currentTrick: game.currentTrick || [],
    turnIndex: game.turnIndex || 0,
    trickSuit: game.trickSuit || null,
    stateVersion: game.stateVersion || 0,
    cardCounts: buildCardCounts(game),
    playerPoints: buildPointTotals(game),
    collectedHandsByPlayer: buildCollectedHands(game),
    choiceState: serializeChoiceState(game),
    latestRoundStats: game.lastRoundStats || null,
    matchComplete: gameFinished || (game.phase === 'round_stats' && !hasRemainingChoices(game)),
    standings: buildStandings(game),
    startingHandSize: game.startingHandSize || 0
  };
}

function restoreUserSession(io, socket, user) {
  const currentRoom = findCurrentRoomForUser(user);
  if (!currentRoom) {
    return null;
  }

  const { roomId, room: lobby } = currentRoom;
  const role = getLobbyMemberRole(lobby, user.userId);
  const member = updateLobbyMemberSocket(lobby, user, socket.id);
  if (!member || !role) {
    return null;
  }

  clearPendingLobbyDisconnect(roomId, user.userId);
  socket.join(roomId);

  const game = activeGames.get(roomId);
  if (game) {
    const gamePlayer = game.players.find((player) => player.userId === user.userId);
    if (gamePlayer) {
      gamePlayer.socketId = socket.id;
      gamePlayer.name = getUserDisplayName(user);
      gamePlayer.isConnected = true;
    }
  }

  emitLobbyUpdate(io, roomId, lobby);

  return {
    roomId,
    assignedRole: role,
    lobby: serializeLobby(lobby),
    game: game
      ? buildGameSessionSnapshot(roomId, game, user.userId, { isSpectator: role === 'spectator' })
      : null
  };
}

function emitChoiceState(io, roomId, game, extra = {}) {
  io.to(roomId).emit('choice_state_update', {
    choiceState: serializeChoiceState(game),
    stateVersion: bumpGameStateVersion(game),
    ...extra
  });
}

function clearGameTimer(game) {
  if (game?.timerId) {
    clearTimeout(game.timerId);
    game.timerId = null;
  }
  if (game) {
    game.timerDeadline = null;
  }
}

function scheduleGameTimer(io, roomId, game, callback) {
  clearGameTimer(game);

  const timerMs = sanitizeTurnTimerSeconds(game.turnTimerSeconds) * 1000;
  game.timerDeadline = Date.now() + timerMs;
  game.timerId = setTimeout(() => {
    game.timerId = null;
    game.timerDeadline = null;
    callback();
  }, timerMs);
  game.timerId.unref?.();
}

function emitHands(io, roomId, game) {
  game.players.forEach((player) => {
    io.to(player.socketId).emit('hand_update', game.handsReady[player.userId] || []);
  });

  const lobby = lobbies.get(roomId);
  lobby?.spectators.forEach((spectator) => {
    io.to(spectator.socketId).emit('hand_update', []);
  });
}

function dealNewRoundCards(io, roomId, game) {
  const unShuffledDeck = generateDeck(game.players.length);
  const shuffledDeck = shuffle([...unShuffledDeck]);
  const playerIds = game.players.map((player) => player.userId);
  const hands = dealCards(shuffledDeck, playerIds);

  game.handsReady = hands;
  game.startingHandSize = hands[playerIds[0]]?.length || 0;
  game.currentTrick = [];
  game.trickSuit = null;
  game.trickPending = false;
  game.collectedHands = [];
  game.collectedByPlayer = playerIds.reduce((acc, playerId) => {
    acc[playerId] = [];
    return acc;
  }, {});

  emitHands(io, roomId, game);
}

function buildInitialPoints(players) {
  return players.reduce((acc, player) => {
    acc[player.userId] = 0;
    return acc;
  }, {});
}

function buildRankMap(standings) {
  return standings.reduce((acc, standing, index) => {
    acc[standing.userId] = index + 1;
    return acc;
  }, {});
}

function createRoundStats(game) {
  const ruleset = RULESETS[game.activeRulesetId];
  const previousPoints = { ...game.pointsByPlayer };

  game.roundStats = {
    roundId: `${game.roomId}-${game.roundNumber}`,
    roundNumber: game.roundNumber,
    startedAt: Date.now(),
    rulesetId: ruleset.id,
    rulesetLabel: ruleset.label,
    rulesetAbbreviation: ruleset.abbreviation,
    nv: Boolean(game.nvSelected),
    chooserId: game.chooserId,
    chooserName: game.players.find((player) => player.userId === game.chooserId)?.name || 'Player',
    previousPoints,
    previousRanks: buildRankMap(buildStandings(game, previousPoints)),
    tricks: []
  };
}

function finalizeRoundStats(game) {
  const stats = game.roundStats || {};
  const nextPoints = { ...game.pointsByPlayer };

  return {
    ...stats,
    durationMs: Date.now() - (stats.startedAt || Date.now()),
    scoreDeltas: game.players.reduce((acc, player) => {
      acc[player.userId] = (nextPoints[player.userId] || 0) - (stats.previousPoints?.[player.userId] || 0);
      return acc;
    }, {}),
    previousRanks: stats.previousRanks || {},
    nextRanks: buildRankMap(buildStandings(game, nextPoints)),
    nextPoints,
    tricks: stats.tricks || []
  };
}

function applyActiveRulesetToTrick({ game, playerId, handCards }) {
  if (!game.activeRulesetId || !RULESETS[game.activeRulesetId]) {
    return { gameEnded: false, scoreDelta: 0 };
  }

  const previousPoints = game.pointsByPlayer[playerId] || 0;
  const nonDiscardedCards = game.players.flatMap((player) => game.handsReady[player.userId] || []);
  const result = evaluateRulesetForTrick({
    rulesetId: game.activeRulesetId,
    playerCount: game.players.length,
    initialPoints: previousPoints,
    handCards,
    nonDiscardedCards
  });
  const multiplier = game.nvSelected ? 2 : 1;
  const scoreDelta = result.delta * multiplier;

  game.pointsByPlayer[playerId] = previousPoints + scoreDelta;
  return {
    gameEnded: Boolean(result.gameEnded),
    scoreDelta,
    rawDelta: result.delta,
    componentDeltas: result.componentDeltas || null
  };
}

function getLegalCardsForPlayer(game, playerId) {
  const hand = game.handsReady[playerId] || [];
  if (!game.trickSuit || game.currentTrick.length === 0) {
    return hand;
  }

  const matchingSuit = hand.filter((card) => card.split('-')[1] === game.trickSuit);
  return matchingSuit.length > 0 ? matchingSuit : hand;
}

function chooseFirstAvailableRule(game) {
  const eligible = getEligibleRuleIdsForPlayer(game, game.chooserId);
  return eligible[0] || null;
}

function finishBigGame(io, roomId, game) {
  clearGameTimer(game);
  game.status = 'finished';
  game.phase = 'finished';

  const standings = buildStandings(game);
  const gameFinishedVersion = bumpGameStateVersion(game);

  io.to(roomId).emit('game_finished', {
    winnerId: standings[0]?.userId || null,
    winnerName: standings[0]?.name || 'No winner',
    stateVersion: gameFinishedVersion,
    standings,
    playerPoints: buildPointTotals(game),
    collectedHandsByPlayer: buildCollectedHands(game),
    cardCounts: buildCardCounts(game),
    choiceState: serializeChoiceState(game)
  });
}

function startRulesetSelection(io, roomId, game, { dealFirst = false } = {}) {
  if (dealFirst) {
    dealNewRoundCards(io, roomId, game);
  }

  game.phase = 'choosing_ruleset';
  clearGameTimer(game);

  emitChoiceState(io, roomId, game, {
    cardCounts: buildCardCounts(game),
    playerPoints: buildPointTotals(game)
  });
}

function beginChooserTurn(io, roomId, game) {
  const nextChooser = findNextChooser(game, game.chooserCursor);
  if (!nextChooser) {
    finishBigGame(io, roomId, game);
    return false;
  }

  game.chooserCursor = nextChooser.cursor;
  game.chooserId = nextChooser.playerId;
  game.activeRulesetId = null;
  game.nvSelected = false;
  game.currentTrick = [];
  game.trickSuit = null;
  game.trickPending = false;
  game.handsReady = game.players.reduce((acc, player) => {
    acc[player.userId] = [];
    return acc;
  }, {});
  game.collectedHands = [];
  game.collectedByPlayer = game.players.reduce((acc, player) => {
    acc[player.userId] = [];
    return acc;
  }, {});

  if (game.nvAllowed) {
    game.phase = 'choosing_nv';
    clearGameTimer(game);
    emitChoiceState(io, roomId, game, {
      cardCounts: buildCardCounts(game),
      playerPoints: buildPointTotals(game)
    });
    return true;
  }

  game.nvSelected = false;
  startRulesetSelection(io, roomId, game, { dealFirst: true });
  return true;
}

function setNvChoiceForRound(io, roomId, game, playerId, nvSelected) {
  if (!game || game.phase !== 'choosing_nv') {
    return { error: 'NV choice is not active' };
  }

  if (playerId !== game.chooserId) {
    return { error: 'Only the choosing player can pick NV' };
  }

  clearGameTimer(game);
  game.nvSelected = Boolean(nvSelected);
  startRulesetSelection(io, roomId, game, { dealFirst: !game.nvSelected });
  return { success: true };
}

function selectRulesetForRound(io, roomId, game, playerId, rulesetId) {
  if (!game || game.phase !== 'choosing_ruleset') {
    return { error: 'Ruleset choice is not active' };
  }

  if (playerId !== game.chooserId) {
    return { error: 'Only the choosing player can choose the game' };
  }

  if (!getEligibleRuleIdsForPlayer(game, playerId).includes(rulesetId)) {
    return { error: 'That game is not available for this player' };
  }

  clearGameTimer(game);

  if (game.nvSelected && game.players.every((player) => (game.handsReady[player.userId] || []).length === 0)) {
    dealNewRoundCards(io, roomId, game);
  }

  game.usedChoices[playerId] = {
    ...(game.usedChoices[playerId] || {}),
    [rulesetId]: true
  };
  game.activeRulesetId = rulesetId;
  game.phase = 'playing_round';
  game.turnIndex = Math.max(0, game.players.findIndex((player) => player.userId === playerId));
  game.roundNumber += 1;
  createRoundStats(game);

  scheduleGameTimer(io, roomId, game, () => {
    const currentPlayer = game.players[game.turnIndex];
    const fallbackCard = getLegalCardsForPlayer(game, currentPlayer?.userId)[0];
    if (currentPlayer && fallbackCard) {
      playCardForPlayer(io, roomId, currentPlayer.userId, fallbackCard, { auto: true });
    }
  });

  const stateVersion = bumpGameStateVersion(game);
  io.to(roomId).emit('small_game_started', {
    message: `${game.roundStats.chooserName} has chosen ${RULESETS[rulesetId].label}${game.nvSelected ? ' (NV)!' : ''}`,
    choiceState: serializeChoiceState(game),
    currentTrick: game.currentTrick,
    turnIndex: game.turnIndex,
    trickSuit: game.trickSuit,
    stateVersion,
    cardCounts: buildCardCounts(game),
    playerPoints: buildPointTotals(game),
    collectedHandsByPlayer: buildCollectedHands(game),
    roundNumber: game.roundNumber
  });

  return { success: true };
}

function finishSmallGameRound(io, roomId, game) {
  clearGameTimer(game);
  game.phase = 'round_stats';
  const roundStats = finalizeRoundStats(game);
  game.lastRoundStats = roundStats;

  const matchComplete = !hasRemainingChoices(game);
  const stateVersion = bumpGameStateVersion(game);

  io.to(roomId).emit('round_finished', {
    roundStats,
    matchComplete,
    stateVersion,
    choiceState: serializeChoiceState(game),
    standings: buildStandings(game),
    playerPoints: buildPointTotals(game),
    collectedHandsByPlayer: buildCollectedHands(game),
    cardCounts: buildCardCounts(game)
  });

  if (matchComplete) {
    finishBigGame(io, roomId, game);
  }
}

function continueAfterRound(io, roomId, game) {
  if (!game || game.phase !== 'round_stats') {
    return { error: 'No round stats are waiting' };
  }

  game.chooserCursor = (game.chooserCursor + 1) % Math.max(game.chooserOrder.length, 1);
  return beginChooserTurn(io, roomId, game)
    ? { success: true }
    : { error: 'No available games remain' };
}

function removeMemberFromLobby(io, roomId, lobby, targetUserId, reason = 'Removed from room') {
  const playerIndex = lobby.players.findIndex((player) => player.userId === targetUserId);
  const spectatorIndex = lobby.spectators.findIndex((spectator) => spectator.userId === targetUserId);
  const collection = playerIndex !== -1 ? lobby.players : lobby.spectators;
  const index = playerIndex !== -1 ? playerIndex : spectatorIndex;

  if (index === -1) {
    return null;
  }

  const [member] = collection.splice(index, 1);
  clearPendingLobbyDisconnect(roomId, member.userId);
  delete lobby.rulesetPermissions[member.userId];
  io.to(member.socketId).emit('lobby_removed', { roomId, reason });
  io.sockets.sockets.get(member.socketId)?.leave(roomId);

  if (lobby.hostId === member.userId) {
    lobby.hostId = getNextHostId(lobby);
  }

  ensureRulesetPermissionsForPlayers(lobby);
  return member;
}

function abandonUserSession(io, socket, user) {
  const currentRoom = findCurrentRoomForUser(user);
  if (!currentRoom) {
    return { success: true };
  }

  const { roomId, room: lobby } = currentRoom;
  const member = getMemberByUserId(lobby, user.userId);
  clearPendingLobbyDisconnect(roomId, user.userId);
  socket.leave(roomId);

  if (!member) {
    return { success: true };
  }

  if (lobby.status !== 'waiting') {
    member.isConnected = false;
    const game = activeGames.get(roomId);
    const gamePlayer = game?.players.find((player) => player.userId === user.userId);
    if (gamePlayer) {
      gamePlayer.isConnected = false;
    }
    return { success: true };
  }

  const playerIndex = lobby.players.findIndex((player) => player.userId === user.userId);
  const spectatorIndex = lobby.spectators.findIndex((spectator) => spectator.userId === user.userId);

  if (playerIndex !== -1) {
    const [removed] = lobby.players.splice(playerIndex, 1);
    delete lobby.rulesetPermissions[removed.userId];
  } else if (spectatorIndex !== -1) {
    lobby.spectators.splice(spectatorIndex, 1);
  }

  if (getAllLobbyMembers(lobby).length === 0) {
    lobbies.delete(roomId);
    return { success: true };
  }

  if (lobby.hostId === user.userId) {
    lobby.hostId = getNextHostId(lobby);
  }

  ensureRulesetPermissionsForPlayers(lobby);
  emitLobbyUpdate(io, roomId, lobby, 'A player left');
  return { success: true };
}

function scheduleWaitingLobbyDisconnectCleanup(io, roomId, lobby, member, disconnectedSocketId) {
  clearPendingLobbyDisconnect(roomId, member.userId);
  member.isConnected = false;

  const timeoutId = setTimeout(() => {
    pendingLobbyDisconnects.delete(getLobbyDisconnectKey(roomId, member.userId));

    const currentLobby = lobbies.get(roomId);
    if (!currentLobby || currentLobby.status !== 'waiting') {
      return;
    }

    const currentMember = getMemberByUserId(currentLobby, member.userId);
    if (!currentMember || currentMember.socketId !== disconnectedSocketId || currentMember.isConnected) {
      return;
    }

    const playerIndex = currentLobby.players.findIndex((player) => player.userId === member.userId);
    const spectatorIndex = currentLobby.spectators.findIndex((spectator) => spectator.userId === member.userId);

    if (playerIndex !== -1) {
      const [removed] = currentLobby.players.splice(playerIndex, 1);
      delete currentLobby.rulesetPermissions[removed.userId];
    } else if (spectatorIndex !== -1) {
      currentLobby.spectators.splice(spectatorIndex, 1);
    }

    if (getAllLobbyMembers(currentLobby).length === 0) {
      lobbies.delete(roomId);
      return;
    }

    if (currentLobby.hostId === member.userId) {
      currentLobby.hostId = getNextHostId(currentLobby);
    }

    ensureRulesetPermissionsForPlayers(currentLobby);
    emitLobbyUpdate(io, roomId, currentLobby, 'A player left');
  }, DISCONNECT_GRACE_MS);

  timeoutId.unref?.();
  pendingLobbyDisconnects.set(getLobbyDisconnectKey(roomId, member.userId), timeoutId);
}

function playCardForPlayer(io, roomId, playerId, card, { auto = false } = {}) {
  const game = activeGames.get(roomId);
  if (!game) {
    return { error: 'Game not found' };
  }

  if (game.phase !== 'playing_round') {
    return { error: 'Cards cannot be played right now' };
  }

  if (game.trickPending) {
    return { error: 'A trick is resolving' };
  }

  const pIndex = game.players.findIndex((player) => player.userId === playerId);
  if (pIndex === -1) {
    return { error: 'Spectators cannot play cards' };
  }

  if (pIndex !== game.turnIndex) {
    return { error: 'It is not your turn!' };
  }

  const hand = game.handsReady[playerId];
  if (!hand || !hand.includes(card)) {
    return { error: 'That card is not in your hand' };
  }

  if (game.currentTrick.length === 0) {
    const [, suit] = card.split('-');
    game.trickSuit = suit;
  } else {
    const [, playSuit] = card.split('-');
    if (playSuit !== game.trickSuit) {
      const hasSuit = hand.some((handCard) => handCard.split('-')[1] === game.trickSuit);
      if (hasSuit) {
        return { error: `You must play a card of suit ${SUIT_NAMES[game.trickSuit] || game.trickSuit}` };
      }
    }
  }

  clearGameTimer(game);

  const player = game.players[pIndex];
  game.handsReady[playerId] = hand.filter((entry) => entry !== card);
  game.currentTrick.push({
    playedBy: player.userId,
    playerName: player.name,
    card,
    auto
  });

  game.turnIndex = (game.turnIndex + 1) % game.players.length;
  const trickComplete = game.currentTrick.length === game.players.length;
  if (!trickComplete) {
    scheduleGameTimer(io, roomId, game, () => {
      const currentPlayer = game.players[game.turnIndex];
      const fallbackCard = getLegalCardsForPlayer(game, currentPlayer?.userId)[0];
      if (currentPlayer && fallbackCard) {
        playCardForPlayer(io, roomId, currentPlayer.userId, fallbackCard, { auto: true });
      }
    });
  }

  const gameUpdateVersion = bumpGameStateVersion(game);

  io.to(roomId).emit('game_update', {
    currentTrick: game.currentTrick,
    turnIndex: game.turnIndex,
    trickSuit: game.trickSuit,
    stateVersion: gameUpdateVersion,
    cardCounts: buildCardCounts(game),
    choiceState: serializeChoiceState(game),
    timerDeadline: game.timerDeadline
  });

  io.to(player.socketId).emit('hand_update', game.handsReady[playerId]);

  if (!trickComplete) {
    return { success: true };
  }

  game.trickPending = true;
  const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  let winnerIndex = 0;
  let highestRank = -1;

  game.currentTrick.forEach((play, index) => {
    const [val, suit] = play.card.split('-');
    if (suit === game.trickSuit) {
      const rank = VALUES.indexOf(val);
      if (rank > highestRank) {
        highestRank = rank;
        winnerIndex = index;
      }
    }
  });

  const winningPlay = game.currentTrick[winnerIndex];
  game.collectedHands.push(game.currentTrick);
  game.collectedByPlayer[winningPlay.playedBy].push([...game.currentTrick]);
  const collectedHandCards = game.currentTrick.map((play) => play.card);
  const ruleResolution = applyActiveRulesetToTrick({
    game,
    playerId: winningPlay.playedBy,
    handCards: collectedHandCards
  });

  game.roundStats?.tricks.push({
    index: game.collectedHands.length,
    cards: [...game.currentTrick],
    takenBy: winningPlay.playedBy,
    takenByName: winningPlay.playerName,
    scoreDelta: ruleResolution.scoreDelta,
    rawDelta: ruleResolution.rawDelta,
    componentDeltas: ruleResolution.componentDeltas
  });

  game.turnIndex = game.players.findIndex((entry) => entry.userId === winningPlay.playedBy);
  const trickWonVersion = bumpGameStateVersion(game);

  io.to(roomId).emit('trick_won', {
    winnerName: winningPlay.playerName,
    winnerId: winningPlay.playedBy,
    trickSuit: game.trickSuit,
    scoreDelta: ruleResolution.scoreDelta,
    stateVersion: trickWonVersion,
    playerPoints: buildPointTotals(game),
    collectedHandsByPlayer: buildCollectedHands(game),
    cardCounts: buildCardCounts(game),
    choiceState: serializeChoiceState(game)
  });

  setTimeout(() => {
    game.currentTrick = [];
    game.trickSuit = null;
    game.trickPending = false;
    const allHandsEmpty = game.players.every(
      (entry) => (game.handsReady[entry.userId] || []).length === 0
    );
    const gameShouldFinish = allHandsEmpty || ruleResolution.gameEnded;

    if (!gameShouldFinish) {
      scheduleGameTimer(io, roomId, game, () => {
        const currentPlayer = game.players[game.turnIndex];
        const fallbackCard = getLegalCardsForPlayer(game, currentPlayer?.userId)[0];
        if (currentPlayer && fallbackCard) {
          playCardForPlayer(io, roomId, currentPlayer.userId, fallbackCard, { auto: true });
        }
      });
    }

    const trickEndVersion = bumpGameStateVersion(game);

    io.to(roomId).emit('trick_end', {
      nextTurnIndex: game.turnIndex,
      collectedHandsCount: game.collectedHands.length,
      trickSuit: null,
      stateVersion: trickEndVersion,
      playerPoints: buildPointTotals(game),
      collectedHandsByPlayer: buildCollectedHands(game),
      cardCounts: buildCardCounts(game),
      gameFinished: gameShouldFinish,
      choiceState: serializeChoiceState(game)
    });

    if (gameShouldFinish) {
      finishSmallGameRound(io, roomId, game);
      return;
    }
  }, 1500);

  return { success: true };
}

function attachSocketManager(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Basic authentication simulation for socket (in final, verify JWT or magic link)
    socket.on('authenticate', (userData) => {
      if (!userData?.userId) {
        return;
      }

      socketToUser.set(socket.id, userData);
      console.log(
        `Socket ${socket.id} authenticated as ${userData.displayName || userData.name}`
      );
    });

    socket.on('restore_session', (_payload = {}, callback = () => {}) => {
      const user = socketToUser.get(socket.id);
      if (!user) {
        return callback({ success: false, error: 'Not authenticated' });
      }

      const restoredSession = restoreUserSession(io, socket, user);
      if (!restoredSession) {
        return callback({ success: true, restoredRoom: false });
      }

      callback({ success: true, restoredRoom: true, ...restoredSession });
    });

    socket.on('abandon_session', (_payload = {}, callback = () => {}) => {
      const user = socketToUser.get(socket.id);
      if (!user) {
        return callback({ success: true });
      }

      callback(abandonUserSession(io, socket, user));
    });

    // 1. Create a Lobby
    socket.on('create_lobby', async ({ rulesetId, roomName, visibility } = {}, callback = () => {}) => {
      const user = socketToUser.get(socket.id);
      if (!user) return callback({ error: 'Not authenticated' });

      const currentRoom = findCurrentRoomForUser(user);
      if (currentRoom) {
        return callback({ error: 'Leave your current room before creating another one' });
      }

      // Generate a short 6-letter room code
      const roomId = randomFriendCode();
      const selectedRulesets = { ...DEFAULT_RULESET_SELECTIONS };
      const hostMember = createLobbyMember(user, socket.id, { isReady: true, role: 'player' });
      const lobby = {
        roomId,
        roomName: sanitizeRoomName(roomName, user),
        visibility: sanitizeRoomVisibility(visibility),
        hostId: user.userId,
        players: [hostMember],
        spectators: [],
        rulesetId: rulesetId || null,
        selectedRulesets,
        rulesetPermissions: {
          [user.userId]: createDefaultPermissionsForPlayer()
        },
        nvAllowed: true,
        turnTimerSeconds: DEFAULT_TURN_TIMER_SECONDS,
        bannedUserIds: [],
        status: 'waiting'
      };
      ensureRulesetPermissionsForPlayers(lobby);
      socket.join(roomId);

      lobbies.set(roomId, lobby);

      console.log(`Room ${roomId} created by ${user.displayName || user.name}`);
      callback({ success: true, roomId, lobby: serializeLobby(lobbies.get(roomId)), assignedRole: 'player' });
    });

    socket.on('list_public_rooms', (_payload = {}, callback = () => {}) => {
      const user = socketToUser.get(socket.id);
      if (!user) return callback({ error: 'Not authenticated' });

      callback({
        success: true,
        rooms: listPublicRoomsForUser(user),
        currentRoomId: findCurrentRoomForUser(user)?.roomId || null
      });
    });

    // 2. Join a Lobby
    socket.on('join_lobby', ({ roomId }, callback = () => {}) => {
      const user = socketToUser.get(socket.id);
      if (!user) return callback({ error: 'Not authenticated' });

      const normalizedRoomId = String(roomId || '').trim().toUpperCase();
      const currentRoom = findCurrentRoomForUser(user);
      if (currentRoom && currentRoom.roomId !== normalizedRoomId) {
        return callback({ error: 'Leave your current room before joining another one' });
      }

      const lobby = lobbies.get(normalizedRoomId);
      if (!lobby) return callback({ error: 'Lobby not found' });
      if (lobby.status !== 'waiting') return callback({ error: 'Game already in progress' });
      if (lobby.bannedUserIds?.includes(user.userId)) return callback({ error: 'You are banned from this room' });

      const existingPlayer = lobby.players.find((player) => player.socketId === socket.id || player.userId === user.userId);
      const existingSpectator = lobby.spectators.find((spectator) => spectator.socketId === socket.id || spectator.userId === user.userId);
      let assignment = {
        assignedRole: existingPlayer ? 'player' : 'spectator',
        autoSpectator: false
      };

      if (existingPlayer || existingSpectator) {
        clearPendingLobbyDisconnect(normalizedRoomId, user.userId);
        updateLobbyMemberSocket(lobby, user, socket.id);
        socket.join(normalizedRoomId);
        emitLobbyUpdate(io, normalizedRoomId, lobby);
      } else {
        socket.join(normalizedRoomId);
        assignment = addMemberToLobby(lobby, user, socket.id);
        emitLobbyUpdate(io, normalizedRoomId, lobby);
      }

      callback({ success: true, roomId: normalizedRoomId, lobby: serializeLobby(lobby), ...assignment });
    });

    // 3. Toggle Ready Status
    socket.on('toggle_ready', ({ roomId }, callback = () => {}) => {
      const lobby = lobbies.get(roomId);
      if (!lobby) return callback({ error: 'Lobby not found' });

      const player = lobby.players.find((entry) => entry.socketId === socket.id);
      if (!player) {
        return callback({ error: 'Spectators cannot ready up' });
      }

      player.isReady = !player.isReady;
      emitLobbyUpdate(io, roomId, lobby);
      callback({ success: true, lobby: serializeLobby(lobby), isReady: player.isReady });
    });

    socket.on('set_lobby_role', ({ roomId, role }, callback = () => {}) => {
      const lobby = lobbies.get(roomId);
      if (!lobby) return callback({ error: 'Lobby not found' });
      if (lobby.status !== 'waiting') return callback({ error: 'Game already in progress' });

      const user = socketToUser.get(socket.id);
      if (!user) return callback({ error: 'Not authenticated' });

      const roleUpdate = setLobbyMemberRole(lobby, socket.id, role);
      if (roleUpdate.error) {
        return callback({ error: roleUpdate.error });
      }

      if (lobby.hostId === user.userId && role === 'spectator') {
        lobby.hostId = getNextHostId(lobby);
      }

      if (roleUpdate.changed) {
        emitLobbyUpdate(io, roomId, lobby);
      }

      callback({
        success: true,
        assignedRole: roleUpdate.assignedRole,
        lobby: serializeLobby(lobby)
      });
    });

    socket.on('update_room_settings', ({
      roomId,
      roomName,
      visibility,
      nvAllowed,
      turnTimerSeconds,
      selectedRulesets,
      rulesetPermissions
    }, callback = () => {}) => {
      const lobby = lobbies.get(roomId);
      const user = socketToUser.get(socket.id);

      if (!lobby) return callback({ error: 'Lobby not found' });
      if (!user) return callback({ error: 'Not authenticated' });
      if (lobby.status !== 'waiting') return callback({ error: 'Room settings can only be changed before the match starts' });
      if (lobby.hostId !== user.userId) return callback({ error: 'Only the host can change room settings' });

      lobby.roomName = sanitizeRoomName(roomName ?? lobby.roomName, user);
      lobby.visibility = sanitizeRoomVisibility(visibility ?? lobby.visibility);
      lobby.nvAllowed = typeof nvAllowed === 'boolean' ? nvAllowed : Boolean(lobby.nvAllowed);
      lobby.turnTimerSeconds = sanitizeTurnTimerSeconds(turnTimerSeconds ?? lobby.turnTimerSeconds);
      lobby.selectedRulesets = sanitizeRulesetSelections(selectedRulesets);
      lobby.rulesetPermissions = sanitizeRulesetPermissions(rulesetPermissions, lobby.players, lobby.selectedRulesets);
      emitLobbyUpdate(io, roomId, lobby);
      callback({ success: true, lobby: serializeLobby(lobby) });
    });

    socket.on('transfer_host', ({ roomId, targetUserId }, callback = () => {}) => {
      const lobby = lobbies.get(roomId);
      const user = socketToUser.get(socket.id);

      if (!lobby) return callback({ error: 'Lobby not found' });
      if (!user) return callback({ error: 'Not authenticated' });
      if (lobby.status !== 'waiting') return callback({ error: 'Host transfer is only available before the match starts' });
      if (lobby.hostId !== user.userId) return callback({ error: 'Only the host can transfer host' });
      if (!getMemberByUserId(lobby, targetUserId)) return callback({ error: 'Target player not found' });

      lobby.hostId = targetUserId;
      emitLobbyUpdate(io, roomId, lobby, 'Host transferred');
      callback({ success: true, lobby: serializeLobby(lobby) });
    });

    socket.on('kick_member', ({ roomId, targetUserId }, callback = () => {}) => {
      const lobby = lobbies.get(roomId);
      const user = socketToUser.get(socket.id);

      if (!lobby) return callback({ error: 'Lobby not found' });
      if (!user) return callback({ error: 'Not authenticated' });
      if (lobby.status !== 'waiting') return callback({ error: 'Players can only be kicked before the match starts' });
      if (lobby.hostId !== user.userId) return callback({ error: 'Only the host can kick players' });
      if (targetUserId === lobby.hostId) return callback({ error: 'Transfer host before removing yourself' });

      const removed = removeMemberFromLobby(io, roomId, lobby, targetUserId, 'You were kicked from the room');
      if (!removed) return callback({ error: 'Target player not found' });

      emitLobbyUpdate(io, roomId, lobby, `${getUserDisplayName(removed)} was kicked`);
      callback({ success: true, lobby: serializeLobby(lobby) });
    });

    socket.on('ban_member', ({ roomId, targetUserId }, callback = () => {}) => {
      const lobby = lobbies.get(roomId);
      const user = socketToUser.get(socket.id);

      if (!lobby) return callback({ error: 'Lobby not found' });
      if (!user) return callback({ error: 'Not authenticated' });
      if (lobby.status !== 'waiting') return callback({ error: 'Players can only be banned before the match starts' });
      if (lobby.hostId !== user.userId) return callback({ error: 'Only the host can ban players' });
      if (targetUserId === lobby.hostId) return callback({ error: 'Transfer host before banning yourself' });

      if (!lobby.bannedUserIds.includes(targetUserId)) {
        lobby.bannedUserIds.push(targetUserId);
      }

      const removed = removeMemberFromLobby(io, roomId, lobby, targetUserId, 'You were banned from the room');
      if (!removed) return callback({ error: 'Target player not found' });

      emitLobbyUpdate(io, roomId, lobby, `${getUserDisplayName(removed)} was banned`);
      callback({ success: true, lobby: serializeLobby(lobby) });
    });

    socket.on('delete_lobby', ({ roomId }, callback = () => {}) => {
      const lobby = lobbies.get(roomId);
      const user = socketToUser.get(socket.id);

      if (!lobby) return callback({ error: 'Lobby not found' });
      if (!user) return callback({ error: 'Not authenticated' });
      if (lobby.status !== 'waiting') return callback({ error: 'Rooms can only be deleted before the match starts' });
      if (lobby.hostId !== user.userId) return callback({ error: 'Only the host can delete the room' });

      clearLobbyDisconnects(roomId, lobby);
      io.to(roomId).emit('lobby_deleted', { roomId, reason: 'The host deleted the room', deletedBy: user.userId });
      getAllLobbyMembers(lobby).forEach((member) => {
        io.sockets.sockets.get(member.socketId)?.leave(roomId);
      });
      lobbies.delete(roomId);
      callback({ success: true });
    });

    // 4. Start Game
    socket.on('start_game', async ({ roomId }, callback) => {
      const lobby = lobbies.get(roomId);
      const user = socketToUser.get(socket.id);
      const validationError = getStartGameValidationError(lobby, user);
      if (validationError) {
        return callback({ error: validationError });
      }

      lobby.status = 'playing';
      ensureRulesetPermissionsForPlayers(lobby);

      const playerIds = lobby.players.map((player) => player.userId);
      const chooserOrder = shuffle([...playerIds]);

      const gameState = {
        roomId,
        roomName: lobby.roomName,
        hostId: lobby.hostId,
        rulesetId: lobby.rulesetId,
        selectedRulesets: sanitizeRulesetSelections(lobby.selectedRulesets),
        rulesetPermissions: sanitizeRulesetPermissions(lobby.rulesetPermissions, lobby.players, lobby.selectedRulesets),
        nvAllowed: Boolean(lobby.nvAllowed),
        turnTimerSeconds: sanitizeTurnTimerSeconds(lobby.turnTimerSeconds),
        players: lobby.players.map((player) => ({
          userId: player.userId,
          socketId: player.socketId,
          name: player.displayName || player.name,
          isConnected: player.isConnected !== false
        })),
        status: 'playing',
        phase: 'initializing',
        chooserOrder,
        chooserCursor: 0,
        chooserId: null,
        usedChoices: playerIds.reduce((acc, playerId) => {
          acc[playerId] = {};
          return acc;
        }, {}),
        activeRulesetId: null,
        nvSelected: false,
        roundNumber: 0,
        handsReady: playerIds.reduce((acc, playerId) => {
          acc[playerId] = [];
          return acc;
        }, {}),
        stateVersion: 0,
        turnIndex: 0,
        trickPending: false,
        currentTrick: [], // cards played this round
        trickSuit: null,
        collectedHands: [], // History of hands collected
        pointsByPlayer: buildInitialPoints(lobby.players),
        collectedByPlayer: playerIds.reduce((acc, playerId) => {
          acc[playerId] = [];
          return acc;
        }, {}),
        roundStats: null,
        lastRoundStats: null,
        timerId: null,
        timerDeadline: null
      };

      activeGames.set(roomId, gameState);

      // Save game to DB initial state
      try {
        /*
        await Game.create({
          roomId,
          hostId: lobby.hostId,
          rulesetId: lobby.rulesetId,
          players: playerIds,
          state: {
            status: 'playing',
            hands: [],
            cards: hands,
            points: {},
            snapshot: {
              PLAYER_COUNT: lobby.players.length,
              INITIAL_POINTS: 0
            }
          }
        });
        */
        
        const gameStartedVersion = bumpGameStateVersion(gameState);

        // Notify players individually with their own cards (hide others)
        lobby.players.forEach((p, index) => {
          io.to(p.socketId).emit('game_started', {
            message: 'The game has begun!',
            hand: gameState.handsReady[p.userId] || [],
            playerIndex: index,
            isSpectator: false,
            turnIndex: 0,
            trickSuit: null,
            stateVersion: gameStartedVersion,
            cardCounts: buildCardCounts(gameState),
            playerPoints: buildPointTotals(gameState),
            collectedHandsByPlayer: buildCollectedHands(gameState),
            choiceState: serializeChoiceState(gameState),
            availableRulesets: getAvailableRulesets()
          });
        });

        lobby.spectators.forEach((spectator) => {
          io.to(spectator.socketId).emit('game_started', {
            message: 'The game has begun!',
            hand: [],
            playerIndex: -1,
            isSpectator: true,
            turnIndex: 0,
            trickSuit: null,
            stateVersion: gameStartedVersion,
            cardCounts: buildCardCounts(gameState),
            playerPoints: buildPointTotals(gameState),
            collectedHandsByPlayer: buildCollectedHands(gameState),
            choiceState: serializeChoiceState(gameState),
            availableRulesets: getAvailableRulesets()
          });
        });

        beginChooserTurn(io, roomId, gameState);
        
        callback({ success: true });
      } catch (err) {
        console.error('Failed to create game in DB:', err);
        callback({ error: 'Failed to start game due to DB error' });
      }
    });

    socket.on('set_nv_choice', ({ roomId, nvSelected }, callback = () => {}) => {
      const game = activeGames.get(roomId);
      const user = socketToUser.get(socket.id);
      if (!game) return callback({ error: 'Game not found' });
      if (!user) return callback({ error: 'Not authenticated' });

      const result = setNvChoiceForRound(io, roomId, game, user.userId, Boolean(nvSelected));
      if (result.error) {
        socket.emit('game_error', result.error);
      }
      callback(result);
    });

    socket.on('choose_ruleset', ({ roomId, rulesetId }, callback = () => {}) => {
      const game = activeGames.get(roomId);
      const user = socketToUser.get(socket.id);
      if (!game) return callback({ error: 'Game not found' });
      if (!user) return callback({ error: 'Not authenticated' });

      const result = selectRulesetForRound(io, roomId, game, user.userId, rulesetId);
      if (result.error) {
        socket.emit('game_error', result.error);
      }
      callback(result);
    });

    socket.on('continue_match', ({ roomId }, callback = () => {}) => {
      const game = activeGames.get(roomId);
      const user = socketToUser.get(socket.id);
      if (!game) return callback({ error: 'Game not found' });
      if (!user) return callback({ error: 'Not authenticated' });
      if (game.hostId !== user.userId) return callback({ error: 'Only the host can continue the match' });

      const result = continueAfterRound(io, roomId, game);
      if (result.error) {
        socket.emit('game_error', result.error);
      }
      callback(result);
    });

    // 5. Play Card
    socket.on('play_card', ({ roomId, card }) => {
      const user = socketToUser.get(socket.id);
      if (!user) return;

      const result = playCardForPlayer(io, roomId, user.userId, card);
      if (result.error) {
        socket.emit('game_error', result.error);
      }
    });

    // Disconnect Handle
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const user = socketToUser.get(socket.id);
      if (user) {
        for (const [roomId, lobby] of lobbies.entries()) {
          const member = getAllLobbyMembers(lobby).find((entry) => entry.socketId === socket.id);
          if (!member) {
            continue;
          }

          member.isConnected = false;

          const game = activeGames.get(roomId);
          const gamePlayer = game?.players.find((player) => player.userId === member.userId);
          if (gamePlayer) {
            gamePlayer.isConnected = false;
          }

          if (lobby.status === 'waiting') {
            scheduleWaitingLobbyDisconnectCleanup(io, roomId, lobby, member, socket.id);
            ensureRulesetPermissionsForPlayers(lobby);
            emitLobbyUpdate(io, roomId, lobby);
          }
        }
      }
      socketToUser.delete(socket.id);
    });
  });
}

module.exports = attachSocketManager;
module.exports.getStartGameValidationError = getStartGameValidationError;
module.exports.setLobbyMemberRole = setLobbyMemberRole;
module.exports.bumpGameStateVersion = bumpGameStateVersion;
module.exports.buildPublicRoomSummary = buildPublicRoomSummary;
module.exports.findNextChooser = findNextChooser;
module.exports.getEligibleRuleIdsForPlayer = getEligibleRuleIdsForPlayer;
module.exports.sanitizeRulesetPermissions = sanitizeRulesetPermissions;
module.exports.sanitizeTurnTimerSeconds = sanitizeTurnTimerSeconds;
