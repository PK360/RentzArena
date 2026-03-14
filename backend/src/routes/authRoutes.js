const crypto = require('crypto');
const express = require('express');

const User = require('../../models/User');
const { generateFriendCode } = require('../../utils/helpers');
const { sendMagicLinkEmail } = require('../services/mailer');

const router = express.Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/request-link', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const displayName = String(req.body.displayName || '').trim();

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        displayName: displayName || email.split('@')[0],
        friendCode: await generateFriendCode(User)
      });
    } else if (displayName) {
      user.displayName = displayName;
    }

    const rawToken = crypto.randomBytes(24).toString('hex');
    user.magicLinkTokenHash = hashToken(rawToken);
    user.magicLinkExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const magicLink = `${appUrl}/auth/verify?token=${rawToken}&email=${encodeURIComponent(email)}`;
    const delivery = await sendMagicLinkEmail({ email, magicLink });

    res.json({
      ok: true,
      message: 'Magic link sent',
      previewUrl: delivery.previewUrl || null
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-link', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const token = String(req.body.token || '').trim();

    if (!email || !token) {
      return res.status(400).json({ error: 'Email and token are required' });
    }

    const user = await User.findOne({
      email,
      magicLinkTokenHash: hashToken(token),
      magicLinkExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Magic link is invalid or expired' });
    }

    user.emailConfirmedAt = new Date();
    user.lastSeenAt = new Date();
    user.magicLinkTokenHash = null;
    user.magicLinkExpiresAt = null;
    await user.save();

    res.json({
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        friendCode: user.friendCode
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
