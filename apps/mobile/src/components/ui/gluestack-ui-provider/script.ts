export const script = (mode: string) => {
  const documentElement = document.documentElement;

  function getSystemColorMode() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  try {
    const theme = mode === "system" ? getSystemColorMode() : mode;
    documentElement.classList.remove(theme === "light" ? "dark" : "light");
    documentElement.classList.add(theme);
    documentElement.style.colorScheme = theme;
  } catch (error) {
    console.error(error);
  }
};
