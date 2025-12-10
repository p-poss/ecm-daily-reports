import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { NavigationProvider, useNavigation } from '@/contexts/NavigationContext';
import { LoginPage } from '@/pages/LoginPage';
import { JobsListPage } from '@/pages/JobsListPage';
import { ReportsListPage } from '@/pages/ReportsListPage';
import { DailyReportPage } from '@/pages/DailyReportPage';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentPage } = useNavigation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
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
    <AuthProvider>
      <SyncProvider>
        <NavigationProvider>
          <AppContent />
        </NavigationProvider>
      </SyncProvider>
    </AuthProvider>
  );
}

export default App;
