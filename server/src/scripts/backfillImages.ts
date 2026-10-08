import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import dbConnect from '../config/database';
import '../models/Category';
import { Circular, CircularImageSubdoc } from '../models/Circular';
import { config } from '../config';
import { extractAndPersistAttachmentImages } from '../services/imageExtractor';

/**
 * Backfill extracted images for circulars that were ingested before the
 * image extractor existed. For every attachment that lives on disk, we
 * extract PDF page renders / embedded figures / DOCX media and store them
 * under circular.images, plus the primary thumbnail for cards.
 */
async function backfill() {
  console.log('Backfilling circular images...');
  await dbConnect();

  const circulars = await Circular.find({}).sort({ receivedDate: -1 });
  console.log(`Found ${circulars.length} circulars to process.`);

  const destDir = path.join(path.resolve(config.upload.dir), 'extracted');
  let updated = 0;
  let imagesAdded = 0;

  for (const circular of circulars) {
    if (!circular.attachments || circular.attachments.length === 0) {
      continue;
    }

    const baseName = circular._id.toString();
    let addedForCircular = 0;

    for (const attachment of circular.attachments) {
      if (!attachment.filePath) continue;
      const fullPath = path.resolve(attachment.filePath);
      if (!fs.existsSync(fullPath)) {
        console.warn(`  - Missing file on disk for attachment ${attachment.filename}: ${fullPath}`);
        continue;
      }

      try {
        const { images, primaryThumb } = await extractAndPersistAttachmentImages(
          {
            filePath: fullPath,
            fileType: attachment.fileType,
            sourceAttachmentId: attachment._id.toString(),
          },
          destDir,
          `${baseName}-${attachment._id.toString()}`,
          attachment._id.toString()
        );

        const existingKeys = new Set((circular.images || []).map((im: CircularImageSubdoc) => `${im.sourceType}-${im.page}-${im.index}`));
        const fresh = (images as any[]).filter((im) => !existingKeys.has(`${im.sourceType}-${im.page}-${im.index}`));

        circular.images.push(...fresh);
        if (!circular.primaryThumb && primaryThumb) {
          circular.primaryThumb = primaryThumb;
        }
        addedForCircular += fresh.length;
      } catch (err) {
        console.error(`  - Extraction failed for ${attachment.filename}:`, (err as Error).message);
      }
    }

    if (addedForCircular > 0) {
      await circular.save();
      updated++;
      imagesAdded += addedForCircular;
      console.log(`  + Added ${addedForCircular} image(s) to "${circular.shortTitle || circular.subject}"`);
    }
  }

  console.log(`Done. Updated ${updated} circulars, added ${imagesAdded} images total.`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during backfill:', err);
    process.exit(1);
  });