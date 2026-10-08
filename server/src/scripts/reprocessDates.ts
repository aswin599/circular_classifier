import dbConnect from '../config/database';
import { Circular } from '../models/Circular';
import { detectExpiry } from '../services/expiryDetector';

async function main() {
  console.log('🔄 Re-processing dates for all circulars in database...');
  await dbConnect();

  const circulars = await Circular.find();
  console.log(`Found ${circulars.length} circulars in database`);

  for (const circular of circulars) {
    console.log('\n--- EXTRACTED TEXT SNIPPET ---');
    console.log((circular.extractedText || circular.bodyText || '').slice(0, 1000));
    console.log('--- END SNIPPET ---\n');

    const fullText = [circular.subject, circular.extractedText || '', circular.bodyText || '']
      .filter(Boolean)
      .join('\n\n');
    const result = detectExpiry(fullText);

    console.log(`\nCircular: "${circular.subject}"`);
    console.log(`  - Detected Expire Date:`, result.expireDate);
    console.log(`  - Last Date Without Fine:`, result.lastDateWithoutFine);
    console.log(`  - Last Date With Fine:`, result.lastDateWithFine);
    console.log(`  - Multiple Important Dates Found:`, result.importantDates.length);
    result.importantDates.forEach((d, idx) => {
      console.log(`     ${idx + 1}. [${d.dateType}] ${d.title}: ${d.date.toISOString().slice(0, 10)}`);
    });

    if (result.expireDate) circular.expireDate = result.expireDate;
    if (result.lastDateWithoutFine) circular.lastDateWithoutFine = result.lastDateWithoutFine;
    if (result.lastDateWithFine) circular.lastDateWithFine = result.lastDateWithFine;
    if (result.expirySource) circular.expirySource = result.expirySource;
    if (result.expiryConfidence) circular.expiryConfidence = result.expiryConfidence;
    circular.importantDates = result.importantDates;

    await circular.save();
    console.log(`  ✅ Updated database record`);
  }

  console.log('\n🎉 Finished updating circular dates!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error reprocessing dates:', err);
  process.exit(1);
});
