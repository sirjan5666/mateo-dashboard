import { lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Calculator, CalendarClock, CalendarDays, HeartPulse, MessageSquare, Stethoscope, Syringe, TrendingUp, UserCog, Users } from 'lucide-react';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/context';
import { AppShell } from './components/layout/AppShell';
import { PanelShell } from './components/layout/PanelShell';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import type { PanelNavItem } from './components/layout/PanelShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BabyForm from './pages/BabyForm';
import Vaccines from './pages/Vaccines';
import Skin from './pages/Skin';
import Food from './pages/Food';
import Feeds from './pages/Feeds';
import Sleep from './pages/Sleep';
import Diapers from './pages/Diapers';
import Symptoms from './pages/Symptoms';
import Medicines from './pages/Medicines';
import Allergies from './pages/Allergies';
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
import DoctorHome from './pages/doctor/DoctorHome';
import DoctorProfileForm from './pages/doctor/DoctorProfileForm';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import Patients from './pages/doctor/Patients';
import PatientDetail from './pages/doctor/PatientDetail';
import GrowthCharts from './pages/doctor/GrowthCharts';
import Vaccinations from './pages/doctor/Vaccinations';
import DoseCalculator from './pages/doctor/DoseCalculator';
import Development from './pages/doctor/Development';
import AnalyticsPage from './pages/doctor/Analytics';
import Labs from './pages/doctor/Labs';
import Neonatology from './pages/doctor/Neonatology';
import Billing from './pages/doctor/Billing';
import Schedule from './pages/doctor/Schedule';
import DoctorMessages from './pages/doctor/Messages';
import MyHealth from './pages/portal/MyHealth';
import MyMessages from './pages/portal/MyMessages';
import AdminHome from './pages/admin/AdminHome';
import ManageParents from './pages/admin/AdminParents';
import ManageDoctors from './pages/admin/AdminDoctors';
import AdminChats from './pages/admin/AdminChats';
import Shop from './pages/shop/Shop';
import ProductDetail from './pages/shop/ProductDetail';
import Cart from './pages/shop/Cart';
import Checkout from './pages/shop/Checkout';
import MyOrders from './pages/shop/MyOrders';
import OrderDetail from './pages/shop/OrderDetail';
import AdminOrders from './pages/shop/AdminOrders';
import { getDoctorNotifications, getPortalNotifications } from './api/notifications';
import { CartProvider } from './shop/CartProvider';
import { CartDrawer } from './components/shop/CartDrawer';
import { CartToast } from './components/shop/CartToast';
// Growth pulls in recharts (~350 kB) — code-split so it stays out of the initial bundle.
const Growth = lazy(() => import('./pages/Growth'));

const DOCTOR_NAV: PanelNavItem[] = [
  { to: '/doctor', label: 'Home', icon: Stethoscope, end: true },
  { to: '/doctor/patients', label: 'Patients', icon: Users },
  { to: '/doctor/growth', label: 'Growth', icon: TrendingUp },
  { to: '/doctor/vaccines', label: 'Vaccines', icon: Syringe },
  { to: '/doctor/dose', label: 'Dose calc', icon: Calculator },
  { to: '/doctor/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/doctor/messages', label: 'Messages', icon: MessageSquare },
  { to: '/doctor/appointments', label: 'Consultations', icon: CalendarClock },
  { to: '/doctor/profile', label: 'Profile', icon: UserCog },
];

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
    const nav = doctorUnread ? DOCTOR_NAV.map((it) => (it.to === '/doctor/messages' ? { ...it, badge: doctorUnread } : it)) : DOCTOR_NAV;
    return (
      <Routes>
        <Route element={<PanelShell panelLabel="Doctor" navItems={nav} />}>
          <Route path="/doctor" element={<DoctorHome />} />
          <Route path="/doctor/patients" element={<Patients />} />
          <Route path="/doctor/patients/:id" element={<PatientDetail />} />
          <Route path="/doctor/growth" element={<GrowthCharts />} />
          <Route path="/doctor/vaccines" element={<Vaccinations />} />
          <Route path="/doctor/dose" element={<DoseCalculator />} />
          <Route path="/doctor/development" element={<Development />} />
          <Route path="/doctor/analytics" element={<AnalyticsPage />} />
          <Route path="/doctor/labs" element={<Labs />} />
          <Route path="/doctor/neonatology" element={<Neonatology />} />
          <Route path="/doctor/billing" element={<Billing />} />
          <Route path="/doctor/schedule" element={<Schedule />} />
          <Route path="/doctor/messages" element={<DoctorMessages />} />
          <Route path="/doctor/appointments" element={<DoctorAppointments />} />
          <Route path="/doctor/consultations/:id" element={<ConsultationDetail />} />
          <Route path="/doctor/profile" element={<DoctorProfileForm />} />
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
        <Route path="/babies/new" element={<BabyForm />} />
        <Route path="/babies/:id/edit" element={<BabyForm />} />
        <Route path="/babies/:id/vaccines" element={<Vaccines />} />
        <Route path="/babies/:id/growth" element={<Growth />} />
        <Route path="/babies/:id/skin" element={<Skin />} />
        <Route path="/babies/:id/food" element={<Food />} />
        <Route path="/babies/:id/feeds" element={<Feeds />} />
        <Route path="/babies/:id/sleep" element={<Sleep />} />
        <Route path="/babies/:id/diapers" element={<Diapers />} />
        <Route path="/babies/:id/symptoms" element={<Symptoms />} />
        <Route path="/babies/:id/medicines" element={<Medicines />} />
        <Route path="/babies/:id/allergies" element={<Allergies />} />
        <Route path="/babies/:id/milestones" element={<Milestones />} />
        <Route path="/babies/:id/records" element={<Health />} />
        <Route path="/babies/:id/chat" element={<Chat />} />
        <Route path="/find-doctor" element={<FindDoctor />} />
        <Route path="/find-doctor/:id" element={<FindDoctor />} />
        <Route path="/consultations" element={<MyConsultations />} />
        <Route path="/consultations/:id" element={<ConsultationDetail />} />
        <Route path="/refer" element={<ReferEarn />} />
        <Route path="/community" element={<Community />} />
        <Route path="/report" element={<Report />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/p/:id" element={<ProductDetail />} />
        <Route path="/shop/cart" element={<Cart />} />
        <Route path="/shop/checkout" element={<Checkout />} />
        <Route path="/shop/orders" element={<MyOrders />} />
        <Route path="/shop/orders/:id" element={<OrderDetail />} />
        {isAdmin && <Route path="/shop/admin/orders" element={<AdminOrders />} />}
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
        <ImpersonationBanner />
        <AppRoutes />
        <CartDrawer />
        <CartToast />
      </CartProvider>
    </AuthProvider>
  );
}
