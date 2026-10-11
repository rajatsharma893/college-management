const express = require('express');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'FACULTY'), getStudents);
router.get('/:id', authorize('ADMIN', 'FACULTY'), getStudent);
router.post('/', authorize('ADMIN'), createStudent);
router.put('/:id', authorize('ADMIN'), updateStudent);
router.delete('/:id', authorize('ADMIN'), deleteStudent);

module.exports = router;