'use client';

import React from 'react';

export const MediaCardSkeleton = () => {
  return (
    <div className="relative bg-brand-bg blueprint-border rounded-xl overflow-hidden shadow-sm flex flex-col h-full animate-pulse">
      {/* Poster Placeholder */}
      <div className="aspect-[2/3] bg-brand-bg/50" />
      
      {/* Info Placeholder */}
      <div className="p-3 flex flex-col flex-1 space-y-2">
        <div className="h-4 bg-white/5 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
        
        {/* Buttons Placeholder */}
        <div className="mt-auto flex gap-1 pt-2">
          <div className="flex-1 h-7 bg-white/5 rounded-md" />
          <div className="flex-1 h-7 bg-white/5 rounded-md" />
        </div>
      </div>
    </div>
  );
};
