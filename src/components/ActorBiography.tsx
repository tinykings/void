'use client';

import { useEffect, useId, useRef, useState } from 'react';

export const ActorBiography = ({ biography }: { biography: string }) => {
  const id = useId();
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const element = paragraph.current;
    if (!element || expanded) return;
    const measure = () => setCanExpand(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [biography, expanded]);

  return (
    <div className="mt-5">
      <p className="type-label text-brand-silver/60">Biography</p>
      <p ref={paragraph} id={id} className={`mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-silver ${expanded ? '' : 'line-clamp-6'}`}>
        {biography || 'No biography available.'}
      </p>
      {(canExpand || expanded) && biography && (
        <button type="button" aria-expanded={expanded} aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className="type-action mt-2 min-h-11 rounded-lg px-3 text-brand-cyan transition-colors hover:bg-brand-cyan/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan">
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  );
};
