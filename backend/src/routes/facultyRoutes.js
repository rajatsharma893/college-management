const express = require('express');
const {
  getFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
} = require('../controllers/facultyController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'FACULTY'), getFaculty);
router.get('/:id', authorize('ADMIN', 'FACULTY'), getFacultyById);
router.post('/', authorize('ADMIN'), createFaculty);
router.put('/:id', authorize('ADMIN'), updateFaculty);
router.delete('/:id', authorize('ADMIN'), deleteFaculty);

module.exports = router;