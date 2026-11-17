import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { User, NotificationItem } from '../../types';

export interface AppLayoutProps {
  currentUser?: User | null;
  onLogout?: () => void;
  notifications?: NotificationItem[];
  unreadNotificationsCount?: number;
  onMarkAllNotificationsRead?: () => void;
  onMarkNotificationRead?: (id: string | number) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentUser,
  onLogout,
  notifications = [],
  unreadNotificationsCount = 0,
  onMarkAllNotificationsRead = () => {},
  onMarkNotificationRead = () => {},
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          currentUser={currentUser}
          onLogout={onLogout}
          notifications={notifications}
          unreadNotificationsCount={unreadNotificationsCount}
          onMarkAllNotificationsRead={onMarkAllNotificationsRead}
          onMarkNotificationRead={onMarkNotificationRead}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
