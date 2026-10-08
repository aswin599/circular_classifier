import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dbConnect from '../config/database';
import { Circular } from '../models/Circular';

async function migrate() {
  console.log('📦 Migrating disk attachments into MongoDB Buffer storage...');
  await dbConnect();

  const circulars = await Circular.find({ 'attachments.0': { $exists: true } });
  let migratedCount = 0;

  for (const c of circulars) {
    let modified = false;
    for (const att of c.attachments) {
      if (!att.data && att.filePath && fs.existsSync(att.filePath)) {
        try {
          const buf = fs.readFileSync(att.filePath);
          att.data = buf;
          modified = true;
          migratedCount++;
          console.log(`Stored ${att.filename} (${buf.length} bytes) into MongoDB for circular ${c.shortTitle || c.subject}`);
        } catch (err) {
          console.error(`Error reading ${att.filePath}:`, err);
        }
      }
    }
    if (modified) {
      await c.save();
    }
  }

  console.log(`Migrated ${migratedCount} attachments to database.`);

  // Now remove the uploads directory
  const uploadsDir = path.resolve(__dirname, '../../uploads');
  if (fs.existsSync(uploadsDir)) {
    try {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
      console.log('🗑️ Successfully removed server/uploads directory!');
    } catch (err) {
      console.warn('Could not remove uploads directory immediately:', err);
    }
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
