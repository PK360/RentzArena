const test = require('node:test');
const assert = require('node:assert');
const {
  buildPublicRoomSummary,
  bumpGameStateVersion,
  findNextChooser,
  getEligibleRuleIdsForPlayer,
  getStartGameValidationError,
  sanitizeRulesetPermissions,
  setLobbyMemberRole
} = require('../socketManager');

test('prevents starting a game when the lobby has only one player', () => {
  const error = getStartGameValidationError(
    {
      hostId: 'host-1',
      players: [{ userId: 'host-1', isReady: true }]
    },
    { userId: 'host-1' }
  );

  assert.strictEqual(error, 'At least 2 players are required to start the game');
});

test('allows the host to start when at least two ready players are present', () => {
  const error = getStartGameValidationError(
    {
      hostId: 'host-1',
      players: [
        { userId: 'host-1', isReady: true },
        { userId: 'guest-1', isReady: true }
      ],
      spectators: [{ userId: 'viewer-1', role: 'spectator' }]
    },
    { userId: 'host-1' }
  );

  assert.strictEqual(error, null);
});

test('lets a spectator claim an open player seat as unready', () => {
  const lobby = {
    hostId: 'host-1',
    players: [{ socketId: 'socket-host', userId: 'host-1', isReady: true, role: 'player' }],
    spectators: [{ socketId: 'socket-viewer', userId: 'viewer-1', isReady: false, role: 'spectator' }]
  };

  const result = setLobbyMemberRole(lobby, 'socket-viewer', 'player');

  assert.deepStrictEqual(result, { assignedRole: 'player', changed: true });
  assert.strictEqual(lobby.players.length, 2);
  assert.strictEqual(lobby.spectators.length, 0);
  assert.strictEqual(lobby.players[1].userId, 'viewer-1');
  assert.strictEqual(lobby.players[1].isReady, false);
});

test('prevents moving a spectator into the player list when all six seats are taken', () => {
  const lobby = {
    hostId: 'host-1',
    players: Array.from({ length: 6 }, (_, index) => ({
      socketId: `socket-${index}`,
      userId: `player-${index}`,
      isReady: index < 3,
      role: 'player'
    })),
    spectators: [{ socketId: 'socket-viewer', userId: 'viewer-1', isReady: false, role: 'spectator' }]
  };

  const result = setLobbyMemberRole(lobby, 'socket-viewer', 'player');

  assert.strictEqual(result.error, 'All 6 player seats are taken. You can spectate for now.');
  assert.strictEqual(lobby.players.length, 6);
  assert.strictEqual(lobby.spectators.length, 1);
});

test('bumps the gameplay state version monotonically for room sync events', () => {
  const game = { stateVersion: 0 };

  assert.strictEqual(bumpGameStateVersion(game), 1);
  assert.strictEqual(bumpGameStateVersion(game), 2);
  assert.strictEqual(game.stateVersion, 2);
});

test('sanitizes per-player ruleset permissions against enabled rules', () => {
  const permissions = sanitizeRulesetPermissions(
    {
      'p-1': { whist: false, levate: true }
    },
    [{ userId: 'p-1' }, { userId: 'p-2' }],
    { whist: true, levate: false }
  );

  assert.strictEqual(permissions['p-1'].whist, false);
  assert.strictEqual(permissions['p-1'].levate, false);
  assert.strictEqual(permissions['p-2'].whist, true);
  assert.strictEqual(permissions['p-2'].levate, false);
});

test('fixed chooser order loops and skips players with no choices', () => {
  const game = {
    chooserOrder: ['p-1', 'p-2', 'p-3'],
    chooserCursor: 1,
    selectedRulesets: {
      kingOfHearts: false,
      diamonds: false,
      queens: false,
      tenOfClubs: false,
      whist: true,
      levate: true,
      totalPlus: false,
      totalMinus: false
    },
    rulesetPermissions: {
      'p-1': { whist: true, levate: true },
      'p-2': { whist: false, levate: false },
      'p-3': { whist: true, levate: false }
    },
    usedChoices: {
      'p-1': {},
      'p-2': {},
      'p-3': {}
    }
  };

  assert.deepStrictEqual(findNextChooser(game), { cursor: 2, playerId: 'p-3' });
  game.usedChoices['p-3'].whist = true;
  assert.deepStrictEqual(findNextChooser(game, 0), { cursor: 0, playerId: 'p-1' });
  assert.deepStrictEqual(getEligibleRuleIdsForPlayer(game, 'p-2'), []);
});

test('builds public room summaries with avatars and friend markers', () => {
  const summary = buildPublicRoomSummary(
    'ABCDEF',
    {
      roomName: 'Public Table',
      visibility: 'public',
      status: 'waiting',
      players: [
        { userId: 'p-1', name: 'Alex', avatarUrl: 'alex.png' },
        { userId: 'p-2', name: 'Mara' }
      ],
      spectators: []
    },
    { userId: 'viewer', friends: ['p-2'] }
  );

  assert.strictEqual(summary.roomId, 'ABCDEF');
  assert.strictEqual(summary.roomName, 'Public Table');
  assert.strictEqual(summary.playerCount, 2);
  assert.strictEqual(summary.avatars[0].avatarUrl, 'alex.png');
  assert.strictEqual(summary.hasFriend, true);
});
