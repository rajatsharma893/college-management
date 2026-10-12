const express = require('express');
const {
  getCourseStudents,
  markAttendance,
  getMyAttendance,
} = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/my', authorize('STUDENT'), getMyAttendance);
router.get('/course/:courseId/students', authorize('ADMIN', 'FACULTY'), getCourseStudents);
router.post('/mark', authorize('ADMIN', 'FACULTY'), markAttendance);

module.exports = router;