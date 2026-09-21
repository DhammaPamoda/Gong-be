const { getDatabase } = require('../dataSource');

async function getAll() {
  const database = await getDatabase();
  return database.getRepository('GongType').find({ order: { id: 'ASC' } });
}

async function getById(id) {
  const database = await getDatabase();
  return database.getRepository('GongType').findOneBy({ id });
}

async function create(gongType) {
  const database = await getDatabase();
  const repository = database.getRepository('GongType');
  const lastGongType = await repository.findOne({ order: { id: 'DESC' } });
  const record = { ...gongType, id: (lastGongType ? lastGongType.id : 0) + 1 };
  await repository.insert(record);
  return record;
}

async function update(id, values) {
  const database = await getDatabase();
  await database.getRepository('GongType').update(id, values);
}

async function remove(id) {
  const database = await getDatabase();
  const found = await database.getRepository('GongType').findOneBy({ id });
  if (!found) return null;
  await database.getRepository('GongType').delete(id);
  return found;
}

module.exports = { getAll, getById, create, update, remove };
