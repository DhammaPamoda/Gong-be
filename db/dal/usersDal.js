const { getDatabase } = require('../dataSource');

async function getAll() {
  const database = await getDatabase();
  return database.getRepository('UserAccount').find();
}

async function findById(id) {
  const database = await getDatabase();
  return database.getRepository('UserAccount').findOneBy({ id });
}

async function create(user) {
  const database = await getDatabase();
  return database.getRepository('UserAccount').save(user);
}

async function update(id, changes) {
  const database = await getDatabase();
  const repository = database.getRepository('UserAccount');
  await repository.update(id, changes);
  return repository.findOneBy({ id });
}

async function remove(id) {
  const database = await getDatabase();
  await database.getRepository('UserAccount').delete(id);
}

async function clearAccessToken(id) {
  return update(id, {
    accessTokenHash: null,
    accessTokenExpiresAt: null,
  });
}

module.exports = {
  getAll,
  findById,
  create,
  update,
  remove,
  clearAccessToken,
};
