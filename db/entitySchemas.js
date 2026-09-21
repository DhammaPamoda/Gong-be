const gongSchemas = require('./gongs');
const courseTemplateSchemas = require('./courseTemplate');
const scheduledCourseSchemas = require('./scheduledCourse');
const userSchemas = require('./users');
const systemSettingsSchemas = require('./systemSettings');
const hk4Schemas = require('./hk4');

module.exports = [
  ...gongSchemas,
  ...courseTemplateSchemas,
  ...scheduledCourseSchemas,
  ...userSchemas,
  ...systemSettingsSchemas,
  ...hk4Schemas,
];
