import React, { useId } from 'react';
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
}) => {
  const descriptionId = useId();
  return (
    <span className="group/help relative inline-flex h-4 w-4 shrink-0 align-middle">
      <button
        type="button"
        aria-label={`${term}の説明`}
        aria-describedby={descriptionId}
        title={`${term}: ${description}`}
        onClick={(event) => event.stopPropagation()}
        className="absolute left-1/2 top-1/2 z-10 inline-flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-cyan-500/15 hover:text-cyan-300 focus:bg-cyan-500/15 focus:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/70"
      >
        <CircleHelp className="h-4 w-4" />
      </button>
      <span
        id={descriptionId}
        role="tooltip"
        className={`pointer-events-none invisible absolute bottom-full z-[200] mb-2 w-64 rounded-lg border border-cyan-500/30 bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-relaxed text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100 ${alignClass[align]}`}
      >
        <strong className="mb-0.5 block text-cyan-300">{term}</strong>
        {description}
      </span>
    </span>
  );
};
