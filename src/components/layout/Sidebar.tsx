import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  ArrowLeftRight,
  Users2,
  UserCheck,
  AlertOctagon,
  LineChart,
  FileSpreadsheet,
  ShieldCheck,
  Settings,
  Store,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export const Sidebar: React.FC<{ isOpen?: boolean; onClose?: () => void }> = ({
  isOpen = true,
  onClose,
}) => {
  const sections: { title?: string; items: NavItem[] }[] = [
    {
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { name: 'Products Master', path: '/products', icon: <Package className="w-4 h-4" /> },
        { name: 'Inventory & Batches', path: '/inventory', icon: <Boxes className="w-4 h-4" /> },
        { name: 'Sales & POS', path: '/sales', icon: <ShoppingCart className="w-4 h-4" /> },
        { name: 'Purchases (PO)', path: '/purchases', icon: <Truck className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Stock Movements', path: '/movements', icon: <ArrowLeftRight className="w-4 h-4" /> },
        { name: 'Suppliers', path: '/suppliers', icon: <Users2 className="w-4 h-4" /> },
        { name: 'Customers', path: '/customers', icon: <UserCheck className="w-4 h-4" /> },
        { name: 'Expiry & Wastage', path: '/expiry', icon: <AlertOctagon className="w-4 h-4 text-amber-500" /> },
      ],
    },
    {
      title: 'Reports & BI',
      items: [
        { name: 'Analytics & P&L', path: '/analytics', icon: <LineChart className="w-4 h-4" /> },
        { name: 'Excel & PDF Reports', path: '/reports', icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> },
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'User Management', path: '/users', icon: <ShieldCheck className="w-4 h-4" /> },
        { name: 'Store Settings', path: '/settings', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 z-40 transition-transform duration-200 ease-in-out md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-100 bg-slate-50/50">
        <img
          src="/images/logo.png"
          alt="DiaryTrack Logo"
          className="w-10 h-10 rounded-xl object-cover object-[50%_18%] border border-emerald-200 shadow-xs shrink-0 bg-white"
        />
        <div className="min-w-0">
          <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
            DiaryTrack
            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">2.0</span>
          </h1>
          <p className="text-[10px] text-emerald-700 font-bold truncate">Milk . Curd . Diary Delights</p>
        </div>
      </div>

      {/* Current Branch Badge */}
      <div className="mx-3 mt-3 px-3 py-2 bg-emerald-50/60 border border-emerald-100 rounded-lg flex items-center gap-2">
        <Store className="w-4 h-4 text-emerald-700 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase font-bold text-emerald-800">Active Branch</p>
          <p className="text-xs font-semibold text-emerald-950 truncate">Central Dairy Store</p>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.title && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            <nav className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                      isActive
                        ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600')}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
        DairyTrack System v2.0 • Online
      </div>
    </aside>
  );
};
