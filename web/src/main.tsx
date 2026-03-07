import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './router';
import { startPreload } from './ml/preload';
import './index.css';

// 페이지 로드 즉시 무거운 리소스 백그라운드 프리로드 시작
startPreload();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
