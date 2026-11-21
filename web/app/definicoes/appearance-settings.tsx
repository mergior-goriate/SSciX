"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { themeStorageKey } from "../theme";

const themes = [
  { value: "light", label: "Modo claro", icon: Sun },
  { value: "dark", label: "Modo escuro", icon: Moon },
] as const;

type Theme = (typeof themes)[number]["value"];

export default function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function changeTheme(value: Theme) {
    setTheme(value);
    if (value === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;

    try {
      localStorage.setItem(themeStorageKey, value);
    } catch {
      // The choice still applies to the current page if browser storage is unavailable.
    }
  }

  return <>
    <p>A escolha fica guardada neste navegador.</p>
    <fieldset className="theme-options">
      <legend>Tema da interface</legend>
      {themes.map(({ value, label, icon: Icon }) => <label className="theme-option" key={value}>
        <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => changeTheme(value)} />
        <Icon size={20} aria-hidden="true" />{label}
      </label>)}
    </fieldset>
  </>;
}
