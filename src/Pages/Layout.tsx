import { A } from "@solidjs/router";
import { Suspense, type ParentProps } from "solid-js";

export default function Layout(props: ParentProps) {
  return (
    <>
      <header>
        <nav>
          <ul>
            <li>
              <A href="/">Home</A>
            </li>
            <li>
              <A href="/styleguide">Styleguide</A>
            </li>
          </ul>
          <ul>
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
