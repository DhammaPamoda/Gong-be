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
      type: 'many-to-many',
      target: 'Area',
      joinTable: {
        name: 'hk4_key_sequence_areas',
        joinColumn: {
          name: 'sequence',
          referencedColumnName: 'sequence',
        },
        inverseJoinColumn: {
          name: 'areaId',
          referencedColumnName: 'id',
        },
      },
    },
  },
});

module.exports = [Hk4KeySequence];
