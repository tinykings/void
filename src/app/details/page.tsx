import DetailsView from '@/components/DetailsView';
import { Suspense } from 'react';

export default function DetailsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <DetailsView />
    </Suspense>
  );
}