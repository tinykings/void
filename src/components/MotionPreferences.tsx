'use client';

import { MotionConfig } from 'framer-motion';

export const MotionPreferences = ({ children }: { children: React.ReactNode }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
);
