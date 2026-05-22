import { useEffect, useId, useRef, useState } from "react";
import { brand } from "@/config/brand";
import { SponsorInquiryForm } from "./SponsorInquiryForm";

export default function SponsorSlot() {
  const { sponsor } = brand;
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!sponsor.enabled) return null;

  return (
    <>
      <section className="no-print max-w-4xl mx-auto mb-20 sm:mb-32" aria-label="Sponsorship opportunity">
        <div className="px-6 py-5 sm:py-6 rounded-2xl border-2 border-dashed border-white/10 bg-surface-800/20 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold bg-white/5 px-2 py-1 rounded">
              {sponsor.label}
            </span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-wrap-500/10 rounded-xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-wrap-500/70 text-xl" aria-hidden="true">
                  {sponsor.icon}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-white/90">{sponsor.headline}</p>
                <p className="text-text-muted text-sm mt-1 max-w-md">{sponsor.subcopy}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 text-wrap-500 text-sm font-semibold flex items-center gap-1 whitespace-nowrap border border-wrap-500/30 hover:border-wrap-500/60 rounded-full px-4 py-2 transition-colors"
          >
            {sponsor.ctaLabel}
            <span className="material-symbols-outlined text-xs" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="backdrop:bg-black/70 bg-surface-800 border border-white/10 text-white rounded-2xl p-0 w-[min(100%,32rem)] max-h-[min(90vh,720px)] shadow-2xl open:flex open:flex-col"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/10 shrink-0">
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              Sponsorship inquiry
            </h2>
            <p className="text-text-muted text-sm mt-1">
              Tell us about your business and we&apos;ll follow up about this spot.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-text-muted hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <SponsorInquiryForm
            idPrefix="sponsor-modal"
            onSuccess={() => setTimeout(() => setOpen(false), 2500)}
          />
        </div>
      </dialog>
    </>
  );
}
