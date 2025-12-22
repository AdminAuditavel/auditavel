//app/poll/[id]/RankingOption.tsx

'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RankingOptionProps {
  id: string;
  text: string;
  index: number;
}

export default function RankingOption({ id, text, index }: RankingOptionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const pos = index + 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full rounded-xl border px-4 py-3 bg-white flex items-start gap-3 transition
        ${
          isDragging
            ? 'opacity-80 shadow-md border-emerald-200'
            : 'border-gray-200 hover:border-emerald-300'
        }
        focus-within:ring-2 focus-within:ring-emerald-500/20`}
    >
      {/* POSIÇÃO */}
      <span
        className="shrink-0 mt-0.5 inline-flex items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-700
                   h-7 w-7 text-sm font-semibold"
        aria-label={`Posição ${pos}`}
      >
        {pos}
      </span>

      {/* TEXTO */}
      <div className="flex-1">
        <div className="text-gray-900 text-justify leading-relaxed">{text}</div>
      </div>

      {/* HANDLE (arrastar) */}
      <button
        type="button"
        className="shrink-0 mt-0.5 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50
                   h-9 w-9 text-gray-600 hover:text-gray-800 hover:border-gray-300
                   active:scale-[0.98] transition
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
        aria-label="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        {/* Ícone simples (6 pontos), sem dependências */}
        <span className="grid grid-cols-2 gap-1">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </span>
      </button>
    </div>
  );
}
