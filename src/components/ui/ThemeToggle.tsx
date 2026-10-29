import { Moon, Sun } from "lucide-react";
import { usePreferencesStore } from "../../store/preferencesStore";
import { IconButton } from "./Button";

export function ThemeToggle({ className }: { className?: string }) {
  const theme = usePreferencesStore((state) => state.theme);
  const toggleTheme = usePreferencesStore((state) => state.toggleTheme);
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <IconButton
      label={`Switch to ${nextTheme} theme`}
      className={`!h-10 !w-10 !rounded-xl ${className ?? ""}`}
      onClick={toggleTheme}
    >
      <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
        <Sun
          size={20}
          className={
            theme === "dark"
              ? "absolute rotate-90 scale-50 opacity-0 transition-all duration-300"
              : "absolute rotate-0 scale-100 opacity-100 transition-all duration-300"
          }
        />
        <Moon
          size={20}
          className={
            theme === "dark"
              ? "absolute rotate-0 scale-100 opacity-100 transition-all duration-300"
              : "absolute -rotate-90 scale-50 opacity-0 transition-all duration-300"
          }
        />
      </span>
    </IconButton>
  );
}
