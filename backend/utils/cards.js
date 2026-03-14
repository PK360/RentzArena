const SUITS = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
const VALUES = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

// Generates a deck strictly configured for exactly 8 * playerCount cards
function generateDeck(playerCount) {
  const totalCards = 8 * playerCount;
  const valuesNeeded = totalCards / 4; // since 4 suits exist
  
  if (valuesNeeded > VALUES.length || valuesNeeded < 1) {
    throw new Error('Unsupported player count for standard deck slice');
  }

  const activeValues = VALUES.slice(0, valuesNeeded);
  const deck = [];

  for (const value of activeValues) {
    for (const suit of SUITS) {
      deck.push(`${value}-${suit}`);
    }
  }

  return deck;
}

// Fisher-Yates shuffle
function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  while (currentIndex > 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

function dealCards(deck, playerIds) {
  const cardsPerPlayer = deck.length / playerIds.length;
  const hands = {};
  
  playerIds.forEach(id => {
    hands[id] = [];
  });

  let currentPlayerIndex = 0;
  deck.forEach(card => {
    hands[playerIds[currentPlayerIndex]].push(card);
    currentPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
  });

  return hands;
}

module.exports = {
  generateDeck,
  shuffle,
  dealCards
};
