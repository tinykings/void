'use client';

import React from 'react';

export const MediaCardSkeleton = () => {
  return (
    <div className="relative bg-brand-bg blueprint-border rounded-xl overflow-hidden animate-pulse">
      {/* Poster Placeholder */}
      <div className="aspect-[2/3] bg-brand-bg/50" />
    </div>
  );
};
