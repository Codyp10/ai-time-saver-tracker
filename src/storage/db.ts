import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { MonthlyReport, UserSettings } from "@/types/conversation";

interface TrackerDB extends DBSchema {
  reports: {
    key: string;
    value: MonthlyReport;
  };
  settings: {
    key: string;
    value: UserSettings;
  };
}

const DB_NAME = "ai-time-saver-tracker";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TrackerDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<TrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("reports", { keyPath: "monthKey" });
        db.createObjectStore("settings");
      },
    });
  }
  return dbPromise;
}

export async function saveReport(report: MonthlyReport): Promise<void> {
  const db = await getDb();
  await db.put("reports", report);
}

export async function getReport(monthKey: string): Promise<MonthlyReport | undefined> {
  const db = await getDb();
  return db.get("reports", monthKey);
}

export async function listReports(): Promise<MonthlyReport[]> {
  const db = await getDb();
  const all = await db.getAll("reports");
  return all.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export async function deleteReport(monthKey: string): Promise<void> {
  const db = await getDb();
  await db.delete("reports", monthKey);
}

const SETTINGS_KEY = "user";

export async function getSettings(): Promise<UserSettings> {
  const db = await getDb();
  return (await db.get("settings", SETTINGS_KEY)) ?? {};
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await getDb();
  await db.put("settings", settings, SETTINGS_KEY);
}

export function serializeReportForExport(report: MonthlyReport): string {
  return JSON.stringify(report, null, 2);
}

export function deserializeReport(json: string): MonthlyReport {
  const parsed = JSON.parse(json) as MonthlyReport;
  for (const c of parsed.conversations) {
    for (const m of c.messages) {
      m.timestamp = new Date(m.timestamp);
    }
    c.createdAt = new Date(c.createdAt);
    c.updatedAt = new Date(c.updatedAt);
  }
  return parsed;
}
