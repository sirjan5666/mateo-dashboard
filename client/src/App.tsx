import { lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { HeartPulse, MessageSquare } from 'lucide-react';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/context';
import { AppShell } from './components/layout/AppShell';
import { PanelShell } from './components/layout/PanelShell';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import type { PanelNavItem } from './components/layout/PanelShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Subscribe from './pages/Subscribe';
import { RequireSubscribed } from './components/subscription/RequireSubscribed';
import BabyForm from './pages/BabyForm';
import BabyOnboarding from './pages/BabyOnboarding';
import Vaccines from './pages/Vaccines';
import Skin from './pages/Skin';
import Food from './pages/Food';
import Sleep from './pages/Sleep';
import Medicines from './pages/Medicines';
import Milestones from './pages/Milestones';
import Health from './pages/Health';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import FindDoctor from './pages/FindDoctor';
import MyConsultations from './pages/MyConsultations';
import ConsultationDetail from './pages/ConsultationDetail';
import ReferEarn from './pages/ReferEarn';
import Community from './pages/Community';
import Report from './pages/Report';
import DoctorDashboard from './pages/doctor/Dashboard';
import LocationsManagement from './pages/doctor/LocationsManagement';
import TeamAndRoles from './pages/doctor/TeamAndRoles';
import CreateSubUser from './pages/doctor/CreateSubUser';
import PatientsList from './pages/doctor/PatientsList';
import PatientWorkspace from './pages/doctor/PatientWorkspace';
import PrescriptionsPage from './pages/doctor/PrescriptionsPage';
import PrescriptionPrint from './pages/doctor/PrescriptionPrint';
import ConsultationDetails from './pages/doctor/ConsultationDetails';
import RegisterNewPatient from './pages/doctor/RegisterNewPatient';
import SettingsPage from './pages/doctor/SettingsPage';
import AuditLogs from './pages/doctor/AuditLogs';
import EmailLogs from './pages/doctor/EmailLogs';
import PharmacyInventory from './pages/pharmacy/Inventory';
import NewPurchaseEntry from './pages/pharmacy/NewPurchaseEntry';
import NewBill from './pages/pharmacy/NewBill';
import BillSuccess from './pages/pharmacy/BillSuccess';
import DoctorProfileForm from './pages/doctor/DoctorProfileForm';
import ReportsAnalytics from './pages/doctor/ReportsAnalytics';
import BillingInvoices from './pages/doctor/BillingInvoices';
import AppointmentsPage from './pages/doctor/AppointmentsPage';
import BookAppointment from './pages/doctor/BookAppointment';
import DoctorMessages from './pages/doctor/Messages';
import MyHealth from './pages/portal/MyHealth';
import MyMessages from './pages/portal/MyMessages';
import AdminHome from './pages/admin/AdminHome';
import ManageParents from './pages/admin/AdminParents';
import ManageDoctors from './pages/admin/AdminDoctors';
import AdminChats from './pages/admin/AdminChats';
import Shop from './pages/shop/Shop';
import BrandCategories from './pages/shop/BrandCategories';
import ProductGrid from './pages/shop/ProductGrid';
import ProductDetail from './pages/shop/ProductDetail';
import Rewards from './pages/Rewards';
import Cart from './pages/shop/Cart';
import Checkout from './pages/shop/Checkout';
import MyOrders from './pages/shop/MyOrders';
import OrderDetail from './pages/shop/OrderDetail';
import AdminOrders from './pages/shop/AdminOrders';
import { getDoctorNotifications, getPortalNotifications } from './api/notifications';
import { CartProvider } from './shop/CartProvider';
import { CartDrawer } from './components/shop/CartDrawer';
import { CartToast } from './components/shop/CartToast';
import { SmoothScroll } from './components/SmoothScroll';
import { CommandPalette } from './components/doctor/CommandPalette';
import { DoctorShell } from './components/doctor/v2/DoctorShell';
// Growth pulls in recharts (~350 kB) — code-split so it stays out of the initial bundle.
const Growth = lazy(() => import('./pages/Growth'));

// The doctor panel's navigation now lives inside DoctorShell (Clinic OS rebuild).
// PanelShell + PanelNavItem still serve the Patient portal below, unchanged.
const PORTAL_NAV: PanelNavItem[] = [
  { to: '/portal', label: 'My Health', icon: HeartPulse, end: true },
  { to: '/portal/messages', label: 'Messages', icon: MessageSquare },
];

// One backend, role-based. Doctors get their own panel. Admin uses the same app
// shell as parents (Dashboard + trackers + assistant) PLUS user-management pages
// (Parents / Doctors) and the ability to switch into any user they create.
function AppRoutes() {
  const { user, loading } = useAuth();
  const role = user?.role;
  const [doctorUnread, setDoctorUnread] = useState(0);
  const [patientUnread, setPatientUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (role === 'doctor') {
      getDoctorNotifications()
        .then((d) => !cancelled && setDoctorUnread(d.messages.total))
        .catch(() => undefined);
    } else if (role === 'patient') {
      getPortalNotifications()
        .then((d) => !cancelled && setPatientUnread(d.messages.total))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-stone-500">Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user.role === 'doctor') {
    return (
      <Routes>
        <Route element={<DoctorShell unread={doctorUnread} globals={<CommandPalette />} />}>
          <Route path="/doctor" element={<DoctorDashboard />} />
          <Route path="/doctor/patients" element={<PatientsList />} />
          <Route path="/doctor/patients/new" element={<RegisterNewPatient />} />
          <Route path="/doctor/patients/:id" element={<PatientWorkspace />} />
          <Route path="/doctor/appointments" element={<AppointmentsPage />} />
          <Route path="/doctor/appointments/new" element={<BookAppointment />} />
          <Route path="/doctor/messages" element={<DoctorMessages />} />
          <Route path="/doctor/analytics" element={<ReportsAnalytics />} />
          <Route path="/doctor/reports" element={<ReportsAnalytics />} />
          <Route path="/doctor/profile" element={<DoctorProfileForm />} />
          <Route path="/doctor/settings" element={<SettingsPage />} />
          <Route path="/doctor/prescriptions" element={<PrescriptionsPage />} />
          <Route path="/doctor/prescriptions/:id" element={<PrescriptionPrint />} />
          <Route path="/doctor/consultations/:id" element={<ConsultationDetails />} />
          <Route path="/doctor/charts" element={<ReportsAnalytics />} />
          <Route path="/doctor/pharmacy" element={<PharmacyInventory />} />
          <Route path="/doctor/pharmacy/purchase" element={<NewPurchaseEntry />} />
          <Route path="/doctor/pharmacy/billing" element={<NewBill />} />
          <Route path="/doctor/pharmacy/billing/success" element={<BillSuccess />} />
          <Route path="/doctor/revenue" element={<BillingInvoices />} />
          {/* Staff IS Team & Roles — one page, not two. */}
          <Route path="/doctor/staff" element={<Navigate to="/doctor/team" replace />} />
          <Route path="/doctor/locations" element={<LocationsManagement />} />
          <Route path="/doctor/team" element={<TeamAndRoles />} />
          <Route path="/doctor/team/new" element={<CreateSubUser />} />
          <Route path="/doctor/audit" element={<AuditLogs />} />
          <Route path="/doctor/email-logs" element={<EmailLogs />} />
        </Route>
        <Route path="*" element={<Navigate to="/doctor" replace />} />
      </Routes>
    );
  }

  if (user.role === 'patient') {
    const nav = patientUnread ? PORTAL_NAV.map((it) => (it.to === '/portal/messages' ? { ...it, badge: patientUnread } : it)) : PORTAL_NAV;
    return (
      <Routes>
        <Route element={<PanelShell panelLabel="Patient" navItems={nav} />}>
          <Route path="/portal" element={<MyHealth />} />
          <Route path="/portal/messages" element={<MyMessages />} />
        </Route>
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  // Parent (default) + admin both use the baby-tracking app shell. Admin also gets
  // the user-management pages.
  const isAdmin = user.role === 'admin';
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={isAdmin ? <AdminHome /> : <Dashboard />} />
        <Route path="/babies/new" element={<BabyOnboarding />} />
        <Route path="/babies/:id/edit" element={<BabyForm />} />
        {/* Paid features — trackers, Dai Maa chat and the report sit behind the plan.
            Unsubscribed parents land on /subscribe; the server 402s the APIs too. */}
        <Route element={<RequireSubscribed />}>
          <Route path="/babies/:id/vaccines" element={<Vaccines />} />
          <Route path="/babies/:id/growth" element={<Growth />} />
          <Route path="/babies/:id/skin" element={<Skin />} />
          <Route path="/babies/:id/food" element={<Food />} />
          <Route path="/babies/:id/sleep" element={<Sleep />} />
          <Route path="/babies/:id/medicines" element={<Medicines />} />
          <Route path="/babies/:id/milestones" element={<Milestones />} />
          <Route path="/babies/:id/records" element={<Health />} />
          <Route path="/babies/:id/chat" element={<Chat />} />
          <Route path="/report" element={<Report />} />
        </Route>
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/find-doctor" element={<FindDoctor />} />
        <Route path="/find-doctor/:id" element={<FindDoctor />} />
        <Route path="/consultations" element={<MyConsultations />} />
        <Route path="/consultations/:id" element={<ConsultationDetail />} />
        <Route path="/refer" element={<ReferEarn />} />
        <Route path="/community" element={<Community />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/b/:brand" element={<BrandCategories />} />
        <Route path="/shop/b/:brand/:category" element={<ProductGrid />} />
        <Route path="/shop/p/:id" element={<ProductDetail />} />
        <Route path="/shop/cart" element={<Cart />} />
        <Route path="/shop/checkout" element={<Checkout />} />
        <Route path="/shop/orders" element={<MyOrders />} />
        <Route path="/shop/orders/:id" element={<OrderDetail />} />
        {isAdmin && <Route path="/shop/admin/orders" element={<AdminOrders />} />}
        {/* Rewards wallet is FREE (earn/redeem regardless of plan) — outside RequireSubscribed. */}
        {!isAdmin && <Route path="/rewards" element={<Rewards />} />}
        <Route path="/settings" element={<Settings />} />
        {isAdmin && <Route path="/parents" element={<ManageParents />} />}
        {isAdmin && <Route path="/doctors" element={<ManageDoctors />} />}
        {isAdmin && <Route path="/chats" element={<AdminChats />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SmoothScroll>
          <ImpersonationBanner />
          <AppRoutes />
          <CartDrawer />
          <CartToast />
        </SmoothScroll>
      </CartProvider>
    </AuthProvider>
  );
}
