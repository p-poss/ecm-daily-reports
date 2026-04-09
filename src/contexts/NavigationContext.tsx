import { createContext, useContext, useState, type ReactNode } from 'react';

type Page = 'jobs' | 'reports' | 'report-form';

interface NavigationContextType {
  currentPage: Page;
  selectedJobId: string | null;
  selectedJobLabel: string | null;
  selectedReportId: string | null;
  copyFromReportId: string | null;
  navigateToJobs: () => void;
  navigateToReports: (jobId: string, jobLabel?: string) => void;
  navigateToReportForm: (jobId: string, reportId?: string, copyFromId?: string, jobLabel?: string) => void;
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<Page>('jobs');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobLabel, setSelectedJobLabel] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [copyFromReportId, setCopyFromReportId] = useState<string | null>(null);

  function navigateToJobs() {
    setCurrentPage('jobs');
    setSelectedJobId(null);
    setSelectedJobLabel(null);
    setSelectedReportId(null);
    setCopyFromReportId(null);
    document.title = 'Jobs | ECM';
  }

  function navigateToReports(jobId: string, jobLabel?: string) {
    setSelectedJobId(jobId);
    setSelectedJobLabel(jobLabel || null);
    setSelectedReportId(null);
    setCopyFromReportId(null);
    setCurrentPage('reports');
    document.title = 'Reports | ECM';
  }

  function navigateToReportForm(jobId: string, reportId?: string, copyFromId?: string, jobLabel?: string) {
    setSelectedJobId(jobId);
    if (jobLabel) setSelectedJobLabel(jobLabel);
    setSelectedReportId(reportId || null);
    setCopyFromReportId(copyFromId || null);
    setCurrentPage('report-form');
    document.title = 'Daily Report | ECM';
  }

  function goBack() {
    if (currentPage === 'report-form') {
      setCurrentPage('reports');
      setSelectedReportId(null);
      setCopyFromReportId(null);
      document.title = 'Reports | ECM';
    } else if (currentPage === 'reports') {
      setCurrentPage('jobs');
      setSelectedJobId(null);
      setSelectedJobLabel(null);
      document.title = 'Jobs | ECM';
    }
  }

  return (
    <NavigationContext.Provider
      value={{
        currentPage,
        selectedJobId,
        selectedJobLabel,
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
