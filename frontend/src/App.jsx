import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Ban,
  BarChart3,
  Check,
  Clock,
  Copy,
  Crown,
  Download,
  Droplet,
  FileCode2,
  Globe2,
  Home,
  Info,
  Library,
  Lock,
  LogIn,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Upload,
  UserRound,
  Users,
  Users2,
  X
} from 'lucide-react';
import clsx from 'clsx';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
  autoConnect: false
});

const SUIT_SYMBOLS = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠'
};

const SUIT_NAMES = {
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
  S: 'Spades'
};

const CARD_VALUE_NAMES = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
  '10': 'Ten',
  '9': 'Nine',
  '8': 'Eight',
  '7': 'Seven',
  '6': 'Six',
  '5': 'Five',
  '4': 'Four',
  '3': 'Three',
  '2': 'Two'
};

const CARD_ASSET_VALUE_NAMES = {
  A: 'ace',
  K: 'king',
  Q: 'queen',
  J: 'jack',
  '10': '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2'
};
const CARD_ASSET_SUIT_NAMES = {
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
  S: 'spades'
};
const ILLUSTRATED_FACE_CARD_VALUES = new Set(['J', 'Q', 'K']);
const JOKER_CARD_LABELS = {
  black_joker: 'Black Joker',
  red_joker: 'Red Joker'
};
const CARD_ASSET_BASE_PATH = `${import.meta.env.BASE_URL}cards/`;
const CARD_ASSET_ASPECT_RATIO = 167.0869141 / 242.6669922;
const MAX_ACTIVITY_FEED_ITEMS = 60;
const TRICK_CARD_CENTER_BOX_PERCENT = 3.2;
const TRICK_CARD_ROTATION_LIMIT_DEGREES = 18;
const HAND_CARD_MAX_ADVANCE_RATIO = 0.76;
const HAND_CARD_MIN_ADVANCE_RATIO = 0.42;
const HAND_CARD_SIZE_SCALE = 0.95;
const HAND_CARD_MIN_HEIGHT_PX = 44;
const HAND_CARD_MAX_HEIGHT_PX = 108;
const HAND_CARD_MEASURE_MIN_WIDTH_PX = 140;
const HAND_CARD_MEASURE_MIN_HEIGHT_PX = 42;
const MIN_PLAYERS_TO_START = 2;
const MAX_ACTIVE_PLAYERS = 6;
const ROOM_RULESET_OPTIONS = [
  { id: 'kingOfHearts', label: 'King of Hearts', abbreviation: 'K♥' },
  { id: 'diamonds', label: 'Diamonds', abbreviation: '♦' },
  { id: 'queens', label: 'Queens', abbreviation: 'Q' },
  { id: 'tenOfClubs', label: '10 of Clubs', abbreviation: '10♣' },
  { id: 'whist', label: 'Whist', abbreviation: 'W' },
  { id: 'levate', label: 'Levate', abbreviation: 'L' },
  { id: 'totalPlus', label: 'Total Plus', abbreviation: 'T+' },
  { id: 'totalMinus', label: 'Total Minus', abbreviation: 'T-' }
];
const DEFAULT_ROOM_RULESET_SELECTIONS = Object.freeze(
  ROOM_RULESET_OPTIONS.reduce((acc, option) => {
    acc[option.id] = true;
    return acc;
  }, {})
);
const DEFAULT_ROOM_VISIBILITY = 'public';
const TURN_TIMER_RANGE = { min: 15, max: 300, defaultValue: 45 };
const RULESET_TYPE_OPTIONS = new Set(['per_round', 'end_game']);
const RENTZ_METADATA_KEYS = new Set(['long_name', 'short_name', 'title', 'name', 'abbreviation', 'abbr', 'type']);

const VALUE_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUIT_ORDER = ['H', 'S', 'D', 'C'];
const STORAGE_KEYS = {
  theme: 'rentz-theme',
  fontScale: 'rentz-font-scale',
  pageZoom: 'rentz-page-zoom',
  guestProfile: 'rentz-guest-profile'
};
const FONT_SCALE_RANGE = { min: 70, max: 130, step: 5, defaultValue: 100 };
const PAGE_ZOOM_RANGE = { min: 100, max: 125, step: 5, defaultValue: 100 };

function createStepValues(min, max, step) {
  const values = [];

  for (let value = min; value <= max; value += step) {
    values.push(value);
  }

  return values;
}

function getStepAlignedMidpoint(min, max, step) {
  const midpoint = (min + max) / 2;
  const steppedMidpoint = Math.round((midpoint - min) / step) * step + min;
  return Math.min(max, Math.max(min, steppedMidpoint));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildRulesetShortNameFallback(longName) {
  return Array.from(String(longName || 'Ruleset').replace(/\s+/g, '')).slice(0, 4).join('') || 'R';
}

function normalizeRulesetType(type) {
  return RULESET_TYPE_OPTIONS.has(type) ? type : 'per_round';
}

function normalizeRentzMetadataKey(key) {
  return String(key || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function parseRentzMetadataLine(line) {
  const match = String(line || '').trim().match(/^(?:#\s*)?([^:=#]+?)\s*[:=]\s*(.*)$/);
  if (!match) {
    return null;
  }

  const key = normalizeRentzMetadataKey(match[1]);
  if (!RENTZ_METADATA_KEYS.has(key)) {
    return null;
  }

  return {
    key,
    value: match[2].trim()
  };
}

function parseRentzRulesetText(sourceText) {
  const normalizedText = String(sourceText || '').replace(/\r\n/g, '\n');
  const lines = normalizedText.split('\n');
  const metadata = {};
  let index = 0;
  let hasRentzHeader = false;

  if (/^(?:#\s*)?Rentz Arena Ruleset\s*$/i.test(lines[0]?.trim() || '')) {
    hasRentzHeader = true;
    index = 1;
  }

  const metadataStartIndex = index;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed === '#') {
      index += 1;
      break;
    }

    if (/^-{3,}$/.test(trimmed)) {
      index += 1;
      break;
    }

    const metadataEntry = parseRentzMetadataLine(lines[index]);
    if (!metadataEntry) {
      break;
    }

    metadata[metadataEntry.key] = metadataEntry.value;
    index += 1;
  }

  const hasLeadingMetadata = index > metadataStartIndex;

  if (!hasRentzHeader && !hasLeadingMetadata) {
    let titleIndex = 0;
    while (titleIndex < lines.length && !lines[titleIndex].trim()) {
      titleIndex += 1;
    }

    const typeLine = lines[titleIndex + 1]?.trim() || '';
    const typeMatch = typeLine.match(/^type:\s*([\w-]+)\s*$/i);
    if (lines[titleIndex]?.trim() && typeMatch) {
      const longName = lines[titleIndex].trim();
      return {
        longName,
        shortName: buildRulesetShortNameFallback(longName),
        type: normalizeRulesetType(typeMatch[1]),
        code: lines.slice(titleIndex + 2).join('\n').trim()
      };
    }
  }

  const code = (hasRentzHeader || hasLeadingMetadata)
    ? lines.slice(index).join('\n').trim()
    : normalizedText.trim();
  const longName = metadata.long_name || metadata.title || metadata.name || 'Imported Ruleset';
  const shortName = metadata.short_name || metadata.abbreviation || metadata.abbr || buildRulesetShortNameFallback(longName);

  return {
    longName,
    shortName,
    type: normalizeRulesetType(metadata.type),
    code
  };
}

function formatRentzRuleset({ longName, shortName, type, code }) {
  const resolvedLongName = String(longName || '').trim() || 'Untitled Ruleset';
  const resolvedShortName = String(shortName || '').trim() || buildRulesetShortNameFallback(resolvedLongName);

  return [
    `# long_name: ${resolvedLongName}`,
    `# short_name: ${resolvedShortName}`,
    `# type: ${normalizeRulesetType(type)}`,
    '#',
    String(code || '').trim(),
    ''
  ].join('\n');
}

function buildRulesetDownloadName(longName) {
  const slug = String(longName || 'ruleset')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `${slug || 'ruleset'}.rentz`;
}

function normalizeRoomSettings(roomSettings) {
  const availableRulesets = roomSettings?.availableRulesets?.length
    ? roomSettings.availableRulesets.map((option) => ({
      ...option,
      abbreviation: option.abbreviation || ROOM_RULESET_OPTIONS.find((fallback) => fallback.id === option.id)?.abbreviation || option.label
    }))
    : ROOM_RULESET_OPTIONS;
  const selectedRulesets = availableRulesets.reduce((acc, option) => {
    acc[option.id] = typeof roomSettings?.selectedRulesets?.[option.id] === 'boolean'
      ? roomSettings.selectedRulesets[option.id]
      : (Object.prototype.hasOwnProperty.call(DEFAULT_ROOM_RULESET_SELECTIONS, option.id)
        ? DEFAULT_ROOM_RULESET_SELECTIONS[option.id]
        : option.enabledByDefault !== false);
    return acc;
  }, {});
  const rulesetPermissions = roomSettings?.rulesetPermissions && typeof roomSettings.rulesetPermissions === 'object'
    ? roomSettings.rulesetPermissions
    : {};

  return {
    availableRulesets,
    selectedRulesets,
    rulesetPermissions,
    nvAllowed: roomSettings?.nvAllowed ?? true,
    turnTimerSeconds: clampNumber(
      Number(roomSettings?.turnTimerSeconds ?? TURN_TIMER_RANGE.defaultValue),
      TURN_TIMER_RANGE.min,
      TURN_TIMER_RANGE.max
    ),
    visibility: roomSettings?.visibility || DEFAULT_ROOM_VISIBILITY,
    roomName: roomSettings?.roomName || ''
  };
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seedValue) {
  let seed = hashString(seedValue) || 1;

  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function getTrickCardPlacement(play, index) {
  const nextRandom = createSeededRandom([
    play.card,
    play.playedBy || '',
    play.playerName || '',
    index
  ].join(':'));

  return {
    left: 50 + ((nextRandom() - 0.5) * TRICK_CARD_CENTER_BOX_PERCENT),
    top: 50 + ((nextRandom() - 0.5) * TRICK_CARD_CENTER_BOX_PERCENT),
    rotation: (nextRandom() - 0.5) * TRICK_CARD_ROTATION_LIMIT_DEGREES * 2
  };
}

function readStoredPreference(key, fallback, allowedValues) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue == null) {
      return fallback;
    }

    if (typeof fallback === 'number') {
      const parsedValue = Number(storedValue);
      return allowedValues.includes(parsedValue) ? parsedValue : fallback;
    }

    return allowedValues.includes(storedValue) ? storedValue : fallback;
  } catch {
    return fallback;
  }
}

function readStoredGuestSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.sessionStorage.getItem(STORAGE_KEYS.guestProfile);
    if (!storedValue) {
      return null;
    }

    const storedSession = JSON.parse(storedValue);
    const profile = storedSession?.profile || storedSession;
    if (!profile?.userId || !profile?.name) {
      return null;
    }

    return {
      profile: {
        userId: profile.userId,
        name: profile.name,
        guest: true
      },
      roomId: storedSession?.profile ? (storedSession.roomId || null) : null
    };
  } catch {
    return null;
  }
}

function isRefreshNavigation() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigationEntry = window.performance?.getEntriesByType?.('navigation')?.[0];
  if (navigationEntry?.type) {
    return navigationEntry.type === 'reload';
  }

  return window.performance?.navigation?.type === 1;
}

function storeGuestProfile(profile, { roomId = null } = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEYS.guestProfile);
    if (profile?.userId && profile?.name) {
      window.sessionStorage.setItem(STORAGE_KEYS.guestProfile, JSON.stringify({
        profile: {
          userId: profile.userId,
          name: profile.name,
          guest: true
        },
        roomId: roomId || null
      }));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEYS.guestProfile);
    }
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function updateStoredGuestRoom(roomId) {
  const storedSession = readStoredGuestSession();
  if (storedSession?.profile) {
    storeGuestProfile(storedSession.profile, { roomId });
  }
}

function readRecoverableGuestSessionForCurrentNavigation() {
  const session = readStoredGuestSession();
  if (!session?.profile) {
    return null;
  }

  if (isRefreshNavigation()) {
    return session;
  }

  storeGuestProfile(null);
  return null;
}

function parseCard(cardString) {
  const [value, suit] = cardString.split('-');
  return { value, suit };
}

function getCardAssetPath(cardString) {
  if (JOKER_CARD_LABELS[cardString]) {
    return `${CARD_ASSET_BASE_PATH}${cardString}.svg`;
  }

  const { value, suit } = parseCard(cardString);
  const suffix = ILLUSTRATED_FACE_CARD_VALUES.has(value) ? '2' : '';

  return `${CARD_ASSET_BASE_PATH}${CARD_ASSET_VALUE_NAMES[value]}_of_${CARD_ASSET_SUIT_NAMES[suit]}${suffix}.svg`;
}

function getCardLabel(cardString) {
  if (JOKER_CARD_LABELS[cardString]) {
    return JOKER_CARD_LABELS[cardString];
  }

  const { value, suit } = parseCard(cardString);
  return `${CARD_VALUE_NAMES[value]} of ${SUIT_NAMES[suit]}`;
}

function sortCards(cards) {
  return [...cards].sort((leftCard, rightCard) => {
    const left = parseCard(leftCard);
    const right = parseCard(rightCard);

    const suitDiff = SUIT_ORDER.indexOf(left.suit) - SUIT_ORDER.indexOf(right.suit);
    if (suitDiff !== 0) {
      return suitDiff;
    }

    return VALUE_ORDER.indexOf(left.value) - VALUE_ORDER.indexOf(right.value);
  });
}

function getPlayerName(player) {
  return player?.name || player?.displayName || 'Player';
}

function getPlayerInitials(player) {
  const name = getPlayerName(player).trim();
  if (!name) {
    return 'P';
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function getPlayerAvatarSource(player) {
  return (
    player?.avatarUrl ||
    player?.avatar ||
    player?.profileImageUrl ||
    player?.profileImage ||
    player?.image ||
    null
  );
}

function getPlayerRating(player) {
  return player?.elo ?? player?.rating ?? player?.mmr ?? player?.rank ?? null;
}

function getPlayerPoints(player) {
  return player?.points ?? player?.score ?? player?.totalPoints ?? null;
}

function getPlayerPresence(player) {
  if (typeof player?.isConnected === 'boolean') {
    return player.isConnected;
  }

  if (typeof player?.connected === 'boolean') {
    return player.connected;
  }

  return Boolean(player?.socketId || player?.userId);
}

function formatMetaValue(value, fallback = '--') {
  if (value == null || value === '') {
    return fallback;
  }

  return `${value}`;
}

function formatDuration(ms = 0) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getRankDelta(previousRank, nextRank) {
  if (!previousRank || !nextRank) {
    return '—';
  }

  const delta = previousRank - nextRank;
  if (delta > 0) {
    return `+${delta}`;
  }
  if (delta < 0) {
    return `${delta}`;
  }
  return '0';
}

function formatMarkingSuit(trickSuit) {
  if (!trickSuit) {
    return 'Waiting...';
  }

  return `${SUIT_NAMES[trickSuit].toUpperCase()} ${SUIT_SYMBOLS[trickSuit]}`;
}

function canPlayCard({ card, hand, trickSuit, isMyTurn, trickPending }) {
  if (!isMyTurn || trickPending) {
    return false;
  }

  if (!trickSuit) {
    return true;
  }

  const { suit } = parseCard(card);
  if (suit === trickSuit) {
    return true;
  }

  return !hand.some((handCard) => parseCard(handCard).suit === trickSuit);
}

function getDesktopSeatOrder(players) {
  if (!players.length) {
    return [];
  }

  return [...players];
}

function getDesktopSeatLayoutMetrics({ playerCount, stageRect, boardRect, stageTightness = 0 }) {
  if (!playerCount) {
    return null;
  }

  const boardCenterX = boardRect.left - stageRect.left + (boardRect.width / 2);
  const boardCenterY = boardRect.top - stageRect.top + (boardRect.height / 2);
  const stageMinDimension = Math.min(stageRect.width, stageRect.height);
  const tightZoomFactor = clampNumber(stageTightness, 0, 1);
  const seatFootprintScale = 1 - (tightZoomFactor * 0.18);
  const seatFootprintX = clampNumber(stageMinDimension * 0.15 * seatFootprintScale, 92, 142);
  const seatFootprintY = clampNumber(stageMinDimension * 0.2 * seatFootprintScale, 104, 168);
  const seatHalfWidth = seatFootprintX / 2;
  const seatHalfHeight = seatFootprintY / 2;
  const padding = {
    left: clampNumber((stageRect.width * 0.042) - (tightZoomFactor * 10), 14, 52),
    right: clampNumber((stageRect.width * 0.042) - (tightZoomFactor * 10), 14, 52),
    top: clampNumber((stageRect.height * 0.022) - (tightZoomFactor * 7), 4, 24),
    bottom: clampNumber((stageRect.height * 0.026) - (tightZoomFactor * 8), 6, 26)
  };
  const boardTop = boardRect.top - stageRect.top;
  const boardBottom = boardRect.bottom - stageRect.top;
  const spaceAboveBoard = Math.max(0, boardTop - padding.top);
  const spaceBelowBoard = Math.max(0, stageRect.height - padding.bottom - boardBottom);
  const upwardCenterShift = clampNumber(
    ((spaceAboveBoard - spaceBelowBoard) * 0.42) + (stageRect.height * 0.035),
    0,
    stageRect.height * 0.16
  );
  const centerX = boardCenterX;
  const centerY = boardCenterY - upwardCenterShift;
  const angles = playerCount === 1
    ? [-Math.PI / 2]
    : Array.from({ length: playerCount }, (_, index) => (-Math.PI / 2) + (index * ((Math.PI * 2) / playerCount)));
  const maxRadiusX = Math.max(
    0,
    Math.min(
      centerX - padding.left - seatHalfWidth,
      stageRect.width - padding.right - centerX - seatHalfWidth
    )
  );
  const maxRadiusY = Math.max(
    0,
    Math.min(
      centerY - padding.top - seatHalfHeight,
      stageRect.height - padding.bottom - centerY - seatHalfHeight
    )
  );
  const maxRadiusTop = Math.max(0, centerY - padding.top - seatHalfHeight);
  const maxRadiusBottom = Math.max(0, stageRect.height - padding.bottom - centerY - seatHalfHeight);
  const preferredRadiusX = (boardRect.width / 2) + seatHalfWidth + clampNumber(stageRect.width * 0.104, 76, 134) + (clampNumber(stageRect.width * 0.072, 28, 76) * tightZoomFactor);
  const preferredRadiusY = (boardRect.height / 2) + seatHalfHeight + clampNumber(stageRect.height * 0.205, 112, 196) + (clampNumber(stageRect.height * 0.11, 42, 92) * tightZoomFactor);
  const minimumRadiusX = (boardRect.width / 2) + seatHalfWidth + clampNumber(stageRect.width * 0.068, 52, 98);
  const minimumRadiusY = (boardRect.height / 2) + seatHalfHeight + clampNumber(stageRect.height * 0.13, 76, 134);

  return {
    angles,
    centerX,
    centerY,
    maxRadiusX,
    maxRadiusY,
    maxRadiusTop,
    maxRadiusBottom,
    minimumRadiusX,
    minimumRadiusY,
    padding,
    preferredRadiusX,
    preferredRadiusY
  };
}

function getDesktopStageTightness({ playerCount, stageRect, boardRect }) {
  const baseMetrics = getDesktopSeatLayoutMetrics({
    playerCount,
    stageRect,
    boardRect,
    stageTightness: 0
  });

  if (!baseMetrics) {
    return 0;
  }

  const horizontalCompression = clampNumber(
    (baseMetrics.preferredRadiusX - baseMetrics.maxRadiusX) / Math.max(baseMetrics.preferredRadiusX, 1),
    0,
    1
  );
  const verticalCompression = clampNumber(
    (baseMetrics.preferredRadiusY - baseMetrics.maxRadiusY) / Math.max(baseMetrics.preferredRadiusY, 1),
    0,
    1
  );

  return clampNumber(Math.max(horizontalCompression * 2.1, verticalCompression * 2.8), 0, 1);
}

function buildDesktopSeatLayout({ playerCount, stageRect, boardRect, stageTightness = 0 }) {
  const layoutMetrics = getDesktopSeatLayoutMetrics({
    playerCount,
    stageRect,
    boardRect,
    stageTightness
  });

  if (!layoutMetrics) {
    return [];
  }

  const tightZoomFactor = clampNumber(stageTightness, 0, 1);
  const radiusX = Math.max(
    Math.min(layoutMetrics.preferredRadiusX, layoutMetrics.maxRadiusX),
    Math.min(layoutMetrics.minimumRadiusX, layoutMetrics.maxRadiusX)
  );
  const baseRadiusY = Math.max(
    Math.min(layoutMetrics.preferredRadiusY, layoutMetrics.maxRadiusY),
    Math.min(layoutMetrics.minimumRadiusY, layoutMetrics.maxRadiusY)
  );
  const expandedRadiusY = baseRadiusY + ((layoutMetrics.maxRadiusY - baseRadiusY) * (0.26 + (tightZoomFactor * 0.68)));
  const symmetricRadiusY = clampNumber(
    expandedRadiusY,
    Math.min(layoutMetrics.minimumRadiusY, layoutMetrics.maxRadiusY),
    layoutMetrics.maxRadiusY
  );
  const radiusYTop = clampNumber(
    symmetricRadiusY + ((layoutMetrics.maxRadiusTop - symmetricRadiusY) * (0.72 + (tightZoomFactor * 0.18))),
    Math.min(layoutMetrics.minimumRadiusY, layoutMetrics.maxRadiusTop),
    layoutMetrics.maxRadiusTop
  );
  const radiusYBottom = clampNumber(
    symmetricRadiusY + ((layoutMetrics.maxRadiusBottom - symmetricRadiusY) * (0.32 + (tightZoomFactor * 0.12))),
    Math.min(layoutMetrics.minimumRadiusY, layoutMetrics.maxRadiusBottom),
    layoutMetrics.maxRadiusBottom
  );

  return layoutMetrics.angles.map((angle) => {
    const rawX = layoutMetrics.centerX + (Math.cos(angle) * radiusX);
    const verticalRadius = Math.sin(angle) < 0 ? radiusYTop : radiusYBottom;
    const rawY = layoutMetrics.centerY + (Math.sin(angle) * verticalRadius);

    return {
      x: clampNumber(rawX, layoutMetrics.padding.left, stageRect.width - layoutMetrics.padding.right),
      y: clampNumber(rawY, layoutMetrics.padding.top, stageRect.height - layoutMetrics.padding.bottom),
      angle
    };
  });
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'absolute';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

function Card({ cardString, onClick, disabled, ghosted = false, compact = false, title = '', variant = 'default' }) {
  if (!cardString) {
    return null;
  }

  const cardLabel = getCardLabel(cardString);
  const cardAssetPath = getCardAssetPath(cardString);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : (onClick ? 0 : -1)}
      title={title}
      aria-label={cardLabel}
      className={clsx(
        'relative isolate flex shrink-0 overflow-hidden bg-transparent p-0 transition-[transform,box-shadow,filter,opacity] duration-200',
        variant === 'trick'
          ? 'rounded-[0.22rem]'
          : variant === 'hand'
            ? 'rounded-none'
            : 'rounded-[0.34rem]',
        variant === 'trick' || variant === 'hand'
          ? 'h-full w-full'
          : compact
            ? 'h-[3.85rem] w-[2.6rem] sm:h-[4.3rem] sm:w-[2.9rem] md:h-[4.75rem] md:w-[3.2rem]'
            : 'h-[5.2rem] w-[3.45rem] sm:h-[5.95rem] sm:w-[3.95rem] md:h-[8rem] md:w-[5.2rem] lg:h-[8.7rem] lg:w-[5.65rem]',
        disabled && ghosted
          ? 'cursor-not-allowed opacity-40 saturate-0'
          : disabled
            ? 'cursor-default opacity-90'
            : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_18px_28px_-16px_rgba(0,0,0,0.4)]'
      )}
      style={{
        boxShadow: '0 10px 18px rgba(0, 0, 0, 0.12)'
      }}
    >
      <img
        src={cardAssetPath}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={clsx(
          'block h-full w-full select-none',
          variant === 'hand' ? 'object-fill' : 'object-contain'
        )}
      />
    </button>
  );
}

function ThemeTray({ themes, theme, onThemeChange, mobile = false }) {
  return (
    <div
      className={clsx(
        'relative z-40',
        mobile ? 'flex gap-2 overflow-x-auto p-2' : 'grid grid-cols-1 gap-2.5 p-0 sm:grid-cols-2'
      )}
    >
      {themes.map((themeOption) => (
        <button
          type="button"
          key={themeOption.id}
          onClick={() => onThemeChange(themeOption.id)}
          className={clsx(
            'theme-chip relative z-10',
            theme === themeOption.id ? 'theme-chip-active scale-[1.02]' : 'text-[var(--text-secondary)]'
          )}
        >
          {themeOption.label}
        </button>
      ))}
    </div>
  );
}

function SettingsSlider({ title, description, min, max, step, value, defaultValue, onChange }) {
  const midpointValue = getStepAlignedMidpoint(min, max, step);

  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-xl font-display font-black text-[var(--text-primary)] sm:text-2xl">{title}</h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="status-pill w-fit px-4 py-2">{value}%</div>
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className="rounded-full border border-[var(--glass-border)] bg-[var(--surface-medium)] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] px-4 py-4 sm:px-5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="settings-slider"
          aria-label={title}
        />
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)] sm:text-xs">
          <span>{min}%</span>
          <span>{midpointValue}%</span>
          <span>{max}%</span>
        </div>
        <p className="mt-3 text-xs font-semibold leading-6 text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
    </section>
  );
}

function ChromePanelHeader({ title, accent = 'neutral' }) {
  return (
    <div className="rentz-panel-header">
      <div className="rentz-panel-dots" aria-hidden="true">
        <span className="is-red" />
        <span className="is-yellow" />
        <span className="is-green" />
      </div>
      <h4 className={clsx('rentz-panel-title', accent === 'light' && 'text-white')}>{title}</h4>
    </div>
  );
}

function RentzSeatCluster({
  player,
  seatRole = 'top',
  isCurrent = false,
  isWinner = false,
  isLocal = false,
  showElo = true,
  showStats = true,
  cardCount = 0,
  tricksWon = 0,
  points = null,
  mobileHero = false,
  onEmojiClick
}) {
  const avatarSource = getPlayerAvatarSource(player);
  const rating = getPlayerRating(player);
  const isConnected = getPlayerPresence(player);
  const showTurnMarker = isCurrent && !mobileHero;

  return (
    <article data-seat-player-id={player.userId}
      className={clsx(
        'rentz-seat-cluster',
        `rentz-seat-cluster-${seatRole}`,
        mobileHero && 'rentz-seat-cluster-hero',
        isWinner && 'is-winner',
        showTurnMarker && 'is-current'
      )}
    >
      {showTurnMarker && (
        <div
          className="rentz-seat-turn-marker"
          aria-label={`${getPlayerName(player)} is the current player`}
        />
      )}

      <div className="rentz-seat-name">
        {getPlayerName(player)} {isLocal ? '(You)' : ''}
      </div>

      <div className="rentz-avatar-wrap">
        <button
          type="button"
          onClick={onEmojiClick}
          className="rentz-emoji-button"
          title="Emoji reactions are not wired yet"
          aria-label={`Open emoji reaction menu for ${getPlayerName(player)}`}
        >
          🙂
        </button>
        <span
          className={clsx('rentz-presence-dot', isConnected ? 'is-online' : 'is-offline')}
          title={isConnected ? 'Present in room' : 'Not currently connected'}
        />

        <div className="rentz-avatar-shell">
          {avatarSource ? (
            <img
              src={avatarSource}
              alt={`${getPlayerName(player)} avatar`}
              className="rentz-avatar-image"
            />
          ) : (
            <div className="rentz-avatar-fallback">{getPlayerInitials(player)}</div>
          )}

          {showElo && (
            <div className="rentz-elo-badge">
              <Trophy className="h-3 w-3" />
              <span>{rating == null ? 'ELO --' : `ELO ${rating}`}</span>
            </div>
          )}
        </div>
      </div>

      {showStats && (
        <div className="rentz-seat-stats">
          <div className="rentz-seat-stat">
            <span className="rentz-seat-stat-value">{tricksWon}</span>
            <span className="rentz-seat-stat-label">hands</span>
          </div>
          <div className="rentz-seat-stat">
            <span className="rentz-seat-stat-value">{formatMetaValue(points)}</span>
            <span className="rentz-seat-stat-label">points</span>
          </div>
          <div className="rentz-seat-stat">
            <span className="rentz-seat-stat-value">{cardCount}</span>
            <span className="rentz-seat-stat-label">cards</span>
          </div>
        </div>
      )}
    </article>
  );
}

function CompactPlayerRow({ player, isCurrent, isLocal, cardCount, tricksWon, points }) {
  const rating = getPlayerRating(player);

  return (
    <div data-seat-player-id={player?.userId} className={clsx('rentz-player-row', isCurrent && 'is-current')}>
      <div className="rentz-player-row-avatar">{getPlayerInitials(player)}</div>
      <div className="rentz-player-row-copy">
        <div className="rentz-player-row-name">
          {getPlayerName(player)} {isLocal ? '(You)' : ''}
        </div>
        <div className="rentz-player-row-meta">
          <span>{rating == null ? 'ELO --' : `ELO ${rating}`}</span>
          <span>{cardCount} cards</span>
          <span>{tricksWon} hands</span>
          <span>{formatMetaValue(points)} pts</span>
        </div>
      </div>
    </div>
  );
}

function DesktopPlayerCard({ player, isCurrent, isLocal, cardCount, tricksWon, points }) {
  const rating = getPlayerRating(player);
  const avatarSource = getPlayerAvatarSource(player);

  return (
    <article className={clsx('rentz-desktop-player-card', isCurrent && 'is-current', isLocal && 'is-local')}>
      <div className="rentz-desktop-player-card-top">
        <div className="rentz-desktop-player-card-avatar">
          {avatarSource ? (
            <img
              src={avatarSource}
              alt={`${getPlayerName(player)} avatar`}
              className="rentz-desktop-player-card-avatar-image"
            />
          ) : (
            <div className="rentz-desktop-player-card-avatar-fallback">{getPlayerInitials(player)}</div>
          )}
        </div>
        <div className="rentz-desktop-player-card-copy">
          <div className="rentz-desktop-player-card-name">
            {getPlayerName(player)} {isLocal ? '(You)' : ''}
          </div>
          <div className="rentz-desktop-player-card-rating">
            {rating == null ? 'ELO --' : `ELO ${rating}`} <span aria-hidden="true">★</span>
          </div>
          <div className="rentz-desktop-player-card-stats">
            <span>{cardCount} cards</span>
            <span>{tricksWon} hands</span>
            <span>{formatMetaValue(points)} pts</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function TrickBoard({ currentTrick, trickPending, trickWinnerId, boardRef }) {
  const [flightPaths, setFlightPaths] = useState(null);

  useLayoutEffect(() => {
    if (trickPending && trickWinnerId && currentTrick.length > 0) {
      const timer = window.setTimeout(() => {
        let targetEl = null;

        const mobileHeroEl = document.querySelector('.rentz-mobile-hero .rentz-seat-cluster');
        if (mobileHeroEl && window.getComputedStyle(mobileHeroEl.parentElement).display !== 'none') {
          targetEl = mobileHeroEl;
        } else {
          targetEl = document.querySelector(`.rentz-desktop-seats [data-seat-player-id="${trickWinnerId}"]`);
        }

        if (targetEl && boardRef.current) {
          const boardRect = boardRef.current.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          const flightX = targetRect.left + targetRect.width / 2 - (boardRect.left + boardRect.width / 2);
          const flightY = targetRect.top + targetRect.height / 2 - (boardRect.top + boardRect.height / 2);

          setFlightPaths({ x: flightX, y: flightY });
        }
      }, 50);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setFlightPaths(null), 0);
    return () => window.clearTimeout(timer);
  }, [boardRef, trickPending, trickWinnerId, currentTrick.length]);

  return (
    <section
      ref={boardRef}
      className={clsx('rentz-trick-board', trickPending && 'is-pending')}
      aria-label="Central trick board"
    >
      {(currentTrick || []).map((play, index) => {
        const placement = getTrickCardPlacement(play, index);
        const isFlying = flightPaths !== null;

        return (
          <div
            key={`${play.playedBy || play.playerName || 'player'}-${play.card}-${index}`}
            className="rentz-trick-card"
            style={{
              left: `${placement.left}%`,
              top: `${placement.top}%`,
              transform: isFlying
                ? `translate(calc(-50% + ${flightPaths.x}px), calc(-50% + ${flightPaths.y}px)) scale(0.3)`
                : `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
              transition: isFlying ? `transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.25s ease 0.8s` : 'none',
              opacity: isFlying ? 0 : 1,
              zIndex: index + 1
            }}
          >
            <div className="rentz-trick-card-content">
              <Card cardString={play.card} compact disabled variant="trick" />
            </div>
          </div>
        );
      })}
    </section>
  );
}

function CollectedHandsView({ players, collectedHandsByPlayer, myPlayerId }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {players.map((player) => {
        const tricks = collectedHandsByPlayer[player.userId] || [];
        const isMe = player.userId === myPlayerId;

        return (
          <section key={player.userId} className="glass-panel p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xl font-display font-black text-[var(--text-primary)]">
                  {getPlayerName(player)} {isMe ? '(You)' : ''}
                </h4>
                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                  {tricks.length} collected hand{tricks.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="status-pill px-3 py-2">{tricks.length}</div>
            </div>

            {tricks.length === 0 ? (
              <div className="rounded-[1.3rem] border border-dashed border-[var(--glass-border)] bg-[var(--surface-subtle)] p-5 text-sm font-semibold text-[var(--text-secondary)]">
                No hands collected yet.
              </div>
            ) : (
              <div className="space-y-3">
                {tricks.map((trick, trickIndex) => (
                  <div key={`${player.userId}-${trickIndex}`} className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-subtle)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        Hand {trickIndex + 1}
                      </span>
                      <span className="text-xs font-bold text-[var(--text-secondary)]">
                        Won by {getPlayerName(player)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {trick.map((play, playIndex) => (
                        <div key={`${player.userId}-${trickIndex}-${playIndex}`} className="flex flex-col items-center gap-1">
                          <Card cardString={play.card} compact disabled />
                          <span className="max-w-[4.5rem] truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                            {play.playerName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  wide = false,
  headerAside = null,
  afterPanel = null,
  overlayClassName = '',
  panelClassName = '',
  bodyClassName = ''
}) {
  return (
    <div className={clsx('rentz-modal-overlay fixed inset-0 z-[80] flex items-center justify-center px-4 py-6', overlayClassName)}>
      <div className={clsx('rentz-modal-panel glass-panel flex max-h-[82vh] w-full flex-col rounded-[2rem] p-5 sm:p-6', wide ? 'max-w-6xl' : 'max-w-3xl', panelClassName)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                {eyebrow}
              </div>
            )}
            <h3 className="mt-2 text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">
              {title}
            </h3>
          </div>
          {headerAside}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--glass-border)] bg-[var(--surface-medium)] p-2 text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className={clsx('mt-5 min-h-0 flex-1 overflow-y-auto pr-1', bodyClassName)} data-rentz-modal-scroll="y">
          {children}
        </div>
        {footer && <div className="mt-5 shrink-0">{footer}</div>}
      </div>
      {afterPanel}
    </div>
  );
}

function ToggleCheck({ checked, disabled = false, onChange, label, compact = false }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        'rentz-toggle-check',
        checked && 'is-checked',
        disabled && 'is-disabled',
        compact && 'is-compact'
      )}
    >
      <span className="rentz-toggle-check-mark" aria-hidden="true">
        <Check className="h-3.5 w-3.5" strokeWidth={3.2} />
      </span>
    </button>
  );
}

function StatsOverlay({ stats, players, onClose, onContinue, canContinue, matchComplete }) {
  if (!stats) {
    return null;
  }

  const playersById = new Map(players.map((player) => [player.userId, player]));
  const rankingRows = players.map((player) => {
    const previousRank = stats.previousRanks?.[player.userId];
    const nextRank = stats.nextRanks?.[player.userId];
    const previousPoints = stats.previousPoints?.[player.userId] || 0;
    const nextPoints = stats.nextPoints?.[player.userId] || 0;
    const scoreDelta = stats.scoreDeltas?.[player.userId] || 0;

    return {
      player,
      previousRank,
      nextRank,
      previousPoints,
      nextPoints,
      scoreDelta
    };
  }).sort((left, right) => {
    const leftRank = left.nextRank || 999;
    const rightRank = right.nextRank || 999;
    return leftRank - rightRank;
  });

  return (
    <ModalShell
      title={matchComplete ? 'Final Stats' : 'Round Stats'}
      eyebrow={`${stats.rulesetLabel || 'Ruleset'}${stats.nv ? ' (NV)' : ''}`}
      wide
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {canContinue && !matchComplete && (
            <button type="button" onClick={onContinue} className="frutiger-button px-5 py-3 text-sm uppercase tracking-[0.14em]">
              Continue Match
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            Hide
          </button>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="status-pill px-4 py-3">Time {formatDuration(stats.durationMs)}</div>
            <div className="status-pill px-4 py-3">Game {stats.rulesetAbbreviation || stats.rulesetLabel}</div>
            <div className="status-pill px-4 py-3">{stats.nv ? 'NV x2' : 'Normal'}</div>
          </div>

          <div className="mt-4 space-y-3">
            {rankingRows.map(({ player, previousRank, nextRank, previousPoints, nextPoints, scoreDelta }) => (
              <div key={player.userId} className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-[var(--glass-border)] bg-[var(--surface-subtle)] px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-black text-[var(--text-primary)]">{getPlayerName(player)}</div>
                  <div className="text-xs font-bold text-[var(--text-secondary)]">
                    Rank {previousRank || '—'} → {nextRank || '—'} ({getRankDelta(previousRank, nextRank)})
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                    <span className="rounded-full bg-slate-200/85 px-3 py-1 text-slate-700">
                      Current {previousPoints}
                    </span>
                    <span className="rounded-full bg-sky-200/80 px-3 py-1 text-sky-900">
                      Final {nextPoints}
                    </span>
                  </div>
                </div>
                <div className={clsx('text-lg font-black', scoreDelta >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                  {scoreDelta >= 0 ? '+' : ''}{scoreDelta}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-lg font-display font-black text-[var(--text-primary)]">Taken Hands</h4>
            <div className="status-pill px-3 py-2">{stats.tricks?.length || 0}</div>
          </div>
          <div className="grid max-h-[46vh] gap-3 overflow-y-auto pr-1" data-rentz-modal-scroll="y">
            {(stats.tricks || []).length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-[var(--glass-border)] bg-[var(--surface-subtle)] p-4 text-sm font-semibold text-[var(--text-secondary)]">
                No hands were taken in this round.
              </div>
            ) : stats.tricks.map((trick) => (
              <div key={`${stats.roundId}-${trick.index}`} className="rounded-[1.2rem] border border-[var(--glass-border)] bg-[var(--surface-subtle)] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">Hand {trick.index}</span>
                  <span className={clsx('rounded-full px-3 py-1 text-xs font-black', trick.scoreDelta >= 0 ? 'bg-emerald-200/80 text-emerald-900' : 'bg-red-200/80 text-red-900')}>
                    {trick.scoreDelta >= 0 ? '+' : ''}{trick.scoreDelta}
                  </span>
                </div>
                <div className="mb-3 text-sm font-bold text-[var(--text-secondary)]">
                  Taken by {getPlayerName(playersById.get(trick.takenBy)) || trick.takenByName}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(trick.cards || []).map((play, index) => (
                    <div key={`${trick.index}-${play.card}-${index}`} className="flex flex-col items-center gap-1">
                      <Card cardString={play.card} compact disabled />
                      <span className="max-w-[4.5rem] truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                        {play.playerName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ModalShell>
  );
}

function App() {
  const [theme, setTheme] = useState(() =>
    readStoredPreference(
      STORAGE_KEYS.theme,
      'theme-frutiger-lime',
      ['theme-frutiger-lime', 'theme-dark-glass', 'theme-light-gloss', 'theme-colorful-aero']
    )
  );
  const [fontScale, setFontScale] = useState(() =>
    readStoredPreference(
      STORAGE_KEYS.fontScale,
      FONT_SCALE_RANGE.defaultValue / 100,
      createStepValues(FONT_SCALE_RANGE.min, FONT_SCALE_RANGE.max, FONT_SCALE_RANGE.step).map((value) => value / 100)
    )
  );
  const [pageZoom, setPageZoom] = useState(() =>
    readStoredPreference(
      STORAGE_KEYS.pageZoom,
      PAGE_ZOOM_RANGE.defaultValue / 100,
      createStepValues(PAGE_ZOOM_RANGE.min, PAGE_ZOOM_RANGE.max, PAGE_ZOOM_RANGE.step).map((value) => value / 100)
    )
  );
  const [activeTab, setActiveTab] = useState('play');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [playView, setPlayView] = useState('table');

  const [inLobby, setInLobby] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [players, setPlayers] = useState([]);
  const [spectators, setSpectators] = useState([]);
  const [lobbyHostId, setLobbyHostId] = useState('');
  const [roomSettings, setRoomSettings] = useState(() => normalizeRoomSettings());
  const [draftRoomSettings, setDraftRoomSettings] = useState(() => normalizeRoomSettings());
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomVisibility, setRoomVisibility] = useState(DEFAULT_ROOM_VISIBILITY);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomVisibility, setNewRoomVisibility] = useState(DEFAULT_ROOM_VISIBILITY);
  const [isPublicBrowserOpen, setIsPublicBrowserOpen] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [publicRoomsLoading, setPublicRoomsLoading] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestProfile, setGuestProfile] = useState(null);
  const [recoverableGuestSession, setRecoverableGuestSession] = useState(() => readRecoverableGuestSessionForCurrentNavigation());
  const [isRecoveryPromptOpen, setIsRecoveryPromptOpen] = useState(() => Boolean(recoverableGuestSession?.profile));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const [gameStarted, setGameStarted] = useState(false);
  const [isSpectatingGame, setIsSpectatingGame] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [trickPending, setTrickPending] = useState(false);
  const [hand, setHand] = useState([]);
  const [startingHandSize, setStartingHandSize] = useState(0);
  const [cardCounts, setCardCounts] = useState({});
  const [currentTrick, setCurrentTrick] = useState([]);
  const [trickSuit, setTrickSuit] = useState(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [myIndex, setMyIndex] = useState(-1);
  const [animatingWinner, setAnimatingWinner] = useState(null);
  const [trickWinnerId, setTrickWinnerId] = useState(null);
  const [collectedHandsByPlayer, setCollectedHandsByPlayer] = useState({});
  const [choiceState, setChoiceState] = useState(null);
  const [latestRoundStats, setLatestRoundStats] = useState(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [matchCompletePending, setMatchCompletePending] = useState(false);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [activityFeed, setActivityFeed] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [finalStandings, setFinalStandings] = useState([]);
  const [topPrompts, setTopPrompts] = useState([]);
  const [turnTimerNotice, setTurnTimerNotice] = useState('');
  const [isSpectatorPopoverOpen, setIsSpectatorPopoverOpen] = useState(false);
  const [desktopSeatLayout, setDesktopSeatLayout] = useState([]);
  const [desktopStageTightness, setDesktopStageTightness] = useState(0);
  const [handSpreadMetrics, setHandSpreadMetrics] = useState(null);
  const [hoveredCardIndex, setHoveredCardIndex] = useState(null);
  const [pendingPlayCard, setPendingPlayCard] = useState(null);
  const topPromptTimeoutsRef = useRef(new Map());
  const gameEventTimeoutsRef = useRef(new Set());
  const latestGameStateVersionRef = useRef(0);
  const startingHandSizeRef = useRef(0);
  const activeProfileRef = useRef(null);
  const mobileNavRef = useRef(null);
  const tableStageRef = useRef(null);
  const cardBoardRef = useRef(null);
  const handScrollRef = useRef(null);
  const choiceHandScrollRef = useRef(null);
  const editorImportInputRef = useRef(null);
  const roomImportInputRef = useRef(null);
  const spectatorPopoverRef = useRef(null);
  const turnTimerWarningStateRef = useRef({ deadline: null, halfShown: false, quarterShown: false });
  const turnTimerNoticeTimeoutRef = useRef(null);

  const [editorTitle, setEditorTitle] = useState('My House Rules');
  const [editorShortName, setEditorShortName] = useState('MHR');
  const [editorType, setEditorType] = useState('per_round');
  const [editorCode, setEditorCode] = useState(
    'if(HEART_KING)\n  add(-100)\n  game_end()\nendif'
  );
  const [editorStatus, setEditorStatus] = useState('');
  const [editorAst, setEditorAst] = useState(null);
  const [ruleDrafts, setRuleDrafts] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('rentz-rule-drafts') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    document.body.className = theme;
    document.documentElement.classList.remove(
      'theme-frutiger-lime',
      'theme-dark-glass',
      'theme-light-gloss',
      'theme-colorful-aero'
    );
    document.documentElement.classList.add(theme);

    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-scale', `${fontScale}`);

    try {
      window.localStorage.setItem(STORAGE_KEYS.fontScale, `${fontScale}`);
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.style.setProperty('--page-zoom', `${pageZoom}`);

    try {
      window.localStorage.setItem(STORAGE_KEYS.pageZoom, `${pageZoom}`);
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }, [pageZoom]);

  useEffect(() => {
    try {
      window.localStorage.setItem('rentz-rule-drafts', JSON.stringify(ruleDrafts));
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }, [ruleDrafts]);

  function applyRestoredSession(response) {
    if (!response?.success || !response.roomId || !response.lobby) {
      return;
    }

    const restoredGame = response.game || null;
    const restoredHand = restoredGame?.hand || [];

    updateStoredGuestRoom(response.roomId);
    setRoomId(response.roomId);
    setInLobby(true);
    setActiveTab('play');
    setIsPublicBrowserOpen(false);
    setIsRoomSettingsOpen(false);
    setPlayers(response.lobby.players || []);
    setSpectators(response.lobby.spectators || []);
    setLobbyHostId(response.lobby.hostId || '');
    const nextRoomSettings = normalizeRoomSettings(response.lobby.roomSettings);
    setRoomSettings(nextRoomSettings);
    setDraftRoomSettings(nextRoomSettings);
    setRoomName(response.lobby.roomName || nextRoomSettings.roomName || '');
    setRoomVisibility(response.lobby.visibility || nextRoomSettings.visibility || DEFAULT_ROOM_VISIBILITY);

    if (!restoredGame) {
      setGameStarted(false);
      setIsSpectatingGame(false);
      setGameFinished(false);
      setChoiceState(null);
      setHand([]);
      setStartingHandSize(0);
      startingHandSizeRef.current = 0;
      setLatestRoundStats(null);
      setIsStatsOpen(false);
      setMatchCompletePending(false);
      return;
    }

    const restoredStartingHandSize = restoredGame.startingHandSize || restoredHand.length;
    startingHandSizeRef.current = restoredStartingHandSize;
    setGameStarted(Boolean(restoredGame.gameStarted));
    setIsSpectatingGame(Boolean(restoredGame.isSpectator));
    setGameFinished(Boolean(restoredGame.gameFinished));
    setTrickPending(Boolean(restoredGame.trickPending));
    setPlayView('table');
    setHand(restoredHand);
    setStartingHandSize(restoredStartingHandSize);
    setMyIndex(typeof restoredGame.playerIndex === 'number' ? restoredGame.playerIndex : -1);
    setTurnIndex(restoredGame.turnIndex || 0);
    setTrickSuit(restoredGame.trickSuit || null);
    setCardCounts(restoredGame.cardCounts || {});
    setCollectedHandsByPlayer(restoredGame.collectedHandsByPlayer || {});
    setCurrentTrick(restoredGame.currentTrick || []);
    setPendingPlayCard(null);
    setAnimatingWinner(null);
    setTrickWinnerId(null);
    setChoiceState(restoredGame.choiceState || null);
    setLatestRoundStats(restoredGame.latestRoundStats || null);
    setIsStatsOpen(Boolean(restoredGame.latestRoundStats && restoredGame.choiceState?.phase === 'round_stats'));
    setMatchCompletePending(Boolean(restoredGame.matchComplete));
    setFinalStandings(restoredGame.standings || []);
    applyPlayerPoints(restoredGame.playerPoints);
    if (typeof restoredGame.stateVersion === 'number') {
      latestGameStateVersionRef.current = restoredGame.stateVersion;
    }
  }

  function resetActiveRoomState() {
    const defaultRoomSettings = normalizeRoomSettings();

    if (turnTimerNoticeTimeoutRef.current) {
      window.clearTimeout(turnTimerNoticeTimeoutRef.current);
      turnTimerNoticeTimeoutRef.current = null;
    }

    updateStoredGuestRoom(null);
    latestGameStateVersionRef.current = 0;
    startingHandSizeRef.current = 0;
    setInLobby(false);
    setGameStarted(false);
    setIsSpectatingGame(false);
    setGameFinished(false);
    setRoomId('');
    setRoomName('');
    setRoomVisibility(DEFAULT_ROOM_VISIBILITY);
    setPlayers([]);
    setSpectators([]);
    setLobbyHostId('');
    setRoomSettings(defaultRoomSettings);
    setDraftRoomSettings(defaultRoomSettings);
    setChoiceState(null);
    setHand([]);
    setStartingHandSize(0);
    setMyIndex(-1);
    setTurnIndex(0);
    setTrickSuit(null);
    setCardCounts({});
    setCollectedHandsByPlayer({});
    setCurrentTrick([]);
    setPendingPlayCard(null);
    setAnimatingWinner(null);
    setTrickWinnerId(null);
    setPlayView('table');
    setActivityFeed([]);
    setErrorMsg('');
    setFinalStandings([]);
    setTopPrompts([]);
    setTurnTimerNotice('');
    setIsSpectatorPopoverOpen(false);
    setLatestRoundStats(null);
    setIsStatsOpen(false);
    setMatchCompletePending(false);
    setIsRoomSettingsOpen(false);
  }

  useEffect(() => {
    const promptTimeouts = topPromptTimeoutsRef.current;
    const gameEventTimeouts = gameEventTimeoutsRef.current;

    const clearScheduledGameEventTimeouts = () => {
      gameEventTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      gameEventTimeouts.clear();
    };

    const registerGameStateVersion = (nextVersion, { reset = false } = {}) => {
      if (typeof nextVersion !== 'number') {
        if (reset) {
          latestGameStateVersionRef.current = 0;
        }
        return latestGameStateVersionRef.current;
      }

      latestGameStateVersionRef.current = reset
        ? nextVersion
        : Math.max(latestGameStateVersionRef.current, nextVersion);

      return latestGameStateVersionRef.current;
    };

    const scheduleVersionedGameStateUpdate = (stateVersion, callback) => {
      registerGameStateVersion(stateVersion);

      const timeoutId = window.setTimeout(() => {
        gameEventTimeouts.delete(timeoutId);

        if (typeof stateVersion === 'number' && stateVersion < latestGameStateVersionRef.current) {
          return;
        }

        callback();
      }, 1050);

      gameEventTimeouts.add(timeoutId);
    };

    const authenticateAndRestoreSession = () => {
      const profile = activeProfileRef.current;
      if (!profile?.userId) {
        return;
      }

      socket.emit('authenticate', profile);
      socket.emit('restore_session', {}, (response) => {
        if (response?.success) {
          applyRestoredSession(response);
        }
      });
    };

    socket.connect();
    socket.on('connect', authenticateAndRestoreSession);
    if (socket.connected) {
      authenticateAndRestoreSession();
    }

    socket.on('lobby_update', (lobby) => {
      const { players: lobbyPlayers, spectators: lobbySpectators, hostId: nextHostId } = lobby || {};
      setPlayers(lobbyPlayers || []);
      setSpectators(lobbySpectators || []);
      setLobbyHostId(nextHostId || '');
      const nextRoomSettings = normalizeRoomSettings(lobby?.roomSettings);
      setRoomSettings(nextRoomSettings);
      setDraftRoomSettings(nextRoomSettings);
      setRoomName(lobby?.roomName || nextRoomSettings.roomName || '');
      setRoomVisibility(lobby?.visibility || nextRoomSettings.visibility || DEFAULT_ROOM_VISIBILITY);
    });

    socket.on('game_started', ({ hand: nextHand, playerIndex, isSpectator, turnIndex: nextTurnIndex, cardCounts: nextCardCounts, playerPoints: nextPlayerPoints, trickSuit: nextTrickSuit, collectedHandsByPlayer: nextCollectedHands, stateVersion, choiceState: nextChoiceState }) => {
      clearScheduledGameEventTimeouts();
      registerGameStateVersion(stateVersion, { reset: true });
      const resolvedHand = nextHand || [];
      startingHandSizeRef.current = resolvedHand.length;
      setGameStarted(true);
      setIsSpectatingGame(Boolean(isSpectator));
      setGameFinished(false);
      setTrickPending(false);
      setPlayView('table');
      setHand(resolvedHand);
      setStartingHandSize(resolvedHand.length);
      setMyIndex(typeof playerIndex === 'number' ? playerIndex : -1);
      setTurnIndex(nextTurnIndex);
      setTrickSuit(nextTrickSuit || null);
      setCardCounts(nextCardCounts || {});
      setCollectedHandsByPlayer(nextCollectedHands || {});
      setCurrentTrick([]);
      setPendingPlayCard(null);
      setAnimatingWinner(null);
      setTrickWinnerId(null);
      setActivityFeed([]);
      setFinalStandings([]);
      setChoiceState(nextChoiceState || null);
      setLatestRoundStats(null);
      setIsStatsOpen(false);
      setMatchCompletePending(false);
      applyPlayerPoints(nextPlayerPoints);
    });

    socket.on('choice_state_update', ({ choiceState: nextChoiceState, cardCounts: nextCardCounts, playerPoints: nextPlayerPoints, stateVersion }) => {
      registerGameStateVersion(stateVersion);
      setChoiceState(nextChoiceState || null);
      if (nextChoiceState?.phase && nextChoiceState.phase !== 'round_stats') {
        setIsStatsOpen(false);
        setMatchCompletePending(false);
      }
      if (nextCardCounts) {
        setCardCounts(nextCardCounts);
      }
      applyPlayerPoints(nextPlayerPoints);
    });

    socket.on('small_game_started', ({ message, choiceState: nextChoiceState, currentTrick: nextTrick, turnIndex: nextTurnIndex, trickSuit: nextTrickSuit, cardCounts: nextCardCounts, playerPoints: nextPlayerPoints, collectedHandsByPlayer: nextCollectedHands, stateVersion }) => {
      registerGameStateVersion(stateVersion);
      setChoiceState(nextChoiceState || null);
      setIsStatsOpen(false);
      setMatchCompletePending(false);
      setCurrentTrick(nextTrick || []);
      setTurnIndex(nextTurnIndex || 0);
      setTrickSuit(nextTrickSuit || null);
      setTrickPending(false);
      setAnimatingWinner(null);
      setTrickWinnerId(null);
      if (nextCardCounts) {
        setCardCounts(nextCardCounts);
      }
      if (nextCollectedHands) {
        setCollectedHandsByPlayer(nextCollectedHands);
      }
      applyPlayerPoints(nextPlayerPoints);
      if (message) {
        setActivityFeed((current) => [message, ...current].slice(0, MAX_ACTIVITY_FEED_ITEMS));
        showTopPrompt(message, 'success');
      }
    });

    socket.on('game_update', ({ currentTrick: nextTrick, turnIndex: nextTurnIndex, trickSuit: nextTrickSuit, cardCounts: nextCardCounts, stateVersion, choiceState: nextChoiceState }) => {
      registerGameStateVersion(stateVersion);
      setCurrentTrick(nextTrick);
      setTurnIndex(nextTurnIndex);
      setTrickSuit(nextTrickSuit || null);
      setTrickPending(false);
      setAnimatingWinner(null);
      setTrickWinnerId(null);
      if (nextChoiceState) {
        setChoiceState(nextChoiceState);
      }
      if (nextCardCounts) {
        setCardCounts(nextCardCounts);
      }
    });

    socket.on('hand_update', (nextHand) => {
      const resolvedHand = nextHand || [];
      if (resolvedHand.length > 0 && startingHandSizeRef.current === 0) {
        startingHandSizeRef.current = resolvedHand.length;
        setStartingHandSize(resolvedHand.length);
      }
      setHand(resolvedHand);
    });

    socket.on('trick_won', ({ winnerName, winnerId, scoreDelta, collectedHandsByPlayer: nextCollectedHands, cardCounts: nextCardCounts, playerPoints: nextPlayerPoints, stateVersion, choiceState: nextChoiceState }) => {
      registerGameStateVersion(stateVersion);
      setAnimatingWinner(winnerName);
      setTrickWinnerId(winnerId);
      setTrickPending(true);
      if (nextChoiceState) {
        setChoiceState(nextChoiceState);
      }
      scheduleVersionedGameStateUpdate(stateVersion, () => {
        if (nextCollectedHands) {
          setCollectedHandsByPlayer(nextCollectedHands);
        }
        if (nextCardCounts) {
          setCardCounts(nextCardCounts);
        }
        applyPlayerPoints(nextPlayerPoints);
        setActivityFeed((current) => [`${winnerName} took the hand${typeof scoreDelta === 'number' ? ` (${scoreDelta >= 0 ? '+' : ''}${scoreDelta})` : ''}.`, ...current].slice(0, MAX_ACTIVITY_FEED_ITEMS));
      });
    });

    socket.on('trick_end', ({ nextTurnIndex, trickSuit: nextTrickSuit, collectedHandsByPlayer: nextCollectedHands, cardCounts: nextCardCounts, playerPoints: nextPlayerPoints, gameFinished: finished, stateVersion, choiceState: nextChoiceState }) => {
      scheduleVersionedGameStateUpdate(stateVersion, () => {
        setTurnIndex(nextTurnIndex);
        setCurrentTrick([]);
        setAnimatingWinner(null);
        if (!finished) {
          setTrickWinnerId(null);
        }
        setTrickSuit(nextTrickSuit || null);
        setTrickPending(Boolean(finished));
        if (nextCollectedHands) {
          setCollectedHandsByPlayer(nextCollectedHands);
        }
        if (nextCardCounts) {
          setCardCounts(nextCardCounts);
        }
        if (nextChoiceState) {
          setChoiceState(nextChoiceState);
        }
        applyPlayerPoints(nextPlayerPoints);
      });
    });

    socket.on('round_finished', ({ roundStats, matchComplete, standings, choiceState: nextChoiceState, collectedHandsByPlayer: nextCollectedHands, cardCounts: nextCardCounts, playerPoints: nextPlayerPoints, stateVersion }) => {
      scheduleVersionedGameStateUpdate(stateVersion, () => {
        setLatestRoundStats(roundStats || null);
        setIsStatsOpen(Boolean(roundStats));
        setMatchCompletePending(Boolean(matchComplete));
        setChoiceState(nextChoiceState || null);
        setTrickPending(false);
        setCurrentTrick([]);
        if (standings) {
          setFinalStandings(standings);
        }
        if (nextCollectedHands) {
          setCollectedHandsByPlayer(nextCollectedHands);
        }
        if (nextCardCounts) {
          setCardCounts(nextCardCounts);
        }
        applyPlayerPoints(nextPlayerPoints);
      });
    });

    socket.on('game_finished', ({ winnerId, winnerName, standings, collectedHandsByPlayer: nextCollectedHands, cardCounts: nextCardCounts, playerPoints: nextPlayerPoints, stateVersion, choiceState: nextChoiceState }) => {
      scheduleVersionedGameStateUpdate(stateVersion, () => {
        setGameFinished(true);
        setTrickPending(false);
        setTrickWinnerId(winnerId);
        setAnimatingWinner(null);
        setFinalStandings(standings || []);
        setChoiceState(nextChoiceState || null);
        setMatchCompletePending(true);
        setIsStatsOpen(true);
        if (nextCollectedHands) {
          setCollectedHandsByPlayer(nextCollectedHands);
        }
        if (nextCardCounts) {
          setCardCounts(nextCardCounts);
        }
        applyPlayerPoints(nextPlayerPoints);
        setActivityFeed((current) => [`Game finished. ${winnerName} won the final hand.`, ...current].slice(0, MAX_ACTIVITY_FEED_ITEMS));
      });
    });

    socket.on('lobby_removed', ({ reason }) => {
      resetActiveRoomState();
      showTopPrompt(reason || 'You were removed from the room.', 'error');
    });

    socket.on('lobby_deleted', ({ reason, deletedBy }) => {
      resetActiveRoomState();
      showTopPrompt(
        deletedBy === activeProfileRef.current?.userId ? 'Room deleted.' : (reason || 'The room was deleted.'),
        deletedBy === activeProfileRef.current?.userId ? 'info' : 'error'
      );
    });

    socket.on('game_error', (message) => {
      setErrorMsg(message);
      window.setTimeout(() => setErrorMsg(''), 3000);
    });

    return () => {
      promptTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      promptTimeouts.clear();
      clearScheduledGameEventTimeouts();

      socket.off('connect', authenticateAndRestoreSession);
      socket.off('lobby_update');
      socket.off('game_started');
      socket.off('choice_state_update');
      socket.off('small_game_started');
      socket.off('game_update');
      socket.off('hand_update');
      socket.off('trick_won');
      socket.off('trick_end');
      socket.off('round_finished');
      socket.off('game_finished');
      socket.off('lobby_removed');
      socket.off('lobby_deleted');
      socket.off('game_error');
    };
    // Socket listeners are registered once; reconnect auth reads the live profile from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSpectatorPopoverOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (spectatorPopoverRef.current?.contains(event.target)) {
        return;
      }

      setIsSpectatorPopoverOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSpectatorPopoverOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSpectatorPopoverOpen]);

  const showTopPrompt = (message, tone = 'info') => {
    const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setTopPrompts((current) => [...current, { id: promptId, message, tone }]);

    const timeoutId = window.setTimeout(() => {
      setTopPrompts((current) => current.filter((prompt) => prompt.id !== promptId));
      topPromptTimeoutsRef.current.delete(promptId);
    }, 1200);

    topPromptTimeoutsRef.current.set(promptId, timeoutId);
  };

  const applyPlayerPoints = (playerPoints) => {
    if (!playerPoints || typeof playerPoints !== 'object') {
      return;
    }

    setPlayers((current) => current.map((player) => ({
      ...player,
      points: Object.prototype.hasOwnProperty.call(playerPoints, player.userId)
        ? playerPoints[player.userId]
        : (player.points ?? 0)
    })));
  };

  const applyLobbyState = (lobby) => {
    setPlayers(lobby?.players || []);
    setSpectators(lobby?.spectators || []);
    setLobbyHostId(lobby?.hostId || '');
    const nextRoomSettings = normalizeRoomSettings(lobby?.roomSettings);
    setRoomSettings(nextRoomSettings);
    setDraftRoomSettings(nextRoomSettings);
    setRoomName(lobby?.roomName || nextRoomSettings.roomName || '');
    setRoomVisibility(lobby?.visibility || nextRoomSettings.visibility || DEFAULT_ROOM_VISIBILITY);
  };

  const showErrorMessage = (message) => {
    setErrorMsg(message);
    window.setTimeout(() => setErrorMsg(''), 3000);
  };

  const recoverableGuestProfile = recoverableGuestSession?.profile || null;
  const recoverableGuestRoomId = recoverableGuestSession?.roomId || null;

  const createSessionProfile = (name, guest = false) => ({
    userId: Math.random().toString(36).slice(2, 10),
    name,
    guest
  });

  const handleGuestContinue = () => {
    const trimmedName = guestNameInput.trim();
    if (!trimmedName) {
      return;
    }

    const profile = createSessionProfile(trimmedName, true);
    storeGuestProfile(profile);
    socket.emit('authenticate', profile);
    setGuestProfile(profile);
    setRecoverableGuestSession(null);
    setIsRecoveryPromptOpen(false);
    setActiveTab('play');
  };

  const handleRejoinRecoverableSession = () => {
    if (!recoverableGuestProfile?.userId) {
      setIsRecoveryPromptOpen(false);
      return;
    }

    storeGuestProfile(recoverableGuestProfile, { roomId: recoverableGuestRoomId });
    setGuestProfile(recoverableGuestProfile);
    setGuestNameInput(recoverableGuestProfile.name || '');
    setRecoverableGuestSession(null);
    setIsRecoveryPromptOpen(false);
    setActiveTab('play');

    socket.emit('authenticate', recoverableGuestProfile);
    socket.emit('restore_session', {}, (response) => {
      if (response?.success && response.restoredRoom !== false && response.lobby) {
        applyRestoredSession(response);
        return;
      }

      showTopPrompt(
        recoverableGuestRoomId
          ? 'Rejoined player session. Previous room is no longer available.'
          : 'Rejoined player session.',
        recoverableGuestRoomId ? 'error' : 'info'
      );
    });
  };

  const handleStartFreshSession = () => {
    const nextName = recoverableGuestProfile?.name || guestNameInput.trim() || 'Player';
    const profile = createSessionProfile(nextName, true);

    if (recoverableGuestProfile?.userId) {
      socket.emit('authenticate', recoverableGuestProfile);
      socket.emit('abandon_session', {});
    }

    storeGuestProfile(profile);
    setGuestProfile(profile);
    setGuestNameInput(nextName);
    setRecoverableGuestSession(null);
    setIsRecoveryPromptOpen(false);
    setActiveTab('play');
    socket.emit('authenticate', profile);
  };

  const handleLogout = () => {
    if (inLobby || gameStarted) {
      setErrorMsg('Leave the current room before switching players.');
      window.setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    setIsAuthenticated(false);
    setUserProfile(null);
    setActiveTab('login');
  };

  const handleGuestReset = () => {
    if (inLobby || gameStarted) {
      setErrorMsg('Leave the current room before changing your guest name.');
      window.setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    setGuestNameInput(guestProfile?.name || '');
    storeGuestProfile(null);
    setRecoverableGuestSession(null);
    setIsRecoveryPromptOpen(false);
    setGuestProfile(null);
    setActiveTab('play');
  };

  const handleCreateLobby = () => {
    if (!activeProfile) {
      showErrorMessage('Choose a guest name or sign in before creating a room.');
      setActiveTab('play');
      return;
    }

    socket.emit('authenticate', activeProfile);
    socket.emit('create_lobby', {
      roomName: newRoomName,
      visibility: newRoomVisibility
    }, (response) => {
      if (response.success) {
        updateStoredGuestRoom(response.roomId);
        setRoomId(response.roomId);
        setInLobby(true);
        setGameStarted(false);
        setIsSpectatingGame(false);
        setGameFinished(false);
        setFinalStandings([]);
        setIsPublicBrowserOpen(false);
        applyLobbyState(response.lobby);
      } else if (response.error) {
        showErrorMessage(response.error);
      }
    });
  };

  const handleJoinLobby = () => {
    if (!activeProfile) {
      showErrorMessage('Choose a guest name or sign in before joining a room.');
      setActiveTab('play');
      return;
    }

    if (!joinInput.trim()) {
      return;
    }

    socket.emit('authenticate', activeProfile);
    socket.emit('join_lobby', { roomId: joinInput.toUpperCase() }, (response) => {
      if (response.success) {
        updateStoredGuestRoom(response.roomId);
        setRoomId(response.roomId);
        setInLobby(true);
        setGameStarted(false);
        setIsSpectatingGame(false);
        setGameFinished(false);
        setFinalStandings([]);
        setIsPublicBrowserOpen(false);
        applyLobbyState(response.lobby);
        if (response.autoSpectator) {
          showTopPrompt(`All ${MAX_ACTIVE_PLAYERS} player seats are full. You joined as a spectator.`, 'info');
        }
      } else if (response.error) {
        if (response.error === 'Game already in progress') {
          showTopPrompt(response.error, 'error');
        } else {
          showErrorMessage(response.error);
        }
      }
    });
  };

  const getEditorRulesetPayload = () => {
    const longName = editorTitle.trim() || 'Untitled Ruleset';

    return {
      longName,
      shortName: editorShortName.trim() || buildRulesetShortNameFallback(longName),
      type: normalizeRulesetType(editorType),
      code: editorCode
    };
  };

  const handleCompileRules = async () => {
    try {
      setEditorStatus('Compiling ruleset...');
      const response = await fetch('/api/rulesets/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: editorCode,
          type: editorType
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to compile ruleset');
      }

      setEditorAst(data.ast);
      setEditorStatus('Ruleset compiled successfully.');
    } catch (error) {
      setEditorStatus(error.message);
      setEditorAst(null);
    }
  };

  const handleSaveDraft = () => {
    const payload = getEditorRulesetPayload();
    const nextDraft = {
      id: `${Date.now()}`,
      title: payload.longName,
      shortName: payload.shortName,
      type: payload.type,
      code: payload.code,
      updatedAt: new Date().toISOString()
    };

    setRuleDrafts((current) => [nextDraft, ...current.filter((draft) => draft.title !== nextDraft.title)].slice(0, 10));
    setEditorStatus('Draft saved locally.');
  };

  const handleDownloadRentzRuleset = () => {
    const payload = getEditorRulesetPayload();
    const fileText = formatRentzRuleset(payload);
    const blob = new Blob([fileText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = buildRulesetDownloadName(payload.longName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setEditorStatus('Ruleset downloaded as .rentz.');
  };

  const readRentzFileFromInput = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return null;
    }

    const sourceText = await file.text();
    const ruleset = parseRentzRulesetText(sourceText);
    if (!ruleset.code.trim()) {
      throw new Error('Imported .rentz file does not contain ruleset code');
    }

    return ruleset;
  };

  const handleImportRentzToEditor = async (event) => {
    try {
      const importedRuleset = await readRentzFileFromInput(event);
      if (!importedRuleset) {
        return;
      }

      setEditorTitle(importedRuleset.longName);
      setEditorShortName(importedRuleset.shortName);
      setEditorType(importedRuleset.type);
      setEditorCode(importedRuleset.code);
      setEditorAst(null);
      setEditorStatus('Ruleset imported.');
    } catch (error) {
      setEditorStatus(error.message);
      setEditorAst(null);
    }
  };

  const addRulesetToCurrentRoom = (rulesetPayload, { updateEditorStatus = false } = {}) => {
    if (!activeProfile?.guest || !inLobby || !amIHost || gameStarted) {
      const message = 'Only a guest host can add room rulesets before the match starts.';
      if (updateEditorStatus) {
        setEditorStatus(message);
      }
      showErrorMessage(message);
      return;
    }

    if (updateEditorStatus) {
      setEditorStatus('Compiling and applying ruleset...');
    }

    socket.emit('authenticate', activeProfile);
    socket.emit('add_room_ruleset', {
      roomId,
      ruleset: rulesetPayload
    }, (response) => {
      if (response?.error) {
        if (updateEditorStatus) {
          setEditorStatus(response.error);
          setEditorAst(null);
        }
        showErrorMessage(response.error);
        return;
      }

      if (response?.lobby) {
        applyLobbyState(response.lobby);
      }

      if (updateEditorStatus) {
        setEditorStatus('Ruleset added to the current room.');
      }
      showTopPrompt(`${rulesetPayload.longName || 'Ruleset'} added to the room.`, 'success');
    });
  };

  const handleApplyEditorRulesetToRoom = () => {
    addRulesetToCurrentRoom(getEditorRulesetPayload(), { updateEditorStatus: true });
  };

  const handleImportRentzToRoom = async (event) => {
    try {
      const importedRuleset = await readRentzFileFromInput(event);
      if (!importedRuleset) {
        return;
      }

      addRulesetToCurrentRoom(importedRuleset);
    } catch (error) {
      showErrorMessage(error.message);
    }
  };

  const handleCopyRoomCode = async () => {
    if (!roomId) {
      return;
    }

    try {
      await copyTextToClipboard(roomId);
      showTopPrompt(`Room code ${roomId} copied to clipboard.`, 'success');
    } catch {
      showTopPrompt('Could not copy the room code right now.', 'error');
    }
  };

  const toggleReady = () => {
    socket.emit('toggle_ready', { roomId }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }

      if (response?.lobby) {
        applyLobbyState(response.lobby);
      }
    });
  };

  const setLobbyRole = (role) => {
    socket.emit('set_lobby_role', { roomId, role }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }

      if (response?.lobby) {
        applyLobbyState(response.lobby);
      }

      showTopPrompt(
        role === 'player' ? 'You moved into the active player seats.' : 'You are now spectating this lobby.',
        role === 'player' ? 'success' : 'info'
      );
    });
  };

  const refreshPublicRooms = () => {
    if (!activeProfile) {
      showErrorMessage('Choose a guest name or sign in before browsing rooms.');
      return;
    }

    setPublicRoomsLoading(true);
    socket.emit('authenticate', activeProfile);
    socket.emit('list_public_rooms', {}, (response) => {
      setPublicRoomsLoading(false);
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }

      setPublicRooms(response?.rooms || []);
    });
  };

  const openPublicRoomBrowser = () => {
    setIsPublicBrowserOpen(true);
    refreshPublicRooms();
  };

  const joinPublicRoom = (targetRoomId) => {
    if (inLobby || gameStarted) {
      showTopPrompt('Leave your current room before joining another one.', 'error');
      return;
    }

    socket.emit('authenticate', activeProfile);
    socket.emit('join_lobby', { roomId: targetRoomId }, (response) => {
      if (response.success) {
        updateStoredGuestRoom(response.roomId);
        setRoomId(response.roomId);
        setInLobby(true);
        setGameStarted(false);
        setIsSpectatingGame(false);
        setGameFinished(false);
        setFinalStandings([]);
        setIsPublicBrowserOpen(false);
        applyLobbyState(response.lobby);
        if (response.autoSpectator) {
          showTopPrompt(`All ${MAX_ACTIVE_PLAYERS} player seats are full. You joined as a spectator.`, 'info');
        }
      } else if (response.error) {
        showErrorMessage(response.error);
      }
    });
  };

  const handleOpenRoomSettings = () => {
    setDraftRoomSettings(roomSettings);
    setIsRoomSettingsOpen(true);
  };

  const handleRoomRulesetToggle = (ruleId) => {
    setDraftRoomSettings((current) => ({
      ...current,
      selectedRulesets: {
        ...current.selectedRulesets,
        [ruleId]: !current.selectedRulesets[ruleId]
      }
    }));
  };

  const handlePlayerRulesetPermissionToggle = (playerId, ruleId) => {
    setDraftRoomSettings((current) => ({
      ...current,
      rulesetPermissions: {
        ...current.rulesetPermissions,
        [playerId]: {
          ...(current.rulesetPermissions?.[playerId] || {}),
          [ruleId]: !(current.rulesetPermissions?.[playerId]?.[ruleId] ?? true)
        }
      }
    }));
  };

  const handleSaveRoomSettings = () => {
    socket.emit('update_room_settings', {
      roomId,
      roomName: draftRoomSettings.roomName,
      visibility: draftRoomSettings.visibility,
      nvAllowed: draftRoomSettings.nvAllowed,
      turnTimerSeconds: draftRoomSettings.turnTimerSeconds,
      selectedRulesets: draftRoomSettings.selectedRulesets,
      rulesetPermissions: draftRoomSettings.rulesetPermissions
    }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }

      if (response?.lobby) {
        applyLobbyState(response.lobby);
      }

      setIsRoomSettingsOpen(false);
      showTopPrompt('Room settings updated.', 'success');
    });
  };

  const handleTransferHost = (targetUserId) => {
    socket.emit('transfer_host', { roomId, targetUserId }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }
      if (response?.lobby) {
        applyLobbyState(response.lobby);
      }
      showTopPrompt('Host transferred.', 'success');
    });
  };

  const handleKickMember = (targetUserId) => {
    socket.emit('kick_member', { roomId, targetUserId }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }
      if (response?.lobby) {
        applyLobbyState(response.lobby);
      }
      showTopPrompt('Player kicked.', 'info');
    });
  };

  const handleBanMember = (targetUserId) => {
    socket.emit('ban_member', { roomId, targetUserId }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }
      if (response?.lobby) {
        applyLobbyState(response.lobby);
      }
      showTopPrompt('Player banned.', 'info');
    });
  };

  const handleDeleteRoom = () => {
    socket.emit('delete_lobby', { roomId }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }
      resetActiveRoomState();
    });
  };

  const handleLeaveRoom = () => {
    socket.emit('leave_lobby', { roomId }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }

      resetActiveRoomState();
      showTopPrompt(response?.message || 'You left the room.', response?.roomDeleted ? 'info' : 'success');
    });
  };

  const handleNvChoice = (nvSelected) => {
    socket.emit('set_nv_choice', { roomId, nvSelected }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
      }
    });
  };

  const handleChooseRuleset = (rulesetId) => {
    socket.emit('choose_ruleset', { roomId, rulesetId }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
      }
    });
  };

  const handleContinueMatch = () => {
    socket.emit('continue_match', { roomId }, (response) => {
      if (response?.error) {
        showErrorMessage(response.error);
        return;
      }
      setIsStatsOpen(false);
      setMatchCompletePending(false);
    });
  };

  const startGame = () => {
    if (players.length < MIN_PLAYERS_TO_START) {
      showTopPrompt(`At least ${MIN_PLAYERS_TO_START} active players are required to start the game.`, 'error');
      return;
    }

    socket.emit('start_game', { roomId }, (response) => {
      if (response.error) {
        showErrorMessage(response.error);
      }
    });
  };

  const applyTheme = (nextTheme) => {
    setTheme(nextTheme);
  };

  const navItems = [
    { id: 'play', label: 'Play', icon: Home },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'ruleset-rater', label: 'Ruleset Rater', icon: Users2 },
    { id: 'editor', label: 'Editor', icon: FileCode2 },
    ...(!isAuthenticated ? [{ id: 'login', label: 'Login', icon: LogIn }] : [])
  ];
  const mobilePrimaryNavIds = new Set(['play', 'friends', 'library']);
  const mobilePrimaryNavItems = navItems.filter((item) => mobilePrimaryNavIds.has(item.id));
  const mobileMoreNavItems = navItems.filter((item) => !mobilePrimaryNavIds.has(item.id));
  const isMobileMoreActive = mobileMoreNavItems.some((item) => item.id === activeTab);

  const handleNavSelect = (tabId) => {
    setActiveTab(tabId);
    setIsMobileMoreOpen(false);
  };

  const themes = [
    { id: 'theme-frutiger-lime', label: 'Frutiger Lime' },
    { id: 'theme-dark-glass', label: 'Dark Glass' },
    { id: 'theme-light-gloss', label: 'Light Gloss' },
    { id: 'theme-colorful-aero', label: 'Colorful Aero' }
  ];

  const activeProfile = isAuthenticated ? userProfile : guestProfile;
  activeProfileRef.current = activeProfile;
  const activeLobbyPlayer = players.find(
    (player) => player.socketId === socket.id || player.userId === activeProfile?.userId
  );
  const mySpectatorProfile = spectators.find(
    (spectator) => spectator.socketId === socket.id || spectator.userId === activeProfile?.userId
  );
  const myPlayerId = players[myIndex]?.userId || activeLobbyPlayer?.userId || activeProfile?.userId;
  const myPlayer = players[myIndex] || activeLobbyPlayer || null;
  const amIHost = inLobby && lobbyHostId === activeProfile?.userId;
  const canAddGuestRoomRulesets = Boolean(activeProfile?.guest && amIHost && !gameStarted);
  const amIReady = inLobby && !!activeLobbyPlayer?.isReady;
  const amISpectator = inLobby && !!mySpectatorProfile;
  const isMyTurn = gameStarted && !gameFinished && myIndex === turnIndex;
  const nextTurnPlayer = players[turnIndex];
  const currentChooser = players.find((player) => player.userId === choiceState?.chooserId) || null;
  const amIChooser = Boolean(choiceState?.chooserId && choiceState.chooserId === myPlayerId);
  const isChoosingNv = gameStarted && choiceState?.phase === 'choosing_nv';
  const isChoosingRuleset = gameStarted && choiceState?.phase === 'choosing_ruleset';
  const isPlayingRound = gameStarted && !gameFinished && choiceState?.phase === 'playing_round';
  const isRoundStatsPhase = gameStarted && !gameFinished && choiceState?.phase === 'round_stats';
  const isRoundSetupPhase = gameStarted && !gameFinished && !isPlayingRound && !isRoundStatsPhase;
  const hasActiveModal = Boolean(
    (isRecoveryPromptOpen && recoverableGuestProfile) ||
    isRoomSettingsOpen ||
    isChoosingNv ||
    isChoosingRuleset ||
    (isStatsOpen && latestRoundStats)
  );
  const canContinueRoundFromStats = Boolean(
    amIHost &&
    latestRoundStats &&
    choiceState?.phase === 'round_stats' &&
    !matchCompletePending &&
    !gameFinished
  );
  const activeRoundTimerDeadline = isPlayingRound ? choiceState?.timerDeadline : null;
  const turnTimerRemainingMs = activeRoundTimerDeadline
    ? Math.max(0, activeRoundTimerDeadline - timerNow)
    : 0;
  const turnTimerRemainingSeconds = Math.ceil(turnTimerRemainingMs / 1000);
  const turnTimerTotalSeconds = roomSettings.turnTimerSeconds || TURN_TIMER_RANGE.defaultValue;
  const turnTimerProgress = activeRoundTimerDeadline
    ? clampNumber(turnTimerRemainingMs / Math.max(turnTimerTotalSeconds * 1000, 1), 0, 1)
    : 0;
  const turnTimerElapsedProgress = activeRoundTimerDeadline
    ? clampNumber(1 - turnTimerProgress, 0, 1)
    : 0;
  const turnTimerWarningStage = !activeRoundTimerDeadline
    ? 'normal'
    : turnTimerRemainingSeconds <= 5
      ? 'low'
      : turnTimerProgress <= 0.25
        ? 'quarter'
        : turnTimerProgress <= 0.5
          ? 'half'
          : 'normal';
  const fontScalePercent = Math.round(fontScale * 100);
  const pageZoomPercent = Math.round(pageZoom * 100);
  const isTurnLocked = gameStarted && !gameFinished && (!isMyTurn || trickPending || isChoosingNv || isChoosingRuleset);
  const activeSeatsRemaining = Math.max(0, MAX_ACTIVE_PLAYERS - players.length);
  const areActiveSeatsFull = players.length >= MAX_ACTIVE_PLAYERS;
  const selectedRoomRuleLabels = roomSettings.availableRulesets
    .filter((option) => roomSettings.selectedRulesets[option.id])
    .map((option) => option.abbreviation || option.label);
  const playableCards = hand.reduce((acc, card) => {
    acc[card] = canPlayCard({
      card,
      hand,
      trickSuit,
      isMyTurn,
      trickPending
    });
    return acc;
  }, {});

  useEffect(() => {
    if (!hasActiveModal) {
      document.documentElement.classList.remove('rentz-modal-open');
      document.body.classList.remove('rentz-modal-open');
      return undefined;
    }

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverscroll = root.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTouchY = 0;

    const getScrollTarget = (target) => {
      if (!(target instanceof Element)) {
        return null;
      }

      return target.closest('[data-rentz-modal-scroll]');
    };

    const canScrollVertically = (element) => element.scrollHeight > element.clientHeight + 1;

    const shouldBlockVerticalScroll = (scrollTarget, deltaY) => {
      if (!canScrollVertically(scrollTarget)) {
        return true;
      }

      const atTop = scrollTarget.scrollTop <= 0;
      const atBottom = scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 1;
      return (atTop && deltaY > 0) || (atBottom && deltaY < 0);
    };

    const handleTouchStart = (event) => {
      const touch = event.touches?.[0];
      if (!touch) {
        return;
      }

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      lastTouchY = touch.clientY;
    };

    const handleTouchMove = (event) => {
      const touch = event.touches?.[0];
      const scrollTarget = getScrollTarget(event.target);

      if (!touch || !scrollTarget) {
        event.preventDefault();
        return;
      }

      const axis = scrollTarget.getAttribute('data-rentz-modal-scroll') || 'y';
      const gestureX = Math.abs(touch.clientX - touchStartX);
      const gestureY = Math.abs(touch.clientY - touchStartY);

      if (axis.includes('x') && gestureX > gestureY) {
        return;
      }

      if (!axis.includes('y')) {
        event.preventDefault();
        return;
      }

      const deltaY = touch.clientY - lastTouchY;
      lastTouchY = touch.clientY;

      if (shouldBlockVerticalScroll(scrollTarget, deltaY)) {
        event.preventDefault();
      }
    };

    const handleWheel = (event) => {
      const scrollTarget = getScrollTarget(event.target);

      if (!scrollTarget) {
        event.preventDefault();
        return;
      }

      const axis = scrollTarget.getAttribute('data-rentz-modal-scroll') || 'y';
      const isMostlyHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);

      if (axis.includes('x') && isMostlyHorizontal) {
        return;
      }

      if (!axis.includes('y')) {
        event.preventDefault();
        return;
      }

      if (shouldBlockVerticalScroll(scrollTarget, -event.deltaY)) {
        event.preventDefault();
      }
    };

    root.classList.add('rentz-modal-open');
    body.classList.add('rentz-modal-open');
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      root.classList.remove('rentz-modal-open');
      body.classList.remove('rentz-modal-open');
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      root.style.overscrollBehavior = previousRootOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [hasActiveModal]);

  useEffect(() => {
    setIsMobileMoreOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isMobileMoreOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (mobileNavRef.current && !mobileNavRef.current.contains(event.target)) {
        setIsMobileMoreOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isMobileMoreOpen]);

  useEffect(() => {
    if (!inLobby || gameStarted || !amIHost) {
      setIsRoomSettingsOpen(false);
    }
  }, [amIHost, gameStarted, inLobby]);

  useEffect(() => {
    if (pendingPlayCard && !playableCards[pendingPlayCard]) {
      setPendingPlayCard(null);
    }
  }, [pendingPlayCard, playableCards]);

  const localTablePlayer = myPlayer || mySpectatorProfile || activeProfile;
  const desktopSeatPlayers = players.length > 0
    ? getDesktopSeatOrder(players)
    : localTablePlayer
      ? [localTablePlayer]
      : [];
  const isTableStageVisible = activeTab === 'play' && inLobby && gameStarted && !gameFinished && !isRoundSetupPhase && playView === 'table';
  const isChoiceHandSpreadVisible = isChoosingRuleset && !choiceState?.nvSelected && !isSpectatingGame;
  const handSpreadLayoutMode = isChoiceHandSpreadVisible ? 'choice' : isTableStageVisible ? 'play' : 'hidden';
  const isHandSpreadVisible = handSpreadLayoutMode !== 'hidden';
  const sortedHand = sortCards(hand);
  const fallbackHandSpreadMetrics = sortedHand.length > 0
    ? (() => {
      const fallbackCardHeight = HAND_CARD_MIN_HEIGHT_PX;
      const fallbackCardWidth = fallbackCardHeight * CARD_ASSET_ASPECT_RATIO;
      const fallbackCardAdvance = fallbackCardWidth * 0.58;
      const fallbackSpreadWidth = fallbackCardWidth + (Math.max(0, sortedHand.length - 1) * fallbackCardAdvance);

      return {
        cardHeight: fallbackCardHeight,
        cardWidth: fallbackCardWidth,
        cardAdvance: fallbackCardAdvance,
        spreadWidth: fallbackSpreadWidth
      };
    })()
    : null;
  const visibleHandSpreadMetrics = handSpreadMetrics || fallbackHandSpreadMetrics;
  const playersForMobilePanel = [...players].sort((left, right) => {
    if (left.userId === nextTurnPlayer?.userId) {
      return -1;
    }

    if (right.userId === nextTurnPlayer?.userId) {
      return 1;
    }

    if (left.userId === myPlayerId) {
      return -1;
    }

    if (right.userId === myPlayerId) {
      return 1;
    }

    return getPlayerName(left).localeCompare(getPlayerName(right));
  });

  const handleEmojiPrompt = (player) => {
    showTopPrompt(`Emoji reactions are not wired yet for ${getPlayerName(player)}.`, 'info');
  };

  useEffect(() => {
    return () => {
      if (turnTimerNoticeTimeoutRef.current) {
        window.clearTimeout(turnTimerNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeRoundTimerDeadline) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setTimerNow(Date.now()), 0);
    const intervalId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [activeRoundTimerDeadline]);

  useEffect(() => {
    const warningState = turnTimerWarningStateRef.current;
    const clearTurnTimerNotice = () => {
      if (turnTimerNoticeTimeoutRef.current) {
        window.clearTimeout(turnTimerNoticeTimeoutRef.current);
        turnTimerNoticeTimeoutRef.current = null;
      }
      setTurnTimerNotice('');
    };

    const showTurnTimerNotice = (secondsLeft) => {
      if (turnTimerNoticeTimeoutRef.current) {
        window.clearTimeout(turnTimerNoticeTimeoutRef.current);
      }
      setTurnTimerNotice(`${secondsLeft}s left`);
      turnTimerNoticeTimeoutRef.current = window.setTimeout(() => {
        setTurnTimerNotice('');
        turnTimerNoticeTimeoutRef.current = null;
      }, 1600);
    };

    if (!isPlayingRound || !activeRoundTimerDeadline) {
      warningState.deadline = null;
      warningState.halfShown = false;
      warningState.quarterShown = false;
      clearTurnTimerNotice();
      return;
    }

    const totalTimerMs = Math.max(turnTimerTotalSeconds * 1000, 1);

    if (warningState.deadline !== activeRoundTimerDeadline) {
      warningState.deadline = activeRoundTimerDeadline;
      warningState.halfShown = turnTimerRemainingMs <= totalTimerMs / 2;
      warningState.quarterShown = turnTimerRemainingMs <= totalTimerMs / 4;
      clearTurnTimerNotice();
      return;
    }

    if (!warningState.quarterShown && turnTimerRemainingMs > 0 && turnTimerRemainingMs <= totalTimerMs / 4) {
      warningState.quarterShown = true;
      showTurnTimerNotice(turnTimerRemainingSeconds);
      return;
    }

    if (!warningState.halfShown && turnTimerRemainingMs > 0 && turnTimerRemainingMs <= totalTimerMs / 2) {
      warningState.halfShown = true;
      showTurnTimerNotice(turnTimerRemainingSeconds);
    }
  }, [activeRoundTimerDeadline, isPlayingRound, turnTimerRemainingMs, turnTimerRemainingSeconds, turnTimerTotalSeconds]);

  useEffect(() => {
    const stageElement = tableStageRef.current;
    const boardElement = cardBoardRef.current;

    if (!isTableStageVisible || !stageElement || !boardElement || desktopSeatPlayers.length === 0) {
      setDesktopSeatLayout([]);
      setDesktopStageTightness(0);
      return undefined;
    }

    let frameId = 0;
    const updateSeatLayout = () => {
      const stageRect = stageElement.getBoundingClientRect();
      const boardRect = boardElement.getBoundingClientRect();

      if (!stageRect.width || !stageRect.height || !boardRect.width || !boardRect.height) {
        return;
      }

      const nextStageTightness = getDesktopStageTightness({
        playerCount: desktopSeatPlayers.length,
        stageRect,
        boardRect
      });

      setDesktopStageTightness(nextStageTightness);

      setDesktopSeatLayout(buildDesktopSeatLayout({
        playerCount: desktopSeatPlayers.length,
        stageRect,
        boardRect,
        stageTightness: nextStageTightness
      }));
    };

    const queueSeatLayoutUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateSeatLayout);
    };

    queueSeatLayoutUpdate();

    const resizeObserver = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(() => {
        queueSeatLayoutUpdate();
      })
      : null;

    resizeObserver?.observe(stageElement);
    resizeObserver?.observe(boardElement);
    window.addEventListener('resize', queueSeatLayoutUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', queueSeatLayoutUpdate);
      resizeObserver?.disconnect();
    };
  }, [desktopSeatPlayers.length, isTableStageVisible, pageZoom]);

  useLayoutEffect(() => {
    const scrollElement = handSpreadLayoutMode === 'choice'
      ? choiceHandScrollRef.current
      : handScrollRef.current;
    const referenceHandSize = Math.max(startingHandSizeRef.current, startingHandSize);

    if (!isHandSpreadVisible || !scrollElement || referenceHandSize === 0) {
      setHandSpreadMetrics(null);
      return undefined;
    }

    let frameId = 0;
    const updateHandSpread = () => {
      const scrollRect = scrollElement.getBoundingClientRect();
      const parentRect = scrollElement.parentElement?.getBoundingClientRect();
      const measuredWidth = scrollRect.width || scrollElement.clientWidth || parentRect?.width || 0;
      const measuredHeight = scrollRect.height || scrollElement.clientHeight || parentRect?.height || 0;

      if (
        measuredWidth < HAND_CARD_MEASURE_MIN_WIDTH_PX ||
        measuredHeight < HAND_CARD_MEASURE_MIN_HEIGHT_PX ||
        referenceHandSize === 0
      ) {
        return;
      }

      const scrollStyles = window.getComputedStyle(scrollElement);
      const horizontalPadding = Number.parseFloat(scrollStyles.paddingLeft || '0')
        + Number.parseFloat(scrollStyles.paddingRight || '0');
      const verticalPadding = Number.parseFloat(scrollStyles.paddingTop || '0')
        + Number.parseFloat(scrollStyles.paddingBottom || '0');
      const availableWidth = Math.max(0, measuredWidth - horizontalPadding - 10);
      const availableHeight = Math.max(0, measuredHeight - verticalPadding - 4);
      const widthFitDenominator = CARD_ASSET_ASPECT_RATIO * (
        1 + (Math.max(0, referenceHandSize - 1) * HAND_CARD_MAX_ADVANCE_RATIO)
      );
      const maxHeightFromWidth = widthFitDenominator > 0
        ? availableWidth / widthFitDenominator
        : HAND_CARD_MAX_HEIGHT_PX;
      const responsiveMaxCardHeight = Math.min(
        HAND_CARD_MAX_HEIGHT_PX,
        Math.max(HAND_CARD_MIN_HEIGHT_PX, maxHeightFromWidth),
        Math.max(HAND_CARD_MIN_HEIGHT_PX, availableHeight)
      );
      const nextCardHeight = clampNumber(
        availableHeight * HAND_CARD_SIZE_SCALE,
        Math.min(HAND_CARD_MIN_HEIGHT_PX, responsiveMaxCardHeight),
        responsiveMaxCardHeight
      );
      const nextCardWidth = nextCardHeight * CARD_ASSET_ASPECT_RATIO;
      const maxAdvance = nextCardWidth * HAND_CARD_MAX_ADVANCE_RATIO;
      const minAdvance = nextCardWidth * HAND_CARD_MIN_ADVANCE_RATIO;
      const fittingAdvance = referenceHandSize > 1
        ? (availableWidth - nextCardWidth) / (referenceHandSize - 1)
        : nextCardWidth;
      const nextCardAdvance = referenceHandSize > 1
        ? clampNumber(fittingAdvance, minAdvance, maxAdvance)
        : nextCardWidth;
      const nextSpreadWidth = nextCardWidth + (Math.max(0, referenceHandSize - 1) * nextCardAdvance);

      setHandSpreadMetrics((current) => {
        if (
          current &&
          Math.abs(current.cardHeight - nextCardHeight) < 0.5 &&
          Math.abs(current.cardWidth - nextCardWidth) < 0.5 &&
          Math.abs(current.cardAdvance - nextCardAdvance) < 0.5 &&
          Math.abs(current.spreadWidth - nextSpreadWidth) < 0.5
        ) {
          return current;
        }

        return {
          cardHeight: nextCardHeight,
          cardWidth: nextCardWidth,
          cardAdvance: nextCardAdvance,
          spreadWidth: nextSpreadWidth
        };
      });
    };

    const queueHandSpreadUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateHandSpread);
    };

    queueHandSpreadUpdate();

    const resizeObserver = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(() => {
        queueHandSpreadUpdate();
      })
      : null;

    resizeObserver?.observe(scrollElement);
    if (scrollElement.parentElement) {
      resizeObserver?.observe(scrollElement.parentElement);
    }
    window.addEventListener('resize', queueHandSpreadUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', queueHandSpreadUpdate);
      resizeObserver?.disconnect();
    };
  }, [hand.length, handSpreadLayoutMode, isHandSpreadVisible, pageZoom, startingHandSize]);

  const isCompactGameHeader = activeTab === 'play' && inLobby && gameStarted;

  const renderLobbyView = () => (
    <div className="relative z-10 w-full max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-2xl font-display font-extrabold text-[var(--text-primary)] sm:text-3xl">
            {roomName || 'Room'}
          </h3>
          <div className="flex items-center gap-2 rounded-[1.35rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-3 py-2 shadow-sm">
            <span className="text-base font-black tracking-[0.22em] text-[var(--text-secondary)] sm:text-lg sm:tracking-[0.26em]">
              {roomId}
            </span>
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="rounded-full border border-[var(--glass-border)] bg-[var(--surface-hover)] p-2 text-[var(--text-primary)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-solid)]"
              title="Copy room code"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="status-pill px-4 py-2">
            {roomVisibility === 'public' ? 'Public' : 'Private'}
          </div>
          <div className="status-pill px-4 py-2">
            {players.length}/{MAX_ACTIVE_PLAYERS} active
          </div>
          <div className="status-pill px-4 py-2">
            {spectators.length} spectator{spectators.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xl font-display font-black text-[var(--text-primary)] sm:text-2xl">Active Players</h4>
                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                  Only these players receive cards and take turns in the match.
                </p>
              </div>
              <div className="status-pill px-4 py-2">
                {players.length}/{MAX_ACTIVE_PLAYERS} seats used
              </div>
            </div>

            <div className="grid gap-4">
              {players.length > 0 ? (
                players.map((player, index) => {
                  const isHostPlayer = player.userId === lobbyHostId;

                  return (
                    <div key={`${player.socketId}-${index}`} className="glass-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="seat-avatar h-12 w-12 text-sm">
                          {getPlayerName(player).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-lg font-black text-[var(--text-primary)] sm:text-xl">
                            {getPlayerName(player)} {player.socketId === socket.id ? '(You)' : ''}
                          </div>
                          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                            {isHostPlayer ? 'Host Player' : 'Player'}
                          </div>
                        </div>
                      </div>
                      <div className={clsx('status-pill px-4 py-2', player.isReady && 'bg-emerald-200/80 text-emerald-900')}>
                        {player.isReady ? (
                          <span className="flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            Ready
                          </span>
                        ) : (
                          'Waiting'
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="glass-panel px-4 py-5 text-sm font-semibold text-[var(--text-secondary)] sm:px-5">
                  No active players yet.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-xl font-display font-black text-[var(--text-primary)] sm:text-2xl">Spectators</h4>
                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                  Spectators watch the table without joining gameplay.
                </p>
              </div>
              <div className="status-pill px-4 py-2">
                {spectators.length} watching
              </div>
            </div>

            <div className="grid gap-4">
              {spectators.length > 0 ? (
                spectators.map((spectator, index) => {
                  const isHostSpectator = spectator.userId === lobbyHostId;

                  return (
                    <div key={`${spectator.socketId}-${index}`} className="glass-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="seat-avatar h-12 w-12 text-sm">
                          {getPlayerName(spectator).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-lg font-black text-[var(--text-primary)] sm:text-xl">
                            {getPlayerName(spectator)} {spectator.socketId === socket.id ? '(You)' : ''}
                          </div>
                          <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                            {isHostSpectator ? 'Host Spectator' : 'Spectator'}
                          </div>
                        </div>
                      </div>
                      <div className="status-pill bg-sky-100/85 px-4 py-2 text-sky-900">
                        Spectating
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="glass-panel px-4 py-5 text-sm font-semibold text-[var(--text-secondary)] sm:px-5">
                  No one is spectating right now.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="glass-panel h-fit p-5 sm:p-6">
          <div className="mb-4">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Your lobby role
            </div>
            <div className="mt-2 text-2xl font-black text-[var(--text-primary)]">
              {amISpectator ? 'Spectator' : 'Active Player'}
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
              {amISpectator
                ? (areActiveSeatsFull
                  ? `All ${MAX_ACTIVE_PLAYERS} player seats are currently taken.`
                  : `There ${activeSeatsRemaining === 1 ? 'is' : 'are'} ${activeSeatsRemaining} open player seat${activeSeatsRemaining === 1 ? '' : 's'} right now.`)
                : 'Ready up when you want to be included in the next match.'}
            </p>
          </div>

          <div className="mb-4 rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-subtle)] p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Room rules
            </div>
            <div className="mt-2 text-base font-black text-[var(--text-primary)]">
              {selectedRoomRuleLabels.length > 0 ? selectedRoomRuleLabels.join(', ') : 'No rules selected'}
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)]">
              {amIHost
                ? 'You can change these before the match starts.'
                : 'Only the host can change the room rule selection.'}
            </p>
            {amIHost && !gameStarted && (
              <button
                type="button"
                onClick={handleOpenRoomSettings}
                className="mt-3 inline-flex items-center gap-2 rounded-[1.1rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              >
                <Settings className="h-4 w-4" />
                Room Settings
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {!amISpectator ? (
              <>
                <button
                  onClick={toggleReady}
                  className={clsx(
                    'rounded-[1.6rem] px-6 py-4 text-base font-black uppercase tracking-[0.16em] transition-[transform,background-color,color,box-shadow] duration-300 sm:px-8 sm:text-lg sm:tracking-[0.18em]',
                    amIReady ? 'ready-button-active' : 'ready-button'
                  )}
                >
                  {amIReady ? 'Ready to Deal' : 'Ready Up'}
                </button>
                <button
                  onClick={() => setLobbyRole('spectator')}
                  className="rounded-[1.6rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-6 py-4 text-base font-black uppercase tracking-[0.16em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] sm:px-8 sm:text-lg sm:tracking-[0.18em]"
                >
                  Become Spectator
                </button>
              </>
            ) : (
              <button
                onClick={() => setLobbyRole('player')}
                disabled={areActiveSeatsFull}
                className={clsx(
                  'rounded-[1.6rem] px-6 py-4 text-base font-black uppercase tracking-[0.16em] transition-[transform,background-color,color,box-shadow] duration-300 sm:px-8 sm:text-lg sm:tracking-[0.18em]',
                  areActiveSeatsFull
                    ? 'cursor-not-allowed border border-[var(--glass-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] opacity-70'
                    : 'ready-button'
                )}
              >
                {areActiveSeatsFull ? 'Player Seats Full' : 'Join Player Seats'}
              </button>
            )}

            {amIHost && (
              <button onClick={startGame} className="frutiger-button px-6 py-4 text-base sm:px-8 sm:text-lg">
                Start Match
              </button>
            )}

            <button
              type="button"
              onClick={handleLeaveRoom}
              className="inline-flex items-center justify-center gap-2 rounded-[1.6rem] border border-red-200/75 bg-[linear-gradient(180deg,rgba(255,243,243,0.97)_0%,rgba(254,205,211,0.9)_100%)] px-6 py-4 text-base font-black uppercase tracking-[0.16em] text-red-950 transition hover:-translate-y-0.5 hover:brightness-[1.02] sm:px-8 sm:text-lg sm:tracking-[0.18em]"
            >
              <LogOut className="h-4 w-4" />
              Leave Room
            </button>

            {gameFinished && (
              <button onClick={() => setPlayView('stats')} className="rounded-[1.6rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-6 py-4 text-base font-black uppercase tracking-[0.16em] transition hover:bg-[var(--surface-hover)] sm:px-8 sm:text-lg sm:tracking-[0.18em]">
                View Last Game Stats
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMatchmaking = () => (
    <div className="relative z-10 m-auto w-full max-w-3xl space-y-6">
      {!isAuthenticated && guestProfile && (
        <div className="glass-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Guest profile
            </div>
            <div className="mt-1 text-2xl font-black text-[var(--text-primary)]">
              {guestProfile.name}
            </div>
          </div>
          <button
            onClick={handleGuestReset}
            className="rounded-full border border-[var(--glass-border)] bg-[var(--surface-medium)] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            Change Guest Name
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="glass-panel p-5 sm:p-8">
          <h3 className="mb-3 text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">Host Table</h3>
          <p className="mb-6 text-base font-semibold text-[var(--text-secondary)] sm:text-sm">
            Create a named room. Public rooms appear in the browser; private rooms still work by code.
          </p>
          <div className="mb-4 grid gap-3">
            <input
              value={newRoomName}
              onChange={(event) => setNewRoomName(event.target.value)}
              placeholder={activeProfile ? `${getPlayerName(activeProfile)}'s Room` : 'Room name'}
              className="w-full rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-input)] px-5 py-4 font-black text-[var(--text-primary)] shadow-inner placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-glow)]"
            />
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'public', label: 'Public', icon: Globe2 },
                { id: 'private', label: 'Private', icon: Lock }
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setNewRoomVisibility(option.id)}
                  className={clsx(
                    'flex items-center justify-center gap-2 rounded-[1.2rem] border px-4 py-3 text-sm font-black uppercase tracking-[0.14em] transition',
                    newRoomVisibility === option.id
                      ? 'border-white/80 bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-md'
                      : 'border-[var(--glass-border)] bg-[var(--surface-medium)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  )}
                >
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleCreateLobby} className="frutiger-button w-full py-4 text-base sm:text-lg">
            Create Room
          </button>
        </div>
        <div className="glass-panel p-5 sm:p-8">
          <h3 className="mb-3 text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">Join Room</h3>
          <p className="mb-6 text-base font-semibold text-[var(--text-secondary)] sm:text-sm">
            Paste a private room code or browse currently open public rooms.
          </p>
          <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={joinInput}
              onChange={(event) => setJoinInput(event.target.value)}
              autoCapitalize="characters"
              placeholder="Room code"
              spellCheck={false}
              className="min-w-0 rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-input)] px-5 py-4 font-mono text-[0.95rem] font-black uppercase tracking-[0.06em] text-[var(--text-primary)] shadow-inner placeholder:font-sans placeholder:text-[0.9rem] placeholder:font-bold placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-4 focus:ring-[var(--accent-glow)] sm:text-[1rem] sm:tracking-[0.12em]"
            />
            <button onClick={handleJoinLobby} className="frutiger-button w-full px-6 py-4 text-base sm:min-w-[9rem] sm:px-8 sm:text-lg">
              Join
            </button>
          </div>
          <button
            type="button"
            onClick={openPublicRoomBrowser}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            <Users className="h-4 w-4" />
            Browse public rooms
          </button>
        </div>
      </div>
    </div>
  );

  const renderPublicRoomsView = () => (
    <div className="relative z-10 m-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">Public Rooms</h3>
          <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
            Join one open room at a time. Private rooms still require their code.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshPublicRooms}
            className="inline-flex items-center gap-2 rounded-[1.2rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsPublicBrowserOpen(false)}
            className="rounded-[1.2rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            Back
          </button>
        </div>
      </div>

      {inLobby && (
        <div className="glass-panel p-4 text-sm font-bold text-[var(--text-secondary)]">
          You are already in room {roomId}. Leave it before joining another public room.
        </div>
      )}

      {publicRoomsLoading ? (
        <div className="glass-panel p-6 text-center text-sm font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">
          Loading rooms...
        </div>
      ) : publicRooms.length === 0 ? (
        <div className="glass-panel p-6 text-center text-sm font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">
          No public rooms are waiting right now.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {publicRooms.map((room) => (
            <article key={room.roomId} className="glass-panel p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xl font-black text-[var(--text-primary)]">{room.roomName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                    <span>{room.playerCount}/{room.maxPlayers} players</span>
                    {room.hasFriend && <span className="rounded-full bg-emerald-200/80 px-2 py-1 text-emerald-900">Friend here</span>}
                  </div>
                </div>
                <div className="status-pill px-3 py-2">{room.roomId}</div>
              </div>
              <div className="mb-4 flex -space-x-2">
                {(room.avatars || []).map((avatar, index) => (
                  <div key={`${room.roomId}-${avatar.userId || index}`} className="seat-avatar h-10 w-10 border-2 border-white text-xs">
                    {avatar.avatarUrl ? (
                      <img src={avatar.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      getPlayerInitials(avatar)
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={inLobby || gameStarted}
                onClick={() => joinPublicRoom(room.roomId)}
                className={clsx(
                  'w-full rounded-[1.3rem] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] transition',
                  inLobby || gameStarted
                    ? 'cursor-not-allowed border border-[var(--glass-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] opacity-70'
                    : 'frutiger-button'
                )}
              >
                {inLobby || gameStarted ? 'Already in a room' : 'Join public room'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );

  const renderGameTable = () => {
    if (gameFinished && playView === 'stats') {
      return (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4">
          <section className="glass-panel p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-[var(--text-secondary)]" />
                <div>
                  <h4 className="text-xl font-display font-black text-[var(--text-primary)] sm:text-2xl">Game Finished</h4>
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">
                    Final standings for room {roomId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPlayView('table')}
                className="rounded-full border border-[var(--glass-border)] bg-[var(--surface-medium)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition hover:bg-[var(--surface-hover)]"
              >
                Back to Lobby
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {finalStandings.map((standing, index) => (
                <div
                  key={standing.userId}
                  className={clsx(
                    'rounded-[1.5rem] border px-4 py-4 text-sm font-bold',
                    index === 0
                      ? 'border-lime-200/80 bg-lime-100/20 text-[var(--text-primary)]'
                      : 'border-[var(--glass-border)] bg-[var(--surface-subtle)] text-[var(--text-primary)]'
                  )}
                >
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
                    {index === 0 ? 'Winner' : `Place ${index + 1}`}
                  </div>
                  <div className="mt-1 text-lg font-black">{standing.name}</div>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">{standing.tricksWon} hands collected</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">{standing.cardsLeft} cards left</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (isRoundSetupPhase) {
      const setupPlayerName = getPlayerName(currentChooser);
      const setupLabel = isChoosingNv
        ? `${setupPlayerName} is choosing NV.`
        : isChoosingRuleset
          ? `${setupPlayerName} is choosing a game.`
          : 'Preparing the round.';

      return (
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
          <section className="glass-panel max-w-md p-5 text-center sm:p-6" aria-live="polite">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Round setup
            </div>
            <h3 className="mt-2 text-2xl font-display font-black text-[var(--text-primary)]">
              {setupLabel}
            </h3>
          </section>
        </div>
      );
    }

    if (playView === 'collected') {
      return (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4">
          <section className="glass-panel p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xl font-display font-black text-[var(--text-primary)] sm:text-2xl">Taken Hands</h4>
                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                  This is the existing taken-hands view, remapped from the new table action area.
                </p>
              </div>
              <button
                onClick={() => setPlayView('table')}
                className="frutiger-button px-5 py-3 text-sm font-black uppercase tracking-[0.16em]"
              >
                Back to table
              </button>
            </div>

            <CollectedHandsView
              players={players}
              collectedHandsByPlayer={collectedHandsByPlayer}
              myPlayerId={myPlayerId}
            />
          </section>
        </div>
      );
    }

    return (
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <section
          className="rentz-game-frame flex-1 min-h-0"
          style={{ '--rentz-stage-tightness': `${desktopStageTightness}` }}
        >
          <div className="rentz-desktop-main">
            <div className="rentz-desktop-stage">
              <div className="rentz-table-stage table-felt">
              <div ref={tableStageRef} className="rentz-table-main">
              <div className="rentz-marking-box">
                <span className="rentz-marking-label">Marking suit:</span>
                <span
                  className={clsx(
                    'rentz-marking-value',
                    trickSuit && (trickSuit === 'H' || trickSuit === 'D') ? 'is-red' : 'is-neutral'
                  )}
                >
                  {formatMarkingSuit(trickSuit)}
                </span>
              </div>

              <div
                ref={spectatorPopoverRef}
                className={clsx('rentz-spectator-box', isSpectatorPopoverOpen && 'is-open')}
              >
                <button
                  type="button"
                  className="rentz-spectator-toggle"
                  onClick={() => setIsSpectatorPopoverOpen((current) => !current)}
                  aria-expanded={isSpectatorPopoverOpen}
                  aria-controls="rentz-spectator-popover"
                  title="View spectators"
                >
                  <span className="rentz-spectator-label">
                    <Users className="h-4 w-4" />
                    Spectators
                  </span>
                  <span className="rentz-marking-value is-neutral">{spectators.length}</span>
                </button>

                {isSpectatorPopoverOpen && (
                  <div id="rentz-spectator-popover" className="rentz-spectator-popover">
                    {spectators.length > 0 ? (
                      spectators.map((spectator, index) => (
                        <div
                          key={spectator.userId || spectator.socketId || index}
                          className="rentz-spectator-entry"
                        >
                          <div className="rentz-spectator-entry-avatar">
                            {getPlayerInitials(spectator)}
                          </div>
                          <div className="rentz-spectator-entry-copy">
                            <div className="rentz-spectator-entry-name">
                              {getPlayerName(spectator)}{' '}
                              {spectator.socketId === socket.id ? '(You)' : ''}
                            </div>
                            <div className="rentz-spectator-entry-meta">
                              {spectator.userId === lobbyHostId ? 'Host spectating' : 'Watching the table'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rentz-spectator-empty">No spectators right now.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="rentz-table-brand">Rentz</div>

              {isPlayingRound && activeRoundTimerDeadline && (
                <div
                  className={clsx(
                    'rentz-turn-timer-box',
                    turnTimerWarningStage === 'half' && 'is-half',
                    turnTimerWarningStage === 'quarter' && 'is-quarter',
                    turnTimerWarningStage === 'low' && 'is-low'
                  )}
                  style={{ '--timer-progress-deg': `${turnTimerElapsedProgress * 360}deg` }}
                  aria-label={`${turnTimerRemainingSeconds} seconds left for ${nextTurnPlayer ? getPlayerName(nextTurnPlayer) : 'player'} to play`}
                >
                  <div className="rentz-turn-timer-ring" aria-hidden="true">
                    <div className="rentz-turn-timer-face">
                      <span className="rentz-turn-timer-value">{turnTimerRemainingSeconds}</span>
                      <span className="rentz-turn-timer-unit">sec</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="rentz-mobile-hero">
                <div className="rentz-current-player-label">Current player:</div>
                {nextTurnPlayer ? (
                  <RentzSeatCluster
                    player={nextTurnPlayer}
                    seatRole="hero"
                    mobileHero
                    isCurrent
                    isWinner={trickWinnerId === nextTurnPlayer.userId}
                    isLocal={nextTurnPlayer.userId === myPlayerId}
                    cardCount={nextTurnPlayer.userId === myPlayerId ? hand.length : (cardCounts[nextTurnPlayer.userId] || 0)}
                    tricksWon={(collectedHandsByPlayer[nextTurnPlayer.userId] || []).length}
                    points={getPlayerPoints(nextTurnPlayer)}
                    onEmojiClick={() => handleEmojiPrompt(nextTurnPlayer)}
                  />
                ) : null}
              </div>

              <div className="rentz-desktop-seats">
                {desktopSeatPlayers.map((player, index) => {
                  const seatPosition = desktopSeatLayout[index];

                  if (!seatPosition) {
                    return null;
                  }

                  return (
                    <div
                      key={player.userId || player.socketId || index}
                      className={clsx('rentz-seat-slot', player.userId === myPlayerId && 'is-local')}
                      style={{ left: `${seatPosition.x}px`, top: `${seatPosition.y}px` }}
                    >
                      <RentzSeatCluster
                        player={player}
                        seatRole="table"
                        isCurrent={nextTurnPlayer?.userId === player.userId}
                        isWinner={trickWinnerId === player.userId}
                        isLocal={player.userId === myPlayerId}
                        showElo={false}
                        showStats={false}
                        onEmojiClick={() => handleEmojiPrompt(player)}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="rentz-board-area">
                <TrickBoard
                  boardRef={cardBoardRef}
                  currentTrick={currentTrick}
                  trickPending={trickPending || Boolean(animatingWinner)}
                  trickWinnerId={trickWinnerId}
                />
                {turnTimerNotice && (
                  <div
                    key={turnTimerNotice}
                    className={clsx(
                      'rentz-trick-board-note',
                      turnTimerWarningStage === 'half' && 'is-half',
                      turnTimerWarningStage === 'quarter' && 'is-quarter',
                      turnTimerWarningStage === 'low' && 'is-low'
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    <Clock className="rentz-trick-board-note-icon h-4 w-4" aria-hidden="true" />
                    <span>{turnTimerNotice}</span>
                  </div>
                )}
              </div>
            </div>
            </div>
            </div>

            <div className="rentz-bottom-strip">
              {renderHandSpread()}

              <div className="rentz-bottom-action-column flex w-full h-full flex-col justify-center items-center gap-2">
                <div className="rentz-bottom-action-row">
                  <button
                    type="button"
                    onClick={() => setPlayView('collected')}
                    className="rentz-verify-button w-full !min-h-0 shrink-0 py-2 sm:py-3 transition-transform hover:-translate-y-0.5"
                  >
                    <span className="inline-flex items-center justify-center gap-1.5 text-[0.85rem] sm:text-[0.95rem]">
                      <Swords className="h-4 w-4" />
                      See Hands
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!latestRoundStats}
                    onClick={() => latestRoundStats && setIsStatsOpen(true)}
                    className={clsx(
                      'rentz-verify-button w-full !min-h-0 shrink-0 py-2 sm:py-3 transition-transform hover:-translate-y-0.5',
                      !latestRoundStats && 'is-disabled'
                    )}
                    title={latestRoundStats ? 'Open round stats' : 'Stats appear after a round ends'}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5 text-[0.85rem] sm:text-[0.95rem]">
                      <BarChart3 className="h-4 w-4" />
                      Stats
                    </span>
                  </button>
                </div>

                <div
                  className="flex w-full shrink-0 items-center justify-between rounded-[1.3rem] border border-[rgba(255,255,255,0.74)] px-3 py-2 sm:px-4 sm:py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(148,163,184,0.16),0_8px_16px_rgba(0,0,0,0.1)]"
                  style={{ background: 'linear-gradient(180deg, rgba(240,245,249,0.96) 0%, rgba(208,219,230,0.92) 100%)' }}
                >
                  <div className="flex flex-col gap-0 pr-2 sm:pr-3">
                    <span className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#546775]">Room</span>
                    <span className="text-[0.9rem] sm:text-[1rem] font-black uppercase tracking-[0.12em] text-[#1f4d68] drop-shadow-sm leading-none">{roomId}</span>
                  </div>
                  <div className="h-6 w-px bg-[#94a3b8]/40 mx-1"></div>
                  <div className="flex flex-col items-end gap-0 pl-2 sm:pl-3 min-w-0">
                    <span className="text-[0.65rem] sm:text-[0.7rem] font-bold text-[#5c7080] truncate max-w-[80px] sm:max-w-[100px]">
                      {localTablePlayer ? `${getPlayerName(localTablePlayer)}` : 'You'}
                    </span>
                    <span className="text-[0.65rem] sm:text-[0.7rem] font-black text-[#20303b]">
                      {isSpectatingGame ? 'Spectating' : `${hand.length} cards`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rentz-desktop-sidebar">
            <div className="rentz-desktop-player-list">
              {playersForMobilePanel.map((player, index) => (
                <DesktopPlayerCard
                  key={player.userId || player.socketId || index}
                  player={player}
                  isCurrent={nextTurnPlayer?.userId === player.userId}
                  isLocal={player.userId === myPlayerId}
                  cardCount={player.userId === myPlayerId ? hand.length : (cardCounts[player.userId] || 0)}
                  tricksWon={(collectedHandsByPlayer[player.userId] || []).length}
                  points={getPlayerPoints(player)}
                />
              ))}
            </div>

            <section className="rentz-log-panel rentz-log-panel-desktop">
              <ChromePanelHeader title="Log" />
              <div className="rentz-log-list">
                {activityFeed.length === 0 ? (
                  <div className="rentz-log-entry is-empty">Hand winners appear here.</div>
                ) : (
                  activityFeed.map((item, index) => (
                    <div key={`${item}-${index}`} className="rentz-log-entry">
                      {item}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="rentz-mobile-panels">
            <section className="rentz-players-panel">
              <ChromePanelHeader title="Players" />
              <div className="rentz-player-list">
                {playersForMobilePanel.map((player, index) => (
                  <CompactPlayerRow
                    key={player.userId || player.socketId || index}
                    player={player}
                    isCurrent={nextTurnPlayer?.userId === player.userId}
                    isLocal={player.userId === myPlayerId}
                    cardCount={player.userId === myPlayerId ? hand.length : (cardCounts[player.userId] || 0)}
                    tricksWon={(collectedHandsByPlayer[player.userId] || []).length}
                    points={getPlayerPoints(player)}
                  />
                ))}
              </div>
            </section>

            <section className="rentz-log-panel rentz-log-panel-mobile">
              <ChromePanelHeader title="Log" />
              <div className="rentz-log-list">
                {activityFeed.length === 0 ? (
                  <div className="rentz-log-entry is-empty">Hand winners appear here.</div>
                ) : (
                  activityFeed.map((item, index) => (
                    <div key={`${item}-${index}`} className="rentz-log-entry">
                      {item}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    );
  };

  const renderPlayContent = () => {
    let playContent;

    if (!activeProfile) {
      playContent = (
        <div className="relative z-10 m-auto flex w-full max-w-md flex-col gap-4 px-1 text-center">
          <h3 className="text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">Play as Guest</h3>
          <p className="text-base font-semibold text-[var(--text-secondary)] sm:text-sm">
            Pick a guest display name for this device. Account login lives separately from guest play.
          </p>
          <input
            value={guestNameInput}
            onChange={(event) => setGuestNameInput(event.target.value)}
            placeholder="Enter a guest display name..."
            className="w-full rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-input)] px-5 py-4 font-black tracking-wide text-[var(--text-primary)] shadow-inner focus:outline-none focus:ring-4 focus:ring-[var(--accent-glow)]"
          />
          <button onClick={handleGuestContinue} className="frutiger-button py-4 text-base sm:text-lg">
            Continue as Guest
          </button>
        </div>
      );
    } else if (!inLobby) {
      playContent = isPublicBrowserOpen ? renderPublicRoomsView() : renderMatchmaking();
    } else if (!gameStarted || (gameFinished && playView !== 'stats')) {
      playContent = renderLobbyView();
    } else {
      playContent = renderGameTable();
    }

    return (
      <>
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-[1.5rem] bg-red-500/90 px-4 py-3 text-sm font-bold text-white shadow-lg sm:rounded-full sm:px-6">
            <Info className="h-5 w-5" />
            {errorMsg}
          </div>
        )}
        {playContent}
      </>
    );
  };

  const renderHandSpread = ({ mode = 'play' } = {}) => {
    const isPlayMode = mode === 'play';

    return (
      <section className={clsx('rentz-hand-panel relative', mode === 'choice' && 'rentz-choice-hand-panel')}>
        {isPlayMode && pendingPlayCard && (
          <div className="absolute right-4 top-1 z-[110] flex origin-top-right scale-[0.93] flex-col items-center gap-1.5 rounded-[1.2rem] border border-[rgba(255,255,255,0.7)] bg-[linear-gradient(180deg,rgba(255,255,255,0.65)_0%,rgba(210,225,240,0.5)_100%)] p-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_8px_16px_rgba(30,50,70,0.12)] backdrop-blur-md">
            <span className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-[#1e3445] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] pt-0.5">Place card?</span>
            <div className="flex w-full justify-between gap-1.5 px-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingPlayCard(null);
                }}
                className="flex h-[1.35rem] w-full flex-1 items-center justify-center rounded-full border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.8)_0%,rgba(230,235,240,0.8)_100%)] text-slate-500 shadow-sm transition hover:brightness-105"
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  socket.emit('play_card', { roomId, card: pendingPlayCard });
                  setPendingPlayCard(null);
                }}
                className="flex h-[1.35rem] w-full flex-1 items-center justify-center rounded-full border border-[#b4e854] bg-[linear-gradient(180deg,#d4fc79_0%,#96e6a1_100%)] text-[#2f5c15] shadow-[0_2px_4px_rgba(150,230,161,0.3),inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:brightness-105"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </button>
            </div>
          </div>
        )}
        <div
          ref={mode === 'choice' ? choiceHandScrollRef : handScrollRef}
          className="rentz-hand-scroll"
          data-rentz-modal-scroll={mode === 'choice' ? 'x' : undefined}
        >
          <div
            className="rentz-hand-row"
            style={sortedHand.length > 0 && visibleHandSpreadMetrics ? { width: `${visibleHandSpreadMetrics.spreadWidth}px` } : undefined}
          >
            {(() => {
              let hoverShifts = [];
              if (sortedHand.length > 0) {
                const N = sortedHand.length;
                hoverShifts = new Array(N).fill(0);
                const effectiveHoverIndex = hoveredCardIndex !== null
                  ? hoveredCardIndex
                  : (pendingPlayCard ? sortedHand.indexOf(pendingPlayCard) : null);

                if (effectiveHoverIndex !== null && visibleHandSpreadMetrics && N > 1) {
                  const H = effectiveHoverIndex;
                  const A = visibleHandSpreadMetrics.cardAdvance;
                  const hoverWeight = 3.5;

                  const leftTotalWeight = (H > 0) ? ((H - 1) * 1 + hoverWeight) : 0;
                  let currentX = 0;
                  for (let i = 0; i <= H; i += 1) {
                    hoverShifts[i] = currentX - i * A;
                    if (i === H - 1) {
                      currentX += (H * A) * (hoverWeight / leftTotalWeight);
                    } else if (i < H - 1) {
                      currentX += (H * A) * (1 / leftTotalWeight);
                    }
                  }

                  const R = N - 1 - Math.max(0, H);
                  const rightTotalWeight = (R > 0) ? ((R - 1) * 1 + hoverWeight) : 0;
                  currentX = H * A;
                  for (let i = H + 1; i < N; i += 1) {
                    if (i === H + 1) {
                      currentX += (R * A) * (hoverWeight / rightTotalWeight);
                    } else {
                      currentX += (R * A) * (1 / rightTotalWeight);
                    }
                    hoverShifts[i] = currentX - i * A;
                  }
                }
              }

              return sortedHand.map((card, index) => {
                const playable = isPlayMode && playableCards[card];
                const disabled = !playable;
                const mustFollowSuit = isPlayMode && isMyTurn && trickSuit && !playable && hand.some((handCard) => parseCard(handCard).suit === trickSuit);
                const shouldGhostCard = isPlayMode && disabled && (mustFollowSuit || isTurnLocked);

                const isCardHovered = (hoveredCardIndex !== null ? hoveredCardIndex : (pendingPlayCard ? sortedHand.indexOf(pendingPlayCard) : null)) === index;

                return (
                  <div
                    key={`${mode}-${card}-${index}`}
                    className={clsx(
                      'rentz-hand-card-wrap',
                      playable && 'is-playable',
                      isCardHovered && 'is-hovered'
                    )}
                    onMouseEnter={() => setHoveredCardIndex(index)}
                    onMouseLeave={() => setHoveredCardIndex(null)}
                    style={{
                      zIndex: index + 1,
                      height: visibleHandSpreadMetrics ? `${visibleHandSpreadMetrics.cardHeight}px` : undefined,
                      width: visibleHandSpreadMetrics ? `${visibleHandSpreadMetrics.cardWidth}px` : undefined,
                      marginLeft: index > 0 && visibleHandSpreadMetrics
                        ? `${visibleHandSpreadMetrics.cardAdvance - visibleHandSpreadMetrics.cardWidth}px`
                        : undefined,
                      '--hover-shift': `${hoverShifts[index]}px`
                    }}
                  >
                    <Card
                      cardString={card}
                      onClick={isPlayMode
                        ? () => {
                          const isMobileDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 1024;
                          if (disabled) {
                            if (isMobileDevice) {
                              setPendingPlayCard(null);
                            }
                            return;
                          }
                          if (isMobileDevice) {
                            setPendingPlayCard(card);
                          } else {
                            socket.emit('play_card', { roomId, card });
                          }
                        }
                        : undefined}
                      disabled={disabled}
                      ghosted={shouldGhostCard}
                      title={mustFollowSuit ? `You must follow ${SUIT_NAMES[trickSuit]}.` : ''}
                      variant="hand"
                    />
                  </div>
                );
              });
            })()}

            {hand.length === 0 && (
              <div className="rentz-empty-hand">
                {isSpectatingGame ? 'Spectating this match...' : 'Waiting for the next hand...'}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderChoiceMatrix = () => {
    const rulesets = choiceState?.availableRulesets?.length
      ? choiceState.availableRulesets
      : roomSettings.availableRulesets;
    const selectedRulesets = choiceState?.selectedRulesets || roomSettings.selectedRulesets;
    const permissions = choiceState?.rulesetPermissions || roomSettings.rulesetPermissions;
    const usedChoices = choiceState?.usedChoices || {};
    const chooserName = getPlayerName(currentChooser);
    const showChoiceHand = !choiceState?.nvSelected && !isSpectatingGame;

    return (
      <ModalShell
        title={amIChooser ? 'Choose a game' : `${getPlayerName(currentChooser)} is choosing a game`}
        eyebrow={choiceState?.nvSelected ? 'NV selected' : 'Small game'}
        wide
        overlayClassName={clsx('rentz-choice-overlay', showChoiceHand && 'has-choice-hand')}
        panelClassName={clsx('rentz-choice-panel', showChoiceHand && 'has-choice-hand')}
        bodyClassName="rentz-choice-body"
        headerAside={(
          <div className={clsx('rentz-choice-status-pill', amIChooser ? 'is-active' : 'is-waiting')}>
            {amIChooser ? 'Your choice' : 'Waiting for chooser'}
          </div>
        )}
        afterPanel={showChoiceHand ? (
          <div className="rentz-choice-hand-stage" aria-label="Your hand preview">
            {renderHandSpread({ mode: 'choice' })}
          </div>
        ) : null}
      >
        <div className={clsx('rentz-choice-table-shell', !amIChooser && 'is-waiting')}>
          <div className="rentz-ruleset-grid-wrap rentz-choice-table-scroll overflow-x-auto" data-rentz-modal-scroll="y">
          <table className="rentz-ruleset-grid w-full">
            <thead>
              <tr>
                <th className="rentz-ruleset-header-cell text-left">
                  Game
                </th>
                {players.map((player) => (
                  <th
                    key={player.userId}
                    data-short-label={getPlayerInitials(player)}
                    className={clsx(
                      'rentz-ruleset-header-cell text-center',
                      player.userId === choiceState?.chooserId && 'is-chooser-column'
                    )}
                    title={getPlayerName(player)}
                  >
                    <span className="rentz-ruleset-player-name">{getPlayerName(player)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rulesets.map((rule) => (
                <tr key={rule.id}>
                  <th className="rentz-ruleset-row-header text-left">
                    <div className="text-lg font-black text-[var(--text-primary)]">{rule.abbreviation || rule.label}</div>
                    <div className="text-xs font-bold text-[var(--text-secondary)]">{rule.label}</div>
                  </th>
                  {players.map((player) => {
                    const globallyEnabled = selectedRulesets[rule.id] !== false;
                    const allowed = permissions?.[player.userId]?.[rule.id] !== false;
                    const used = Boolean(usedChoices?.[player.userId]?.[rule.id]);
                    const isChooserCell = player.userId === choiceState?.chooserId;
                    const canChoose = amIChooser && isChooserCell && globallyEnabled && allowed && !used;
                    const choiceLabel = used ? 'Used' : globallyEnabled && allowed ? (isChooserCell ? 'Pick' : 'Open') : 'Off';

                    return (
                      <td
                        key={`${player.userId}-${rule.id}`}
                        role={canChoose ? 'button' : undefined}
                        tabIndex={canChoose ? 0 : undefined}
                        aria-disabled={!canChoose || undefined}
                        onClick={canChoose ? () => handleChooseRuleset(rule.id) : undefined}
                        onKeyDown={canChoose
                          ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleChooseRuleset(rule.id);
                            }
                          }
                          : undefined}
                        className={clsx(
                          'rentz-ruleset-choice-td',
                          canChoose && 'is-pickable',
                          used && 'is-used',
                          !used && globallyEnabled && allowed && !canChoose && 'is-open',
                          (!globallyEnabled || !allowed) && 'is-disabled',
                          isChooserCell && 'is-chooser-cell'
                        )}
                      >
                        <span className="rentz-ruleset-choice-cell">{choiceLabel}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!amIChooser && (
            <div className="rentz-choice-table-status is-floating">
              {chooserName} is choosing. Table actions are paused for you.
            </div>
          )}
        </div>
      </ModalShell>
    );
  };

  const renderNvChoice = () => (
    <ModalShell
      title={amIChooser ? 'Choose NV' : `${getPlayerName(currentChooser)} is choosing NV`}
      eyebrow="Round setup"
      headerAside={(
        <div className={clsx('rentz-choice-status-pill', amIChooser ? 'is-active' : 'is-waiting')}>
          {amIChooser ? 'Your choice' : 'Waiting for chooser'}
        </div>
      )}
    >
      <div className="rentz-nv-choice-intro">
        <p>
          {amIChooser
            ? 'You are choosing whether this round starts as NV.'
            : `${getPlayerName(currentChooser)} is choosing whether this round starts as NV.`}
        </p>
      </div>
      <div className={clsx('rentz-nv-choice-grid', !amIChooser && 'is-waiting')}>
        <button
          type="button"
          disabled={!amIChooser}
          onClick={() => handleNvChoice(true)}
          className={clsx(
            'rentz-nv-choice-card',
            amIChooser && 'is-pickable',
            !amIChooser && 'is-disabled'
          )}
        >
          <span className="rentz-nv-choice-icon">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="rentz-nv-choice-title">Play NV</span>
          <span className="rentz-nv-choice-copy">Choose the game first. Scores from the round are doubled.</span>
        </button>
        <button
          type="button"
          disabled={!amIChooser}
          onClick={() => handleNvChoice(false)}
          className={clsx(
            'rentz-nv-choice-card',
            amIChooser && 'is-pickable',
            !amIChooser && 'is-disabled'
          )}
        >
          <span className="rentz-nv-choice-icon">
            <Swords className="h-5 w-5" />
          </span>
          <span className="rentz-nv-choice-title">No NV</span>
          <span className="rentz-nv-choice-copy">Deal first. Every player sees their own hand during game choice.</span>
        </button>
      </div>
    </ModalShell>
  );

  const renderEditorContent = () => (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">Ruleset Editor</h3>
            <p className="text-base font-semibold text-[var(--text-secondary)] sm:text-sm">
              Create, edit, and validate custom Rentz rules before you bring them into a match.
            </p>
          </div>
          <div className="status-pill px-4 py-2">{editorType.replace('_', ' ')}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto]">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">Long name</span>
            <input
              value={editorTitle}
              onChange={(event) => setEditorTitle(event.target.value)}
              className="w-full rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-input)] px-5 py-4 font-black text-[var(--text-primary)] shadow-inner focus:outline-none focus:ring-4 focus:ring-[var(--accent-glow)]"
              placeholder="King of Hearts"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">Short name</span>
            <input
              value={editorShortName}
              onChange={(event) => setEditorShortName(event.target.value)}
              className="w-full rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-input)] px-5 py-4 font-black text-[var(--text-primary)] shadow-inner focus:outline-none focus:ring-4 focus:ring-[var(--accent-glow)]"
              placeholder="K♥"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">Type</span>
            <select
              value={editorType}
              onChange={(event) => setEditorType(event.target.value)}
              className="w-full rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-input)] px-4 py-4 font-black text-[var(--text-primary)] shadow-inner focus:outline-none"
            >
              <option value="per_round">per_round</option>
              <option value="end_game">end_game</option>
            </select>
          </label>
        </div>

        <div className="rentz-code-editor-shell mt-4">
          <textarea
            value={editorCode}
            onChange={(event) => setEditorCode(event.target.value)}
            className="rentz-code-editor-textarea"
            spellCheck={false}
          />
        </div>

        <input
          ref={editorImportInputRef}
          type="file"
          accept=".rentz,text/plain"
          onChange={handleImportRentzToEditor}
          className="hidden"
        />

        <div className="rentz-editor-actions mt-4">
          <button onClick={handleCompileRules} className="rentz-editor-action is-primary">
            <span className="rentz-editor-action-icon">
              <FileCode2 className="h-5 w-5" />
            </span>
            <span className="rentz-editor-action-copy">
              <span className="rentz-editor-action-title">Compile Ruleset</span>
              <span className="rentz-editor-action-meta">Validate syntax and refresh the preview.</span>
            </span>
          </button>
          <button onClick={handleSaveDraft} className="rentz-editor-action is-positive">
            <span className="rentz-editor-action-icon">
              <Check className="h-5 w-5" />
            </span>
            <span className="rentz-editor-action-copy">
              <span className="rentz-editor-action-title">Save Draft</span>
              <span className="rentz-editor-action-meta">Keep this ruleset in your local draft list.</span>
            </span>
          </button>
          <button onClick={handleDownloadRentzRuleset} className="rentz-editor-action">
            <span className="rentz-editor-action-icon">
              <Download className="h-5 w-5" />
            </span>
            <span className="rentz-editor-action-copy">
              <span className="rentz-editor-action-title">Download .rentz</span>
              <span className="rentz-editor-action-meta">Export the current ruleset as a shareable file.</span>
            </span>
          </button>
          <button onClick={() => editorImportInputRef.current?.click()} className="rentz-editor-action">
            <span className="rentz-editor-action-icon">
              <Upload className="h-5 w-5" />
            </span>
            <span className="rentz-editor-action-copy">
              <span className="rentz-editor-action-title">Import .rentz</span>
              <span className="rentz-editor-action-meta">Load a saved ruleset into the editor.</span>
            </span>
          </button>
          {canAddGuestRoomRulesets && (
            <button onClick={handleApplyEditorRulesetToRoom} className="rentz-editor-action is-room">
              <span className="rentz-editor-action-icon">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="rentz-editor-action-copy">
                <span className="rentz-editor-action-title">Apply to Room</span>
                <span className="rentz-editor-action-meta">Push this ruleset straight into the current room.</span>
              </span>
            </button>
          )}
          <button onClick={() => setActiveTab('guide')} className="rentz-editor-action is-guide">
            <span className="rentz-editor-action-icon">
              <Info className="h-5 w-5" />
            </span>
            <span className="rentz-editor-action-copy">
              <span className="rentz-editor-action-title">View Guide</span>
              <span className="rentz-editor-action-meta">Open the syntax guide and rule-writing help.</span>
            </span>
          </button>
        </div>

        {editorStatus && (
          <div className="mt-4 rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
            {editorStatus}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="glass-panel p-5 sm:p-6">
          <h4 className="mb-3 text-2xl font-display font-black text-[var(--text-primary)]">Compiler Preview</h4>
          {editorAst ? (
            <pre className="max-h-[24rem] overflow-auto rounded-[1.3rem] bg-slate-950/80 p-4 text-xs text-lime-100">
              {JSON.stringify(editorAst, null, 2)}
            </pre>
          ) : (
            <p className="rounded-[1.3rem] border border-dashed border-[var(--glass-border)] bg-[var(--surface-subtle)] p-5 text-sm font-semibold text-[var(--text-secondary)]">
              No compiled preview yet.
            </p>
          )}
        </div>

        <div className="glass-panel p-5 sm:p-6">
          <h4 className="mb-3 text-2xl font-display font-black text-[var(--text-primary)]">My Drafts</h4>
          <div className="space-y-3">
            {ruleDrafts.length === 0 ? (
              <p className="text-sm font-semibold text-[var(--text-secondary)]">
                Drafts you save here stay on this device for quick iteration.
              </p>
            ) : (
              ruleDrafts.map((draft) => (
                <button
                  key={draft.id}
                  onClick={() => {
                    setEditorTitle(draft.title);
                    setEditorShortName(draft.shortName || buildRulesetShortNameFallback(draft.title));
                    setEditorType(draft.type);
                    setEditorCode(draft.code);
                    setActiveTab('editor');
                  }}
                  className="w-full rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-subtle)] px-4 py-3 text-left transition hover:bg-[var(--surface-soft)]"
                >
                  <div className="text-base font-black text-[var(--text-primary)]">{draft.title}</div>
                  <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    {draft.type} • {new Date(draft.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );

  const renderLoginContent = () => (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <section className="glass-panel p-5 sm:p-8">
        <h3 className="mb-2 text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">Account Login</h3>
        <p className="mb-6 text-base font-semibold text-[var(--text-secondary)] sm:text-sm">
          Guest display names now live on the Play screen. This area is reserved for registered account access instead of minting pseudo-accounts from a display name field.
        </p>

        {!isAuthenticated ? (
          <div className="rounded-[1.7rem] border border-dashed border-[var(--glass-border)] bg-[var(--surface-subtle)] p-5 sm:p-6">
            <div className="text-lg font-black text-[var(--text-primary)]">Registered accounts are not wired in yet.</div>
            <p className="mt-3 text-sm font-semibold leading-7 text-[var(--text-secondary)]">
              Use the Play tab to choose a guest display name and jump into rooms. Once real account auth is connected, this page can host the proper sign-in flow without confusing guest names for accounts.
            </p>
            <button onClick={() => setActiveTab('play')} className="frutiger-button mt-5 w-full py-4 text-lg">
              Back to Play
            </button>
          </div>
        ) : (
          <div className="rounded-[1.7rem] border border-[var(--glass-border)] bg-[var(--surface-subtle)] p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="seat-avatar h-14 w-14 text-lg">
                {userProfile?.name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
              <div>
                <div className="text-2xl font-black text-[var(--text-primary)]">{userProfile?.name}</div>
                <div className="text-sm font-semibold text-[var(--text-secondary)]">Signed in for local multiplayer</div>
              </div>
            </div>
            <button onClick={handleLogout} className="ready-button mt-6 w-full py-4 text-lg">
              Switch Player
            </button>
          </div>
        )}
      </section>

      <section className="glass-panel p-5 sm:p-8">
        <h4 className="mb-3 text-2xl font-display font-black text-[var(--text-primary)]">Session Status</h4>
        <div className="space-y-3 text-sm font-semibold text-[var(--text-secondary)]">
          <div className="status-pill flex items-center justify-between px-4 py-3">
            <span>Authenticated</span>
            <span>{isAuthenticated ? 'Yes' : 'No'}</span>
          </div>
          <div className="status-pill flex items-center justify-between px-4 py-3">
            <span>Current room</span>
            <span>{roomId || 'None'}</span>
          </div>
          <div className="status-pill flex items-center justify-between px-4 py-3">
            <span>Game active</span>
            <span>{gameStarted ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </section>
    </div>
  );

  const renderPlaceholderModule = (title, body) => (
    <div className="glass-panel min-h-[60vh] p-5 sm:p-8">
      <h3 className="mb-3 text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">{title}</h3>
      <p className="max-w-2xl text-base font-semibold leading-7 text-[var(--text-secondary)] sm:text-sm">{body}</p>
    </div>
  );

  const renderGuideContent = () => (
    <div className="flex max-h-[85vh] flex-col gap-4">
      <div className="flex shrink-0 items-center justify-between px-2">
        <h3 className="text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">Ruleset Definition Guide</h3>
        <button onClick={() => setActiveTab('editor')} className="rounded-full border border-[var(--glass-border)] bg-[var(--surface-medium)] px-5 py-2 text-sm font-black uppercase tracking-[0.18em] text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--surface-hover)]">
          Back to Editor
        </button>
      </div>

      <div className="glass-panel flex-1 overflow-y-auto p-5 sm:p-8">
        <div className="space-y-8 text-sm font-medium leading-7 text-[var(--text-secondary)]">
          <section>
            <h4 className="mb-3 text-xl font-bold text-[var(--text-primary)]">Overview</h4>
            <p>The rules engine supports custom Rentz rules executed either <code>per_round</code> or <code>end_game</code>. Special variables are made available to your scripts at runtime.</p>
          </section>

          <section>
            <h4 className="mb-3 text-xl font-bold text-[var(--text-primary)]">Variables</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <strong className="text-base text-[var(--text-primary)]">POINTS</strong>
                <p className="mt-1 text-xs">The current score of the player.</p>
              </div>
              <div className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <strong className="text-base text-[var(--text-primary)]">TRICKS_WON</strong>
                <p className="mt-1 text-xs">The number of tricks currently won by the player.</p>
              </div>
              <div className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <strong className="text-base text-[var(--text-primary)]">[SUIT]_COUNT</strong>
                <p className="mt-1 text-xs">Number of specific suits captured (e.g. <code>HEART_COUNT</code>, <code>SPADE_COUNT</code>).</p>
              </div>
              <div className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <strong className="text-base text-[var(--text-primary)]">[SUIT]_[VALUE]</strong>
                <p className="mt-1 text-xs">Boolean if the specific card was captured (e.g. <code>HEART_KING</code>, <code>DIAMOND_JACK</code>).</p>
              </div>
              <div className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <strong className="text-base text-[var(--text-primary)]">CARD_NR</strong>
                <p className="mt-1 text-xs">The total number of cards currently collected by the player.</p>
              </div>
              <div className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <strong className="text-base text-[var(--text-primary)]">PLAYER_COUNT</strong>
                <p className="mt-1 text-xs">The total number of players in the game.</p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-3 text-xl font-bold text-[var(--text-primary)]">Functions & Commands</h4>
            <ul className="space-y-4">
              <li className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <code className="rounded bg-[var(--surface-code-inline)] px-1 font-mono text-base font-bold text-[var(--text-primary)]">add(value)</code>
                <p className="mt-1">Adds the specified integer expression to the player's score.</p>
              </li>
              <li className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <code className="rounded bg-[var(--surface-code-inline)] px-1 font-mono text-base font-bold text-[var(--text-primary)]">set_to(value)</code>
                <p className="mt-1">Hardcodes the player's score directly to the specified expression.</p>
              </li>
              <li className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <code className="rounded bg-[var(--surface-code-inline)] px-1 font-mono text-base font-bold text-[var(--text-primary)]">reset_to(value)</code>
                <p className="mt-1">Resets the score back to a default value, optionally taking an expression.</p>
              </li>
              <li className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <code className="rounded bg-[var(--surface-code-inline)] px-1 font-mono text-base font-bold text-[var(--text-primary)]">end()</code>
                <p className="mt-1">Instantly ends the current round context execution.</p>
              </li>
              <li className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
                <code className="rounded bg-[var(--surface-code-inline)] px-1 font-mono text-base font-bold text-[var(--text-primary)]">game_end()</code>
                <p className="mt-1">Forces the game to conclude and proceeds to final standings.</p>
              </li>
            </ul>
          </section>

          <section>
            <h4 className="mb-3 text-xl font-bold text-[var(--text-primary)]">Control Flow & Logic</h4>
            <p className="mb-3">Standard logical branches are fully supported. Conditions must be wrapped in parentheses.</p>
            <ul className="list-inside list-disc space-y-2 pl-4">
              <li><strong>Statements:</strong> <code>if</code>, <code>elif</code>, <code>else</code>, <code>endif</code></li>
              <li><strong>Comparisons:</strong> <code>==</code>, <code>!=</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code></li>
              <li><strong>Logical Operators:</strong> <code>and</code>, <code>or</code>, <code>not</code></li>
              <li><strong>Math Operators:</strong> <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code></li>
            </ul>
          </section>

          <section>
            <h4 className="mb-3 text-xl font-bold text-[var(--text-primary)]">Comprehensive Example</h4>
            <pre className="overflow-x-auto rounded-[1.3rem] bg-slate-950/85 p-6 font-mono text-sm leading-relaxed text-lime-100 shadow-inner">
              {`if (HEART_KING)
  add(-100)
elif (HEART_COUNT > 0)
  add(HEART_COUNT * -20)
endif

if (TRICKS_WON == 0 and POINTS < -50)
  set_to(0)
  end()
endif

if (not DIAMOND_JACK)
  add(10)
else
  add(150)
endif

if (POINTS < -500)
  game_end()
endif`}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );

  const renderMainContent = () => {
    if (activeTab === 'play') {
      return renderPlayContent();
    }

    if (activeTab === 'editor') {
      return renderEditorContent();
    }

    if (activeTab === 'guide') {
      return renderGuideContent();
    }

    if (activeTab === 'login') {
      return renderLoginContent();
    }

    if (activeTab === 'settings') {
      return (
        <div className="space-y-5">
          <div className="glass-panel p-5 sm:p-6 lg:p-8">
            <h3 className="mb-3 text-2xl font-display font-black text-[var(--text-primary)] sm:text-3xl">Settings</h3>
            <p className="mb-6 text-base font-semibold leading-7 text-[var(--text-secondary)] sm:text-sm">
              Theme, font size, and content zoom save locally on this device. Page zoom only affects the active subpage area, so the browser window and OS UI stay untouched.
            </p>

            <div className="rounded-[1.6rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4 sm:p-5">
              <div className="mb-4">
                <h4 className="text-xl font-display font-black text-[var(--text-primary)] sm:text-2xl">Theme Palette</h4>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-secondary)] sm:text-base">
                  Each palette now uses stronger surface contrast so cards, chips, and secondary panels stay readable.
                </p>
              </div>
              <ThemeTray themes={themes} theme={theme} onThemeChange={applyTheme} />
            </div>
          </div>

          <SettingsSlider
            title="Font Size"
            description="Scale the app typography in fixed 5% steps for easier reading across the interface."
            min={FONT_SCALE_RANGE.min}
            max={FONT_SCALE_RANGE.max}
            step={FONT_SCALE_RANGE.step}
            value={fontScalePercent}
            defaultValue={FONT_SCALE_RANGE.defaultValue}
            onChange={(nextValue) => setFontScale(nextValue / 100)}
          />

          <SettingsSlider
            title="Subpage Zoom"
            description="Scale the current page content in fixed 5% steps without zooming the entire browser tab."
            min={PAGE_ZOOM_RANGE.min}
            max={PAGE_ZOOM_RANGE.max}
            step={PAGE_ZOOM_RANGE.step}
            value={pageZoomPercent}
            defaultValue={PAGE_ZOOM_RANGE.defaultValue}
            onChange={(nextValue) => setPageZoom(nextValue / 100)}
          />
        </div>
      );
    }

    if (activeTab === 'friends') {
      return renderPlaceholderModule(
        'Friends',
        'Friend codes, presence, and private invites can live here. The navbar entry is now in place so we can wire the real friend graph into this space next.'
      );
    }

    if (activeTab === 'library') {
      return renderPlaceholderModule(
        'Library',
        'Saved rulesets, picks from the Ruleset Rater, and your own authored presets will be surfaced here. The editor tab now gives us the creation flow to pair with this library view.'
      );
    }

    if (activeTab === 'ruleset-rater') {
      return renderPlaceholderModule(
        'Ruleset Rater',
        'Shared community rulesets will appear here with ratings, downloads, and quick-save actions once the Ruleset Rater endpoints are fully hooked up.'
      );
    }

    return null;
  };

  return (
    <div className="app-shell relative min-h-screen w-full overflow-hidden p-0 pt-2 font-sans transition-colors duration-700 sm:pt-4 md:p-3 md:pt-3 lg:p-4">
      <div className="app-window macos-window relative z-20 mx-auto flex h-[calc(100dvh-0.5rem)] w-full max-w-[1680px] flex-col border border-[var(--glass-border)] shadow-2xl transition-colors duration-500 sm:h-[calc(100dvh-1rem)] md:h-[96vh]">
        <div className="relative z-30 flex h-14 shrink-0 items-center border-b border-[var(--glass-border)] px-3 shadow-sm transition-colors duration-500 sm:px-4 md:px-5" style={{ background: 'var(--glass-bg)' }}>
          <div className="flex w-20 gap-2.5 md:w-24">
            <div className="h-3.5 w-3.5 rounded-full border border-[#e0443e] bg-[#ff5f56] shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)]" />
            <div className="h-3.5 w-3.5 rounded-full border border-[#dea123] bg-[#ffbd2e] shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)]" />
            <div className="h-3.5 w-3.5 rounded-full border border-[#1aab29] bg-[#27c93f] shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)]" />
          </div>

          <div className="flex flex-1 items-center justify-center gap-2">
            <Droplet fill="currentColor" className="h-4 w-4 text-[var(--text-primary)] opacity-40 drop-shadow-md" />
            <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-[var(--text-primary)] opacity-60 sm:text-xs">
              Rentz Arena
            </span>
          </div>

          <div className="flex w-20 justify-end md:w-24">
            <button
              onClick={() => handleNavSelect('settings')}
              className="rounded-full border border-[var(--glass-border)] bg-[var(--surface-medium)] p-2 text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--surface-hover)]"
              title="Open settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {topPrompts.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-40 px-4">
            <div className="relative mx-auto h-14 w-full">
              {topPrompts.map((topPrompt) => (
                <div
                  key={topPrompt.id}
                  className="absolute left-1/2 top-0 w-fit max-w-[calc(100vw-2rem)] -translate-x-1/2"
                >
                  <div
                    className={clsx(
                      'copy-toast glass-panel inline-flex w-max max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-[1.35rem] px-3 py-2.5 shadow-[0_18px_36px_rgba(0,0,0,0.16)] backdrop-blur-2xl sm:gap-3 sm:rounded-[1.6rem] sm:px-4 sm:py-3 sm:max-w-[30rem]',
                      topPrompt.tone === 'success' && 'border-lime-100/90 bg-[linear-gradient(180deg,rgba(248,255,245,0.92)_0%,rgba(214,247,177,0.78)_100%)]',
                      topPrompt.tone === 'warning' && 'border-amber-100/90 bg-[linear-gradient(180deg,rgba(255,251,235,0.95)_0%,rgba(253,230,138,0.82)_100%)]',
                      topPrompt.tone === 'error' && 'border-rose-100/90 bg-[linear-gradient(180deg,rgba(255,246,248,0.94)_0%,rgba(255,205,218,0.82)_100%)]',
                      topPrompt.tone === 'info' && 'border-sky-100/90 bg-[linear-gradient(180deg,rgba(245,252,255,0.94)_0%,rgba(198,234,255,0.8)_100%)]'
                    )}
                  >
                    <div
                      className={clsx(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-[inset_0_1px_2px_rgba(255,255,255,0.92),0_6px_12px_rgba(0,0,0,0.08)] sm:h-8 sm:w-8',
                        topPrompt.tone === 'success' && 'border-lime-100/95 bg-white/80 text-emerald-700',
                        topPrompt.tone === 'warning' && 'border-amber-100/95 bg-white/80 text-amber-700',
                        topPrompt.tone === 'error' && 'border-rose-100/95 bg-white/80 text-rose-700',
                        topPrompt.tone === 'info' && 'border-sky-100/95 bg-white/80 text-sky-700'
                      )}
                    >
                      {topPrompt.tone === 'error' ? (
                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      ) : topPrompt.tone === 'warning' ? (
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      ) : topPrompt.tone === 'info' ? (
                        <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      ) : (
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      )}
                    </div>
                    <div className="min-w-0 whitespace-normal break-words text-xs font-black leading-5 text-[var(--text-primary)] sm:text-sm md:text-base">
                      {topPrompt.message}
                    </div>
                  </div>
                </div>
              ))}
              <div className="h-14" aria-hidden="true" />
            </div>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--glass-border)] p-4 transition-colors duration-500 md:flex" style={{ background: 'var(--glass-bg)' }}>
            <div className="mb-8 mt-2 flex items-center gap-3 px-3">
              <Sparkles fill="currentColor" className="h-8 w-8 text-[var(--text-primary)] opacity-80 drop-shadow-lg" />
              <h1 className="font-display text-[2.1rem] font-black tracking-tighter text-[var(--text-primary)]">Rentz</h1>
            </div>

            <nav className="flex flex-1 flex-col gap-1.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavSelect(item.id)}
                    className={clsx(
                      'flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left font-medium transition-[transform,background-color,color,box-shadow] duration-300',
                      isActive
                        ? 'translate-x-2 font-bold text-[var(--nav-active-text)]'
                        : 'text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text-primary)]'
                    )}
                    style={isActive ? { background: 'var(--nav-active-bg)', boxShadow: 'var(--nav-active-shadow)' } : {}}
                  >
                    <item.icon className={clsx('relative z-10 h-5 w-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-transform duration-300', isActive && 'scale-110')} />
                    <span className="relative z-10 text-[14px] tracking-wide">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-[var(--glass-border)] pt-6" />
          </aside>

          <main className="relative z-10 flex h-full flex-1 flex-col overflow-y-auto overflow-x-auto p-1 pb-16 sm:p-2 sm:pb-24 md:p-2 lg:p-2">
            <div className="subpage-viewport">
              <div className="subpage-content">
                {!isCompactGameHeader && (
                  <header className="mb-6 flex shrink-0 flex-col gap-3">
                    <div className="min-w-0 flex flex-col gap-1.5 pt-1">
                      <h2 className="flex items-center gap-3 font-display font-black capitalize leading-[1.08] tracking-tight text-[var(--text-primary)] drop-shadow-sm text-[2rem] sm:text-3xl md:text-[4rem]">
                        {activeTab === 'play' && !inLobby && <Swords className="h-8 w-8 opacity-70 sm:h-10 sm:w-10" />}
                        {activeTab}
                      </h2>
                      <div
                        className="h-1.5 w-24 rounded-full"
                        style={{ background: 'var(--button-bg)', boxShadow: 'var(--nav-active-shadow)' }}
                      />
                    </div>
                  </header>
                )}

                {errorMsg && activeTab !== 'play' && (
                  <div className="mb-4 flex items-center gap-2 rounded-[1.5rem] bg-red-500/90 px-4 py-3 text-sm font-bold text-white shadow-lg sm:rounded-full sm:px-6">
                    <Info className="h-5 w-5" />
                    {errorMsg}
                  </div>
                )}

                {renderMainContent()}
              </div>
            </div>
          </main>
        </div>
      </div>

      {isRecoveryPromptOpen && recoverableGuestProfile && (
        <ModalShell
          title="Rejoin session?"
          eyebrow="Refresh recovery"
          footer={(
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleStartFreshSession}
                className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              >
                Start new session
              </button>
              <button
                type="button"
                onClick={handleRejoinRecoverableSession}
                className="frutiger-button px-5 py-3 text-sm uppercase tracking-[0.14em]"
              >
                Rejoin session
              </button>
            </div>
          )}
        >
          <div className="rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4 text-sm font-semibold leading-6 text-[var(--text-secondary)] sm:text-base">
            Do you want to rejoin the previous session of{' '}
            <span className="font-black text-[var(--text-primary)]">{recoverableGuestProfile.name}</span>?
          </div>
        </ModalShell>
      )}

      {isRoomSettingsOpen && (
        <ModalShell
          title="Room Settings"
          eyebrow="Host controls"
          onClose={() => setIsRoomSettingsOpen(false)}
          wide
          footer={(
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsRoomSettingsOpen(false)}
                className="rounded-[1.3rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoomSettings}
                className="frutiger-button px-5 py-3 text-sm uppercase tracking-[0.14em]"
              >
                Save room settings
              </button>
            </div>
          )}
        >
          <input
            ref={roomImportInputRef}
            type="file"
            accept=".rentz,text/plain"
            onChange={handleImportRentzToRoom}
            className="hidden"
          />
          <div className="space-y-5">
            <section className="grid gap-4 lg:grid-cols-3">
              <label className="lg:col-span-1">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">Room name</span>
                <input
                  value={draftRoomSettings.roomName}
                  onChange={(event) => setDraftRoomSettings((current) => ({ ...current, roomName: event.target.value }))}
                  className="w-full rounded-[1.2rem] border border-[var(--glass-border)] bg-[var(--surface-input)] px-4 py-3 font-black text-[var(--text-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-glow)]"
                />
              </label>
              <div>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">Visibility</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'public', label: 'Public', icon: Globe2 },
                    { id: 'private', label: 'Private', icon: Lock }
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDraftRoomSettings((current) => ({ ...current, visibility: option.id }))}
                      className={clsx(
                        'flex items-center justify-center gap-2 rounded-[1.1rem] border px-3 py-3 text-xs font-black uppercase tracking-[0.12em]',
                        draftRoomSettings.visibility === option.id
                          ? 'border-white/80 bg-[var(--surface-solid)] text-[var(--text-primary)]'
                          : 'border-[var(--glass-border)] bg-[var(--surface-medium)] text-[var(--text-secondary)]'
                      )}
                    >
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[var(--text-secondary)]">Round controls</span>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] px-4 py-3">
                    <span className="text-sm font-black text-[var(--text-primary)]">Allow NV</span>
                    <ToggleCheck
                      checked={Boolean(draftRoomSettings.nvAllowed)}
                      onChange={() => setDraftRoomSettings((current) => ({ ...current, nvAllowed: !current.nvAllowed }))}
                      label="Allow NV games"
                    />
                  </div>
                  <label className="rounded-[1.1rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] px-4 py-3">
                    <span className="mb-2 flex items-center gap-2 text-sm font-black text-[var(--text-primary)]"><Clock className="h-4 w-4" /> Turn timer</span>
                    <input
                      type="range"
                      min={TURN_TIMER_RANGE.min}
                      max={TURN_TIMER_RANGE.max}
                      step="5"
                      value={draftRoomSettings.turnTimerSeconds}
                      onChange={(event) => setDraftRoomSettings((current) => ({ ...current, turnTimerSeconds: Number(event.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                    <span className="text-xs font-bold text-[var(--text-secondary)]">{draftRoomSettings.turnTimerSeconds}s</span>
                  </label>
                </div>
              </div>
            </section>

            {canAddGuestRoomRulesets && (
              <section className="flex flex-col gap-3 rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-display font-black text-[var(--text-primary)]">Room Ruleset</h4>
                  <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                    Guest host
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => roomImportInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                  >
                    <Upload className="h-4 w-4" />
                    Import .rentz
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoomSettingsOpen(false);
                      setActiveTab('editor');
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-[var(--glass-border)] bg-[var(--surface-medium)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                  >
                    <FileCode2 className="h-4 w-4" />
                    Open Editor
                  </button>
                </div>
              </section>
            )}

            <section className="rentz-ruleset-grid-wrap overflow-x-auto rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-subtle)] p-3">
              <table className="rentz-ruleset-grid w-full">
                <thead>
                  <tr>
                    <th className="rentz-ruleset-header-cell text-left">Ruleset</th>
                    <th className="rentz-ruleset-header-cell text-center">Room</th>
                    {players.map((player) => (
                      <th
                        key={player.userId}
                        className="rentz-ruleset-header-cell text-center"
                        data-short-label={getPlayerInitials(player)}
                        title={getPlayerName(player)}
                      >
                        <span className="rentz-ruleset-player-name">{getPlayerName(player)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draftRoomSettings.availableRulesets.map((option) => (
                    <tr key={option.id}>
                      <th className="rentz-ruleset-row-header text-left">
                        <div className="text-lg font-black text-[var(--text-primary)]">{option.abbreviation || option.label}</div>
                        <div className="text-xs font-bold text-[var(--text-secondary)]">
                          {option.label}{option.source === 'room' ? ' (room)' : ''}
                        </div>
                      </th>
                      <td className="text-center">
                        <ToggleCheck
                          checked={Boolean(draftRoomSettings.selectedRulesets[option.id])}
                          onChange={() => handleRoomRulesetToggle(option.id)}
                          label={`Enable ${option.label} in this room`}
                          compact
                        />
                      </td>
                      {players.map((player) => (
                        <td key={`${player.userId}-${option.id}`} className="text-center">
                          <ToggleCheck
                            checked={draftRoomSettings.rulesetPermissions?.[player.userId]?.[option.id] !== false && Boolean(draftRoomSettings.selectedRulesets[option.id])}
                            disabled={!draftRoomSettings.selectedRulesets[option.id]}
                            onChange={() => handlePlayerRulesetPermissionToggle(player.userId, option.id)}
                            label={`${getPlayerName(player)} can choose ${option.label}`}
                            compact
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-[1.4rem] border border-[var(--glass-border)] bg-[var(--surface-soft)] p-4">
              <h4 className="mb-3 text-lg font-display font-black text-[var(--text-primary)]">Player Management</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {[...players, ...spectators].filter((member) => member.userId !== activeProfile?.userId).map((member) => (
                  <div key={member.userId} className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--glass-border)] bg-[var(--surface-subtle)] px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-[var(--text-primary)]">{getPlayerName(member)}</div>
                      <div className="text-xs font-bold text-[var(--text-secondary)]">{member.role}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => handleTransferHost(member.userId)} className="rounded-full bg-[var(--surface-medium)] p-2" title="Transfer host"><Crown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => handleKickMember(member.userId)} className="rounded-full bg-[var(--surface-medium)] p-2" title="Kick"><X className="h-4 w-4" /></button>
                      <button type="button" onClick={() => handleBanMember(member.userId)} className="rounded-full bg-[var(--surface-medium)] p-2" title="Ban"><Ban className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="inline-flex items-center gap-2 rounded-[1.2rem] border border-red-200/70 bg-[linear-gradient(180deg,rgba(255,243,243,0.97)_0%,rgba(254,205,211,0.9)_100%)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-red-950"
                >
                  <LogOut className="h-4 w-4" />
                  Leave room
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  className="inline-flex items-center gap-2 rounded-[1.2rem] border border-red-200/70 bg-red-200/70 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete room
                </button>
              </div>
            </section>
          </div>
        </ModalShell>
      )}

      {isChoosingNv && renderNvChoice()}
      {isChoosingRuleset && renderChoiceMatrix()}
      {isStatsOpen && latestRoundStats && (
        <StatsOverlay
          stats={latestRoundStats}
          players={players}
          canContinue={canContinueRoundFromStats}
          matchComplete={matchCompletePending || gameFinished}
          onContinue={handleContinueMatch}
          onClose={() => setIsStatsOpen(false)}
        />
      )}

      <nav ref={mobileNavRef} className="mobile-tab-bar fixed bottom-3 left-2 right-2 z-50 sm:bottom-4 sm:left-3 sm:right-3 md:hidden">
        {isMobileMoreOpen && mobileMoreNavItems.length > 0 && (
          <div className="mobile-more-menu glass-panel absolute bottom-[calc(100%+0.7rem)] right-0 w-full rounded-[1.35rem] border border-[var(--glass-border)] p-2 shadow-[0_22px_44px_rgba(0,0,0,0.22)]">
            <div className="grid gap-2">
              {mobileMoreNavItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavSelect(item.id)}
                    className={clsx(
                      'flex min-h-[3.35rem] items-center gap-3 rounded-[1.05rem] px-3 text-left transition-[background-color,color,box-shadow]',
                      isActive
                        ? 'font-black text-[var(--nav-active-text)] shadow-[var(--nav-active-shadow)]'
                        : 'font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                    )}
                    style={isActive ? { background: 'var(--nav-active-bg)' } : {}}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 truncate text-xs uppercase tracking-[0.12em]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="mobile-tab-panel glass-panel rounded-[1.9rem] border border-[var(--glass-border)] p-2 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
          <div className="grid grid-cols-4 gap-2">
            {mobilePrimaryNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavSelect(item.id)}
                  className={clsx(
                    'relative flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.45rem] px-1.5 transition-[transform,background-color,color,box-shadow] duration-300',
                    isActive ? '-translate-y-2 scale-105 text-[var(--nav-active-text)]' : 'text-[var(--text-secondary)]'
                  )}
                >
                  {isActive && <div className="absolute inset-0 rounded-[1.45rem] shadow-[var(--nav-active-shadow)]" style={{ background: 'var(--nav-active-bg)' }} />}
                  <item.icon className="relative z-10 h-5 w-5 drop-shadow-md" />
                  <span className="relative z-10 max-w-full truncate text-[10px] font-black uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.14em]">
                    {item.label}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsMobileMoreOpen((current) => !current)}
              className={clsx(
                'relative flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.45rem] px-1.5 transition-[transform,background-color,color,box-shadow] duration-300',
                isMobileMoreActive || isMobileMoreOpen ? '-translate-y-2 scale-105 text-[var(--nav-active-text)]' : 'text-[var(--text-secondary)]'
              )}
              aria-expanded={isMobileMoreOpen}
              aria-haspopup="menu"
            >
              {(isMobileMoreActive || isMobileMoreOpen) && (
                <div className="absolute inset-0 rounded-[1.45rem] shadow-[var(--nav-active-shadow)]" style={{ background: 'var(--nav-active-bg)' }} />
              )}
              <MoreHorizontal className="relative z-10 h-5 w-5 drop-shadow-md" />
              <span className="relative z-10 max-w-full truncate text-[10px] font-black uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.14em]">
                More
              </span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default App;
