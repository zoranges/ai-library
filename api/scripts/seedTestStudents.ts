import { v4 as uuidv4 } from 'uuid';
import { initDatabase, queryAll, run } from '../db/database.js';
import bcrypt from 'bcryptjs';

async function seed() {
  await initDatabase();
  console.log('Database connected');

  // Get all active school IDs for distribution
  const schools = await queryAll('SELECT id, name FROM schools WHERE isActive = 1');
  if (schools.length === 0) {
    console.error('No active schools found. Please create at least one school first.');
    process.exit(1);
  }
  console.log(`Found ${schools.length} school(s): ${schools.map((s: any) => s.name).join(', ')}`);

  const password = await bcrypt.hash('test123', 10);
  const count = 300;
  let inserted = 0;

  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(3, '0');
    const username = `test${num}`;
    const email = `test${num}@test.local`;
    const school = schools[i % schools.length];
    const id = uuidv4();

    try {
      await run(
        `INSERT INTO users (id, username, email, password, schoolId, role, points, level, preferredLanguage)
         VALUES (?, ?, ?, ?, ?, 'student', 0, 1, 'en')`,
        [id, username, email, password, (school as any).id]
      );
      inserted++;
      if (inserted % 50 === 0) console.log(`Inserted ${inserted}/${count}...`);
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        console.log(`Skipping duplicate: ${username}`);
      } else {
        console.error(`Error inserting ${username}:`, err?.message);
      }
    }
  }

  console.log(`Done! Inserted ${inserted} test students.`);
  console.log('To delete them later, run: DELETE FROM users WHERE email LIKE "%@test.local"');
  process.exit(0);
}

seed();
