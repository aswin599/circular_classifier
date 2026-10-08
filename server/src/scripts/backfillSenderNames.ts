import 'dotenv/config';
import dbConnect from '../config/database';
import '../models/Category';
import { Circular, AttachmentSubdoc } from '../models/Circular';
import { extractSenderNameFromRef, formatRefSenderName } from '../utils/senderName';

/**
 * Enforces the senderName business rule for every stored circular: the value
 * is always the office/code parsed from the circular's Ref.No — the
 * "TCE/{name}/{name}" reference (falling back to other recognized office
 * codes such as No.COE/... or OFFICE OF ...), never the email sender.
 * The value is stored as the bare office name (e.g. "Alumni-Pragati").
 */
async function main(): Promise<void> {
  console.log('🔄 Applying TCE sender-name rule to all circulars...');
  await dbConnect();

  const circulars = await Circular.find({}).sort({ receivedDate: 1 });
  console.log(`Found ${circulars.length} circulars.`);

  let updated = 0;
  let setNull = 0;
  let unchanged = 0;

  for (const circular of circulars) {
    const attachmentText = (circular.attachments || [])
      .map((att: AttachmentSubdoc) => att.extractedText || '')
      .join('\n\n');
    const combined = [
      circular.subject,
      circular.bodyText || '',
      circular.extractedText || '',
      attachmentText,
    ]
      .filter(Boolean)
      .join('\n\n');

    const senderName = formatRefSenderName(extractSenderNameFromRef(combined));
    const current = circular.senderName || null;

    if (current !== senderName) {
      circular.senderName = senderName;
      await circular.save();
      updated++;
      if (!senderName) setNull++;
      console.log(`  ✅ "${String(circular.subject).slice(0, 60)}" -> sender="${senderName ?? 'NULL'}"`);
    } else {
      unchanged++;
    }
  }

  console.log('\n📊 Done:');
  console.log(`   Total circulars : ${circulars.length}`);
  console.log(`   Updated         : ${updated}`);
  console.log(`   Set to NULL     : ${setNull}`);
  console.log(`   Unchanged       : ${unchanged}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during sender name backfill:', err);
    process.exit(1);
  });