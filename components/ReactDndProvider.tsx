'use client';
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export default function ReactDndProvider({ children }: { children: React.ReactNode }) {
  // marcador DOM para verificar se o provider cliente está sendo montado
  return (
    <DndProvider backend={HTML5Backend}>
      <div data-react-dnd-provider="true" style={{ display: 'none' }}>
        {children}
      </div>
    </DndProvider>
  );
}
