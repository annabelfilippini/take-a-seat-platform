"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, type PointerEvent } from "react";
import type { CreatorMediaItem } from "../_lib/creators";
import { mediaImageStyle } from "../_lib/creator-gallery";

export function CreatorMediaEditor({ item, onChange }: { item: CreatorMediaItem; onChange: (crop: { positionX?: number; positionY?: number; zoom?: number }) => void }) {
  const drag = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  const x = item.positionX ?? 50, y = item.positionY ?? 50, zoom = item.zoom ?? 100;
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onChange({ positionX: Math.max(0, Math.min(100, drag.current.px - (event.clientX - drag.current.x) / rect.width * 100)), positionY: Math.max(0, Math.min(100, drag.current.py - (event.clientY - drag.current.y) / rect.height * 100)) });
  }
  function stop(event: PointerEvent<HTMLDivElement>) { if (drag.current?.id === event.pointerId) drag.current = null; }
  return <div className="creator-media-crop">
    {item.kind === "photo" ? <>
      <div className="creator-media-crop-frame" aria-label={`Reposition ${item.title}`} role="img"
        onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, px: x, py: y }; }}
        onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { drag.current = null; }}>
        <img src={item.source} alt={item.title} draggable={false} style={mediaImageStyle(item)} />
      </div>
      <p>Drag to reposition. Use the controls to fine tune.</p>
      <label><span>Zoom · {Math.round(zoom)}%</span><input aria-label={`Zoom ${item.title}`} type="range" min="100" max="220" value={zoom} onChange={(event) => onChange({ zoom: Number(event.target.value) })} /></label>
      <div className="creator-media-position-controls">
        <label><span>Left / right</span><input aria-label={`Horizontal position ${item.title}`} type="range" min="0" max="100" value={x} onChange={(event) => onChange({ positionX: Number(event.target.value) })} /></label>
        <label><span>Up / down</span><input aria-label={`Vertical position ${item.title}`} type="range" min="0" max="100" value={y} onChange={(event) => onChange({ positionY: Number(event.target.value) })} /></label>
      </div>
      <button type="button" className="editable-secondary-button" onClick={() => onChange({ positionX: 50, positionY: 50, zoom: 100 })}>Reset crop</button>
    </> : <video className="creator-media-crop-frame" src={item.source} controls muted preload="metadata" />}
  </div>;
}
