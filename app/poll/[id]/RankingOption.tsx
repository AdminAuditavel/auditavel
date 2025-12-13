'use client';

interface RankingOptionProps {
  text: string;
  index: number;
  moveUp: () => void;
  moveDown: () => void;
}

export default function RankingOption({
  text,
  index,
  moveUp,
  moveDown,
}: RankingOptionProps) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        gap-3
        p-4
        border
        border-gray-200
        rounded-xl
        bg-white
        hover:bg-emerald-50
        transition
      "
    >
      {/* TEXTO + POSIÇÃO */}
      <div className="flex items-center gap-3">
        <span className="w-6 text-center text-xs font-semibold text-gray-500">
          {index + 1}º
        </span>

        <span className="text-sm font-medium text-gray-800">
          {text}
        </span>
      </div>

      {/* CONTROLES */}
      <div className="flex flex-col gap-1">
        <button
          onClick={moveUp}
          disabled={index === 0}
          aria-label="Mover para cima"
          className="
            p-1
            rounded
            border
            border-gray-200
            text-gray-500
            hover:text-emerald-600
            hover:border-emerald-300
            hover:bg-emerald-100
            transition
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
        >
          ↑
        </button>

        <button
          onClick={moveDown}
          aria-label="Mover para baixo"
          className="
            p-1
            rounded
            border
            border-gray-200
            text-gray-500
            hover:text-emerald-600
            hover:border-emerald-300
            hover:bg-emerald-100
            transition
          "
        >
          ↓
        </button>
      </div>
    </div>
  );
}
