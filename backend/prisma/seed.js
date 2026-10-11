require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ====== Yahan numbers badal sakte ho ======
const TOTAL_STUDENTS = 1000;
const TOTAL_FACULTY = 100;
const COURSES_PER_SEMESTER = 3;
// ==========================================

const DEPARTMENTS = [
  { name: 'Computer Science', code: 'CSE' },
  { name: 'Electronics', code: 'ECE' },
  { name: 'Mechanical', code: 'ME' },
  { name: 'Civil', code: 'CE' },
  { name: 'Electrical', code: 'EE' },
];

const FIRST = ['Aman', 'Priya', 'Rohit', 'Sneha', 'Vikas', 'Neha', 'Rahul', 'Pooja', 'Arjun', 'Kavya',
  'Ankit', 'Riya', 'Karan', 'Isha', 'Manish', 'Divya', 'Suresh', 'Anjali', 'Deepak', 'Meena'];
const LAST = ['Sharma', 'Verma', 'Singh', 'Gupta', 'Patel', 'Yadav', 'Kumar', 'Mishra', 'Joshi', 'Reddy',
  'Nair', 'Chauhan', 'Tiwari', 'Pandey', 'Mehta', 'Jain', 'Saxena', 'Agarwal', 'Bose', 'Das'];

const nameFor = (i) => `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;

async function createManyChunked(model, data, size = 500) {
  for (let i = 0; i < data.length; i += size) {
    await prisma[model].createMany({ data: data.slice(i, i + size), skipDuplicates: true });
  }
}

async function main() {
  console.time('seed');
  const hash = await bcrypt.hash('password123', 10); // sabka password: password123

  // 1. Departments
  await createManyChunked('department', DEPARTMENTS);
  const depts = await prisma.department.findMany();

  // 2. Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@college.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@college.com', password: hash, role: 'ADMIN' },
  });

  // 3. Faculty users + faculty records
  const facultyUsers = Array.from({ length: TOTAL_FACULTY }, (_, i) => ({
    name: 'Dr. ' + nameFor(i + 3),
    email: `faculty${i + 1}@college.com`,
    password: hash,
    role: 'FACULTY',
  }));
  await createManyChunked('user', facultyUsers);
  const fUsers = await prisma.user.findMany({ where: { role: 'FACULTY' } });
  const fUserId = Object.fromEntries(fUsers.map((u) => [u.email, u.id]));

  const facultyRows = Array.from({ length: TOTAL_FACULTY }, (_, i) => ({
    employeeId: 'FAC' + String(i + 1).padStart(3, '0'),
    userId: fUserId[`faculty${i + 1}@college.com`],
    departmentId: depts[i % depts.length].id,
  }));
  await createManyChunked('faculty', facultyRows);
  const faculty = await prisma.faculty.findMany();

  // 4. Courses (har department, 8 semester, har semester mein COURSES_PER_SEMESTER)
  const courseRows = [];
  for (const d of depts) {
    const deptFaculty = faculty.filter((f) => f.departmentId === d.id);
    let k = 0;
    for (let sem = 1; sem <= 8; sem++) {
      for (let n = 1; n <= COURSES_PER_SEMESTER; n++) {
        courseRows.push({
          code: `${d.code}${sem}0${n}`,
          name: `${d.name} Subject ${sem}.${n}`,
          credits: 3 + (n % 2),
          semester: sem,
          departmentId: d.id,
          facultyId: deptFaculty.length ? deptFaculty[k % deptFaculty.length].id : null,
        });
        k++;
      }
    }
  }
  await createManyChunked('course', courseRows);
  const courses = await prisma.course.findMany();

  // 5. Students users + student records
  const studentUsers = Array.from({ length: TOTAL_STUDENTS }, (_, i) => ({
    name: nameFor(i),
    email: `student${i + 1}@college.com`,
    password: hash,
    role: 'STUDENT',
  }));
  await createManyChunked('user', studentUsers);
  const sUsers = await prisma.user.findMany({ where: { role: 'STUDENT' } });
  const sUserId = Object.fromEntries(sUsers.map((u) => [u.email, u.id]));

  const studentRows = Array.from({ length: TOTAL_STUDENTS }, (_, i) => {
    const d = depts[i % depts.length];
    return {
      rollNumber: `${d.code}${String(i + 1).padStart(4, '0')}`,
      semester: (i % 8) + 1,
      userId: sUserId[`student${i + 1}@college.com`],
      departmentId: d.id,
    };
  });
  await createManyChunked('student', studentRows);
  const students = await prisma.student.findMany();

  // 6. Enrollments (student ke department + semester ke courses)
  const enrollRows = [];
  for (const s of students) {
    for (const c of courses) {
      if (c.departmentId === s.departmentId && c.semester === s.semester) {
        enrollRows.push({ studentId: s.id, courseId: c.id });
      }
    }
  }
  await createManyChunked('enrollment', enrollRows);

  // 7. Welcome notice
  if ((await prisma.notice.count()) === 0) {
    await prisma.notice.create({
      data: {
        title: 'Welcome to the College Portal',
        content: 'Classes for the new semester begin next Monday.',
        authorId: admin.id,
      },
    });
  }

  console.log(`Departments: ${depts.length}, Faculty: ${faculty.length}, Courses: ${courses.length}, Students: ${students.length}, Enrollments: ${enrollRows.length}`);
  console.timeEnd('seed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());