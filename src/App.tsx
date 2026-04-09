import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { NavigationProvider, useNavigation } from '@/contexts/NavigationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LoginPage } from '@/pages/LoginPage';
import { JobsListPage } from '@/pages/JobsListPage';
import { ReportsListPage } from '@/pages/ReportsListPage';
import { DailyReportPage } from '@/pages/DailyReportPage';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentPage } = useNavigation();

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
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
