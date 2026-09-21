const { getDatabase } = require('../dataSource');

/* eslint-disable no-restricted-syntax, no-await-in-loop */

function toApi(template) {
  return {
    course_name: template.name,
    days_count: template.daysCount,
    test: template.test,
    course_agenda: template.agenda.sort((a, b) => a.id - b.id).map(item => ({
      title: item.title,
      days: item.days.sort((a, b) => a.id - b.id).map(day => day.dayNumber),
      gongs: {
        times: item.times.sort((a, b) => a.id - b.id).map(time => time.time),
        areas: item.areas.sort((a, b) => a.id - b.id).map(area => area.areaId),
        type: item.gongTypeId,
        volume: item.volume,
        repeat: item.repeat,
      },
    })),
  };
}

async function getAll() {
  const database = await getDatabase();
  const templates = await database.getRepository('CourseTemplate').find({
    relations: { agenda: { days: true, times: true, areas: true } },
    order: { name: 'ASC' },
  });
  return templates.map(toApi);
}

async function getByName(name) {
  const database = await getDatabase();
  const template = await database.getRepository('CourseTemplate').findOne({
    where: { name },
    relations: { agenda: { days: true, times: true, areas: true } },
  });
  return template ? toApi(template) : null;
}

async function addAll(courses) {
  const database = await getDatabase();
  await database.transaction(async (manager) => {
    for (const course of courses) {
      const templateResult = await manager.insert('CourseTemplate', {
        name: course.course_name,
        daysCount: course.days_count,
        test: course.test === true,
      });
      const courseTemplateId = templateResult.identifiers[0].id;
      for (const item of course.course_agenda) {
        const agendaResult = await manager.insert('CourseTemplateAgenda', {
          courseTemplateId,
          title: item.title || null,
          gongTypeId: item.gongs.type,
          volume: item.gongs.volume === undefined ? null : item.gongs.volume,
          repeat: item.gongs.repeat === undefined ? null : item.gongs.repeat,
        });
        const agendaId = agendaResult.identifiers[0].id;
        await manager.insert('CourseTemplateAgendaDay', item.days.map(dayNumber => ({ agendaId, dayNumber })));
        await manager.insert('CourseTemplateAgendaTime', item.gongs.times.map(time => ({ agendaId, time })));
        await manager.insert('CourseTemplateAgendaArea', item.gongs.areas.map(areaId => ({ agendaId, areaId })));
      }
    }
  });
}

async function removeByName(name) {
  const database = await getDatabase();
  const result = await database.getRepository('CourseTemplate').delete({ name });
  return result.affected > 0;
}

module.exports = { getAll, getByName, addAll, removeByName };
