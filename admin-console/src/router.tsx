import type { FC } from 'react';
import { Routes, Route } from 'react-router';
import { AdminLayout } from '@/components/layout/admin-layout';
import { DashboardPage } from '@/pages/dashboard';
import { ScheduleDatePage } from '@/pages/schedule-date';

export const Router: FC = () => (
  <Routes>
    <Route element={<AdminLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="schedule/:date" element={<ScheduleDatePage />} />
    </Route>
  </Routes>
);
