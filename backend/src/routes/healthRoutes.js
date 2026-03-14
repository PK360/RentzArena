const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'rentz-arena-backend'
  });
});

module.exports = router;
