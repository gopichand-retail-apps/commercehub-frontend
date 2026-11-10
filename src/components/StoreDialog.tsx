"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

interface StoreDialogProps {
  open: boolean;
  labelledBy: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

export function StoreDialog({ open, labelledBy, className = "", onClose, children }: StoreDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      className={`store-dialog ${className}`}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}
