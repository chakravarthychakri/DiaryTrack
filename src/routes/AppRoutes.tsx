import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';

// Module 19: Performance - Lazy load pages for dynamic code-splitting
const Login = lazy(() => import('../pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('../pages/Register').then(m => ({ default: m.Register })));
const Dashboard = lazy(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Products = lazy(() => import('../pages/Products').then(m => ({ default: m.Products })));
const Inventory = lazy(() => import('../pages/Inventory').then(m => ({ default: m.Inventory })));
const Sales = lazy(() => import('../pages/Sales').then(m => ({ default: m.Sales })));
const Purchases = lazy(() => import('../pages/Purchases').then(m => ({ default: m.Purchases })));
const StockMovements = lazy(() => import('../pages/StockMovements').then(m => ({ default: m.StockMovements })));
const Suppliers = lazy(() => import('../pages/Suppliers').then(m => ({ default: m.Suppliers })));
const Customers = lazy(() => import('../pages/Customers').then(m => ({ default: m.Customers })));
const ExpiryManagement = lazy(() => import('../pages/ExpiryManagement').then(m => ({ default: m.ExpiryManagement })));
const Analytics = lazy(() => import('../pages/Analytics').then(m => ({ default: m.Analytics })));
const Reports = lazy(() => import('../pages/Reports').then(m => ({ default: m.Reports })));
const UserManagement = lazy(() => import('../pages/UserManagement').then(m => ({ default: m.UserManagement })));
const Settings = lazy(() => import('../pages/Settings').then(m => ({ default: m.Settings })));

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[350px] w-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-neutral-600 tracking-wide">Loading DairyTrack module...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected App Routes under Master AppLayout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/stock-movements" element={<StockMovements />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/expiry-management" element={<ExpiryManagement />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Fallback Catch-All */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
