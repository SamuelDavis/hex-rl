import {
  createContext,
  createSignal,
  useContext,
  type ParentProps,
} from "solid-js";

function createAppState() {
  const [getCount, setCount] = createSignal(0);

  function increment() {
    setCount((count) => count + 1);
  }

  return { getCount, increment };
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
