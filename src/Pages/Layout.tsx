import { A } from "@solidjs/router";
import { For, Suspense, type ParentProps } from "solid-js";
import { useAppState } from "../AppState";
import { isThemeId, THEME_NAMES } from "../theme";

export default function Layout(props: ParentProps) {
  const { getTheme, setTheme } = useAppState();
  return (
    <>
      <header>
        <nav>
          <ul>
            <li>
              <A href="/">Home</A>
            </li>
            <li>
              <A href="/game">Game</A>
            </li>
            <li>
              <A href="/styleguide">Styleguide</A>
            </li>
          </ul>
          <ul>
            <li>
              <select
                aria-label="Theme"
                value={getTheme()}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  if (isThemeId(value)) setTheme(value);
                }}
              >
                <For each={Object.entries(THEME_NAMES)}>
                  {([id, name]) => <option value={id}>{name}</option>}
                </For>
              </select>
            </li>
            <li>
              <strong>Hex RL</strong>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        <Suspense fallback={<progress />}>{props.children}</Suspense>
      </main>
    </>
  );
}
