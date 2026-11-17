import React, { useState } from 'react';
import { DataTable, Column } from '../components/shared/DataTable';
import { Button } from '../components/shared/Button';
import { SearchBar } from '../components/shared/SearchBar';
import { Modal } from '../components/shared/Modal';
import { FormInput } from '../components/shared/FormInput';
import { Customer } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Plus, Users, Phone, Mail, ShoppingBag, RotateCcw } from 'lucide-react';

export const Customers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: 'cust-1',
      name: 'Sunita Sharma',
      phone: '9876501234',
      email: 'sunita@gmail.com',
      address: 'Flat 402, Green Meadows',
      total_purchases: 8450,
      is_active: true,
      created_at: '2026-08-10',
    },
    {
      id: 'cust-2',
      name: 'Amrut Sweet Shop',
      phone: '9845112233',
      email: 'orders@amrutsweets.com',
      address: 'Shop 12, Main Bazaar',
      total_purchases: 45200,
      is_active: true,
      created_at: '2026-06-01',
    },
    {
      id: 'cust-3',
      name: 'Rohan Mehra',
      phone: '9988776655',
      address: 'House 55, Park View',
      total_purchases: 3200,
      is_active: true,
      created_at: '2026-10-15',
    },
  ]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setModalOpen(true);
  };

  const handleSave = () => {
    if (editingCustomer) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === editingCustomer.id
            ? { ...c, name, phone, email, address }
            : c
        )
      );
    } else {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        name,
        phone,
        email,
        address,
        total_purchases: 0,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setCustomers((prev) => [newCust, ...prev]);
    }
    setModalOpen(false);
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      sortable: true,
      render: (c) => (
        <div>
          <span className="font-semibold text-neutral-900">{c.name}</span>
          <p className="text-xs text-neutral-400">Joined: {formatDate(c.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Contact Info',
      render: (c) => (
        <div className="space-y-0.5 text-xs text-neutral-600">
          <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-neutral-400" /> {c.phone}</p>
          {c.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-neutral-400" /> {c.email}</p>}
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Delivery Address',
      render: (c) => <span className="text-xs text-neutral-600">{c.address || '-'}</span>,
    },
    {
      key: 'total_purchases',
      header: 'Lifetime Purchases',
      sortable: true,
      render: (c) => (
        <span className="font-bold text-emerald-700">{formatCurrency(c.total_purchases || 0)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => alert(`Customer Sales History for ${c.name}:\nTotal: ₹${c.total_purchases}`)}
            title="View History"
          >
            <ShoppingBag className="w-4 h-4 text-neutral-600" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingCustomer(c);
              setName(c.name);
              setPhone(c.phone);
              setEmail(c.email || '');
              setAddress(c.address || '');
              setModalOpen(true);
            }}
            className="text-xs"
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Customer Management</h1>
          <p className="text-xs text-neutral-500">Track regular retail clients, wholesale bulk accounts, and credit limits</p>
        </div>

        <Button variant="primary" onClick={handleOpenAdd} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> Add Customer
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search customers..." />
        </div>
      </div>

      <DataTable columns={columns} data={customers} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Register Customer'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Save</Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <FormInput label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Sunita Sharma" />
          <FormInput label="Mobile Number" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="9876543210" />
          <FormInput label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sunita@example.com" />
          <FormInput label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Apartment / Shop address" />
        </div>
      </Modal>
    </div>
  );
};
