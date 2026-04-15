const Game = require('./models/Game');
const User = require('./models/User');
const { randomFriendCode } = require('./utils/helpers');
const { generateDeck, shuffle, dealCards } = require('./utils/cards');
const {
  buildRuleSnapshot,
  compileRuleset,
  evaluateRuleWithSnapshot
} = require('./engine/evaluator');

// In-memory lobby management
const lobbies = new Map(); // roomId -> Set(socketIds)
const activeGames = new Map(); // roomId -> game state
const socketToUser = new Map(); // socketId -> { userId, name }
const MIN_PLAYERS_TO_START = 2;
const MAX_ACTIVE_PLAYERS = 6;
const SUIT_NAMES = {
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
  S: 'Spades'
};
const ROOM_RULESET_DEFINITIONS = Object.freeze({
  kingOfHearts: {
    id: 'kingOfHearts',
    label: 'King of Hearts',
    type: 'per_round',
    code: `
if(HEART_KING)
  add(-100)
  game_end()
endif
`.trim()
  },
  queens: {
    id: 'queens',
    label: 'Queens',
    type: 'per_round',
    code: `
add(-30 * Q_NR, Q_NR > 0)
if(TOTAL_Q_NR == 0)
  game_end()
endif
`.trim()
  },
  diamonds: {
    id: 'diamonds',
    label: 'Diamonds',
    type: 'per_round',
    code: `
add(-15 * DIAMOND_NR, DIAMOND_NR > 0)
if(TOTAL_DIAMOND_NR == 0)
  game_end()
endif
`.trim()
  },
  tenOfClubs: {
    id: 'tenOfClubs',
    label: '10 of Clubs',
    type: 'per_round',
    code: `
if(CLUB_TEN)
  add(-50)
  game_end()
endif
`.trim()
  },
  whist: {
    id: 'whist',
    label: 'Whist',
    type: 'per_round',
    code: 'add(10)'
  }
});
const DEFAULT_ROOM_RULESET_SELECTIONS = Object.freeze(
  Object.keys(ROOM_RULESET_DEFINITIONS).reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {})
);
const COMPILED_ROOM_RULESETS = Object.freeze(
  Object.fromEntries(
    Object.entries(ROOM_RULESET_DEFINITIONS).map(([key, definition]) => [
      key,
      {
        ...definition,
        compiled: compileRuleset(definition.code, definition.type)
      }
    ])
  )
);

function sanitizeRoomRulesetSelections(nextSelections = {}) {
  return Object.keys(DEFAULT_ROOM_RULESET_SELECTIONS).reduce((acc, key) => {
    acc[key] = typeof nextSelections[key] === 'boolean'
      ? nextSelections[key]
      : DEFAULT_ROOM_RULESET_SELECTIONS[key];
    return acc;
  }, {});
}

function serializeRoomSettings(lobby) {
  return {
    availableRulesets: Object.values(ROOM_RULESET_DEFINITIONS).map(({ id, label }) => ({ id, label })),
    selectedRulesets: sanitizeRoomRulesetSelections(lobby?.selectedRulesets)
  };
}

function buildCardCounts(game) {
  return game.players.reduce((acc, player) => {
    acc[player.userId] = game.handsReady[player.userId].length;
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

function buildStandings(game) {
  return game.players
    .map((player) => ({
      userId: player.userId,
      name: player.name,
      points: game.pointsByPlayer?.[player.userId] || 0,
      tricksWon: (game.collectedByPlayer[player.userId] || []).length,
      cardsLeft: game.handsReady[player.userId].length
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
    role
  };
}

function serializeLobby(lobby) {
  return {
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

function getNextHostId(lobby) {
  return lobby.players[0]?.userId || lobby.spectators[0]?.userId || null;
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
  } else {
    lobby.spectators.push(member);
  }

  return {
    assignedRole: role,
    autoSpectator: shouldSpectate
  };
}

function setLobbyMemberRole(lobby, socketId, nextRole) {
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

    return { assignedRole: 'player', changed: true };
  }

  if (spectatorIndex !== -1) {
    return { assignedRole: 'spectator', changed: false };
  }

  const [member] = lobby.players.splice(playerIndex, 1);
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

  return null;
}

function applySelectedRoomRulesToHand({ game, playerId, handCards }) {
  const enabledRuleIds = Object.entries(sanitizeRoomRulesetSelections(game.selectedRulesets))
    .filter(([, isEnabled]) => isEnabled)
    .map(([ruleId]) => ruleId)
    .filter((ruleId) => COMPILED_ROOM_RULESETS[ruleId]);

  if (enabledRuleIds.length === 0) {
    return { gameEnded: false };
  }

  const nonDiscardedCards = game.players.flatMap((player) => game.handsReady[player.userId] || []);
  let nextPoints = game.pointsByPlayer[playerId] || 0;
  let gameEnded = false;

  for (const ruleId of enabledRuleIds) {
    const result = evaluateRuleWithSnapshot(
      COMPILED_ROOM_RULESETS[ruleId].compiled,
      buildRuleSnapshot({
        playerCount: game.players.length,
        initialPoints: nextPoints,
        handCards,
        nonDiscardedCards
      })
    );

    nextPoints = result.POINTS;
    if (result.gameEnded) {
      gameEnded = true;
    }
  }

  game.pointsByPlayer[playerId] = nextPoints;
  return { gameEnded };
}

function attachSocketManager(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Basic authentication simulation for socket (in final, verify JWT or magic link)
    socket.on('authenticate', (userData) => {
      socketToUser.set(socket.id, userData);
      console.log(
        `Socket ${socket.id} authenticated as ${userData.displayName || userData.name}`
      );
    });

    // 1. Create a Lobby
    socket.on('create_lobby', async ({ rulesetId }, callback) => {
      const user = socketToUser.get(socket.id);
      if (!user) return callback({ error: 'Not authenticated' });

      // Generate a short 6-letter room code
      const roomId = randomFriendCode();
      socket.join(roomId);
      
      lobbies.set(roomId, {
        hostId: user.userId,
        players: [createLobbyMember(user, socket.id, { isReady: true, role: 'player' })],
        spectators: [],
        rulesetId: rulesetId || null,
        selectedRulesets: { ...DEFAULT_ROOM_RULESET_SELECTIONS },
        status: 'waiting'
      });

      console.log(`Room ${roomId} created by ${user.displayName || user.name}`);
      callback({ success: true, roomId, lobby: serializeLobby(lobbies.get(roomId)), assignedRole: 'player' });
    });

    // 2. Join a Lobby
    socket.on('join_lobby', ({ roomId }, callback) => {
      const user = socketToUser.get(socket.id);
      if (!user) return callback({ error: 'Not authenticated' });

      const lobby = lobbies.get(roomId);
      if (!lobby) return callback({ error: 'Lobby not found' });
      if (lobby.status !== 'waiting') return callback({ error: 'Game already in progress' });

      const existingPlayer = lobby.players.find((player) => player.socketId === socket.id);
      const existingSpectator = lobby.spectators.find((spectator) => spectator.socketId === socket.id);
      let assignment = {
        assignedRole: existingPlayer ? 'player' : 'spectator',
        autoSpectator: false
      };

      if (!existingPlayer && !existingSpectator) {
        socket.join(roomId);
        assignment = addMemberToLobby(lobby, user, socket.id);
        emitLobbyUpdate(io, roomId, lobby);
      }

      callback({ success: true, roomId, lobby: serializeLobby(lobby), ...assignment });
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

      const roleUpdate = setLobbyMemberRole(lobby, socket.id, role);
      if (roleUpdate.error) {
        return callback({ error: roleUpdate.error });
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

    socket.on('update_room_settings', ({ roomId, selectedRulesets }, callback = () => {}) => {
      const lobby = lobbies.get(roomId);
      const user = socketToUser.get(socket.id);

      if (!lobby) return callback({ error: 'Lobby not found' });
      if (!user) return callback({ error: 'Not authenticated' });
      if (lobby.status !== 'waiting') return callback({ error: 'Room settings can only be changed before the match starts' });
      if (lobby.hostId !== user.userId) return callback({ error: 'Only the host can change room settings' });

      lobby.selectedRulesets = sanitizeRoomRulesetSelections(selectedRulesets);
      emitLobbyUpdate(io, roomId, lobby);
      callback({ success: true, lobby: serializeLobby(lobby) });
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
      
      const unShuffledDeck = generateDeck(lobby.players.length);
      const shuffledDeck = shuffle([...unShuffledDeck]);
      const playerIds = lobby.players.map(p => p.userId);
      const hands = dealCards(shuffledDeck, playerIds);

      const gameState = {
        roomId,
        hostId: lobby.hostId,
        rulesetId: lobby.rulesetId,
        selectedRulesets: sanitizeRoomRulesetSelections(lobby.selectedRulesets),
        players: lobby.players.map(p => ({
          userId: p.userId,
          socketId: p.socketId,
          name: p.displayName || p.name
        })),
        status: 'playing',
        handsReady: hands,
        stateVersion: 0,
        turnIndex: 0,
        trickPending: false,
        currentTrick: [], // cards played this round
        trickSuit: null,
        collectedHands: [], // History of hands collected
        pointsByPlayer: playerIds.reduce((acc, playerId) => {
          acc[playerId] = 0;
          return acc;
        }, {}),
        collectedByPlayer: playerIds.reduce((acc, playerId) => {
          acc[playerId] = [];
          return acc;
        }, {})
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
            hand: hands[p.userId],
            playerIndex: index,
            isSpectator: false,
            turnIndex: 0,
            trickSuit: null,
            stateVersion: gameStartedVersion,
            cardCounts: buildCardCounts(gameState),
            playerPoints: buildPointTotals(gameState),
            collectedHandsByPlayer: buildCollectedHands(gameState)
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
            collectedHandsByPlayer: buildCollectedHands(gameState)
          });
        });
        
        callback({ success: true });
      } catch (err) {
        console.error('Failed to create game in DB:', err);
        callback({ error: 'Failed to start game due to DB error' });
      }
    });

    // 5. Play Card
    socket.on('play_card', ({ roomId, card }) => {
      const game = activeGames.get(roomId);
      const user = socketToUser.get(socket.id);
      if (!game || !user) return;
      
      if (game.trickPending) return;
      
      const pIndex = game.players.findIndex((player) => player.socketId === socket.id);
      if (pIndex === -1) {
        socket.emit('game_error', 'Spectators cannot play cards');
        return;
      }

      if (pIndex !== game.turnIndex) {
        socket.emit('game_error', 'It is not your turn!');
        return;
      }
      
      const hand = game.handsReady[user.userId];
      if (!hand) return;
      if (!hand.includes(card)) return; // Prevents playing cards they don't have
      
      
      // Determine trick suit if it's the first card
      if (game.currentTrick.length === 0) {
        const [, suit] = card.split('-');
        game.trickSuit = suit;
      } else {
        // Enforce following the trick suit if holding it
        const [, playSuit] = card.split('-');
        if (playSuit !== game.trickSuit) {
          const hasSuit = hand.some(c => c.split('-')[1] === game.trickSuit);
          if (hasSuit) {
            socket.emit(
              'game_error',
              `You must play a card of suit ${SUIT_NAMES[game.trickSuit] || game.trickSuit}`
            );
            return;
          }
        }
      }
      
      // Remove card from hand
      game.handsReady[user.userId] = hand.filter(c => c !== card);
      
      game.currentTrick.push({
        playedBy: user.userId,
        playerName: user.displayName || user.name,
        card
      });
      
      // Advance turn sequentially
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
      const gameUpdateVersion = bumpGameStateVersion(game);
      
      io.to(roomId).emit('game_update', {
        currentTrick: game.currentTrick,
        turnIndex: game.turnIndex,
        trickSuit: game.trickSuit,
        stateVersion: gameUpdateVersion,
        cardCounts: buildCardCounts(game)
      });
      
      socket.emit('hand_update', game.handsReady[user.userId]);
      
      // Check trick end (everyone played a card)
      if (game.currentTrick.length === game.players.length) {
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
        const ruleResolution = applySelectedRoomRulesToHand({
          game,
          playerId: winningPlay.playedBy,
          handCards: collectedHandCards
        });
        
        // Trick winner goes first next round
        game.turnIndex = game.players.findIndex(p => p.userId === winningPlay.playedBy);
        const trickWonVersion = bumpGameStateVersion(game);
        
        io.to(roomId).emit('trick_won', {
           winnerName: winningPlay.playerName,
           winnerId: winningPlay.playedBy,
           trickSuit: game.trickSuit,
           stateVersion: trickWonVersion,
           playerPoints: buildPointTotals(game),
           collectedHandsByPlayer: buildCollectedHands(game),
           cardCounts: buildCardCounts(game)
        });
        
        setTimeout(() => {
          game.currentTrick = [];
          game.trickSuit = null;
          game.trickPending = false;
          const allHandsEmpty = game.players.every(
            (player) => game.handsReady[player.userId].length === 0
          );
          const gameShouldFinish = allHandsEmpty || ruleResolution.gameEnded;
          const trickEndVersion = bumpGameStateVersion(game);
          
          io.to(roomId).emit('trick_end', {
            nextTurnIndex: game.turnIndex,
            collectedHandsCount: game.collectedHands.length,
            trickSuit: null,
            stateVersion: trickEndVersion,
            playerPoints: buildPointTotals(game),
            collectedHandsByPlayer: buildCollectedHands(game),
            cardCounts: buildCardCounts(game),
            gameFinished: gameShouldFinish
          });

          if (gameShouldFinish) {
            game.status = 'finished';
            const gameFinishedVersion = bumpGameStateVersion(game);
            const standings = buildStandings(game);

            io.to(roomId).emit('game_finished', {
              winnerId: standings[0]?.userId || winningPlay.playedBy,
              winnerName: standings[0]?.name || winningPlay.playerName,
              stateVersion: gameFinishedVersion,
              standings,
              playerPoints: buildPointTotals(game),
              collectedHandsByPlayer: buildCollectedHands(game),
              cardCounts: buildCardCounts(game)
            });
          }
        }, 1500); // 1.5-second delay to animate sliding cards
      }
    });

    // Disconnect Handle
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const user = socketToUser.get(socket.id);
      if (user) {
        // Remove from any waiting lobbies
        for (const [roomId, lobby] of lobbies.entries()) {
          if (lobby.status === 'waiting') {
            const playerIndex = lobby.players.findIndex((player) => player.socketId === socket.id);
            const spectatorIndex = lobby.spectators.findIndex((spectator) => spectator.socketId === socket.id);

            if (playerIndex !== -1) {
              lobby.players.splice(playerIndex, 1);
            } else if (spectatorIndex !== -1) {
              lobby.spectators.splice(spectatorIndex, 1);
            } else {
              continue;
            }

            if (getAllLobbyMembers(lobby).length === 0) {
              lobbies.delete(roomId); // cleanup empty lobbies
            } else {
              if (lobby.hostId === user.userId) {
                lobby.hostId = getNextHostId(lobby); // reassign host
              }
              emitLobbyUpdate(io, roomId, lobby, 'A player left');
            }
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
