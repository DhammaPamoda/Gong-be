const { expressjwt: expressJwt } = require('express-jwt');

const usersDal = require('../db/dal/usersDal');
const responder = require('../lib/responder');
const hashAccessToken = require('./tokenHash');

const secretCallback = async (req, token) => {
  const { sub } = token.payload;
  const authorization = req.headers.authorization || '';
  const accessToken = authorization.startsWith('Bearer ')
    ? authorization.substring('Bearer '.length)
    : null;
  if (sub && accessToken) {
    const authUser = await usersDal.findById(sub.toLowerCase());
    if (authUser && authUser.accessTokenExpiresAt && authUser.accessTokenExpiresAt <= Date.now()) {
      await usersDal.clearAccessToken(authUser.id);
    } else if (authUser && authUser.tokenSecret && authUser.accessTokenHash
      && hashAccessToken(accessToken) === authUser.accessTokenHash) {
      return authUser.tokenSecret;
    }
  }
  throw new Error('missing_secret');
};

function authorize(roles = []) {
  let rolesArray = roles;
  if (typeof roles === 'string') {
    rolesArray = [roles];
  }

  return [
    // For Debugging
    /* (req, res, next) => {
      console.log('Authorization Entry point. Req( method ,path ,time) :', req.path,
        ' , ', req.method, ' , ', moment().format('HH:mm:ss:ms'));
      next();
    }, */
    // authenticate JWT token and attach user to request object (req.user)
    expressJwt({
      secret: secretCallback,
      algorithms: ['HS256'],
      requestProperty: 'user', // Default is 'auth', but we use 'user' for backward compatibility
    })
      .unless({
        path: [
          '/login',
          '/nextgong',
          '/api/login',
          '/api/nextgong',
          '/api/relay/isGongPlaying',
          '/api/relay/cancelGong',
          '/api/relay/playGong',
          '/api/relay/diagnostics',
          '/data/staticData',
          '/api/data/staticData',
          '/api/data/emergencyState',
          '/data/emergencyState',
          '/loginPage',
          '/mainPage',
          '/favicon.ico',
          /^\/\.well-known\/.*/, // Chrome DevTools and other well-known paths
        ],
      }),

    // authorize based on user role
    (err, req, res, next) => {
      if (err) {
        responder.sendErrorResponse(res, err.httpStatusCode || 500, 'invalid token ', err, req);
        return err;
      }
      if (rolesArray.length && !rolesArray.includes(req.user.role)) {
        // user's role is not authorized
        return res.status(401)
          .json({ message: 'Unauthorized' });
      }

      // authentication and authorization successful
      next();
      return null;
    },
  ];
}

module.exports = authorize;
