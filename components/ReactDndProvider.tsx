import React from 'react';

/**
 * Passthrough provider para evitar que a build quebre quando
 * react-dnd-html5-backend não estiver instalado.
 *
 * Se quiser reativar o react-dnd no futuro, substitua este ficheiro
 * pelo provider original que importa DndProvider + backend.
 */
export default function ReactDndProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
