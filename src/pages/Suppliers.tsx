import React, { useState } from 'react';
import { DataTable, Column } from '../components/shared/DataTable';
import { Button } from '../components/shared/Button';
import { SearchBar } from '../components/shared/SearchBar';
import { Modal } from '../components/shared/Modal';
import { FormInput } from '../components/shared/FormInput';
import { Supplier } from '../types';
import { formatCurrency } from '../utils/formatters';
import { Plus, Truck, Phone, Mail, MapPin } from 'lucide-react';

export const Suppliers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([
    {
      id: 'sup-1',
      name: 'Krishna Dairy Farm',
      contact_person: 'Gopal Yadav',
      phone: '9845012345',
      email: 'krishna.farm@dairy.in',
      address: 'Plot 42, Anand Dairy Belt, Gujarat',
      outstanding_balance: 12500,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sup-2',
      name: 'Gokul Milk Producers Union',
      contact_person: 'Suresh Patil',
      phone: '9822098765',
      email: 'orders@gokulmilk.org',
      address: 'MIDC Dairy Zone, Kolhapur',
      outstanding_balance: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'sup-3',
      name: 'Amrit Agro Feeds & Ghee',
      contact_person: 'Vikram Singh',
      phone: '9811223344',
      email: 'amrit@dairyfeed.com',
      address: 'Sector 14, Karnal, Haryana',
      outstanding_balance: 4200,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setModalOpen(true);
  };

  const handleSave = () => {
    if (editingSupplier) {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === editingSupplier.id
            ? { ...s, name, contact_person: contactPerson, phone, email, address }
            : s
        )
      );
    } else {
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        name,
        contact_person: contactPerson,
        phone,
        email,
        address,
        outstanding_balance: 0,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setSuppliers((prev) => [newSup, ...prev]);
    }
    setModalOpen(false);
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier / Dairy Producer',
      sortable: true,
      render: (s) => (
        <div>
          <span className="font-semibold text-neutral-900">{s.name}</span>
          <p className="text-xs text-neutral-500">Contact: {s.contact_person || 'Representative'}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Contact Info',
      render: (s) => (
        <div className="space-y-0.5 text-xs text-neutral-600">
          <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-neutral-400" /> {s.phone}</p>
          {s.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-neutral-400" /> {s.email}</p>}
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Location / Farm Hub',
      render: (s) => (
        <span className="text-xs text-neutral-600 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          {s.address || '-'}
        </span>
      ),
    },
    {
      key: 'outstanding_balance',
      header: 'Outstanding Dues',
      sortable: true,
      render: (s) => (
        <span className={`font-semibold ${s.outstanding_balance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
          {formatCurrency(s.outstanding_balance)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingSupplier(s);
            setName(s.name);
            setContactPerson(s.contact_person || '');
            setPhone(s.phone);
            setEmail(s.email || '');
            setAddress(s.address || '');
            setModalOpen(true);
          }}
          className="text-xs"
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Dairy Suppliers & Vendors</h1>
          <p className="text-xs text-neutral-500">Manage milk unions, local farmers, procurement pricing, and payable balances</p>
        </div>

        <Button variant="primary" onClick={handleOpenAdd} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> Add Supplier
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search suppliers..." />
        </div>
      </div>

      <DataTable columns={columns} data={suppliers} />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Register New Dairy Supplier'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Save Supplier</Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <FormInput label="Supplier / Farm Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Krishna Dairy Farm" />
          <FormInput label="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="e.g. Gopal Yadav" />
          <FormInput label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="9845012345" />
          <FormInput label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="farm@dairy.in" />
          <FormInput label="Address / Farm Center" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Plot 42, Anand Dairy Belt" />
        </div>
      </Modal>
    </div>
  );
};
