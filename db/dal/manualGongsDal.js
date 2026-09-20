const { getDatabase } = require('../dataSource');

async function getUpcoming(now) {
  const database = await getDatabase();
  return database.getRepository('ManualGong')
    .createQueryBuilder('gong')
    .leftJoinAndSelect('gong.areas', 'areas')
    .where('CAST(gong.time AS INTEGER) >= :now', { now: Number(now) })
    .orderBy('gong.time', 'ASC')
    .addOrderBy('gong.id', 'ASC')
    .getMany();
}

async function create(gong) {
  const database = await getDatabase();
  let id;

  await database.transaction(async (manager) => {
    const result = await manager.getRepository('ManualGong').insert({
      time: String(gong.time),
      gongTypeId: Number(gong.gong.gongType),
      volume: gong.gong.volume === undefined ? null : Number(gong.gong.volume),
      repeat: gong.gong.repeat === undefined ? null : Number(gong.gong.repeat),
    });
    id = result.identifiers[0].id;

    await manager.getRepository('ManualGongArea').insert(gong.gong.areas.map(areaId => ({
      manualGongId: id,
      areaId: Number(areaId),
    })));
  });

  return id;
}

async function removeByTime(time) {
  const database = await getDatabase();
  const result = await database.getRepository('ManualGong').delete({ time: String(time) });
  return result.affected > 0;
}

async function removeExpired(now) {
  const database = await getDatabase();
  await database.getRepository('ManualGong')
    .createQueryBuilder()
    .delete()
    .where('CAST(time AS INTEGER) < :now', { now: Number(now) })
    .execute();
}

module.exports = {
  getUpcoming,
  create,
  removeByTime,
  removeExpired,
};
