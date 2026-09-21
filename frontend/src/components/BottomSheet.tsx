import type { ReactNode } from "react";

export function BottomSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-grabber" />
        {children}
      </div>
    </>
  );
}
