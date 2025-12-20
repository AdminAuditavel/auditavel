// app/components/PollImage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc: string;
  /** opcional: ajuda o navegador a priorizar imagens do card de destaque */
  priority?: boolean;
};

/**
 * PollImage (Client)
 * - Resolve o problema de "link quebrado" de imagem com fallback automático.
 * - Também evita flicker quando o src muda.
 */
export default function PollImage({
  src,
  alt,
  className,
  fallbackSrc,
  priority,
}: Props) {
  const normalizedSrc = useMemo(() => (src || "").trim(), [src]);
  const [currentSrc, setCurrentSrc] = useState(normalizedSrc || fallbackSrc);

  useEffect(() => {
    setCurrentSrc(normalizedSrc || fallbackSrc);
  }, [normalizedSrc, fallbackSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      onError={() => {
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}
