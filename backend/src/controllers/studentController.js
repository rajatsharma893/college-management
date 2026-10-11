const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');

const include = {
  user: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true, code: true } },
};

// GET /api/students?page=1&limit=10&search=aman&departmentId=1&semester=2
const getStudents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const { search, departmentId, semester } = req.query;

    const where = {};
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (semester) where.semester = parseInt(semester);
    if (search) {
      where.OR = [
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        include,
      }),
    ]);

    res.json({
      data: students,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/students/:id
const getStudent = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: parseInt(req.params.id) },
      include,
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/students
const createStudent = async (req, res) => {
  try {
    const { name, email, password, rollNumber, departmentId, semester, phone } = req.body;
    if (!name || !email || !rollNumber || !departmentId) {
      return res.status(400).json({ message: 'name, email, rollNumber and departmentId are required' });
    }

    const hash = await bcrypt.hash(password || 'password123', 10);

    const student = await prisma.student.create({
      data: {
        rollNumber,
        semester: semester ? parseInt(semester) : 1,
        phone,
        department: { connect: { id: parseInt(departmentId) } },
        user: { create: { name, email, password: hash, role: 'STUDENT' } },
      },
      include,
    });

    res.status(201).json(student);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Email or roll number already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(400).json({ message: 'Department not found' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/students/:id
const updateStudent = async (req, res) => {
  try {
    const { name, email, rollNumber, departmentId, semester, phone } = req.body;

    const data = {};
    if (rollNumber) data.rollNumber = rollNumber;
    if (semester) data.semester = parseInt(semester);
    if (phone !== undefined) data.phone = phone;
    if (departmentId) data.department = { connect: { id: parseInt(departmentId) } };

    const userData = {};
    if (name) userData.name = name;
    if (email) userData.email = email;
    if (Object.keys(userData).length) data.user = { update: userData };

    const student = await prisma.student.update({
      where: { id: parseInt(req.params.id) },
      data,
      include,
    });

    res.json(student);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Student not found' });
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Email or roll number already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/students/:id
const deleteStudent = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // user delete karne se student, enrollments, attendance, marks sab apne aap hat jate hain
    await prisma.user.delete({ where: { id: student.userId } });

    res.json({ message: 'Student deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getStudents, getStudent, createStudent, updateStudent, deleteStudent };