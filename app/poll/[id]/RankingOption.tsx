'use client';

interface RankingOptionProps {
  text: string;
  index: number;
  moveUp: () => void;
  moveDown: () => void;
}

export default function RankingOption({ text, index, moveUp, moveDown }: RankingOptionProps) {
  return (
    <div className="flex items-center justify-between p-2 border rounded">
      <span>{index + 1}. {text}</span>

      <div className="space-x-2">
        <button
          onClick={moveUp}
          className="px-2 py-1 border rounded"
          disabled={index === 0}
        >
          ↑
        </button>

        <button
          onClick={moveDown}
          className="px-2 py-1 border rounded"
        >
          ↓
        </button>
      </div>
    </div>
  );
}
