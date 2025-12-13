'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RankingOptionProps {
  id: string;
  text: string;
  index: number;
}

export default function RankingOption({
  id,
  text,
  index,
}: RankingOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        flex
        items-center
        gap-3
        p-4
        border
        border-gray-200
        rounded-xl
        bg-white
        cursor-grab
        transition
        ${isDragging ? 'opacity-60 bg-emerald-50' : 'hover:bg-emerald-50'}
      `}
    >
      {/* POSIÇÃO */}
      <span className="w-6 text-center text-xs font-semibold text-gray-500">
        {index + 1}º
      </span>

      {/* TEXTO */}
      <span className="text-sm font-medium text-gray-800">
        {text}
      </span>

      {/* HINT VISUAL */}
      <span className="ml-auto text-xs text-gray-400">
        arraste
      </span>
    </div>
  );
}
