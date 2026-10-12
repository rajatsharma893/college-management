const express = require('express');
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/courseController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', getCourses);
router.get('/:id', getCourse);
router.post('/', authorize('ADMIN'), createCourse);
router.put('/:id', authorize('ADMIN'), updateCourse);
router.delete('/:id', authorize('ADMIN'), deleteCourse);

module.exports = router;