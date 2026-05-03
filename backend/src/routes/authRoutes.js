const express = require('express');

const User = require('../../models/User');
const { generateFriendCode } = require('../../utils/helpers');
const {
  ACCOUNT_RULESET_OPTIONS,
  MAX_FAVOURITE_RULESETS,
  MAX_RULESET_LOADOUT,
  getRulesetDefinitionByIndex,
  normalizeRulesetIndexes
} = require('../lib/accountRulesets');
const {
  getDefaultAccountImages,
  saveUploadedAccountImage
} = require('../lib/accountAssets');
const {
  clearSessionCookie,
  getAuthenticatedUserFromRequest,
  hashPassword,
  persistSession,
  serializeAccount,
  verifyPassword
} = require('../lib/auth');

const router = express.Router();

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

function readUsername(value) {
  return String(value || '').trim();
}

function readPassword(value) {
  return String(value || '');
}

function validatePassword(password) {
  if (!password) {
    return 'Password is required';
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or less`;
  }

  return null;
}

function normalizeAccountPayload(body = {}) {
  return {
    username: readUsername(body.username),
    password: readPassword(body.password),
    profilePictureUpload: body.profilePictureUpload || null,
    bannerUpload: body.bannerUpload || null,
    description: readProfileField(body.description),
    favouriteRulesets: normalizeRulesetIndexes(body.favouriteRulesets, {
      maxItems: MAX_FAVOURITE_RULESETS,
      fieldName: 'favouriteRulesets'
    }),
    rulesetLoadout: normalizeRulesetIndexes(body.rulesetLoadout, {
      maxItems: MAX_RULESET_LOADOUT,
      fieldName: 'rulesetLoadout'
    })
  };
}

function normalizeAccountUpdatePayload(body = {}) {
  const hasField = (fieldName) => Object.prototype.hasOwnProperty.call(body, fieldName);
  const payload = {};

  if (hasField('username')) {
    payload.username = readUsername(body.username);
  }

  if (hasField('description')) {
    payload.description = readProfileField(body.description);
  }

  if (hasField('profilePictureUpload')) {
    payload.profilePictureUpload = body.profilePictureUpload || null;
  }

  if (hasField('bannerUpload')) {
    payload.bannerUpload = body.bannerUpload || null;
  }

  if (hasField('favouriteRulesets')) {
    payload.favouriteRulesets = normalizeRulesetIndexes(body.favouriteRulesets, {
      maxItems: MAX_FAVOURITE_RULESETS,
      fieldName: 'favouriteRulesets'
    });
  }

  if (hasField('rulesetLoadout')) {
    payload.rulesetLoadout = normalizeRulesetIndexes(body.rulesetLoadout, {
      maxItems: MAX_RULESET_LOADOUT,
      fieldName: 'rulesetLoadout'
    });
  }

  return payload;
}

function mapUserValidationError(error) {
  if (!error) {
    return null;
  }

  if (error.code === 11000) {
    const duplicateFields = Object.keys(error.keyPattern || {});

    if (duplicateFields.includes('usernameLower') || duplicateFields.includes('username')) {
      return {
        statusCode: 409,
        clientMessage: 'Username is already taken'
      };
    }

    if (duplicateFields.includes('friendCode')) {
      return {
        statusCode: 503,
        clientMessage: 'Unable to allocate a unique friend code right now. Please try again.'
      };
    }

    console.error('Unexpected duplicate-key error while saving user account:', {
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });

    return {
      statusCode: 500,
      clientMessage: 'Account registration failed because of a database constraint issue.'
    };
  }

  if (error.name === 'ValidationError') {
    return {
      statusCode: 400,
      clientMessage: Object.values(error.errors)[0]?.message || 'Invalid account details'
    };
  }

  return null;
}

router.post('/register', async (req, res, next) => {
  try {
    let payload;
    try {
      payload = normalizeAccountPayload(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid account details' });
    }

    const passwordError = validatePassword(payload.password);

    if (!payload.username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const defaultImages = getDefaultAccountImages();
    const profilePicture = await saveUploadedAccountImage(
      payload.profilePictureUpload,
      'profile',
      'Profile picture'
    ) || defaultImages.profilePicture;
    const banner = await saveUploadedAccountImage(
      payload.bannerUpload,
      'banner',
      'Banner'
    ) || defaultImages.banner;

    const user = new User({
      username: payload.username,
      passwordHash: await hashPassword(payload.password),
      profilePicture,
      banner,
      description: payload.description,
      favouriteRulesets: payload.favouriteRulesets,
      rulesetLoadout: payload.rulesetLoadout,
      friendCode: await generateFriendCode(User)
    });

    await user.save();
    await persistSession(res, user);

    res.status(201).json({
      ok: true,
      user: serializeAccount(user)
    });
  } catch (error) {
    const mappedError = mapUserValidationError(error);
    if (mappedError) {
      return res.status(mappedError.statusCode).json({ error: mappedError.clientMessage });
    }

    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = readUsername(req.body.username);
    const password = readPassword(req.body.password);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ usernameLower: username.toLowerCase() });
    const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await persistSession(res, user);

    res.json({
      ok: true,
      user: serializeAccount(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req);

    if (user) {
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      await user.save();
    }

    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req);

    if (!user) {
      clearSessionCookie(res);
      return res.json({
        ok: true,
        authenticated: false,
        user: null
      });
    }

    res.json({
      ok: true,
      authenticated: true,
      user: serializeAccount(user)
    });
  } catch (error) {
    clearSessionCookie(res);
    next(error);
  }
});

router.patch('/me', async (req, res, next) => {
  try {
    const user = await getAuthenticatedUserFromRequest(req);

    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'You must be logged in to edit this account' });
    }

    let payload;
    try {
      payload = normalizeAccountUpdatePayload(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid account details' });
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'username') && !payload.username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'username')) {
      user.username = payload.username;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      user.description = payload.description;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'favouriteRulesets')) {
      user.favouriteRulesets = payload.favouriteRulesets;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'rulesetLoadout')) {
      user.rulesetLoadout = payload.rulesetLoadout;
    }

    if (payload.profilePictureUpload) {
      user.profilePicture = await saveUploadedAccountImage(
        payload.profilePictureUpload,
        'profile',
        'Profile picture'
      ) || user.profilePicture;
    }

    if (payload.bannerUpload) {
      user.banner = await saveUploadedAccountImage(
        payload.bannerUpload,
        'banner',
        'Banner'
      ) || user.banner;
    }

    await persistSession(res, user);

    res.json({
      ok: true,
      user: serializeAccount(user)
    });
  } catch (error) {
    const mappedError = mapUserValidationError(error);
    if (mappedError) {
      return res.status(mappedError.statusCode).json({ error: mappedError.clientMessage });
    }

    next(error);
  }
});

router.get('/account-rulesets', async (req, res, next) => {
  try {
    res.json({
      ok: true,
      rulesets: ACCOUNT_RULESET_OPTIONS.map((option) => {
        const definition = getRulesetDefinitionByIndex(option.index);

        return {
          index: option.index,
          id: option.id,
          label: option.label,
          abbreviation: option.abbreviation,
          type: definition?.type || 'per_round',
          code: definition?.code || ''
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const username = readUsername(req.body.username);

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await User.findOne({ usernameLower: username.toLowerCase() });
    if (user) {
      user.passwordResetRequestedAt = new Date();
      await user.save();
    }

    res.json({
      ok: true,
      placeholder: true,
      message: 'Password reset email delivery is not configured yet. A reset request has been recorded for future integration.'
    });
  } catch (error) {
    next(error);
  }
});

function readProfileField(value) {
  return String(value || '').trim();
}

module.exports = router;
