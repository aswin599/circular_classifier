import { ReactNode } from 'react';
import { IconClose } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'sm:max-w-lg' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div
          className={`inline-block animate-scale-in align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-card-hover transform transition-all sm:my-8 sm:align-middle ${maxWidth} sm:w-full border border-brand-100`}
        >
          <div className="px-6 pt-5 pb-4 border-b border-brand-50 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between gap-4">
              <h3
                className="text-lg font-semibold text-brand-900 line-clamp-1"
                id="modal-title"
              >
                {title}
              </h3>
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 rounded-md p-1 text-brand-300 transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="px-6 py-4 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}