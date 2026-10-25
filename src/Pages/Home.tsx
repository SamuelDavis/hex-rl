import { useAppState } from "../AppState";

export default function Home() {
  const { getCount, increment } = useAppState();

  return (
    <article>
      <header>
        <h1>Home</h1>
      </header>
      <button type="button" onClick={increment}>
        Count: {getCount()}
      </button>
    </article>
  );
}
