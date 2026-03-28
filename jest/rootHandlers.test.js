const fs = require('fs');
jest.mock('fs');
jest.mock('../lib/config/dataPaths');
jest.mock('../lib/scheduleManager');
jest.mock('../lib/responder');
jest.mock('../auth/authenticate');

const rootHandlers = require('../handlers/root/rootHandlers');
const dataPaths = require('../lib/config/dataPaths');
const scheduleManager = require('../lib/scheduleManager');
const responder = require('../lib/responder');

describe('rootHandlers', () => {
    describe('getNextGong', () => {
        it('should return next gong info with optionalAreas', () => {
            const req = {};
            const res = {};
            const next = jest.fn();

            const lastUpdatedTime = 123456789;
            const staticData = JSON.stringify({ lastUpdatedTime });
            fs.readFileSync.mockReturnValue(Buffer.from(staticData));
            dataPaths.getStaticAssetPath.mockReturnValue('staticData.json');

            const nextJob = { time: 987654321 };
            scheduleManager.getNextScheduledJob.mockReturnValue(nextJob);

            const optionalAreas = [1, 2, 3];
            dataPaths.OPTIONAL_AREAS = optionalAreas;

            rootHandlers.getNextGong(req, res, next);

            expect(responder.send200Response).toHaveBeenCalledWith(res, expect.objectContaining({
                nextScheduledJob: nextJob,
                staticDataLastUpdateTime: lastUpdatedTime,
                optionalAreas: optionalAreas,
            }));
        });
    });
});
