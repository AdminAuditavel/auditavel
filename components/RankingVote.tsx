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
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemType,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [, drop] = useDrop(() => ({
    accept: ItemType,
    hover: (item: any) => {
      if (item.index !== index) {
        moveOption(item.index, index);
        item.index = index;
      }
    },
  }));

  return (
    <div
      ref={(node) => drag(drop(node))}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '5px',
        marginBottom: '5px',
      }}
    >
      {option.text}
    </div>
  );
}

export default function RankingVote({ options, pollId }: RankingVoteProps) {
  const [ranking, setRanking] = useState(options.map((option) => option.id)); // Inicializa com a ordem original

  const moveOption = (fromIndex: number, toIndex: number) => {
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
        // Redirecionar para resultados ou outra página
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
