const { getDatabase } = require('../dataSource');

function toApi(schedule, exceptions) {
  return {
    id: Number(schedule.legacyId),
    course_name: schedule.courseTemplate.name,
    date: schedule.date,
    startFromDay: schedule.startFromDay,
    testHoursRange: schedule.testHoursRange,
    exceptions: (exceptions.get(schedule.id) || []).map(exception => ({
      day_number: exception.dayNumber,
      time: exception.time,
    })),
  };
}

async function getActive() {
  const database = await getDatabase();
  const schedules = await database.getRepository('ScheduledCourse').find({
    where: { state: 'active' },
    relations: { courseTemplate: true },
    order: { date: 'ASC', id: 'ASC' },
  });
  const exceptions = await database.getRepository('ScheduledCourseException').find();
  const exceptionsBySchedule = new Map();
  exceptions.forEach((exception) => {
    if (!exceptionsBySchedule.has(exception.scheduledCourseId)) {
      exceptionsBySchedule.set(exception.scheduledCourseId, []);
    }
    exceptionsBySchedule.get(exception.scheduledCourseId).push(exception);
  });
  return schedules.map(schedule => toApi(schedule, exceptionsBySchedule));
}

async function saveActive(schedules) {
  const database = await getDatabase();
  await database.transaction(async (manager) => {
    await manager.getRepository('ScheduledCourse')
      .createQueryBuilder()
      .delete()
      .where('state = :state', { state: 'active' })
      .execute();

    await Promise.all(schedules.map(async (schedule) => {
      const courseTemplate = await manager.getRepository('CourseTemplate').findOneBy({
        name: schedule.course_name,
      });
      if (!courseTemplate) {
        throw new Error(`Course template not found: ${schedule.course_name}`);
      }
      const result = await manager.getRepository('ScheduledCourse').insert({
        legacyId: String(schedule.id),
        courseTemplateId: courseTemplate.id,
        date: schedule.date,
        startFromDay: schedule.startFromDay === undefined ? null : Number(schedule.startFromDay),
        testHoursRange: schedule.testHoursRange || null,
        state: 'active',
      });
      const scheduledCourseId = result.identifiers[0].id;
      const exceptions = Array.isArray(schedule.exceptions) ? schedule.exceptions : [];
      if (exceptions.length) {
        await manager.getRepository('ScheduledCourseException').insert(exceptions.map(exception => ({
          scheduledCourseId,
          dayNumber: Number(exception.day_number),
          time: String(exception.time),
        })));
      }
    }));
  });
}

async function archiveByLegacyIds(ids) {
  if (!ids.length) return;
  const database = await getDatabase();
  await database.transaction(async (manager) => {
    await Promise.all(ids.map(id => manager.getRepository('ScheduledCourse').update(
      { legacyId: String(id), state: 'active' },
      { state: 'archived' },
    )));
  });
}

async function removeByLegacyId(id) {
  const database = await getDatabase();
  const result = await database.getRepository('ScheduledCourse').delete({
    legacyId: String(id),
    state: 'active',
  });
  return result.affected > 0;
}

module.exports = {
  getActive,
  saveActive,
  archiveByLegacyIds,
  removeByLegacyId,
};
