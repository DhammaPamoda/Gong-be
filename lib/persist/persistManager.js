const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');
const bcrypt = require('bcrypt');

const utilsManager = require('../utilsManager');
const logger = require('../logger');
const dataPaths = require('../config/dataPaths');

const staticAssetsPath = 'assets/data';

const GongType = require('../../model/gongType');

const actionEnum = Object.freeze({
  ADD: Symbol('ADD'),
  UPDATE: Symbol('UPDATE'),
  DELETE: Symbol('DELETE'),
});

/**
 *
 * @param {string} aNewGongName
 */
function validateNewGongName(aNewGongName) {
  if (!_.isString(aNewGongName)) {
    throw new Error('Gong name must be a string');
  }

  const postfixIndex = aNewGongName.lastIndexOf('.');
  if (postfixIndex < 0) {
    throw new Error('Gong file name must have a postfix identifier');
  }
  const gongName = aNewGongName.substring(0, postfixIndex);

  const { gongsMap } = utilsManager;
  const existingGongsArray = Array.from(gongsMap.values());

  if (existingGongsArray.some((gong) => gong.name.toLowerCase() === gongName.toLowerCase())) {
    throw new Error(`Gong ${gongName} already exist`);
  }

  return gongName;
}

function validateCoursesTemplate(aNewCoursesTemplateJson) {
  if (!Array.isArray(aNewCoursesTemplateJson)) {
    throw new Error('Template must consist of an array of objects');
  }

  const newCoursesArray = Array.from(aNewCoursesTemplateJson);

  const { coursesMap } = utilsManager;
  const existingCoursesNamesArray = Array.from(coursesMap.keys());

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

function persistDataObject(aDataContainerDataName, aJsonObject, aOnResolve, aOnReject) {
  // Determine the correct path based on file type
  // Dynamic data files go to XDG data directory, static/user files stay in assets
  const filename = `${aDataContainerDataName}.json`;
  const isXdgFile = dataPaths.DYNAMIC_DATA_FILES.includes(filename);
  const filePath = isXdgFile
    ? dataPaths.getDataFilePath(filename)
    : `${staticAssetsPath}/${filename}`;

  return new Promise(
    (resolve, reject) => {
      fs.writeFile(
        filePath,
        JSON.stringify(aJsonObject),
        (err) => {
          if (err) {
            logger.error(`PersistManager.js=>persistDataObject(${aDataContainerDataName})`
              + ` Error: Failed to save to ${filePath}`, { error: err });
            if (aOnReject) {
              aOnReject();
            }
            reject(err);
          }
          if (aOnResolve) {
            aOnResolve();
          }
          resolve(true);
        },
      );
    },
  );
}

function persistStaticData(
  aCourses4AddOrDelTemplateJson = null,
  aGong4Action = null,
  aUpdatedPermissions = null,
  aAction = actionEnum.ADD,
) {
  const errorPrefix = 'PersistManager::persistStaticData ERROR.';
  const addOrRemovePromise = new Promise(
    (resolve, reject) => {
      fs.readFile('assets/data/staticData.json', (error, data) => {
        if (error) {
          reject(error);
        } else {
          const currentStaticData = JSON.parse(data);
          let returnObj;

          if (aCourses4AddOrDelTemplateJson) {
            if (aAction === actionEnum.ADD) {
              currentStaticData.courses = [...aCourses4AddOrDelTemplateJson, ...currentStaticData.courses];
            } else {
              const removedObjectsArray = _.remove(
                currentStaticData.courses,
                course => aCourses4AddOrDelTemplateJson
                  .some(courseFromInput => courseFromInput.course_name === course.course_name),
              );
              if (removedObjectsArray.length !== 1) {
                const removedObjectsArrayStr = JSON.stringify(removedObjectsArray);
                reject(new Error(`${errorPrefix}. Trying to delete Course resulted in other than one candidate`
                  + `. candidatesArray : ${removedObjectsArrayStr}`));
              }
            }
            currentStaticData.courses = _.sortBy(currentStaticData.courses, ['course_name']);
          }

          if (aGong4Action) {
            if (aAction === actionEnum.ADD) {
              _.set(aGong4Action, 'id', currentStaticData.gongTypes.length + 1);
              currentStaticData.gongTypes = [...currentStaticData.gongTypes, aGong4Action];
            } else if (aAction === actionEnum.DELETE) {
              const removedObjectsArray = _.remove(
                currentStaticData.gongTypes,
                gongType => gongType.id === aGong4Action.id,
              );
              if (removedObjectsArray.length === 1) {
                // eslint-disable-next-line prefer-destructuring
                returnObj = removedObjectsArray[0];
              } else {
                const removedObjectsArrayStr = JSON.stringify(removedObjectsArray);
                reject(new Error(`${errorPrefix}. Trying to delete Gong resulted in other than one candidate`
                  + `. candidatesArray : ${removedObjectsArrayStr}`));
              }
            } else { // In case update
              const foundGong = _.find(currentStaticData.gongTypes, gongType => gongType.id === aGong4Action.id);
              if (foundGong) {
                foundGong.pathName = aGong4Action.pathName;
              } else {
                const gong4ActionStr = JSON.stringify(aGong4Action);
                reject(new Error(`${errorPrefix}. Trying to update Gong - couldn't find gong for : ${gong4ActionStr}`));
              }
            }
          }

          if (aUpdatedPermissions) {
            _.forEach(currentStaticData.permissions, permission => {
              const foundPermission = _.find(aUpdatedPermissions, updatedPermission => updatedPermission.action === permission.action);
              if (foundPermission) {
                _.set(permission, 'roles', foundPermission.roles);
              } else {
                reject(new Error(
                  `${errorPrefix} Failed to find Permissions object : ${permission.action}`,
                ));
              }
            });
          }

          currentStaticData.lastUpdatedTime = Date.now();

          persistDataObject('staticData', currentStaticData)
            .then(() => {
              utilsManager.refreshData();
              resolve(returnObj);
            })
            .catch((err) => {
              reject(err);
            });
        }
      });
    },
  );

  return addOrRemovePromise;
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

async function persistEditUserTemplate(aStringObj4Errors, aUsersManipulationFunc) {
  return new Promise((resolve, reject) => {
    fs.readFile(
      'assets/data/usersData.json',
      (err, data) => {
        if (err) {
          logger.error(`PersistManager.js=>persistEditUserTemplate(${aStringObj4Errors})`
            + ' Error: Failed to save new user (retrieving existing users)', { error: err });
          reject(err);
        } else {
          const currentUsersData = JSON.parse(data);

          aUsersManipulationFunc(currentUsersData);

          persistDataObject('usersData', currentUsersData)
            .then(() => resolve())
            .catch((error) => {
              logger.error(`PersistManager.js=>persistEditUserTemplate(${aStringObj4Errors})`
                + ' Error: Failed to save new user', { error });
              reject(error);
            });
        }
      },
    );
  });
}

async function persistNewUser(aNewUserJson) {
  return persistEditUserTemplate(
    `New NUser : ${JSON.stringify(aNewUserJson)}`,
    (currentUsersData) => {
      const newUser = _.pick(aNewUserJson, ['id', 'role']);
      const currentTimeInMSec = moment().valueOf();
      _.set(newUser, 'creation-date', currentTimeInMSec);
      _.set(newUser, 'update-date', currentTimeInMSec);
      _.set(newUser, 'encodedPasswd', bcrypt.hashSync(aNewUserJson.password, 10));
      currentUsersData.push(newUser);
    },
  );
}

async function persistRemoveUser(aUserId4Remove) {
  return persistEditUserTemplate(
    `User Id 4 removal : ${aUserId4Remove}`,
    (currentUsersData) => {
      _.remove(currentUsersData, (user) => user.id === aUserId4Remove);
    },
  );
}

async function persistUpdateUser(aUser) {
  return persistEditUserTemplate(
    `User Id 4 update : ${aUser.userId}`,
    (currentUsersData) => {
      const foundUser = currentUsersData.find(user => user.id === aUser.userId);
      if (foundUser) {
        if (aUser.role) {
          _.set(foundUser, 'role', aUser.role);
        } else {
          _.set(foundUser, 'encodedPasswd', bcrypt.hashSync(aUser.password, 10));
        }
        const currentTimeInMSec = moment().valueOf();
        _.set(foundUser, 'update-date', currentTimeInMSec);
      } else {
        throw new Error(`PersistManager=>persistUpdateUser failed for object ${JSON.stringify(aUser)}`);
      }
    },
  );
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
      validateCoursesTemplate(aNewCoursesTemplateJson);
      await persistStaticData(aNewCoursesTemplateJson);
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async deleteCoursesTemplates(aCourseName4Delete) {
    try {
      validateValidString({ aCourseName4Delete }, 'aCourseName4Delete');
      const coursesArrayLike = [{ course_name: aCourseName4Delete }];
      await persistStaticData(coursesArrayLike, null, null, actionEnum.DELETE);
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
      const action = !gongId4UpdateNumber ? actionEnum.ADD : actionEnum.UPDATE;
      if (action === actionEnum.ADD) {
        gongName = validateNewGongName(aNewFilePath);
        newOrUpdatedGong = new GongType(0, gongName, aNewFilePath);
      } else { // for update
        newOrUpdatedGong = utilsManager.gongsMap.get(gongId4UpdateNumber);
        if (newOrUpdatedGong) {
          oldFilePath = newOrUpdatedGong.pathName;
          newOrUpdatedGong.pathName = aNewFilePath;
        } else {
          throw new Error(`PersistManager::addOrUpdateGong. Unuable to retrieve gong for Id : ${gongId4UpdateNumber}`);
        }
      }
      await copyGongFile(aNewFilePath, aCurrentDownloadPath);
      if (action === actionEnum.UPDATE) {
        await removeGongFile(oldFilePath);
      }
      await persistStaticData(null, newOrUpdatedGong, null, action);
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
      const dummyGongObj4Del = { id: gongId4DeleteNum };
      const removedGongObj = await persistStaticData(
        null,
        dummyGongObj4Del,
        null,
        actionEnum.DELETE,
      );
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
      await persistNewUser(aNewUserJson);
      await persistStaticData();
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async removeUser(aUserId4Remove) {
    try {
      validateValidString({ aUserId4Remove }, 'aUserId4Remove');
      await persistRemoveUser(aUserId4Remove);
      await persistStaticData();
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async updateUser(aUserJson) {
    try {
      ['userId', 'role'].forEach(field => validateValidString(aUserJson, field));
      await persistUpdateUser(aUserJson);
      await persistStaticData();
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async resetUserPassword(aUserJson) {
    try {
      ['userId', 'password'].forEach(field => validateValidString(aUserJson, field));
      await persistUpdateUser(aUserJson);
      await persistStaticData();
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }

  async updatePermissions(aPermissionsArrayJson) {
    try {
      validatePermissions(aPermissionsArrayJson);
      await persistStaticData(null, null, aPermissionsArrayJson);
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.resolve();
  }
}

module.exports = new PersistManager();
