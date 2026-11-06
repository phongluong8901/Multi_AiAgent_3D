/**
 * Thành phần gốc của ứng dụng (Root Application Component).
 * Quản lý màn hình khởi động Splash Screen và bố cục bàn làm việc chính WorkbenchLayout.
 */

import { useState } from 'react';
import { WorkbenchLayout } from './WorkbenchLayout';
import { AppSplashScreen } from '../components/common/AppSplashScreen';

export default function App() {
  // Trạng thái chờ khởi động hoàn tất các dịch vụ backend
  const [isReady, setIsReady] = useState(false);

  return (
    <>
      {/* Hiển thị màn hình Splash Screen khi chưa sẵn sàng */}
      {!isReady && <AppSplashScreen onReady={() => setIsReady(true)} />}
      
      {/* Khung bàn làm việc chính, chuyển đổi mượt mà với hiệu ứng mờ dần (opacity transition) */}
      <div className={`h-full w-full transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
        <WorkbenchLayout />
      </div>
    </>
  );
}
