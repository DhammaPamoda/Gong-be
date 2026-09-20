const { getDatabase } = require('../dataSource');

async function getAllAsMap() {
  const database = await getDatabase();
  const areas = await database.getRepository('Area').find({ order: { id: 'ASC' } });
  return Object.fromEntries(areas.map(area => [area.id, area.name]));
}

module.exports = {
  getAllAsMap,
};
