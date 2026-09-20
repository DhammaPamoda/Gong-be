const { EntitySchema } = require('typeorm');

const Hk4KeySequence = new EntitySchema({
  name: 'Hk4KeySequence',
  tableName: 'hk4_key_sequences',
  columns: {
    sequence: { type: String, primary: true },
    gongTypeId: { type: Number },
    volume: { type: Number },
    repeat: { type: Number },
  },
  relations: {
    gongType: {
      type: 'many-to-one',
      target: 'GongType',
      joinColumn: {
        name: 'gongTypeId',
        referencedColumnName: 'id',
      },
      onDelete: 'RESTRICT',
    },
    areas: {
      type: 'one-to-many',
      target: 'Hk4KeySequenceArea',
      inverseSide: 'sequenceRecord',
    },
  },
});

const Hk4KeySequenceArea = new EntitySchema({
  name: 'Hk4KeySequenceArea',
  tableName: 'hk4_key_sequence_areas',
  columns: {
    sequence: { type: String, primary: true },
    areaId: { type: Number, primary: true },
  },
  relations: {
    sequenceRecord: {
      type: 'many-to-one',
      target: 'Hk4KeySequence',
      joinColumn: {
        name: 'sequence',
        referencedColumnName: 'sequence',
      },
      onDelete: 'CASCADE',
    },
  },
});

module.exports = [Hk4KeySequence, Hk4KeySequenceArea];
