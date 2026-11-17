import React, { useState } from 'react';
import { DataTable, Column } from '../components/shared/DataTable';
import { Badge } from '../components/shared/Badge';
import { Button } from '../components/shared/Button';
import { Modal } from '../components/shared/Modal';
import { FormInput } from '../components/shared/FormInput';
import { SearchBar } from '../components/shared/SearchBar';
import { User, UserRole } from '../types';
import { formatDate } from '../utils/formatters';
import { Shield, UserPlus, Mail, Phone, Lock } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');

  const [users, setUsers] = useState<User[]>([
    {
      id: 'u-1',
      email: 'owner@dairytrack.com',
      full_name: 'Ramesh Patel',
      role: 'shop_owner',
      phone: '9845001122',
      is_active: true,
      created_at: '2026-01-10',
    },
    {
      id: 'u-2',
      email: 'manager@dairytrack.com',
      full_name: 'Anjali Sharma',
      role: 'shop_manager',
      phone: '9845003344',
      is_active: true,
      created_at: '2026-02-15',
    },
    {
      id: 'u-3',
      email: 'cashier1@dairytrack.com',
      full_name: 'Vikram Jadhav',
      role: 'cashier',
      phone: '9845005566',
      is_active: true,
      created_at: '2026-03-01',
    },
  ]);

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'super_admin':
        return <Badge variant="danger">Super Admin</Badge>;
      case 'shop_owner':
        return <Badge variant="primary">Shop Owner</Badge>;
      case 'shop_manager':
        return <Badge variant="info">Store Manager</Badge>;
      case 'cashier':
        return <Badge variant="success">Cashier / Staff</Badge>;
      default:
        return <Badge variant="neutral">{r}</Badge>;
    }
  };

  const handleAddUser = () => {
    const newUser: User = {
      id: `u-${Date.now()}`,
      email,
      full_name: fullName,
      phone,
      role,
      is_active: true,
      created_at: new Date().toISOString().slice(0, 10),
    };
    setUsers((prev) => [newUser, ...prev]);
    setModalOpen(false);
    setFullName('');
    setEmail('');
    setPhone('');
  };

  const columns: Column<User>[] = [
    {
      key: 'full_name',
      header: 'Staff Member',
      sortable: true,
      render: (u) => (
        <div>
          <span className="font-semibold text-neutral-900">{u.full_name}</span>
          <p className="text-xs text-neutral-400">Created: {formatDate(u.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contact Credentials',
      render: (u) => (
        <div className="space-y-0.5 text-xs text-neutral-600">
          <p className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-neutral-400" /> {u.email}</p>
          {u.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-neutral-400" /> {u.phone}</p>}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (u) => getRoleBadge(u.role),
    },
    {
      key: 'is_active',
      header: 'Access Status',
      render: (u) => (
        <Badge variant={u.is_active ? 'success' : 'neutral'} size="sm">
          {u.is_active ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (u) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setUsers((prev) =>
              prev.map((item) => (item.id === u.id ? { ...item, is_active: !item.is_active } : item))
            );
          }}
          className="text-xs"
        >
          {u.is_active ? 'Revoke' : 'Reactivate'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            User Management & Permissions
          </h1>
          <p className="text-xs text-neutral-500">Configure role-based access control (RBAC) across cashiers and managers</p>
        </div>

        <Button variant="primary" onClick={() => setModalOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          <UserPlus className="w-4 h-4" /> Add Staff Member
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search staff members..." />
        </div>
      </div>

      <DataTable columns={columns} data={users} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Staff Member"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddUser}>Create Account</Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <FormInput label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Vikram Jadhav" />
          <FormInput label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="cashier@dairytrack.com" />
          <FormInput label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9845001234" />
          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-1.5">
              Role & Permissions
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full text-sm rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="cashier">Cashier (POS & Sales only)</option>
              <option value="shop_manager">Store Manager (Products, Stock & Reports)</option>
              <option value="shop_owner">Shop Owner (Full Access + P&L)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
