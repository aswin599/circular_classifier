import { Router } from 'express';
import { Types } from 'mongoose';
import { Circular } from '../../models/Circular';
import { User } from '../../models/User';
import { classificationQueue, emailQueue, extractionQueue, getQueueStats } from '../../jobs/queue';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { classifier } from '../../services/classifier';
import { checkForNewEmails } from '../../jobs/emailWatcher';
import { syncConnectedMailboxes } from '../../services/gmailWatcher';
import { cleanCircularSubject } from '../../utils/subject';
import { extractSenderNameFromRef, formatRefSenderName } from '../../services/circularIngest';
import { textExtractor } from '../../services/textExtractor';
import { logger } from '../../utils/logger';

const router = Router();

interface ProcessEmail {
  messageId: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  receivedDate: Date;
  bodyText: string | null;
  attachments: {
    filename: string;
    fileType: string;
    fileSize: number;
    filePath: string;
  }[];
}

router.use(authenticate);

router.get('/status', authorize('ADMIN'), (_req, res) => {
  res.json({ queues: getQueueStats() });
});

router.post('/import', authorize('ADMIN'), async (req: AuthRequest, res) => {
  const { email } = req.body;

  if (!email || !email.messageId || !email.subject || !email.senderEmail) {
    res.status(400).json({ error: 'Invalid email data provided' });
    return;
  }

  const processEmail = email as ProcessEmail;

  const existing = await Circular.findOne({ emailMessageId: processEmail.messageId });
  if (existing) {
    res.status(409).json({ error: 'Email already imported', circularId: existing._id.toString() });
    return;
  }

  const importUser = await User.findById(req.user!.id);

  // Derive the sender name from the circular's Ref.No / TCE/ code instead of
  // the email sender. Attachment text is extracted inline so Ref.Nos printed
  // on the attached PDF/DOCX are honored here too.
  const extractedTexts: string[] = [];
  const attachmentSubdocs = [];
  for (const att of processEmail.attachments) {
    let extractedText: string | undefined;
    try {
      const result = await textExtractor.extract(att.filePath, att.fileType);
      extractedText = result.text;
      if (extractedText) extractedTexts.push(extractedText);
    } catch (err) {
      logger.warn(`Failed to extract text from attachment ${att.filename} during import:`, err);
    }
    attachmentSubdocs.push({
      filename: att.filename,
      fileType: att.fileType,
      fileSize: att.fileSize,
      filePath: att.filePath,
      extractedText,
    });
  }
  const combinedExtracted = extractedTexts.join('\n\n');
  const senderName = formatRefSenderName(
    extractSenderNameFromRef(
      [processEmail.subject, processEmail.bodyText || '', combinedExtracted].filter(Boolean).join('\n\n')
    )
  );

  const circular = await Circular.create({
    emailMessageId: processEmail.messageId,
    subject: cleanCircularSubject(processEmail.subject, processEmail.attachments?.[0]?.filename),
    senderEmail: processEmail.senderEmail,
    senderName,
    receivedDate: processEmail.receivedDate,
    bodyText: processEmail.bodyText,
    extractedText: combinedExtracted || undefined,
    processingStatus: 'COMPLETED',
    isProcessed: true,
    createdBy: {
      userId: req.user!.id,
      fullName: importUser?.fullName,
      email: req.user!.email,
      role: req.user!.role as 'ADMIN' | 'STUDENT',
    },
    attachments: attachmentSubdocs,
  });

  const populated = await circular.populate('category');
  const obj = populated.toObject();

  res.status(201).json({
    circular: {
      id: obj._id?.toString(),
      ...obj,
    },
  });
});

router.post('/fetch', authorize('ADMIN'), (_req, res) => {
  try {
    const jobId = emailQueue.add({});
    res.json({ success: true, jobId, message: 'Email fetch job queued' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to queue email fetch job' });
  }
});

router.post('/reclassify-all', authorize('ADMIN'), async (_req, res) => {
  const circulars = await Circular.find({ isProcessed: true })
    .select('subject extractedText bodyText')
    .limit(100);

  let queued = 0;
  for (const circular of circulars) {
    classificationQueue.add({
      circularId: circular._id.toString(),
      extractedText: circular.extractedText || '',
      subject: circular.subject,
    });
    queued++;
  }

  res.json({
    queued,
    message: 'Circulars queued for reclassification',
  });
});

router.post('/train', authorize('ADMIN'), async (_req, res) => {
  const result = await classifier.trainFromSamples();
  res.json({ success: true, trained: result.trained, categories: result.categories });
});

router.post('/check-new', authorize('ADMIN'), async (_req, res) => {
  await checkForNewEmails();
  res.json({ success: true, message: 'Mailbox check completed' });
});

router.post('/gmail-sync', authorize('ADMIN'), async (_req, res) => {
  const result = await syncConnectedMailboxes();
  res.json({ success: true, ...result });
});

router.post('/extract/:id', authorize('ADMIN'), async (req: AuthRequest, res) => {
  const circular = await Circular.findById(req.params.id);
  if (!circular) {
    res.status(404).json({ error: 'Circular not found' });
    return;
  }

  for (const attachment of circular.attachments) {
    extractionQueue.add({
      circularId: circular._id.toString(),
      attachmentId: attachment._id ? attachment._id.toString() : '',
      filePath: attachment.filePath,
      fileType: attachment.fileType,
    });
  }

  res.json({
    queued: circular.attachments.length,
    message: 'Extraction jobs queued',
  });
});

export default router;
