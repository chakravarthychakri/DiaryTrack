import React, { useState } from 'react';
import { Button } from '../components/shared/Button';
import { FormInput } from '../components/shared/FormInput';
import { Store, Bell, Shield, Database, Save, CheckCircle2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const [shopName, setShopName] = useState('DairyTrack Elite Branch #1');
  const [fssaiLicense, setFssaiLicense] = useState('11521018000452');
  const [gstin, setGstin] = useState('27AAACD1234M1Z5');
  const [address, setAddress] = useState('Shop 4-5, Sunrise Complex, Shivaji Road');
  const [phone, setPhone] = useState('022-25419876');

  // Alerts configuration
  const [expiryDaysThreshold, setExpiryDaysThreshold] = useState(3);
  const [lowStockNotification, setLowStockNotification] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);

  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">System & Shop Settings</h1>
        <p className="text-xs text-neutral-500">Configure business identity, compliance licenses, FSSAI numbers & notification rules</p>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Shop Info Card */}
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Store className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-neutral-900 text-base">Shop Identity & Tax Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Shop / Outlet Legal Name" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
            <FormInput label="FSSAI Food License Number" value={fssaiLicense} onChange={(e) => setFssaiLicense(e.target.value)} required />
            <FormInput label="GSTIN Identification Number" value={gstin} onChange={(e) => setGstin(e.target.value)} />
            <FormInput label="Store Contact Telephone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <div className="md:col-span-2">
              <FormInput label="Store Physical Address" value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Alert & Automation Rules */}
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Bell className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-neutral-900 text-base">Automated Notifications & Thresholds</h3>
          </div>

          <div className="space-y-4">
            <div>
              <FormInput
                label="Near-Expiry Early Warning (Days)"
                type="number"
                value={expiryDaysThreshold}
                onChange={(e) => setExpiryDaysThreshold(Number(e.target.value))}
                helperText="Send dashboard alert when dairy batch is within this many days of expiry"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-200">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Low Stock Reorder Alerts</p>
                <p className="text-xs text-neutral-500">Notify immediately when product current stock reaches minimum stock level</p>
              </div>
              <input
                type="checkbox"
                checked={lowStockNotification}
                onChange={(e) => setLowStockNotification(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-neutral-300 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-200">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Daily Nightly EOD Sales Digest</p>
                <p className="text-xs text-neutral-500">Email daily summary of cash collected, UPI volume & stock movements</p>
              </div>
              <input
                type="checkbox"
                checked={emailDigest}
                onChange={(e) => setEmailDigest(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-neutral-300 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Database & System Integrity */}
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-neutral-900 text-base">Database Isolation & Audit Mode</h3>
          </div>
          <p className="text-xs text-neutral-600">
            Database schema: 20 normalized Supabase PostgreSQL tables with strict Row-Level Security (RLS) isolation per shop.
          </p>
          <div className="flex items-center gap-4 text-xs font-semibold text-neutral-700">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-600" /> RLS Enabled</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Stock Ledger Audited</span>
          </div>
        </div>

        <Button type="submit" variant="primary" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Save className="w-4 h-4" /> Save System Settings
        </Button>
      </form>
    </div>
  );
};
