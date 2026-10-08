export interface ExpiryInfo {
  expireDate?: string;
  expirySource?: string;
}

export type ExpiryStatus =
  | 'expired'
  | 'expiring_today'
  | 'expiring_soon'
  | 'valid'
  | 'none';

export interface ExpiryDisplay {
  status: ExpiryStatus;
  label: string;
  daysLeft: number | null;
  color: string;
}

export function getExpiryDisplay(circular: ExpiryInfo): ExpiryDisplay {
  if (!circular.expireDate) {
    return { status: 'none', label: 'No expiry', daysLeft: null, color: '#9CA3AF' };
  }

  const expire = new Date(circular.expireDate);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfExpire = new Date(expire.getFullYear(), expire.getMonth(), expire.getDate());
  const diffMs = startOfExpire.getTime() - startOfToday.getTime();
  const daysLeft = Math.round(diffMs / (24 * 60 * 60 * 1000));

  const formattedDate = formatExpiryDate(circular.expireDate);

  if (daysLeft < 0) {
    return {
      status: 'expired',
      label: `Expired ${Math.abs(daysLeft)}d ago (${formattedDate})`,
      daysLeft,
      color: '#EF4444',
    };
  }

  if (daysLeft === 0) {
    return {
      status: 'expiring_today',
      label: `Expires today (${formattedDate})`,
      daysLeft,
      color: '#EF4444',
    };
  }

  if (daysLeft <= 3) {
    return {
      status: 'expiring_soon',
      label: `Expires in ${daysLeft}d (${formattedDate})`,
      daysLeft,
      color: '#F59E0B',
    };
  }

  return {
    status: 'valid',
    label: `Valid until ${formattedDate} (${daysLeft}d left)`,
    daysLeft,
    color: '#10B981',
  };
}

export function formatExpiryDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}