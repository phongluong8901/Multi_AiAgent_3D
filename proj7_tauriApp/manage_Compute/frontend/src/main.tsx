/**
 * Điểm khởi nhập chính của ứng dụng Frontend Compute Studio (Entry Point).
 * Render cây thành phần React vào phần tử root trong index.html.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
