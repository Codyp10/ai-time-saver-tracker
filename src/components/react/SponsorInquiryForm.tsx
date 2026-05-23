import { useState, type FormEvent } from "react";
import { brand } from "@/config/brand";

export interface SponsorInquiryFormData {
  companyName: string;
  contactName: string;
  email: string;
  website: string;
  offering: string;
  message: string;
}

const inputClass =
  "w-full min-h-11 bg-surface-800 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-text-muted/50 focus:ring-wrap-500 focus:border-wrap-500 outline-none";
const labelClass = "block text-sm font-medium text-slate-200 mb-1";

interface SponsorInquiryFormProps {
  onSuccess?: () => void;
  idPrefix?: string;
}

const MAX_FIELD_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 2000;

export function SponsorInquiryForm({ onSuccess, idPrefix = "sponsor" }: SponsorInquiryFormProps) {
  const [form, setForm] = useState<SponsorInquiryFormData>({
    companyName: "",
    contactName: "",
    email: "",
    website: "",
    offering: "",
    message: "",
  });
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (honeypot) return;
    setStatus("submitting");
    setErrorMessage(null);

    const body = [
      `Company: ${form.companyName}`,
      `Contact: ${form.contactName}`,
      `Email: ${form.email}`,
      form.website ? `Website: ${form.website}` : null,
      "",
      "What they'd like to promote:",
      form.offering,
      form.message ? `\nAdditional notes:\n${form.message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch(
        `https://formsubmit.co/ajax/${brand.sponsor.inquiryEmail}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            _subject: "Sponsorship inquiry — AI Wrapped",
            _template: "box",
            _captcha: "false",
            _honey: "",
            name: form.contactName.slice(0, MAX_FIELD_LENGTH),
            email: form.email.slice(0, MAX_FIELD_LENGTH),
            company: form.companyName.slice(0, MAX_FIELD_LENGTH),
            website: (form.website || "—").slice(0, MAX_FIELD_LENGTH),
            offering: form.offering.slice(0, MAX_MESSAGE_LENGTH),
            message: (form.message || "—").slice(0, MAX_MESSAGE_LENGTH),
            _text: body,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Submission failed");
      }

      setStatus("success");
      setForm({
        companyName: "",
        contactName: "",
        email: "",
        website: "",
        offering: "",
        message: "",
      });
      onSuccess?.();
    } catch {
      setStatus("error");
      setErrorMessage(
        `Something went wrong sending your inquiry. Email us directly at ${brand.sponsor.inquiryEmail}.`,
      );
    }
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-3 py-6">
        <span className="material-symbols-outlined text-wrap-500 text-4xl" aria-hidden="true">
          check_circle
        </span>
        <p className="text-lg font-semibold text-white">Thanks — we got your inquiry.</p>
        <p className="text-text-muted text-sm max-w-sm mx-auto">
          We&apos;ll review your details and get back to you at the email you provided.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — hidden from users, catches bots */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor={`${idPrefix}-website-url`}>Website URL</label>
        <input
          id={`${idPrefix}-website-url`}
          type="text"
          name="website_url"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-company`} className={labelClass}>
            Business name *
          </label>
          <input
            id={`${idPrefix}-company`}
            type="text"
            required
            maxLength={MAX_FIELD_LENGTH}
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            className={inputClass}
            placeholder="Acme Inc."
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-contact`} className={labelClass}>
            Your name *
          </label>
          <input
            id={`${idPrefix}-contact`}
            type="text"
            required
            maxLength={MAX_FIELD_LENGTH}
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            className={inputClass}
            placeholder="Jane Smith"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-email`} className={labelClass}>
            Email *
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            required
            maxLength={MAX_FIELD_LENGTH}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-website`} className={labelClass}>
            Website
          </label>
          <input
            id={`${idPrefix}-website`}
            type="url"
            maxLength={MAX_FIELD_LENGTH}
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className={inputClass}
            placeholder="https://"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-offering`} className={labelClass}>
          What would you like to promote? *
        </label>
        <textarea
          id={`${idPrefix}-offering`}
          required
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          value={form.offering}
          onChange={(e) => setForm((f) => ({ ...f, offering: e.target.value }))}
          className={inputClass}
          placeholder="Product, service, or campaign you'd like featured in this spot."
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-message`} className={labelClass}>
          Anything else we should know?
        </label>
        <textarea
          id={`${idPrefix}-message`}
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          className={inputClass}
          placeholder="Timeline, audience fit, questions about placement…"
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-red-400" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full sm:w-auto min-h-11 bg-wrap-500 hover:bg-wrap-600 disabled:opacity-60 text-black px-8 py-3 rounded-xl font-bold transition-colors"
      >
        {status === "submitting" ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}

export default function SponsorInquiryPageForm() {
  return <SponsorInquiryForm idPrefix="contact-page" />;
}
