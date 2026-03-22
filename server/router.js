const express = require('express');

const router = express.Router();
const users = require('../routes/users');
const relay = require('../routes/relay');
const data = require('../routes/data');
const systemSettings = require('../routes/systemSettings');
const hk4Route = require('../routes/hk4');
const rootDataHandlers = require('../handlers/root/rootHandlers');

const authorizeFunc = require('../auth/authorize');

router.post('/hardware/hk4', rootDataHandlers.handleHK4Key);

router.use(authorizeFunc());
router.use('/users', users);
router.use('/relay', relay);
router.use('/data', data);
router.use('/systemSettings', systemSettings);
router.use('/hk4', hk4Route);

router.post('/login', rootDataHandlers.authenticate);
router.get('/nextgong', rootDataHandlers.getNextGong);

module.exports = router;
