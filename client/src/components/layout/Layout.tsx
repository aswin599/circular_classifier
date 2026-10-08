import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/authContext';
import { useEndingTodayCount } from '../../hooks/useApi';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import NewCircularNotification from './NewCircularNotification';
import {
  IconDashboard,
  IconSearch,
  IconTag,
  IconUser,
  IconLogout,
  IconMail,
  IconShield,
  IconClock,
  IconBell,
} from '../ui/Icons';

export default function Layout() {
  const { user, logout } = useAuth();
  const { status, subscribed, enable, disable } = usePushNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const { data: endingTodayCount = 0 } = useEndingTodayCount();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleNotifications = async () => {
    if (subscribed) {
      await disable();
    } else {
      await enable();
    }
  };

  const notificationsSupported = status !== 'unsupported';

  const isEndingTodayActive = location.pathname === '/' && location.search.includes('endingToday=true');
  const isDashboardActive = location.pathname === '/' && !location.search.includes('endingToday=true');
  const isSearchActive = location.pathname.startsWith('/search');

  const navLinkClass = (active: boolean) =>
    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
      active
        ? 'bg-brand-600 text-white shadow-sm'
        : 'text-brand-800/80 hover:bg-brand-100/70 hover:text-brand-900'
    }`;

  return (
    <div className="min-h-screen bg-brand-50/50">
      <NewCircularNotification />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-brand-100 shadow-card">
        <div className="flex flex-col h-full">
          {/* Brand header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-brand-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-md">
              <IconMail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-brand-950 tracking-tight">Circular Hub</h1>
              <p className="text-[11px] font-medium text-brand-400">Institutional Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3.5 py-4 space-y-1.5 overflow-y-auto">
            {/* Dashboard */}
            <Link to="/" className={navLinkClass(isDashboardActive)}>
              <div className="flex items-center gap-3">
                <IconDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </div>
            </Link>

            {/* Ending Today (Requirement 9) */}
            <Link to="/?endingToday=true" className={navLinkClass(isEndingTodayActive)}>
              <div className="flex items-center gap-3">
                <IconClock className="h-4 w-4" />
                <span>Ending Today</span>
              </div>
              {endingTodayCount > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    isEndingTodayActive
                      ? 'bg-white text-brand-700'
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}
                >
                  {endingTodayCount}
                </span>
              )}
            </Link>

            {/* Search */}
            <Link to="/search" className={navLinkClass(isSearchActive)}>
              <div className="flex items-center gap-3">
                <IconSearch className="h-4 w-4" />
                <span>Search Circulars</span>
              </div>
            </Link>

            {/* Admin Management Section */}
            {isAdmin && (
              <div className="pt-5">
                <p className="px-3 pb-2 text-[11px] font-bold text-brand-400 uppercase tracking-wider">
                  Administration
                </p>
                <div className="space-y-1">
                  <Link
                    to="/admin/categories"
                    className={navLinkClass(location.pathname.startsWith('/admin/categories'))}
                  >
                    <div className="flex items-center gap-3">
                      <IconTag className="h-4 w-4" />
                      <span>Categories</span>
                    </div>
                  </Link>
                  <Link
                    to="/admin/users"
                    className={navLinkClass(location.pathname.startsWith('/admin/users'))}
                  >
                    <div className="flex items-center gap-3">
                      <IconUser className="h-4 w-4" />
                      <span>Users</span>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </nav>

          {/* User Profile info */}
          <div className="px-4 py-4 border-t border-brand-100 bg-brand-50/40">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 font-bold text-sm border border-brand-200">
                {user?.fullName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-brand-900 truncate">{user?.fullName}</p>
                <p className="flex items-center gap-1 text-[11px] text-brand-500 truncate">
                  {isAdmin && <IconShield className="h-3 w-3 text-brand-600" />}
                  {isAdmin ? 'Administrator' : 'Student'}
                </p>
              </div>
              <button
                onClick={toggleNotifications}
                title={subscribed ? 'Deadline reminders enabled' : 'Enable deadline reminders'}
                disabled={!notificationsSupported}
                className={`p-1.5 rounded-lg transition-colors ${
                  subscribed
                    ? 'text-brand-600 hover:text-brand-800 hover:bg-brand-100'
                    : 'text-brand-400 hover:text-brand-700 hover:bg-brand-100 disabled:opacity-40'
                }`}
              >
                <IconBell className="h-4 w-4" />
              </button>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 rounded-lg text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition-colors"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content view */}
      <main className="pl-64">
        <div className="px-8 py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}