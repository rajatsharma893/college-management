const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');

const include = {
  user: { select: { id: true, name: true, email: true } },
  department: { select: { id: true, name: true, code: true } },
  courses: { select: { id: true, code: true, name: true } },
};

// GET /api/faculty?page=1&limit=10&search=anil&departmentId=1
const getFaculty = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const { search, departmentId } = req.query;

    const where = {};
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (search) {
      where.OR = [
        { employeeId: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, faculty] = await Promise.all([
      prisma.faculty.count({ where }),
      prisma.faculty.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        include,
      }),
    ]);

    res.json({
      data: faculty,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/faculty/:id
const getFacultyById = async (req, res) => {
  try {
    const faculty = await prisma.faculty.findUnique({
      where: { id: parseInt(req.params.id) },
      include,
    });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });
    res.json(faculty);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/faculty
const createFaculty = async (req, res) => {
  try {
    const { name, email, password, employeeId, departmentId, phone } = req.body;
    if (!name || !email || !employeeId || !departmentId) {
      return res.status(400).json({ message: 'name, email, employeeId and departmentId are required' });
    }

    const hash = await bcrypt.hash(password || 'password123', 10);

    const faculty = await prisma.faculty.create({
      data: {
        employeeId,
        phone,
        department: { connect: { id: parseInt(departmentId) } },
        user: { create: { name, email, password: hash, role: 'FACULTY' } },
      },
      include,
    });

    res.status(201).json(faculty);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Email or employee ID already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(400).json({ message: 'Department not found' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/faculty/:id
const updateFaculty = async (req, res) => {
  try {
    const { name, email, employeeId, departmentId, phone } = req.body;

    const data = {};
    if (employeeId) data.employeeId = employeeId;
    if (phone !== undefined) data.phone = phone;
    if (departmentId) data.department = { connect: { id: parseInt(departmentId) } };

    const userData = {};
    if (name) userData.name = name;
    if (email) userData.email = email;
    if (Object.keys(userData).length) data.user = { update: userData };

    const faculty = await prisma.faculty.update({
      where: { id: parseInt(req.params.id) },
      data,
      include,
    });

    res.json(faculty);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Faculty or department not found' });
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Email or employee ID already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/faculty/:id
const deleteFaculty = async (req, res) => {
  try {
    const faculty = await prisma.faculty.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    // user delete karne se faculty record hat jata hai, uske courses unassigned ho jate hain
    await prisma.user.delete({ where: { id: faculty.userId } });

    res.json({ message: 'Faculty deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getFaculty, getFacultyById, createFaculty, updateFaculty, deleteFaculty };