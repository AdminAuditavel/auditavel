'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useDrag, useDrop, DragSourceMonitor, DropTargetMonitor } from 'react-dnd';

interface Option {
  id: string;
  text: string;
}

interface RankingVoteProps {
  options: Option[];
  pollId: string;
}

const ItemType = 'OPTION';

function DraggableOption({
  option,
  index,
  moveOption,
}: {
  option: Option;
  index: number;
  moveOption: (from: number, to: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const [, drop] = useDrop({
    accept: ItemType,
    hover(item: { index: number }, monitor: DropTargetMonitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      // Optional: use pointer position to decide more precisely
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only perform the move when the cursor has crossed half of the item's height
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveOption(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    drop: () => ({ droppedOn: index }),
  });

  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { id: option.id, index },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      role="listitem"
      aria-roledescription="draggable option"
      data-option-id={option.id}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        padding: '10px',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        marginBottom: 8,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontWeight: 600, width: 28, textAlign: 'center' }}>{index + 1}</span>
      <span>{option.text}</span>
    </div>
  );
}

export default function RankingVote({ options, pollId }: RankingVoteProps) {
  const [order, setOrder] = useState<string[]>(() => options.map((o) => o.id));

  useEffect(() => {
    // keep order in sync if options prop changes
    setOrder(options.map((o) => o.id));
  }, [options]);

  const moveOption = (fromIndex: number, toIndex: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  // Ensure user_hash exists in localStorage (client-only)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem('user_hash')) {
        const uid =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? (crypto as any).randomUUID()
            : `uid_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('user_hash', uid);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const getUserHash = () => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('user_hash') ?? '' : '';
    } catch {
      return '';
    }
  };

  const submitVote = async () => {
    const user_hash = getUserHash();
    if (!user_hash) {
      alert('Não foi possível identificar o usuário. Tente novamente.');
      return;
    }

    const payload = {
      poll_id: pollId,
      option_ids: order,
      user_hash,
    };

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        alert('Voto registrado com sucesso!');
      } else if (data?.error) {
        alert(`Erro: ${data.error} ${data?.message ? '- ' + data.message : ''}`);
      } else {
        alert('Erro ao registrar voto.');
      }
    } catch (err) {
      console.error('Erro ao enviar voto:', err);
      alert('Erro ao registrar voto.');
    }
  };

  // build a quick map for option text rendering in current order
  const optionsById = new Map(options.map((o) => [o.id, o]));

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Classifique as opções</h3>

      <div role="list" aria-label="Ranking de opções" style={{ marginBottom: 16 }}>
        {order.map((id, idx) => {
          const option = optionsById.get(id);
          if (!option) return null;
          return (
            <DraggableOption
              key={id}
              option={option}
              index={idx}
              moveOption={moveOption}
            />
          );
        })}
      </div>

      <button
        onClick={submitVote}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        aria-label="Submeter classificação"
      >
        Submeter Classificação
      </button>
    </section>
  );
}
