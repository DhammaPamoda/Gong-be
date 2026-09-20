const { getDatabase } = require('../dataSource');

const SETTINGS_ID = 1;

async function getSettings() {
  const database = await getDatabase();
  const settings = await database.getRepository('SystemSettings').findOneBy({ id: SETTINGS_ID });
  if (!settings) {
    throw new Error('System settings have not been migrated to SQLite');
  }
  return settings;
}

async function updateSettings(newSettings) {
  const database = await getDatabase();
  const repository = database.getRepository('SystemSettings');
  await repository.update(SETTINGS_ID, newSettings);
  return repository.findOneBy({ id: SETTINGS_ID });
}

module.exports = {
  getSettings,
  updateSettings,
};
