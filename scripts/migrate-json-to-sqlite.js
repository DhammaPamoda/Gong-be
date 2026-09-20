#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { DataSource } = require('typeorm');
const entitySchemas = require('../db/entitySchemas');

const environmentDirectory = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const defaultDataDirectory = path.join(
  process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
  'gong',
  environmentDirectory,
);

function parseArguments(argv) {
  const options = {
    database: path.join(defaultDataDirectory, 'gong.sqlite'),
    staticData: path.join('assets', 'data', 'staticData.json'),
    users: path.join('assets', 'data', 'usersData.json'),
    dataDirectory: defaultDataDirectory,
    dryRun: false,
  };

  argv.slice(2).forEach((argument) => {
    if (argument === '--dry-run') {
      options.dryRun = true;
      return;
    }

    const separatorIndex = argument.indexOf('=');
    if (separatorIndex < 0) {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const key = argument.slice(2, separatorIndex);
    const value = argument.slice(separatorIndex + 1);
    if (!Object.prototype.hasOwnProperty.call(options, key)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    options[key] = value;
  });

  return options;
}

function readJson(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }

  const content = fs.readFileSync(filePath, 'utf8').trim();
  return content ? JSON.parse(content) : defaultValue;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNullableNumber(value) {
  return value === undefined || value === null ? null : Number(value);
}

function asText(value) {
  return value === undefined || value === null ? null : String(value);
}

function sourceFiles(options) {
  return {
    staticData: path.resolve(options.staticData),
    users: path.resolve(options.users),
    systemSettings: path.join(options.dataDirectory, 'systemSettings.json'),
    hk4KeyMap: path.join(options.dataDirectory, 'hk4KeyMap.json'),
    activeSchedules: path.join(options.dataDirectory, 'coursesSchedule.json'),
    archivedSchedules: path.join(options.dataDirectory, 'archivedCoursesSchedule.json'),
    manualGongs: path.join(options.dataDirectory, 'manualGong.json'),
  };
}

function loadSourceData(files) {
  const staticData = readJson(files.staticData, {});
  const systemSettings = readJson(files.systemSettings, {});
  const hk4KeyMap = readJson(files.hk4KeyMap, {});
  const sourceData = {
    systemSettings,
    hk4KeyMap,
    areas: [],
    gongTypes: asArray(staticData.gongTypes),
    courses: asArray(staticData.courses),
    permissions: asArray(staticData.permissions),
    users: asArray(readJson(files.users, [])),
    activeSchedules: asArray(readJson(files.activeSchedules, [])),
    archivedSchedules: asArray(readJson(files.archivedSchedules, [])),
    manualGongs: asArray(readJson(files.manualGongs, [])),
  };

  const areaNames = new Map(Object.entries(systemSettings.areas || {}).map(([id, name]) => [
    Number(id),
    String(name),
  ]));
  const referencedAreaIds = new Set(areaNames.keys());
  sourceData.courses.forEach(course => (course.course_agenda || []).forEach((agenda) => {
    (agenda.gongs && agenda.gongs.areas || []).forEach(areaId => referencedAreaIds.add(Number(areaId)));
  }));
  sourceData.manualGongs.forEach((record) => {
    (record.gong && record.gong.areas || []).forEach(areaId => referencedAreaIds.add(Number(areaId)));
  });
  Object.values(hk4KeyMap.sequences || {}).forEach((sequence) => {
    (sequence.areas || []).forEach(areaId => referencedAreaIds.add(Number(areaId)));
  });
  sourceData.areas = [...referencedAreaIds].sort((a, b) => a - b).map(id => ({
    id,
    name: areaNames.get(id) || `Unknown Area (${id})`,
  }));

  return sourceData;
}

function countSourceData(sourceData) {
  return {
    areas: sourceData.areas.length,
    gongTypes: sourceData.gongTypes.length,
    courses: sourceData.courses.length,
    permissions: sourceData.permissions.length,
    users: sourceData.users.length,
    activeSchedules: sourceData.activeSchedules.length,
    archivedSchedules: sourceData.archivedSchedules.length,
    manualGongs: sourceData.manualGongs.length,
  };
}

async function clearTables(manager) {
  // Delete child rows first so this remains safe if foreign keys are added later.
    await manager.clear('system_settings');
    await manager.clear('hk4_key_sequence_areas');
    await manager.clear('hk4_key_sequences');
    await manager.clear('course_template_agenda_days');
    await manager.clear('course_template_agenda_times');
    await manager.clear('course_template_agenda_areas');
    await manager.clear('manual_gong_areas');
    await manager.clear('scheduled_course_exceptions');
    await manager.clear('course_template_agenda');
    await manager.clear('manual_gongs');
    await manager.clear('scheduled_courses');
    await manager.clear('course_templates');
    await manager.clear('permissions');
    await manager.clear('users');
    await manager.clear('gong_types');
    await manager.clear('areas');
}

async function migrate(options, sourceData) {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: path.resolve(options.database),
    entities: entitySchemas,
    synchronize: true,
  });

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      await clearTables(manager);

      await manager.insert('areas', sourceData.areas.map(area => ({
        id: Number(area.id),
        name: area.name,
        translation: area.translation || null,
      })));

      await manager.insert('gong_types', sourceData.gongTypes.map(gongType => ({
        id: Number(gongType.id),
        name: gongType.name,
        pathName: gongType.pathName,
      })));

      await manager.insert('system_settings', {
        id: 1,
        runSecurityCheck: sourceData.systemSettings.runSecurityCheck === true,
        testing: sourceData.systemSettings.testing === true,
        hk4Enabled: sourceData.hk4KeyMap.enabled !== false,
        alertLocation: sourceData.systemSettings.alertLocation || '',
        pollingInterval: Number(sourceData.systemSettings.pollingInterval || 10),
        overrideOrefUrl: sourceData.systemSettings.overrideOrefUrl || null,
        supportedAlertCategories: asArray(sourceData.systemSettings.supportedAlertCategories),
      });

      const sequences = Object.entries(sourceData.hk4KeyMap.sequences || {});
      for (const [sequence, config] of sequences) {
        await manager.insert('hk4_key_sequences', {
          sequence,
          gongTypeId: Number(config.gongType),
          volume: Number(config.volume),
          repeat: Number(config.repeat || 1),
        });

        const areas = asArray(config.areas);
        if (areas.length > 0) {
          await manager.insert('hk4_key_sequence_areas', areas.map(areaId => ({
            sequence,
            areaId: Number(areaId),
          })));
        }
      }

      for (const course of sourceData.courses) {
        const templateResult = await manager.insert('course_templates', {
          name: course.course_name,
          daysCount: Number(course.days_count),
        });
        const courseTemplateId = templateResult.identifiers[0].id;
        const agenda = asArray(course.course_agenda);
        for (const item of agenda) {
          const agendaResult = await manager.insert('course_template_agenda', {
            courseTemplateId,
            title: item.title || null,
            gongTypeId: Number(item.gongs && item.gongs.type),
            volume: asNullableNumber(item.gongs && item.gongs.volume),
            repeat: asNullableNumber(item.gongs && item.gongs.repeat),
          });
          const agendaId = agendaResult.identifiers[0].id;
          const days = asArray(item.days);
          const times = asArray(item.gongs && item.gongs.times);
          const areas = asArray(item.gongs && item.gongs.areas);

          if (days.length > 0) {
            await manager.insert('course_template_agenda_days', days.map(dayNumber => ({
              agendaId,
              dayNumber: Number(dayNumber),
            })));
          }
          if (times.length > 0) {
            await manager.insert('course_template_agenda_times', times.map(time => ({
              agendaId,
              time: String(time),
            })));
          }
          if (areas.length > 0) {
            await manager.insert('course_template_agenda_areas', areas.map(areaId => ({
              agendaId,
              areaId: Number(areaId),
            })));
          }
        }
      }

      await manager.insert('permissions', sourceData.permissions.map(permission => ({
        action: permission.action,
        roles: asArray(permission.roles),
        displayOrder: asNullableNumber(permission.order),
      })));

      await manager.insert('users', sourceData.users.map(user => ({
        id: user.id,
        role: user.role,
        creationDate: asNullableNumber(user['creation-date']),
        updateDate: asNullableNumber(user['update-date']),
        encodedPasswd: user.encodedPasswd,
      })));

      for (const [state, schedules] of [
        ['active', sourceData.activeSchedules],
        ['archived', sourceData.archivedSchedules],
      ]) {
        for (const schedule of schedules) {
          const courseTemplate = await manager.findOne('course_templates', {
            where: { name: schedule.course_name },
          });
          if (!courseTemplate) {
            throw new Error(
              `Cannot migrate scheduled course ${schedule.id || '<without id>'}: `
              + `course template '${schedule.course_name}' was not found`,
            );
          }

          const scheduleResult = await manager.insert('scheduled_courses', {
            legacyId: asText(schedule.id),
            courseTemplateId: courseTemplate.id,
            date: asText(schedule.date),
            startFromDay: asNullableNumber(schedule.startFromDay),
            testHoursRange: schedule.testHoursRange || null,
            state,
          });
          const scheduledCourseId = scheduleResult.identifiers[0].id;
          const exceptions = asArray(schedule.exceptions);
          if (exceptions.length > 0) {
            await manager.insert('scheduled_course_exceptions', exceptions.map(exception => ({
              scheduledCourseId,
              dayNumber: Number(exception.day_number),
              time: String(exception.time),
            })));
          }
        }
      }

      for (const record of sourceData.manualGongs) {
        const gongResult = await manager.insert('manual_gongs', {
          time: String(record.time),
          gongTypeId: Number(record.gong && record.gong.gongType),
          volume: asNullableNumber(record.gong && record.gong.volume),
          repeat: asNullableNumber(record.gong && record.gong.repeat),
        });
        const manualGongId = gongResult.identifiers[0].id;
        const areas = asArray(record.gong && record.gong.areas);
        if (areas.length > 0) {
          await manager.insert('manual_gong_areas', areas.map(areaId => ({
            manualGongId,
            areaId: Number(areaId),
          })));
        }
      }
    });
  } finally {
    await dataSource.destroy();
  }
}

async function main() {
  const options = parseArguments(process.argv);
  const files = sourceFiles(options);
  const sourceData = loadSourceData(files);
  const counts = countSourceData(sourceData);

  console.log(JSON.stringify({ database: path.resolve(options.database), files, counts }, null, 2));

  if (options.dryRun) {
    console.log('Dry run complete; no database was written.');
    return;
  }

  fs.mkdirSync(path.dirname(path.resolve(options.database)), { recursive: true });
  await migrate(options, sourceData);
  console.log('Migration complete. Existing imported rows were replaced transactionally.');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
