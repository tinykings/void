import DetailsView from '@/components/DetailsView';
import { Suspense } from 'react';

export default function DetailsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-cyan shadow-[0_0_15px_rgba(34,211,238,0.2)]"></div></div>}>
      <DetailsView />
    </Suspense>
  );
}