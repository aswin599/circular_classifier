import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useCircular, useDeleteCircular, useUpdateCircular, useCategories } from '../hooks/useApi';
import { useAuth } from '../contexts/authContext';
import { getErrorMessage } from '../lib/api';
import { getExpiryDisplay } from '../lib/expiry';
import { getSenderDisplay } from '../lib/sender';
import ImageGallery from '../components/circulars/ImageGallery';
import { IconCalendar, IconClock, IconChevronLeft } from '../components/ui/Icons';
import type { Priority } from '../types';

const priorityColors: Record<string, string> = {
  LOW: '#6B7280',
  NORMAL: '#995C60',
  HIGH: '#B67D80',
  URGENT: '#B3261E',
};

const statusColors: Record<string, string> = {
  PENDING: '#9CA3AF',
  PROCESSING: '#995C60',
  COMPLETED: '#3E7A4F',
  FAILED: '#B3261E',
};

const dateTypeColors: Record<string, string> = {
  fee_without_fine: '#3E7A4F',
  fee_with_fine: '#B67D80',
  exam_date: '#6C4BB3',
  submission_deadline: '#995C60',
  commencement: '#7BA8A5',
  expiry: '#B3261E',
};

function getDateTypeColor(dateType?: string): string {
  return dateTypeColors[dateType ?? ''] ?? '#995C60';
}

export default function CircularDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [isEditing, setIsEditing] = useState(false);

  const { data: circular, isLoading } = useCircular(id);
  const { data: categories = [] } = useCategories();
  const deleteCircular = useDeleteCircular();
  const updateCircular = useUpdateCircular();

  const [editForm, setEditForm] = useState({
    categoryId: '',
    priority: '' as Priority | '',
    tags: '',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
      </div>
    );
  }

  if (!circular) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <h1 className="text-2xl font-bold text-brand-900">Circular not found</h1>
        <Link to="/" className="mt-4 inline-block text-brand-600 hover:text-brand-700">
          Back to inbox
        </Link>
      </div>
    );
  }

  const startEdit = () => {
    setEditForm({
      categoryId: circular.categoryId?.toString() || '',
      priority: circular.priority,
      tags: circular.tags.join(', '),
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateCircular.mutateAsync({
        id: circular.id,
        data: {
          categoryId: editForm.categoryId ? parseInt(editForm.categoryId, 10) : null,
          priority: editForm.priority,
          tags: editForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        },
      });
      toast.success('Circular updated');
      setIsEditing(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this circular? This cannot be undone.')) return;
    try {
      await deleteCircular.mutateAsync(circular.id);
      toast.success('Circular deleted');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const inputClasses =
    'w-full px-3 py-2 border border-brand-200 rounded-lg bg-white text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
          <IconChevronLeft className="h-4 w-4" />
          Back to inbox
        </Link>
        <div className="flex gap-2">
          {isAdmin && !isEditing && (
            <>
              <Button variant="secondary" onClick={startEdit}>
                Edit
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="animate-fade-in-up card-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-brand-900">{circular.subject}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-brand-500">
              <span>From: {getSenderDisplay(circular).primary}</span>
              <span className="text-brand-200">|</span>
              <span className="flex items-center gap-1">
                <IconCalendar className="h-4 w-4 text-brand-300" />
                {format(new Date(circular.receivedDate), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            {getSenderDisplay(circular).secondary && (
              <div className="mt-1 text-sm text-brand-400">{getSenderDisplay(circular).secondary}</div>
            )}
          </div>
          <Badge color={priorityColors[circular.priority]} size="md">
            {circular.priority}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {circular.category && (
            <Badge color={circular.category.color}>{circular.category.name}</Badge>
          )}
          <Badge color={statusColors[circular.processingStatus]}>{circular.processingStatus}</Badge>
          {circular.tags.map((tag) => (
            <Badge key={tag} color="#6B7280" size="sm">
              #{tag}
            </Badge>
          ))}
        </div>

        {circular.expireDate && (
          <div className="mt-5 rounded-lg border border-brand-100 bg-brand-50 p-4">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${getExpiryDisplay(circular).color}20`, color: getExpiryDisplay(circular).color }}
              >
                <IconClock className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: getExpiryDisplay(circular).color }}>
                  {getExpiryDisplay(circular).label}
                </p>
                {circular.expirySource && (
                  <p className="mt-1 text-xs text-brand-500">
                    "{circular.expirySource}"
                    {circular.expiryConfidence !== undefined && (
                      <span className="ml-2">Confidence: {Math.round(circular.expiryConfidence)}%</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {circular.importantDates && circular.importantDates.length > 0 ? (
          <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-brand-900">
                <IconCalendar className="h-5 w-5 text-brand-400" />
                Important Dates & Deadlines ({circular.importantDates.length})
              </h3>
              <span className="text-xs text-brand-400">
                Extracted from circular and attachments
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {circular.importantDates.map((item, idx) => {
                const target = new Date(item.date);
                const now = new Date();
                const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
                const daysDiff = Math.round((startTarget - startToday) / (24 * 60 * 60 * 1000));
                const color = getDateTypeColor(item.dateType);

                let statusBadge = { label: `In ${daysDiff} days`, color: '#3E7A4F' };
                if (daysDiff < 0) {
                  statusBadge = { label: `Expired ${Math.abs(daysDiff)}d ago`, color: '#B3261E' };
                } else if (daysDiff === 0) {
                  statusBadge = { label: 'Due Today', color: '#B3261E' };
                } else if (daysDiff <= 3) {
                  statusBadge = { label: `Due in ${daysDiff} days`, color: '#B67D80' };
                }

                return (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-xl border border-brand-100 bg-white p-4 shadow-card"
                  >
                    <div>
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-800">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${color}20`, color }}
                          >
                            <IconCalendar className="h-3.5 w-3.5" />
                          </span>
                          {item.title}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: `${statusBadge.color}18`, color: statusBadge.color }}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      <p className="mt-1 text-base font-bold text-brand-900">
                        {format(target, 'EEEE, MMMM d, yyyy')}
                      </p>
                    </div>

                    {item.rawText && (
                      <p className="mt-2 line-clamp-2 rounded bg-brand-50 p-2 text-xs italic text-brand-500">
                        "{item.rawText}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : circular.lastDateWithoutFine || circular.lastDateWithFine ? (
          <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900">
              <IconCalendar className="h-4 w-4 text-brand-400" />
              Fee Payment Deadlines
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {circular.lastDateWithoutFine && (
                <div className="rounded-lg border border-brand-100 bg-white p-3 shadow-card">
                  <span className="block text-xs font-semibold text-brand-600">
                    Last Date Without Fine
                  </span>
                  <span className="mt-1 block text-sm font-bold text-brand-900">
                    {format(new Date(circular.lastDateWithoutFine), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
              )}
              {circular.lastDateWithFine && (
                <div className="rounded-lg border border-brand-100 bg-white p-3 shadow-card">
                  <span className="block text-xs font-semibold text-brand-600">
                    Last Date With Fine
                  </span>
                  <span className="mt-1 block text-sm font-bold text-brand-900">
                    {format(new Date(circular.lastDateWithFine), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {isAdmin && isEditing && (
          <div className="mt-6 space-y-4 rounded-lg border border-brand-100 bg-brand-50/60 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-brand-700">
                  Category
                </label>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className={inputClasses}
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-brand-700">
                  Priority
                </label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as Priority })}
                  className={inputClasses}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-700">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                className={inputClasses}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={updateCircular.isPending}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      {circular.images && circular.images.length > 0 && (
        <ImageGallery images={circular.images} />
      )}

      {(circular.extractedText || circular.bodyText) && (
        <div className="card-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-brand-900">Content</h2>
          <div className="space-y-4">
            {circular.bodyText && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-400">
                  Email Body
                </h3>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-brand-800/85">
                  {circular.bodyText}
                </div>
              </div>
            )}
            {circular.extractedText && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-400">
                  Extracted from Attachments
                </h3>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-brand-800/85">
                  {circular.extractedText}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}