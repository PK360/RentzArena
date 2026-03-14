const Game = require('./models/Game');
const User = require('./models/User');
const { generateFriendCode } = require('./utils/helpers');
const { generateDeck, shuffle, dealCards } = require('./utils/cards');

// In-memory lobby management
const lobbies = new Map(); // roomId -> Set(socketIds)
const activeGames = new Map(); // roomId -> game state
const socketToUser = new Map(); // socketId -> { userId, name }

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Basic authentication simulation for socket (in final, verify JWT or magic link)
    socket.on('authenticate', (userData) => {
      socketToUser.set(socket.id, userData);
      console.log(`Socket ${socket.id} authenticated as ${userData.name}`);
    });

    // 1. Create a Lobby
    socket.on('create_lobby', async ({ rulesetId }, callback) => {
      const user = socketToUser.get(socket.id);
      if (!user) return callback({ error: 'Not authenticated' });

      // Generate a short 6-letter room code
      const roomId = generateFriendCode();
      socket.join(roomId);
      
      lobbies.set(roomId, {
        hostId: user.userId,
        players: [{ socketId: socket.id, ...user, isReady: true }],
        rulesetId: rulesetId || null,
        status: 'waiting'
      });

      console.log(`Room ${roomId} created by ${user.name}`);
      callback({ success: true, roomId });
    });

    // 2. Join a Lobby
    socket.on('join_lobby', ({ roomId }, callback) => {
      const user = socketToUser.get(socket.id);
      if (!user) return callback({ error: 'Not authenticated' });

      const lobby = lobbies.get(roomId);
      if (!lobby) return callback({ error: 'Lobby not found' });
      if (lobby.status !== 'waiting') return callback({ error: 'Game already in progress' });

      if (!lobby.players.find(p => p.socketId === socket.id)) {
        socket.join(roomId);
        lobby.players.push({ socketId: socket.id, ...user, isReady: false });
        io.to(roomId).emit('lobby_update', { players: lobby.players });
      }

      callback({ success: true, roomId, lobby });
    });

    // 3. Toggle Ready Status
    socket.on('toggle_ready', ({ roomId }) => {
      const lobby = lobbies.get(roomId);
      if (!lobby) return;

      const player = lobby.players.find(p => p.socketId === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        io.to(roomId).emit('lobby_update', { players: lobby.players });
      }
    });

    // 4. Start Game
    socket.on('start_game', async ({ roomId }, callback) => {
      const lobby = lobbies.get(roomId);
      if (!lobby) return callback({ error: 'Lobby not found' });
      
      const user = socketToUser.get(socket.id);
      if (lobby.hostId !== user.userId) return callback({ error: 'Only host can start the game' });

      const allReady = lobby.players.every(p => p.isReady);
      if (!allReady) return callback({ error: 'Not all players are ready' });

      lobby.status = 'playing';
      
      const unShuffledDeck = generateDeck(lobby.players.length);
      const shuffledDeck = shuffle([...unShuffledDeck]);
      const playerIds = lobby.players.map(p => p.userId);
      const hands = dealCards(shuffledDeck, playerIds);

      const gameState = {
        roomId,
        hostId: lobby.hostId,
        rulesetId: lobby.rulesetId,
        players: lobby.players.map(p => ({ userId: p.userId, socketId: p.socketId, name: p.name })),
        status: 'playing',
        handsReady: hands,
        turnIndex: 0,
        trickPending: false,
        currentTrick: [], // cards played this round
        trickSuit: null,
        collectedHands: [] // History of hands collected
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
        
        // Notify players individually with their own cards (hide others)
        lobby.players.forEach((p, index) => {
          io.to(p.socketId).emit('game_started', { 
            message: 'The game has begun!',
            hand: hands[p.userId],
            playerIndex: index,
            turnIndex: 0
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
      
      const pIndex = game.players.findIndex(p => p.socketId === socket.id);
      if (pIndex !== game.turnIndex) {
        socket.emit('game_error', 'It is not your turn!');
        return;
      }
      
      const hand = game.handsReady[user.userId];
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
            socket.emit('game_error', `You must play a card of suit ${game.trickSuit}`);
            return;
          }
        }
      }
      
      // Remove card from hand
      game.handsReady[user.userId] = hand.filter(c => c !== card);
      
      game.currentTrick.push({ playedBy: user.userId, playerName: user.name, card });
      
      // Advance turn sequentially
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
      
      io.to(roomId).emit('game_update', {
        currentTrick: game.currentTrick,
        turnIndex: game.turnIndex,
        trickSuit: game.trickSuit,
        cardCounts: game.players.reduce((acc, p) => {
          acc[p.userId] = game.handsReady[p.userId].length;
          return acc;
        }, {})
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
        
        // Trick winner goes first next round
        game.turnIndex = game.players.findIndex(p => p.userId === winningPlay.playedBy);
        
        io.to(roomId).emit('trick_won', {
           winnerName: winningPlay.playerName,
           winnerId: winningPlay.playedBy
        });
        
        setTimeout(() => {
          game.currentTrick = [];
          game.trickSuit = null;
          game.trickPending = false;
          
          io.to(roomId).emit('trick_end', {
            nextTurnIndex: game.turnIndex,
            collectedHandsCount: game.collectedHands.length
          });
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
            lobby.players = lobby.players.filter(p => p.socketId !== socket.id);
            if (lobby.players.length === 0) {
              lobbies.delete(roomId); // cleanup empty lobbies
            } else {
              if (lobby.hostId === user.userId) {
                lobby.hostId = lobby.players[0].userId; // reassign host
              }
              io.to(roomId).emit('lobby_update', { players: lobby.players, message: 'A player left' });
            }
          }
        }
      }
      socketToUser.delete(socket.id);
    });
  });
};
