"use client";

import { Globe2 } from "lucide-react";
import { useLanguage } from "@/lib/use-language";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur ${compact ? "text-xs" : "text-sm"}`}
      role="group"
      aria-label={language === "vi" ? "Chọn ngôn ngữ" : "Choose language"}
    >
      <Globe2 className="ml-1 h-4 w-4 text-[#00666d]" aria-hidden="true" />
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`rounded-lg px-2.5 py-1.5 font-semibold transition ${language === "en" ? "bg-[#00666d] text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
        aria-pressed={language === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("vi")}
        className={`rounded-lg px-2.5 py-1.5 font-semibold transition ${language === "vi" ? "bg-[#00666d] text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
        aria-pressed={language === "vi"}
      >
        VI
      </button>
    </div>
  );
}
