const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const usersDal = require('../db/dal/usersDal');
const hashAccessToken = require('./tokenHash');

async function authenticatePassword(aPassword, aUserConfig) {
  return bcrypt.compare(aPassword, aUserConfig.encodedPasswd);
}

function getTokenExpirationTime(clientType) {
  switch (clientType) {
    case 'remote':
      return '24h';

    case 'local':
      return '180d';
    default:
      return '180d';
  }
}

function getTokenExpirationMilliseconds(clientType) {
  return clientType === 'remote'
    ? 24 * 60 * 60 * 1000
    : 180 * 24 * 60 * 60 * 1000;
}

async function authenticate({ username, password, isLocal }) {
  const clientType = isLocal ? 'local' : 'remote';
  if (username && password) {
    const userConfig = await usersDal.findById(username.toLowerCase());
    if (userConfig) {
      const retToken = await authenticatePassword(password, userConfig)
        .then((res) => {
          if (res === true) {
            const tokenSecret = userConfig.tokenSecret || uuidv4();
            const token = jwt.sign(
              {
                sub: userConfig.id,
                role: userConfig.role,
              },
              tokenSecret,
              {
                expiresIn: getTokenExpirationTime(clientType),
              },
            );
            const accessTokenHash = hashAccessToken(token);
            return usersDal.update(userConfig.id, {
              tokenSecret,
              accessTokenHash,
              accessTokenExpiresAt: Date.now() + getTokenExpirationMilliseconds(clientType),
            }).then(() => token);
            // console.log( 'Decoded token :' , jwt.verify(token, userConfig.tokenSecret))
          }
          return null;
        })
        .catch(() => null);
      return retToken;
    }
  }
  return null;
}

// function decode() {
//   console.log('111111', bcrypt.hashSync('adminGong', 10));
//   console.log('222222', bcrypt.hashSync('teacherGong', 10));
// }
// module.exports = decode;

module.exports = authenticate;
