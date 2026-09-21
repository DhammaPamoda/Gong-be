const { EntitySchema } = require('typeorm');

const ScheduledCourse = new EntitySchema({
  name: 'ScheduledCourse',
  tableName: 'scheduled_courses',
  columns: {
    id: { type: Number, primary: true, generated: true },
    legacyId: { type: String, nullable: true },
    courseTemplateId: { type: Number },
    date: { type: String, nullable: true },
    startFromDay: { type: Number, nullable: true },
    testHoursRange: { type: 'simple-json', nullable: true },
    state: { type: String, default: 'active' },
  },
  relations: {
    courseTemplate: {
      type: 'many-to-one',
      target: 'CourseTemplate',
      joinColumn: {
        name: 'courseTemplateId',
        referencedColumnName: 'id',
      },
      onDelete: 'RESTRICT',
    },
  },
});

const ScheduledCourseException = new EntitySchema({
  name: 'ScheduledCourseException',
  tableName: 'scheduled_course_exceptions',
  columns: {
    id: { type: Number, primary: true, generated: true },
    scheduledCourseId: { type: Number },
    dayNumber: { type: Number },
    time: { type: String },
  },
  relations: {
    scheduledCourse: {
      type: 'many-to-one',
      target: 'ScheduledCourse',
      joinColumn: {
        name: 'scheduledCourseId',
        referencedColumnName: 'id',
      },
      onDelete: 'CASCADE',
    },
  },
});

module.exports = [ScheduledCourse, ScheduledCourseException];
