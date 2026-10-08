import 'dotenv/config';
import dbConnect from '../config/database';
import { Circular } from '../models/Circular';
import { classifier } from '../services/classifier';

/**
 * Backfills targetRole for existing circulars using the keyword-based
 * audience classifier (STUDENT / ADMIN / ALL). Safe to re-run: it only
 * updates circulars whose stored role differs or is unset.
 */
async function main() {
  console.log('🎯 Backfilling targetRole for existing circulars...');
  await dbConnect();

  const circulars = await Circular.find().select('subject shortTitle bodyText extractedText summaryBullets targetRole');

  let updated = 0;
  let skipped = 0;

  for (const circular of circulars) {
    const text = [
      circular.subject,
      circular.shortTitle,
      circular.bodyText,
      circular.extractedText,
      ...(circular.summaryBullets || []),
    ]
      .filter(Boolean)
      .join('\n\n');

    const { targetRole } = classifier.classifyRole(text);

    if ((circular.targetRole || 'ALL') === targetRole) {
      skipped++;
      continue;
    }

    circular.targetRole = targetRole;
    await circular.save();
    updated++;
    console.log(`  "${circular.shortTitle || circular.subject}" -> ${targetRole}`);
  }

  console.log(`✅ Backfill complete: ${updated} updated, ${skipped} already correct (of ${circulars.length})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});