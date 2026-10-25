import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <article>
      <header>
        <h1>Not Found</h1>
      </header>
      <p>The page you're looking for could not be found.</p>
      <p>
        Try returning <A href="/">Home</A>.
      </p>
    </article>
  );
}
