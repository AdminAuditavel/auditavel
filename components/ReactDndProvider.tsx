'use client';
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export default function ReactDndProvider({ children }: { children: React.ReactNode }) {
  console.log('[ReactDndProvider] mounted'); // <-- passo único: verifica se o provider existe no DOM
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}
