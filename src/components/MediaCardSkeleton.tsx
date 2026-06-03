'use client';

import React from 'react';

export const MediaCardSkeleton = () => {
  return (
    <div className="relative bg-brand-bg blueprint-border rounded-xl overflow-hidden">
      <div className="aspect-[2/3] skeleton-shimmer animate-shimmer" />
    </div>
  );
};
