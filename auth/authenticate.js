const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const utilsManager = require('../lib/utilsManager');

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

async function authenticate({ username, password, isLocal }) {
  const clientType = isLocal ? 'local' : 'remote';
  if (username && password) {
    const userConfig = utilsManager.usersMap.get(username.toLowerCase());
    if (userConfig) {
      const retToken = await authenticatePassword(password, userConfig)
        .then((res) => {
          if (res === true) {
            const token = jwt.sign(
              {
                sub: userConfig.id,
                role: userConfig.role,
              },
              userConfig.tokenSecret,
              {
                expiresIn: getTokenExpirationTime(clientType)
              });
            // console.log( 'Decoded token :' , jwt.verify(token, userConfig.tokenSecret))
            return token;
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
