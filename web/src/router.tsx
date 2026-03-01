import { createBrowserRouter } from 'react-router';
import { Layout } from '@/components/layout/layout';
import { HomePage } from '@/pages/home';
import { ResultPage } from '@/pages/result';
import { AboutPage } from '@/pages/about';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/result', element: <ResultPage /> },
      { path: '/about', element: <AboutPage /> },
    ],
  },
]);
