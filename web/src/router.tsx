import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from '@/components/layout/layout';
import { HomePage } from '@/pages/home';
import { ResultPage } from '@/pages/result';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/result', element: <ResultPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
