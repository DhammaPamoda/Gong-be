const { EntitySchema } = require('typeorm');

const CourseTemplate = new EntitySchema({
  name: 'CourseTemplate',
  tableName: 'course_templates',
  columns: {
    id: { type: Number, primary: true, generated: true },
    name: { type: String, unique: true },
    daysCount: { type: Number },
    test: { type: Boolean, default: false },
    updatedAt: { type: 'bigint', nullable: true },
  },
  relations: {
    agenda: {
      type: 'one-to-many',
      target: 'CourseTemplateAgenda',
      inverseSide: 'courseTemplate',
    },
  },
});

const CourseTemplateAgenda = new EntitySchema({
  name: 'CourseTemplateAgenda',
  tableName: 'course_template_agenda',
  columns: {
    id: { type: Number, primary: true, generated: true },
    courseTemplateId: { type: Number },
    title: { type: String, nullable: true },
    gongTypeId: { type: Number },
    volume: { type: Number, nullable: true },
    repeat: { type: Number, nullable: true },
  },
  relations: {
    courseTemplate: {
      type: 'many-to-one',
      target: 'CourseTemplate',
      joinColumn: {
        name: 'courseTemplateId',
        referencedColumnName: 'id',
      },
      onDelete: 'CASCADE',
    },
    gongType: {
      type: 'many-to-one',
      target: 'GongType',
      joinColumn: {
        name: 'gongTypeId',
        referencedColumnName: 'id',
      },
      onDelete: 'RESTRICT',
    },
    days: {
      type: 'one-to-many',
      target: 'CourseTemplateAgendaDay',
      inverseSide: 'agenda',
    },
    times: {
      type: 'one-to-many',
      target: 'CourseTemplateAgendaTime',
      inverseSide: 'agenda',
    },
    areas: {
      type: 'one-to-many',
      target: 'CourseTemplateAgendaArea',
      inverseSide: 'agenda',
    },
  },
});

const CourseTemplateAgendaDay = new EntitySchema({
  name: 'CourseTemplateAgendaDay',
  tableName: 'course_template_agenda_days',
  columns: {
    id: { type: Number, primary: true, generated: true },
    agendaId: { type: Number },
    dayNumber: { type: Number },
  },
  relations: {
    agenda: {
      type: 'many-to-one',
      target: 'CourseTemplateAgenda',
      joinColumn: {
        name: 'agendaId',
        referencedColumnName: 'id',
      },
      onDelete: 'CASCADE',
    },
  },
});

const CourseTemplateAgendaTime = new EntitySchema({
  name: 'CourseTemplateAgendaTime',
  tableName: 'course_template_agenda_times',
  columns: {
    id: { type: Number, primary: true, generated: true },
    agendaId: { type: Number },
    time: { type: String },
  },
  relations: {
    agenda: {
      type: 'many-to-one',
      target: 'CourseTemplateAgenda',
      joinColumn: {
        name: 'agendaId',
        referencedColumnName: 'id',
      },
      onDelete: 'CASCADE',
    },
  },
});

const CourseTemplateAgendaArea = new EntitySchema({
  name: 'CourseTemplateAgendaArea',
  tableName: 'course_template_agenda_areas',
  columns: {
    id: { type: Number, primary: true, generated: true },
    agendaId: { type: Number },
    areaId: { type: Number },
  },
  relations: {
    agenda: {
      type: 'many-to-one',
      target: 'CourseTemplateAgenda',
      joinColumn: {
        name: 'agendaId',
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

module.exports = [
  CourseTemplate,
  CourseTemplateAgenda,
  CourseTemplateAgendaDay,
  CourseTemplateAgendaTime,
  CourseTemplateAgendaArea,
];
