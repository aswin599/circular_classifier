import 'dotenv/config';
import dbConnect from '../config/database';
import '../models/Category';
import { Circular } from '../models/Circular';
import { Category } from '../models/Category';
import { classifier } from '../services/classifier';
import { generateShortTitle, generate3PointerSummary } from '../utils/summaryHelper';

async function reprocess() {
  console.log('🔄 Reprocessing circulars in database...');
  await dbConnect();

  // Train classifier from current samples & categories
  await classifier.trainFromSamples();

  const circulars = await Circular.find({}).sort({ receivedDate: 1 });
  console.log(`Found ${circulars.length} circulars to reprocess.`);

  const seenSubjects: Map<string, { id: string; date: Date }> = new Map();

  for (const circular of circulars) {
    const fullText = [circular.extractedText || '', circular.bodyText || ''].filter(Boolean).join('\n\n');
    const classification = await classifier.classify(fullText, circular.subject);

    // 1. Assign Category
    if (classification.categoryId) {
      circular.categoryId = classification.categoryId as any;
    } else {
      // Fallback heuristics based on subject
      const subLower = circular.subject.toLowerCase();
      let catName = 'Administrative';
      if (subLower.includes('exam')) catName = 'Examination';
      else if (subLower.includes('scholarship')) catName = 'Scholarship';
      else if (subLower.includes('placement') || subLower.includes('interview')) catName = 'Placement';
      else if (subLower.includes('hackathon') || subLower.includes('event') || subLower.includes('symposium') || subLower.includes('celebration')) catName = 'Events';
      else if (subLower.includes('learning') || subLower.includes('research') || subLower.includes('academic') || subLower.includes('program')) catName = 'Academic';

      const found = await Category.findOne({ name: catName });
      if (found) {
        circular.categoryId = found._id as any;
      }
    }

    // 2. Short title (maximum 4 words)
    circular.shortTitle = generateShortTitle(circular.subject, circular.bodyText || '');

    // 3. 3-pointer summary
    circular.summaryBullets = generate3PointerSummary(
      circular.subject,
      circular.bodyText || '',
      circular.extractedText || ''
    );

    // 4. Priority and Priority Order
    circular.priority = classification.priority;
    circular.priorityOrder = classification.priorityOrder;

    // 5. Target role
    if (!circular.targetRole) {
      circular.targetRole = 'ALL';
    }

    // 6. Duplicate detection
    const normalizedSubject = circular.subject.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenSubjects.has(normalizedSubject)) {
      const original = seenSubjects.get(normalizedSubject)!;
      circular.isDuplicate = true;
      circular.duplicateOfDate = original.date;
      const formattedDate = new Date(original.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const tag = `Duplicate (${formattedDate})`;
      if (!circular.tags.includes(tag)) {
        circular.tags.push(tag);
      }
      console.log(`⚠️ Detected duplicate: "${circular.subject}" (original on ${formattedDate})`);
    } else {
      circular.isDuplicate = false;
      seenSubjects.set(normalizedSubject, { id: circular._id.toString(), date: circular.receivedDate });
    }

    await circular.save();
    console.log(`✅ Reprocessed: "${circular.shortTitle}" | Priority: ${circular.priority} (${circular.priorityOrder}) | Cat: ${classification.categoryName}`);
  }

  console.log('🎉 Reprocessing complete!');
}

reprocess()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during reprocessing:', err);
    process.exit(1);
  });
