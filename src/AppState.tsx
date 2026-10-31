import { persist } from "@samueldavis/solidlib";
import {
  createContext,
  createEffect,
  createSignal,
  useContext,
  type ParentProps,
} from "solid-js";
import { DEFAULT_THEME, themeOf } from "./theme";

function createAppState() {
  const [getCount, setCount] = createSignal(0);

  function increment() {
    setCount((count) => count + 1);
  }

  const [getTheme, setTheme] = persist(createSignal(DEFAULT_THEME), {
    key: "theme",
    decode: themeOf,
  });

  createEffect(() => {
    document.documentElement.dataset.appTheme = getTheme();
  });

  return { getCount, increment, getTheme, setTheme };
}

type AppState = ReturnType<typeof createAppState>;

const AppStateContext = createContext<AppState>();

export function AppStateProvider(props: ParentProps) {
  return (
    <AppStateContext.Provider value={createAppState()}>
      {props.children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx)
    throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
