import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { brand } from "@/config/brand";
import { PlatformGuide } from "@/components/PlatformGuide";

interface LandingIntroProps {
  monthYearControls: ReactNode;
  uploadSection: ReactNode;
}

export function LandingIntro({ monthYearControls, uploadSection }: LandingIntroProps) {
  const { samplePreview } = brand;

  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center min-h-[85vh] flex flex-col justify-center items-center py-20">
        <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-none">
          {brand.heroHeadline}
        </h1>

        <div className="mt-10 sm:mt-12 mb-12 sm:mb-16">
          <div className="text-wrap-500 text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-glow">
            {samplePreview.hoursSaved}
          </div>
          <div className="text-xl sm:text-2xl md:text-3xl font-semibold mt-3 sm:mt-4 text-wrap-500/80">
            {samplePreview.savedLabel}
          </div>
          <p className="text-text-muted mt-4 text-base sm:text-lg px-4">
            {samplePreview.platformSummary}
          </p>
        </div>

        <p className="text-text-muted text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed px-4">
          {brand.heroSubcopy}
        </p>

        <p className="mt-6 text-sm text-text-muted/60">{brand.heroTrustLine.join(" · ")}</p>
      </section>

      {/* Divider */}
      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent mb-20 sm:mb-32"
        aria-hidden
      />

      {/* Stats breakdown */}
      <section className="max-w-5xl mx-auto mb-20 sm:mb-32 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {samplePreview.breakdown.map((row) => (
            <article
              key={row.label}
              className="surface-card p-6 sm:p-8 rounded-3xl border border-white/5"
            >
              <div className="flex justify-between items-end mb-4">
                <span className="text-xl font-bold">{row.label}</span>
                <span className="text-wrap-500 text-2xl font-black">{row.pct}%</span>
              </div>
              <div className="w-full bg-white/10 h-4 rounded-full overflow-hidden">
                <div
                  className="bg-wrap-500 h-full rounded-full"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <p className="mt-4 text-text-muted text-sm italic">Top task: {row.topTask}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Upload */}
      <section className="max-w-3xl mx-auto pb-16 sm:pb-32" aria-label="Upload your exports">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
          <div>
            <h2 className="text-2xl font-bold">Get your wrap</h2>
            <p className="text-text-muted mt-1">Pick the month, then drop your export files.</p>
          </div>
          {monthYearControls}
        </div>
        {uploadSection}
      </section>

      {/* How it works + privacy */}
      <section className="max-w-3xl mx-auto mt-12 sm:mt-20 pt-12 sm:pt-20 border-t border-white/5">
        <ul className="space-y-6 text-text-muted mb-12">
          {brand.howItWorks.map((line) => (
            <li key={line} className="flex items-start gap-4">
              <span
                className="w-2 h-2 rounded-full bg-wrap-500 mt-2 shrink-0"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="bg-wrap-500/5 border-l-4 border-wrap-500 p-6 rounded-r-xl mb-12">
          <p className="text-text-muted">
            {brand.privacyLine}{" "}
            <Link to="/methodology" className="text-wrap-500 hover:underline">
              See the methodology
            </Link>
            .
          </p>
        </div>

        <p className="text-[10px] text-text-muted/40 uppercase tracking-widest text-center">
          {brand.platformsLine}
        </p>
      </section>

      {/* Export guides */}
      <section className="max-w-5xl mx-auto mt-20 sm:mb-16 px-0 sm:px-2">
        <PlatformGuide />
      </section>
    </div>
  );
}
