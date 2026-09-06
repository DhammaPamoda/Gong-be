const express = require('express');

const responder = require('../lib/responder');
const dataHandlers = require('../handlers/data/dataHandlers');

const router = express.Router();

router.get('/staticData', dataHandlers.getStaticData);

router.get('/coursesSchedule', dataHandlers.getCoursesSchedule);

router.get('/course/:id', dataHandlers.getCourseByName);

router.get('/course', dataHandlers.getCourses);

router.get('/gongs/list', dataHandlers.getManualGongsList);

router.get('/users/list', dataHandlers.getUsersList);

router.get('/checkAuth', dataHandlers.checkAuth);

router.post('/gong/add', dataHandlers.addManualGong);

router.post('/gong/toggle', dataHandlers.toggleGong);

router.post('/gong/remove', dataHandlers.removeGong);

router.post('/coursesSchedule/add', dataHandlers.scheduleCourse);

router.post('/course/uploadCourses', dataHandlers.uploadCourses);

router.post('/course/remove', dataHandlers.removeCourse);

router.post('/gong/upload', dataHandlers.uploadGong);

router.post('/gong/deleteFile', dataHandlers.deleteGongFile);

router.post('/user/add', dataHandlers.addUser);

router.post('/user/remove', dataHandlers.removeUser);

router.post('/user/update', dataHandlers.updateUser);

router.post('/user/resetPassword', dataHandlers.resetUserPassword);

router.post('/permissions/update', dataHandlers.updatePermissions);

router.post('/courseAgenda', dataHandlers.updateCourseAgenda);

router.post('/coursesSchedule/remove', dataHandlers.removeScheduledCourse);

router.get('/emergencyState', dataHandlers.getEmergencyState);
router.delete('/emergencyState', dataHandlers.clearEmergencyState);
router.post('/testEmergency', dataHandlers.triggerTestEmergency);

router.use((req, res) => {
  responder.sendErrorResponse(res, 404, 'Request is not mapped for this server ', null);
});

module.exports = router;
