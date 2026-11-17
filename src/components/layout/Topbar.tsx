import React from 'react';
import { Menu, PlusCircle, LogOut, User as UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { NotificationCenter } from '../shared/NotificationCenter';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { User, NotificationItem } from '../../types';

export interface TopbarProps {
  onToggleSidebar?: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  notifications?: NotificationItem[];
  unreadNotificationsCount?: number;
  onMarkAllNotificationsRead?: () => void;
  onMarkNotificationRead?: (id: string | number) => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onToggleSidebar,
  currentUser,
  onLogout,
  notifications = [],
  unreadNotificationsCount = 0,
  onMarkAllNotificationsRead = () => {},
  onMarkNotificationRead = () => {},
}) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-30 shrink-0">
      {/* Left: Mobile hamburger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 pr-4 border-r border-slate-200">
          <img
            src="/images/logo.png"
            alt="DiaryTrack Logo"
            className="w-9 h-9 rounded-lg object-cover object-[50%_18%] border border-emerald-200 shadow-2xs bg-white shrink-0"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">DiaryTrack</span>
            <span className="text-[10px] font-bold text-emerald-700">Milk . Curd . Diary Delights</span>
          </div>
        </div>
      </div>

      {/* Right: Actions, Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* Quick Sale / POS Button */}
        <Link to="/sales">
          <Button
            size="sm"
            variant="primary"
            icon={<PlusCircle className="w-4 h-4" />}
            className="hidden sm:inline-flex"
          >
            <span>POS Billing</span>
          </Button>
        </Link>

        {/* Notifications */}
        <NotificationCenter
          notifications={notifications}
          unreadCount={unreadNotificationsCount}
          onMarkAllRead={onMarkAllNotificationsRead}
          onMarkRead={onMarkNotificationRead}
        />

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>

          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-tight">
              {currentUser?.name || 'Store Administrator'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="success" className="text-[10px] py-0 px-1.5">
                {currentUser?.role || 'Admin'}
              </Badge>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 ml-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
