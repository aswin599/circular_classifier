import type { Circular } from '../../types';
import Modal from '../ui/Modal';
import { formatDate, getExpiryDisplay } from '../../lib/expiry';
import { IconCalendar, IconClock, IconMail } from '../ui/Icons';
import { getSenderDisplay } from '../../lib/sender';

interface CircularBriefModalProps {
  circular: Circular | null;
  onClose: () => void;
}

export default function CircularBriefModal({ circular, onClose }: CircularBriefModalProps) {
  if (!circular) return null;

  const categoryName = circular.category?.name ?? 'Uncategorized';
  const categoryColor = circular.category?.color ?? '#8B5CF6';
  const expiry = getExpiryDisplay(circular);

  return (
    <Modal isOpen={!!circular} onClose={onClose} title={circular.subject}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
          >
            {categoryName}
          </span>
          {circular.priority && (
            <span className="inline-flex rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
              {circular.priority}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-brand-800/70">
            <IconCalendar className="h-4 w-4 text-brand-300" />
            <div>
              <dt className="text-xs text-brand-400">Received</dt>
              <dd className="font-medium">{formatDate(circular.receivedDate)}</dd>
            </div>
          </div>
          <div className="flex items-center gap-2 text-brand-800/70">
            <IconClock className="h-4 w-4 text-brand-300" />
            <div>
              <dt className="text-xs text-brand-400">Due</dt>
              <dd className="font-medium" style={{ color: circular.expireDate ? expiry.color : undefined }}>
                {circular.expireDate ? expiry.label : 'null'}
              </dd>
            </div>
          </div>
        </dl>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-400">From</p>
          <p className="flex items-center gap-1.5 text-sm text-brand-800/80">
            <IconMail className="h-4 w-4 text-brand-300" />
            {getSenderDisplay(circular).primary}
            {getSenderDisplay(circular).secondary && (
              <span className="text-brand-400">{getSenderDisplay(circular).secondary}</span>
            )}
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-400">
            Brief description
          </p>
          <p className="line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-brand-800/85">
            {circular.bodyText?.trim() ||
              circular.attachments?.[0]?.extractedText?.slice(0, 800) ||
              'No description available for this circular.'}
          </p>
        </div>
      </div>
    </Modal>
  );
}