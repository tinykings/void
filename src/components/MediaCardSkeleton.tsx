'use client';

import React from 'react';

export const MediaCardSkeleton = () => {
  return (
    <div className="relative bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col h-full animate-pulse">
      {/* Poster Placeholder */}
      <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-800" />
      
      {/* Info Placeholder */}
      <div className="p-3 flex flex-col flex-1 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
        
        {/* Buttons Placeholder */}
        <div className="mt-auto flex gap-1 pt-2">
          <div className="flex-1 h-7 bg-gray-200 dark:bg-gray-800 rounded-md" />
          <div className="flex-1 h-7 bg-gray-200 dark:bg-gray-800 rounded-md" />
        </div>
      </div>
    </div>
  );
};
