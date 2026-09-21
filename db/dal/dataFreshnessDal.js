const { getDatabase } = require('../dataSource');

async function getLastUpdatedTime() {
  const database = await getDatabase();
  const [result] = await database.query(`
    SELECT MAX(updatedAt) AS updatedAt FROM (
      SELECT updatedAt FROM course_templates
      UNION ALL SELECT updatedAt FROM gong_types
      UNION ALL SELECT updatedAt FROM permissions
    )
  `);
  return result.updatedAt ? Number(result.updatedAt) : null;
}

module.exports = { getLastUpdatedTime };
