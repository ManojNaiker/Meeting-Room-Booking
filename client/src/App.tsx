import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Dashboard from "@/components/Dashboard";
import AdvancedBookingForm from "@/components/AdvancedBookingForm";
import CalendarView from "@/components/CalendarView";
import MyBookings from "@/components/MyBookings";
import UserManagement from "@/components/UserManagement";
import RoomManagement from "@/components/RoomManagement";
import AuditLog from "@/components/AuditLog";
import EmailSettings from "@/components/EmailSettings";
import Analytics from "@/components/Analytics";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Login} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
        </>
      ) : (
        <Route path="/" component={Home} />
      )}
      
      {isAuthenticated && (
        <>
          <Route path="/dashboard">
            <Layout>
              <Dashboard />
            </Layout>
          </Route>
          <Route path="/book">
            <Layout>
              <AdvancedBookingForm />
            </Layout>
          </Route>
          <Route path="/calendar">
            <Layout>
              <CalendarView />
            </Layout>
          </Route>
          <Route path="/my-bookings">
            <Layout>
              <MyBookings />
            </Layout>
          </Route>
          <Route path="/users">
            <Layout>
              <UserManagement />
            </Layout>
          </Route>
          <Route path="/rooms">
            <Layout>
              <RoomManagement />
            </Layout>
          </Route>
          <Route path="/email-settings">
            <Layout>
              <EmailSettings />
            </Layout>
          </Route>
          <Route path="/analytics">
            <Layout>
              <Analytics />
            </Layout>
          </Route>
          <Route path="/audit">
            <Layout>
              <AuditLog />
            </Layout>
          </Route>
        </>
      )}
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
