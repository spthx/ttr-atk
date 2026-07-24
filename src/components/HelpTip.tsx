import React from 'react';
import { CircleHelp } from 'lucide-react';

interface HelpTipProps {
  term: string;
  description: string;
  align?: 'left' | 'center' | 'right';
}

const alignClass = {
  left: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-0',
} as const;

export const HelpTip: React.FC<HelpTipProps> = ({
  term,
  description,
  align = 'left',
}) => (
  <span className="group/help relative inline-flex shrink-0 align-middle">
    <button
      type="button"
      aria-label={`${term}の説明`}
      title={`${term}: ${description}`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-cyan-500/15 hover:text-cyan-300 focus:bg-cyan-500/15 focus:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/70"
    >
      <CircleHelp className="h-3.5 w-3.5" />
    </button>
    <span
      role="tooltip"
      className={`pointer-events-none invisible absolute bottom-full z-[200] mb-2 w-64 rounded-lg border border-cyan-500/30 bg-slate-950 px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100 ${alignClass[align]}`}
    >
      <strong className="mb-0.5 block text-cyan-300">{term}</strong>
      {description}
    </span>
  </span>
);
