const prisma = require('../config/prisma');

const include = {
  department: { select: { id: true, name: true, code: true } },
  faculty: { select: { id: true, employeeId: true, user: { select: { name: true } } } },
  _count: { select: { enrollments: true } },
};

const getCourses = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const { search, departmentId, semester, facultyId } = req.query;

    const where = {};
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (semester) where.semester = parseInt(semester);
    if (facultyId) where.facultyId = parseInt(facultyId);
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, courses] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { id: 'asc' }, include }),
    ]);

    res.json({ data: courses, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCourse = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: parseInt(req.params.id) }, include });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createCourse = async (req, res) => {
  try {
    const { code, name, credits, semester, departmentId, facultyId } = req.body;
    if (!code || !name || !credits || !semester || !departmentId) {
      return res.status(400).json({ message: 'code, name, credits, semester and departmentId are required' });
    }
    const course = await prisma.course.create({
      data: {
        code: code.toUpperCase(),
        name,
        credits: parseInt(credits),
        semester: parseInt(semester),
        department: { connect: { id: parseInt(departmentId) } },
        ...(facultyId ? { faculty: { connect: { id: parseInt(facultyId) } } } : {}),
      },
      include,
    });
    res.status(201).json(course);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Course code already exists' });
    if (err.code === 'P2025') return res.status(400).json({ message: 'Department or faculty not found' });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { code, name, credits, semester, departmentId, facultyId } = req.body;
    const data = {};
    if (code) data.code = code.toUpperCase();
    if (name) data.name = name;
    if (credits) data.credits = parseInt(credits);
    if (semester) data.semester = parseInt(semester);
    if (departmentId) data.department = { connect: { id: parseInt(departmentId) } };
    if (facultyId === null) data.faculty = { disconnect: true };
    else if (facultyId) data.faculty = { connect: { id: parseInt(facultyId) } };

    const course = await prisma.course.update({ where: { id: parseInt(req.params.id) }, data, include });
    res.json(course);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Course, department or faculty not found' });
    if (err.code === 'P2002') return res.status(409).json({ message: 'Course code already exists' });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    await prisma.course.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Course deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Course not found' });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getCourses, getCourse, createCourse, updateCourse, deleteCourse };