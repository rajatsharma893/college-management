const prisma = require('../config/prisma');

const toDate = (d) => {
  const date = new Date(`${d}T00:00:00.000Z`);
  return isNaN(date.getTime()) ? null : date;
};

// Admin kisi bhi course ki, faculty sirf apne course ki attendance sambhal sakta hai
const checkCourseAccess = async (user, courseId) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return { status: 404, error: 'Course not found' };
  if (user.role === 'ADMIN') return { course };
  const faculty = await prisma.faculty.findUnique({ where: { userId: user.id } });
  if (!faculty || course.facultyId !== faculty.id) {
    return { status: 403, error: 'You are not assigned to this course' };
  }
  return { course };
};

// GET /api/attendance/course/:courseId/students?date=2026-10-12
const getCourseStudents = async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const access = await checkCourseAccess(req.user, courseId);
    if (access.error) return res.status(access.status).json({ message: access.error });

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { studentId: 'asc' },
    });

    let statusByStudent = {};
    if (req.query.date) {
      const date = toDate(req.query.date);
      if (!date) return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
      const records = await prisma.attendance.findMany({ where: { courseId, date } });
      statusByStudent = Object.fromEntries(records.map((r) => [r.studentId, r.status]));
    }

    res.json({
      course: { id: access.course.id, code: access.course.code, name: access.course.name },
      students: enrollments.map((e) => ({
        studentId: e.studentId,
        rollNumber: e.student.rollNumber,
        name: e.student.user.name,
        status: statusByStudent[e.studentId] || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/attendance/mark
// body: { courseId, date: "2026-10-12", records: [{ studentId, status }] }
const markAttendance = async (req, res) => {
  try {
    const { courseId, date, records } = req.body;
    if (!courseId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'courseId, date and records are required' });
    }

    const day = toDate(date);
    if (!day) return res.status(400).json({ message: 'date must be YYYY-MM-DD' });

    const cid = parseInt(courseId);
    const access = await checkCourseAccess(req.user, cid);
    if (access.error) return res.status(access.status).json({ message: access.error });

    const valid = ['PRESENT', 'ABSENT', 'LATE'];
    const enrolled = new Set(
      (await prisma.enrollment.findMany({ where: { courseId: cid }, select: { studentId: true } })).map(
        (e) => e.studentId
      )
    );

    for (const r of records) {
      if (!valid.includes(r.status)) {
        return res.status(400).json({ message: `status must be one of ${valid.join(', ')}` });
      }
      if (!enrolled.has(parseInt(r.studentId))) {
        return res.status(400).json({ message: `Student ${r.studentId} is not enrolled in this course` });
      }
    }

    // Dobara mark karne par purani attendance update ho jati hai
    await prisma.$transaction(
      records.map((r) =>
        prisma.attendance.upsert({
          where: { studentId_courseId_date: { studentId: parseInt(r.studentId), courseId: cid, date: day } },
          update: { status: r.status },
          create: { studentId: parseInt(r.studentId), courseId: cid, date: day, status: r.status },
        })
      )
    );

    res.json({ message: 'Attendance saved', count: records.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/attendance/my  (student apni attendance dekhega)
const getMyAttendance = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const records = await prisma.attendance.findMany({
      where: { studentId: student.id },
      include: { course: { select: { id: true, code: true, name: true } } },
    });

    const byCourse = {};
    for (const r of records) {
      const c = (byCourse[r.courseId] ||= { course: r.course, total: 0, attended: 0 });
      c.total += 1;
      if (r.status !== 'ABSENT') c.attended += 1; // PRESENT aur LATE dono count hote hain
    }

    const courses = Object.values(byCourse).map((c) => {
      const percentage = Math.round((c.attended / c.total) * 1000) / 10;
      return { ...c, percentage, lowAttendance: percentage < 75 };
    });

    const total = courses.reduce((s, c) => s + c.total, 0);
    const attended = courses.reduce((s, c) => s + c.attended, 0);
    const overall = total ? Math.round((attended / total) * 1000) / 10 : null;

    res.json({ overallPercentage: overall, lowAttendance: overall !== null && overall < 75, courses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getCourseStudents, markAttendance, getMyAttendance };