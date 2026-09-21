const { getDatabase } = require('../dataSource');

async function getAll() {
  const database = await getDatabase();
  return database.getRepository('Permission').find({ order: { displayOrder: 'ASC' } });
}

async function updateAll(permissions) {
  const database = await getDatabase();
  const repository = database.getRepository('Permission');
  await database.transaction(async (manager) => {
    for (const permission of permissions) {
      await manager.update('permissions', permission.action, {
      roles: permission.roles,
      displayOrder: permission.order,
      updatedAt: Date.now(),
      });
    }
  });
  return repository.find({ order: { displayOrder: 'ASC' } });
}

module.exports = {
  getAll,
  updateAll,
};
