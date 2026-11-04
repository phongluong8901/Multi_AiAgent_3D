import { useState } from 'react';
import { WorkbenchLayout } from './WorkbenchLayout';
import { AppSplashScreen } from '../components/common/AppSplashScreen';

export default function App() {
  const [isReady, setIsReady] = useState(false);

  return (
    <>
      {!isReady && <AppSplashScreen onReady={() => setIsReady(true)} />}
      <div className={`h-full w-full transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
        <WorkbenchLayout />
      </div>
    </>
  );
}