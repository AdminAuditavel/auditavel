'use client';

import { useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';

interface RankingVoteProps {
  options: { id: string; text: string }[];
  pollId: string;
}

const ItemType = 'OPTION';  // Tipo do item para o drag and drop

// Componente para cada opção
function DraggableOption({ option, index, moveOption }: any) {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: ItemType,
    item: { index, id: option.id },
    collect: (monitor) => {
      const dragging = monitor.isDragging();
      // log a cada coleta para ver se o hook está ativo
      console.log(`[react-dnd] collect option=${option.id} index=${index} isDragging=${dragging}`);
      return {
        isDragging: dragging,
      };
    },
    begin: () => {
      console.log(`[react-dnd] begin drag option=${option.id} index=${index}`);
    },
    end: (item, monitor) => {
      console.log(
        `[react-dnd] end drag option=${option.id} index=${index} dropped=${monitor.didDrop()}`,
        'item',
        item,
        'dropResult',
        monitor.getDropResult?.()
      );
    },
  }));

  const [, drop] = useDrop(() => ({
    accept: ItemType,
    hover: (item: any) => {
      // log para verificar eventos hover e índices
      console.log(`[react-dnd] hover targetIndex=${index} incomingIndex=${item.index}`);
      if (item.index !== index) {
        moveOption(item.index, index);
        item.index = index;
      }
    },
    drop: (item: any, monitor) => {
      console.log(`[react-dnd] drop on index=${index} itemIndex=${item.index}`);
      return { droppedOn: index };
    },
  }));

  return (
    <div
      ref={(node) => {
        drag(drop(node));
      }}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '5px',
        marginBottom: '5px',
      }}
      data-test-option-id={option.id}
    >
      {option.text}
    </div>
  );
}

export default function RankingVote({ options, pollId }: RankingVoteProps) {
  const [ranking, setRanking] = useState(options.map((option) => option.id)); // Inicializa com a ordem original

  console.log('RankingVote mounted, options:', options.map(o => o.id));

  const moveOption = (fromIndex: number, toIndex: number) => {
    console.log(`moveOption from ${fromIndex} to ${toIndex}`);
    const updatedRanking = [...ranking];
    const [movedItem] = updatedRanking.splice(fromIndex, 1);
    updatedRanking.splice(toIndex, 0, movedItem);
    setRanking(updatedRanking);
  };

  const submitVote = async () => {
    try {
      const voteData = {
        poll_id: pollId,
        option_ids: ranking, // Envia a classificação final
      };

      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteData),
      });

      if (res.ok) {
        alert('Voto registrado com sucesso!');
      } else {
        alert('Erro ao registrar voto.');
      }
    } catch (err) {
      console.error('Erro ao enviar o voto:', err);
      alert('Erro ao registrar voto.');
    }
  };

  return (
    <div>
      <h3>Classifique as opções:</h3>
      <div style={{ marginBottom: '20px' }}>
        {options.map((option, index) => (
          <DraggableOption
            key={option.id}
            index={index}
            option={option}
            moveOption={moveOption}
          />
        ))}
      </div>

      <button onClick={submitVote} className="mt-4 p-2 bg-blue-600 text-white rounded">
        Submeter Classificação
      </button>
    </div>
  );
}
