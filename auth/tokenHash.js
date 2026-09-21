const crypto = require('crypto');

function hashAccessToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

module.exports = hashAccessToken;
