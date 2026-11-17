import { api } from './client';

export const reportsApi = {
  downloadExcel: async (params: { period?: string; startDate?: string; endDate?: string; category?: string }) => {
    const filename = `DairyTrack_Master_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await api.download('/reports/excel', filename, params);
  },

  downloadPdf: async (params: { period?: string; startDate?: string; endDate?: string }) => {
    const filename = `DairyTrack_Executive_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
    await api.download('/reports/pdf', filename, params);
  },
};
