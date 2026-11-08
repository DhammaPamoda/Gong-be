const { execFileSync } = require('child_process');
const jsonClassConverter = require('../lib/jsonConverter');
const TimedGong = require('../model/timedGong');

// Run in a fresh process so the timezone does not depend on Jest's environment.
const calculateGong = (timezone, start, day, clock) => {
  const script = `
    const moment = require('moment');
    const TimedGong = require(${JSON.stringify(require.resolve('../model/timedGong'))});
    const [start, day, clock] = JSON.parse(process.argv[1]);
    const agendaTime = moment.duration(day + '.' + clock).asMilliseconds();
    const original = new TimedGong(agendaTime, undefined, false);
    const result = original.cloneWhileAddingTime(moment(start, 'YYYY-MM-DD').valueOf());
    process.stdout.write(JSON.stringify({
      time: new Date(result.time).toISOString(),
      sameGong: result.gong === original.gong,
      isActive: result.isActive,
      originalUnchanged: original.time === agendaTime,
    }));
  `;
  return JSON.parse(execFileSync(process.execPath, ['-e', script, JSON.stringify([start, day, clock])], {
    env: { ...process.env, TZ: timezone },
    encoding: 'utf8',
  }));
};

describe('course gong local clock time', () => {
  test.each([
    ['before spring forward', 'Asia/Jerusalem', '2026-03-26', 0, '07:00', '2026-03-26T05:00:00.000Z'],
    ['spring forward day', 'Asia/Jerusalem', '2026-03-26', 1, '07:00', '2026-03-27T04:00:00.000Z'],
    ['after spring forward', 'Asia/Jerusalem', '2026-03-26', 2, '07:00', '2026-03-28T04:00:00.000Z'],
    ['before fall back', 'Asia/Jerusalem', '2026-10-23', 1, '04:00', '2026-10-24T01:00:00.000Z'],
    ['fall back day', 'Asia/Jerusalem', '2026-10-23', 2, '04:00', '2026-10-25T02:00:00.000Z'],
    ['after fall back', 'Asia/Jerusalem', '2026-10-23', 3, '04:00', '2026-10-26T02:00:00.000Z'],
    ['preserves seconds and clears milliseconds', 'Asia/Jerusalem', '2026-03-26', 1,
      '07:12:34.567', '2026-03-27T04:12:34.000Z'],
    ['interpolated day-zero base', 'Asia/Jerusalem', '2026-10-22', 3, '04:00', '2026-10-25T02:00:00.000Z'],
    ['UTC timezone', 'UTC', '2026-03-26', 1, '07:00', '2026-03-27T07:00:00.000Z'],
  ])('%s', (label, timezone, start, day, clock, expected) => {
    expect(calculateGong(timezone, start, day, clock)).toEqual({
      time: expected,
      sameGong: true,
      isActive: false,
      originalUnchanged: true,
    });
  });
});

test('manual gong conversion clears seconds and milliseconds', () => {
  const result = jsonClassConverter.convertOneObject({
    time: Date.UTC(2026, 10, 9, 8, 0, 34, 567),
    gong: { gongType: 1, areas: [1], volume: 100, repeat: 1 },
    isActive: true,
  }, 'TimedGong');

  expect(result).toBeInstanceOf(TimedGong);
  expect(result.time).toBe(Date.UTC(2026, 10, 9, 8));
});
