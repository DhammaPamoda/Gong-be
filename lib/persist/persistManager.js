const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');
const bcrypt = require('bcrypt');

const usersDal = require('../../db/dal/usersDal');
const permissionsDal = require('../../db/dal/permissionsDal');
const courseTemplatesDal = require('../../db/dal/courseTemplatesDal');
const gongTypesDal = require('../../db/dal/gongTypesDal');

const User = require('../../model/user');

/**
 *
 * @param {string} aNewGongName
 */
async function validateNewGongName(aNewGongName) {
  if (!_.isString(aNewGongName)) {
    throw new Error('Gong name must be a string');
  }

  const postfixIndex = aNewGongName.lastIndexOf('.');
  if (postfixIndex < 0) {
    throw new Error('Gong file name must have a postfix identifier');
  }
  const gongName = aNewGongName.substring(0, postfixIndex);

  const existingGongsArray = await gongTypesDal.getAll();

  if (existingGongsArray.some((gong) => gong.name.toLowerCase() === gongName.toLowerCase())) {
    throw new Error(`Gong ${gongName} already exist`);
  }

  return gongName;
}

async function validateCoursesTemplate(aNewCoursesTemplateJson) {
  if (!Array.isArray(aNewCoursesTemplateJson)) {
    throw new Error('Template must consist of an array of objects');
  }

  const newCoursesArray = Array.from(aNewCoursesTemplateJson);

  const existingCoursesNamesArray = (await courseTemplatesDal.getAll()).map(course => course.course_name);

  const regexp4Time = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');

  newCoursesArray.forEach((newCourse) => {
    const courseName = _.get(newCourse, 'course_name');
    if (!courseName || !_.isString(courseName)) {
      throw new Error('All courses must have course_name attribute with string value');
    }

    if (existingCoursesNamesArray.includes(courseName)) {
      throw new Error(`Course ${courseName} already exist`);
    }

    const daysCount = _.get(newCourse, 'days_count');
    if (!daysCount || !_.isNumber(daysCount)) {
      throw new Error('All courses must have days_count attribute with number value');
    }

    const courseAgenda = _.get(newCourse, 'course_agenda');
    if (!courseAgenda || !Array.isArray(courseAgenda)) {
      throw new Error('All courses must have course_agenda attribute consist of array');
    }

    const agendaArray = Array.from(courseAgenda);
    agendaArray.forEach((agendaProperty) => {
      const days = _.get(agendaProperty, 'days');
      if (!days || !Array.isArray(days) || Array.from(days).some(day => !_.isNumber(day))) {
        throw new Error('All courses must have days attribute consist of array of numbers');
      }

      const gongs = _.get(agendaProperty, 'gongs');
      if (!gongs) {
        throw new Error('All courses must have gongs attribute consist of a parent object');
      }

      const times = _.get(gongs, 'times');
      let badTime;
      if (!times || !Array.isArray(times) || Array.from(times).some(time => !_.isString(time))
        || Array.from(times).some(time => {
          const test = regexp4Time.test(String(time));
          if (!test) badTime = time;
          return !test;
        })) {
        throw new Error('All courses must have times attribute consist of array of stings in the format \'HH:MM\''
          + ` ()${badTime}`);
      }

      const areas = _.get(gongs, 'areas');
      if (!areas || !Array.isArray(areas) || Array.from(areas).some(area => !_.isNumber(area))) {
        throw new Error('All courses must have areas attribute consist of array of numbers');
      }

      const type = _.get(gongs, 'type');
      if (_.isNil(type) || !_.isNumber(type)) {
        throw new Error('All courses must have type attribute consist of a number');
      }

      const volume = _.get(gongs, 'volume');
      if (volume && !_.isNumber(volume)) {
        throw new Error('All courses can have volume attribute consist of a number');
      }
    }); // End of agendaArray.forEach
  });// End of newCoursesArray.forEach
}

function validateValidString(aObject, aField) {
  const fieldValue = _.get(aObject, aField);
  if (!fieldValue || !_.isString(fieldValue) || fieldValue.trim().length <= 0) {
    throw new Error(`${_.upperFirst(aField)} must be a valid string. Current value ${fieldValue}`);
  }
}

function validateValidArray(aArrayJsonForTest) {
  if (!aArrayJsonForTest || !Array.isArray(aArrayJsonForTest) || aArrayJsonForTest.length <= 0) {
    throw new Error('Supposed Array must be valid Array and consist of one or more elements');
  }
}

async function copyGongFile(aNewFileName, aCurrentDownloadPath) {
  return new Promise(
    (resolve, reject) => {
      fs.copyFile(
        aCurrentDownloadPath,
        `assets/sounds/${aNewFileName}`,
        fs.constants.COPYFILE_FICLONE,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      );
    },
  );
}

async function removeGongFile(aGongFileName2Remove) {
  return new Promise(
    (resolve, reject) => {
      fs.unlink(`assets/sounds/${aGongFileName2Remove}`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    },
  );
}

function validateNewUserTemplate(aNewUserJson) {
  ['id', 'role', 'password'].forEach(field => validateValidString(aNewUserJson, field));
}

function validatePermissions(aPermissionsArrayJson) {
  validateValidArray(aPermissionsArrayJson);
  _.forEach(aPermissionsArrayJson, (permission) => {
    validateValidString(permission, 'action');
    validateValidArray(permission.roles);
    if (permission.roles.some(role => !['user', 'super-user', 'admin', 'dev'].includes(role))) {
      throw new Error(
        `Roles must be one of ['user', 'super-user', 'admin', 'dev'] for permission : ${permission.action}`,
      );
    }
  });
}

class PersistManager {
  /**
   *
   * @param aNewCoursesTemplatesJson
   * @return {Promise<void>}
   */
  async addCoursesTemplates(aNewCoursesTemplateJson) {
    try {
      await validateCoursesTemplate(aNewCoursesTemplateJson);
      await courseTemplatesDal.addAll(aNewCoursesTemplateJson);
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async deleteCoursesTemplates(aCourseName4Delete) {
    try {
      validateValidString({ aCourseName4Delete }, 'aCourseName4Delete');
      const wasRemoved = await courseTemplatesDal.removeByName(aCourseName4Delete);
      if (!wasRemoved) throw new Error(`Course ${aCourseName4Delete} does not exist`);
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async addOrUpdateGong(aNewFilePath, aCurrentDownloadPath, aGongId4Update) {
    try {
      let newOrUpdatedGong;
      let gongName;
      let gongId4UpdateNumber;
      let oldFilePath;
      if (aGongId4Update && _.isNumber(Number(aGongId4Update))) {
        gongId4UpdateNumber = Number(aGongId4Update);
      }
      if (!gongId4UpdateNumber) {
        gongName = await validateNewGongName(aNewFilePath);
        newOrUpdatedGong = await gongTypesDal.create({ name: gongName, pathName: aNewFilePath });
      } else { // for update
        newOrUpdatedGong = await gongTypesDal.getById(gongId4UpdateNumber);
        if (newOrUpdatedGong) {
          oldFilePath = newOrUpdatedGong.pathName;
          newOrUpdatedGong = { ...newOrUpdatedGong, pathName: aNewFilePath };
          await gongTypesDal.update(gongId4UpdateNumber, { pathName: aNewFilePath });
        } else {
          throw new Error(`PersistManager::addOrUpdateGong. Unuable to retrieve gong for Id : ${gongId4UpdateNumber}`);
        }
      }
      await copyGongFile(aNewFilePath, aCurrentDownloadPath);
      if (gongId4UpdateNumber) {
        await removeGongFile(oldFilePath);
      }
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async deleteGong(aGongId4Delete) {
    try {
      const gongId4DeleteNum = Number(aGongId4Delete);
      if (!aGongId4Delete || !_.isNumber(gongId4DeleteNum)) {
        throw new Error(`PersistManager::deleteGong : Gong id must be a valid number. Current value ${aGongId4Delete}`);
      }
      const removedGongObj = await gongTypesDal.remove(gongId4DeleteNum);
      if (!removedGongObj) throw new Error(`Gong ${gongId4DeleteNum} does not exist`);
      const fileName = removedGongObj.pathName;
      await removeGongFile(fileName);
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async addUser(aNewUserJson) {
    try {
      validateNewUserTemplate(aNewUserJson);
      const currentTimeInMSec = moment().valueOf();
      const newUser = new User({
        id: aNewUserJson.id,
        role: aNewUserJson.role,
        'creation-date': currentTimeInMSec,
        'update-date': currentTimeInMSec,
        encodedPasswd: bcrypt.hashSync(aNewUserJson.password, 10),
      });
      await usersDal.create(newUser.toDatabase());
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async removeUser(aUserId4Remove) {
    try {
      validateValidString({ aUserId4Remove }, 'aUserId4Remove');
      await usersDal.remove(aUserId4Remove);
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async updateUser(aUserJson) {
    try {
      ['userId', 'role'].forEach(field => validateValidString(aUserJson, field));
      await usersDal.update(aUserJson.userId, {
        role: aUserJson.role,
        updateDate: moment().valueOf(),
      });
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async resetUserPassword(aUserJson) {
    try {
      ['userId', 'password'].forEach(field => validateValidString(aUserJson, field));
      await usersDal.update(aUserJson.userId, {
        encodedPasswd: bcrypt.hashSync(aUserJson.password, 10),
        updateDate: moment().valueOf(),
      });
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async updatePermissions(aPermissionsArrayJson) {
    try {
      validatePermissions(aPermissionsArrayJson);
      await permissionsDal.updateAll(aPermissionsArrayJson);
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }
}

module.exports = new PersistManager();
