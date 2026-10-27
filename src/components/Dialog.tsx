import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export function Dialog({
  title,
  onClose,
  dismissible = true,
  children,
}: {
  title: string;
  onClose: () => void;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onClose={(e) => {
        if (!e.currentTarget.open && dismissible) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={!dismissible}
          onClick={() => ref.current?.close()}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({
  title,
  description,
  confirm = "Confirm",
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirm?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog title={title} onClose={onClose} dismissible={!pending}>
      <p className="muted dialog-copy">{description}</p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          autoFocus
          onClick={onClose}
          className="button secondary"
          disabled={pending}
        >
          Cancel
        </button>
        <button
          className={`button ${danger ? "danger" : "primary"}`}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save.");
              setPending(false);
            }
          }}
        >
          {pending ? "Saving…" : confirm}
        </button>
      </div>
    </Dialog>
  );
}
