import { useState } from 'react';
import { format } from 'date-fns';
import Badge from '../ui/Badge';
import { useUsers } from '../../hooks/useApi';

export default function UserManagement() {
  const { data: users = [], isLoading } = useUsers();
  const [filter, setFilter] = useState<'ALL' | 'ADMIN' | 'STUDENT'>('ALL');

  const filteredUsers = filter === 'ALL' ? users : users.filter((u) => u.role === filter);

  const filterTabs: Array<'ALL' | 'ADMIN' | 'STUDENT'> = ['ALL', 'ADMIN', 'STUDENT'];

  if (isLoading) {
    return <div className="py-12 text-center text-brand-400">Loading users...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-900">User Management</h1>
        <p className="mt-1 text-sm text-brand-500">
          View the accounts registered in the circular portal
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === tab
                ? 'bg-gradient-to-br from-brand-300 to-brand-500 text-white shadow-brand'
                : 'bg-white border border-brand-100 text-brand-600 hover:bg-brand-50'
            }`}
          >
            {tab === 'ALL' ? 'All Users' : tab.charAt(0) + tab.slice(1).toLowerCase() + 's'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-card">
        <table className="min-w-full divide-y divide-brand-50">
          <thead className="bg-brand-50/60">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-brand-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-brand-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-brand-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-brand-500 uppercase tracking-wider">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50 bg-white">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="transition-colors hover:bg-brand-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-200 to-brand-300 text-brand-700 font-semibold text-sm">
                      {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-900">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-brand-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge color={user.role === 'ADMIN' ? '#8B5CF6' : '#995C60'} size="sm">
                    {user.role === 'ADMIN' ? 'Admin' : 'Student'}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-brand-500">
                  {user.department || '—'}
                </td>
                <td className="px-6 py-4 text-sm text-brand-500">
                  {format(new Date(user.createdAt), 'MMM d, yyyy')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
