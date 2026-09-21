const { EntitySchema } = require('typeorm');

const Area = new EntitySchema({
  name: 'Area',
  tableName: 'areas',
  columns: {
    id: { type: Number, primary: true },
    name: { type: String },
    translation: { type: String, nullable: true },
  },
});

const GongType = new EntitySchema({
  name: 'GongType',
  tableName: 'gong_types',
  columns: {
    id: { type: Number, primary: true },
    name: { type: String },
    pathName: { type: String },
    updatedAt: { type: 'bigint', nullable: true },
  },
});

const ManualGong = new EntitySchema({
  name: 'ManualGong',
  tableName: 'manual_gongs',
  columns: {
    id: { type: Number, primary: true, generated: true },
    time: { type: String },
    gongTypeId: { type: Number },
    volume: { type: Number, nullable: true },
    repeat: { type: Number, nullable: true },
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
      target: 'ManualGongArea',
      inverseSide: 'manualGong',
    },
  },
});

const ManualGongArea = new EntitySchema({
  name: 'ManualGongArea',
  tableName: 'manual_gong_areas',
  columns: {
    id: { type: Number, primary: true, generated: true },
    manualGongId: { type: Number },
    areaId: { type: Number },
  },
  relations: {
    manualGong: {
      type: 'many-to-one',
      target: 'ManualGong',
      joinColumn: {
        name: 'manualGongId',
        referencedColumnName: 'id',
      },
      onDelete: 'CASCADE',
    },
    area: {
      type: 'many-to-one',
      target: 'Area',
      joinColumn: {
        name: 'areaId',
        referencedColumnName: 'id',
      },
      onDelete: 'RESTRICT',
    },
  },
});

module.exports = [GongType, Area, ManualGong, ManualGongArea];
