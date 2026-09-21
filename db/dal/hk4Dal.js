const { getDatabase } = require('../dataSource');

async function getSequences() {
  const database = await getDatabase();
  const sequences = await database.getRepository('Hk4KeySequence').find();

  const sequenceAreas = database
    .createQueryBuilder()
    .select('join.sequence', 'sequence')
    .addSelect('join.areaId', 'areaId')
    .from('hk4_key_sequence_areas', 'join')
    .getRawMany();
  const areasBySequence = new Map();
  (await sequenceAreas).forEach((row) => {
    if (!areasBySequence.has(row.sequence)) areasBySequence.set(row.sequence, []);
    areasBySequence.get(row.sequence).push(Number(row.areaId));
  });

  return Object.fromEntries(sequences.map(sequence => [sequence.sequence, {
      gongType: sequence.gongTypeId,
      areas: areasBySequence.get(sequence.sequence) || [],
      volume: sequence.volume,
      repeat: sequence.repeat,
    }]));
}

async function saveSettings(newSettings) {
  const database = await getDatabase();
  await database.transaction(async (manager) => {
    await manager.clear('hk4_key_sequence_areas');
    await manager.clear('hk4_key_sequences');

    const sequences = Object.entries(newSettings.sequences || {});
    for (const [sequence, config] of sequences) {
      await manager.insert('hk4_key_sequences', {
        sequence,
        gongTypeId: Number(config.gongType),
        volume: Number(config.volume),
        repeat: Number(config.repeat || 1),
      });
      const areas = Array.isArray(config.areas) ? config.areas : [];
      if (areas.length) {
        await manager.insert('hk4_key_sequence_areas', areas.map(areaId => ({
          sequence,
          areaId: Number(areaId),
        })));
      }
    }
  });
  return getSequences();
}

module.exports = {
  getSequences,
  saveSettings,
};
