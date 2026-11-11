"use client";

import Image from "next/image";
import type { SnapshotRestoration } from "../../lib/contracts";

export function RestorationPortrait({ code, restoration, compact = false, selectedAnswerId, onSelect }: { code: string; restoration: SnapshotRestoration; compact?: boolean; selectedAnswerId?: string | null; onSelect?: (answerId: string) => void }) {
  return <div className={`restoration-portrait ${compact ? "restoration-portrait-compact" : ""}`} aria-label="The room's restored royal portrait">
    <Image className="restoration-base" src={restoration.base} width={1536} height={1024} priority unoptimized alt="The King's damaged royal portrait" />
    {restoration.slots.map((slot) => {
      const imageUrl = slot.image?.status === "READY" && slot.image.assetId ? `/api/rooms/${code}/media/${slot.image.assetId}` : null;
      const selectable = Boolean(onSelect && slot.answerId);
      return <button type="button" aria-label={slot.prompt ? `${slot.label}: ${slot.prompt}` : `${slot.label} missing portrait piece`} disabled={!selectable} onClick={() => slot.answerId && onSelect?.(slot.answerId)} className={`restoration-piece ${slot.answerId && restoration.winningAnswerIds.includes(slot.answerId) ? "restoration-winner" : ""} ${slot.answerId === selectedAnswerId ? "restoration-selected" : ""}`} key={slot.id} style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%`, clipPath: slot.clipPath, transform: `rotate(${slot.rotate}deg)` }}>
        {imageUrl ? <Image src={imageUrl} fill sizes="(max-width: 700px) 40vw, 28vw" unoptimized alt={slot.prompt ?? `Restored ${slot.label} section`} style={{ objectFit: "cover", objectPosition: slot.objectPosition }} /> : <span className="restoration-placeholder"><b>{slot.image?.status === "QUEUED" || slot.image?.status === "GENERATING" ? "PAINTING…" : "TORN AWAY"}</b><small>{slot.label}</small></span>}
        {slot.answerId === selectedAnswerId && <span className="restoration-check">✓</span>}
      </button>;
    })}
    <div className="restoration-vignette" aria-hidden="true" />
  </div>;
}
