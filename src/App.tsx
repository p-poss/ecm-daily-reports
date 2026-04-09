import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { NavigationProvider, useNavigation } from '@/contexts/NavigationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LoginPage } from '@/pages/LoginPage';
import { JobsListPage } from '@/pages/JobsListPage';
import { ReportsListPage } from '@/pages/ReportsListPage';
import { DailyReportPage } from '@/pages/DailyReportPage';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { UpdateBanner } from '@/components/UpdateBanner';
// PWA update banner v1

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentPage } = useNavigation();
  const showLoading = useDelayedLoading(isLoading, 300);

  if (isLoading) {
    // Still checking auth — show blank bg for <300ms (imperceptible),
    // then the loading login page if it takes longer.
    if (!showLoading) return <div className="min-h-dvh bg-background" />;
    return <LoginPage loading />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  switch (currentPage) {
    case 'jobs':
      return <JobsListPage />;
    case 'reports':
      return <ReportsListPage />;
    case 'report-form':
      return <DailyReportPage />;
    default:
      return <JobsListPage />;
  }
}

function App() {
  return (
    <ThemeProvider>
      <UpdateBanner />
      <AuthProvider>
        <SyncProvider>
          <NavigationProvider>
            <AppContent />
          </NavigationProvider>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
