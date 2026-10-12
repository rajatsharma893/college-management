const prisma = require('../config/prisma');

const getDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { students: true, faculty: true, courses: true } } },
    });
    res.json(departments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'name and code are required' });
    const department = await prisma.department.create({ data: { name, code: code.toUpperCase() } });
    res.status(201).json(department);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Department name or code already exists' });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { name, code } = req.body;
    const data = {};
    if (name) data.name = name;
    if (code) data.code = code.toUpperCase();
    const department = await prisma.department.update({ where: { id: parseInt(req.params.id) }, data });
    res.json(department);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Department not found' });
    if (err.code === 'P2002') return res.status(409).json({ message: 'Department name or code already exists' });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    await prisma.department.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Department deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Department not found' });
    if (err.code === 'P2003') {
      return res.status(409).json({ message: 'Department has students, faculty or courses. Remove them first.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getDepartments, createDepartment, updateDepartment, deleteDepartment };