import { useEffect, useState } from "react";
import type { SkillLevel, UserSettings } from "@/types/conversation";
import { getSettings, saveSettings } from "@/storage/db";
import { OCCUPATIONS } from "@/engine/value";

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        <fieldset className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            OpenAI API key (optional)
          </label>
          <p className="text-xs text-slate-500">
            Used only in your browser to classify ambiguous conversations with gpt-4o-mini. Never
            sent to our servers — we have no servers.
          </p>
          <input
            type="password"
            value={settings.openaiApiKey ?? ""}
            onChange={(e) =>
              setSettings((s) => ({ ...s, openaiApiKey: e.target.value || undefined }))
            }
            placeholder="sk-..."
            className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-white"
            autoComplete="off"
          />
        </fieldset>

        <fieldset className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Occupation (for dollar estimate)
          </label>
          <select
            value={settings.occupation ?? "other"}
            onChange={(e) => setSettings((s) => ({ ...s, occupation: e.target.value }))}
            className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-white"
          >
            {OCCUPATIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} (~${o.hourlyUsd}/hr)
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Custom hourly rate (optional override)
          </label>
          <input
            type="number"
            min={1}
            value={settings.hourlyRate ?? ""}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                hourlyRate: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-white"
          />
        </fieldset>

        <fieldset className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">Default skill level</label>
          <select
            value={settings.skillLevel ?? "intermediate"}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                skillLevel: e.target.value as SkillLevel,
              }))
            }
            className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-white"
          >
            <option value="novice">Novice</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
            <option value="expert_mature_code">Expert (mature codebase)</option>
          </select>
        </fieldset>

        <button
          type="submit"
          className="px-6 py-2.5 rounded-full bg-wrap-600 hover:bg-wrap-500 text-black font-medium"
        >
          Save settings
        </button>
        {saved && <p className="text-green-400 text-sm">Saved.</p>}
      </form>
    </div>
  );
}
