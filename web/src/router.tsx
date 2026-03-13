import { createBrowserRouter, Navigate } from 'react-router';
import { LandingLayout } from '@/components/layout/landing-layout';
import { Layout } from '@/components/layout/layout';
import { LandingPage } from '@/pages/landing';
import { HomePage } from '@/pages/home';
import { ResultPage } from '@/pages/result';
import { SchedulePage } from '@/pages/schedule';

export const router = createBrowserRouter([
  {
    element: <LandingLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/schedule', element: <SchedulePage /> },
    ],
  },
  {
    element: <Layout />,
    children: [
      { path: '/lookalike', element: <HomePage /> },
      { path: '/lookalike/result', element: <ResultPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
