export const themeStorageKey = "sscix-theme";

export const themeInitializationScript = `
  try {
    if (localStorage.getItem(${JSON.stringify(themeStorageKey)}) === "dark") {
      document.documentElement.dataset.theme = "dark";
    }
  } catch {}
`;
