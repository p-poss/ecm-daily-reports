import { createContext, useContext, useState, type ReactNode } from 'react';

type Page = 'jobs' | 'reports' | 'report-form';

interface NavigationContextType {
  currentPage: Page;
  selectedJobId: string | null;
  selectedReportId: string | null;
  copyFromReportId: string | null;
  navigateToJobs: () => void;
  navigateToReports: (jobId: string) => void;
  navigateToReportForm: (jobId: string, reportId?: string, copyFromId?: string) => void;
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<Page>('jobs');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [copyFromReportId, setCopyFromReportId] = useState<string | null>(null);

  function navigateToJobs() {
    setCurrentPage('jobs');
    setSelectedJobId(null);
    setSelectedReportId(null);
    setCopyFromReportId(null);
  }

  function navigateToReports(jobId: string) {
    setSelectedJobId(jobId);
    setSelectedReportId(null);
    setCopyFromReportId(null);
    setCurrentPage('reports');
  }

  function navigateToReportForm(jobId: string, reportId?: string, copyFromId?: string) {
    setSelectedJobId(jobId);
    setSelectedReportId(reportId || null);
    setCopyFromReportId(copyFromId || null);
    setCurrentPage('report-form');
  }

  function goBack() {
    if (currentPage === 'report-form') {
      setCurrentPage('reports');
      setSelectedReportId(null);
      setCopyFromReportId(null);
    } else if (currentPage === 'reports') {
      setCurrentPage('jobs');
      setSelectedJobId(null);
    }
  }

  return (
    <NavigationContext.Provider
      value={{
        currentPage,
        selectedJobId,
        selectedReportId,
        copyFromReportId,
        navigateToJobs,
        navigateToReports,
        navigateToReportForm,
        goBack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
