function randomFriendCode(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function generateFriendCode(UserModel, length = 6) {
  if (!UserModel) {
    return randomFriendCode(length);
  }

  let candidate = randomFriendCode(length);

  while (await UserModel.exists({ friendCode: candidate })) {
    candidate = randomFriendCode(length);
  }

  return candidate;
}

module.exports = {
  generateFriendCode,
  randomFriendCode
};
