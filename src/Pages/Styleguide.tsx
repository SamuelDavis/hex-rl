import { createEffect, createSignal, For, onCleanup } from "solid-js";
import {
  HTMLDate,
  HTMLDialog,
  HTMLIcon,
  HTMLNumber,
} from "@samueldavis/solidlib";

const INPUT_TYPES = [
  "text",
  "email",
  "password",
  "number",
  "search",
  "date",
  "time",
  "file",
  "color",
  "range",
] as const;

const TOOLTIP_PLACEMENTS = ["top", "right", "bottom", "left"] as const;

export default function Styleguide() {
  const [getIsDialogOpen, setIsDialogOpen] = createSignal(false);
  const [getItems, setItems] = createSignal(["First item", "Second item"]);
  const [getDraft, setDraft] = createSignal("");
  const [getQuantity, setQuantity] = createSignal(1);
  const [getIsDark, setIsDark] = createSignal(
    matchMedia("(prefers-color-scheme: dark)").matches,
  );

  function addItem(): void {
    const item = getDraft().trim();
    if (!item) return;
    setItems((items) => [...items, item]);
    setDraft("");
  }

  function removeItem(index: number): void {
    setItems((items) => items.filter((_, i) => i !== index));
  }

  createEffect(() => {
    document.documentElement.dataset.theme = getIsDark() ? "dark" : "light";
  });
  onCleanup(() => delete document.documentElement.dataset.theme);

  return (
    <>
      <hgroup>
        <h1>Styleguide</h1>
        <p>Every element the theme styles.</p>
      </hgroup>
      <label>
        <input
          type="checkbox"
          role="switch"
          checked={getIsDark()}
          onChange={(event) => setIsDark(event.currentTarget.checked)}
        />{" "}
        Dark mode
      </label>

      <section>
        <h2>Typography</h2>
        <h1>Heading 1</h1>
        <h2>Heading 2</h2>
        <h3>Heading 3</h3>
        <h4>Heading 4</h4>
        <h5>Heading 5</h5>
        <h6>Heading 6</h6>
        <p>
          Paragraph with <a href="#/styleguide">a link</a>,{" "}
          <strong>strong</strong>, <em>emphasis</em>, <mark>mark</mark>,{" "}
          <del>deleted</del>, <ins>inserted</ins>, <s>struck</s>,{" "}
          <u>underlined</u>, <abbr title="Abbreviation">abbr</abbr>,{" "}
          <kbd>Ctrl</kbd> + <kbd>K</kbd>, <code>inline code</code>,{" "}
          <small>small</small>, H<sub>2</sub>O and E = mc<sup>2</sup>.
        </p>
        <blockquote>
          Blockquote text that spans enough words to wrap onto a second line at
          narrow widths.
          <footer>
            <cite>— Attribution</cite>
          </footer>
        </blockquote>
        <ul>
          <li>Unordered item</li>
          <li>
            Nested
            <ul>
              <li>Child item</li>
            </ul>
          </li>
        </ul>
        <ol>
          <li>Ordered item</li>
          <li>Ordered item</li>
        </ol>
        <dl>
          <dt>Term</dt>
          <dd>Definition</dd>
        </dl>
        <pre>
          <code>{`function greet(name: string) {\n  return \`Hello, \${name}\`;\n}`}</code>
        </pre>
        <hr />
      </section>

      <section>
        <h2>Buttons</h2>
        <p>
          <button type="button">Button</button>{" "}
          <button type="reset">Reset</button>{" "}
          <button type="button" disabled>
            Disabled
          </button>{" "}
          <button type="button" aria-busy="true">
            Busy
          </button>{" "}
          <a href="#/styleguide" role="button">
            Link button
          </a>
        </p>
        <div role="group">
          <button type="button" aria-current="true">
            Day
          </button>
          <button type="button">Week</button>
          <button type="button">Month</button>
        </div>
      </section>

      <section>
        <h2>Forms</h2>
        <form onSubmit={(event) => event.preventDefault()}>
          <For each={INPUT_TYPES}>
            {(type) => (
              <label>
                {type}
                <input type={type} name={type} placeholder={type} />
              </label>
            )}
          </For>
          <label>
            Valid
            <input aria-invalid="false" value="Looks good" />
            <small>Helper text for a valid field.</small>
          </label>
          <label>
            Invalid
            <input aria-invalid="true" value="Not quite" />
            <small>Helper text for an invalid field.</small>
          </label>
          <label>
            Disabled
            <input disabled value="Disabled" />
          </label>
          <label>
            Read-only
            <input readOnly value="Read-only" />
          </label>
          <label>
            Select
            <select>
              <option>Option one</option>
              <option>Option two</option>
            </select>
          </label>
          <label>
            Multiple select
            <select multiple size={3}>
              <option>Option one</option>
              <option>Option two</option>
              <option>Option three</option>
            </select>
          </label>
          <label>
            Textarea
            <textarea placeholder="Textarea" />
          </label>
          <fieldset>
            <legend>Radios</legend>
            <label>
              <input type="radio" name="radio" checked /> First
            </label>
            <label>
              <input type="radio" name="radio" /> Second
            </label>
          </fieldset>
          <fieldset>
            <legend>Checkboxes and switches</legend>
            <label>
              <input type="checkbox" checked /> Checkbox
            </label>
            <label>
              <input type="checkbox" role="switch" checked /> Switch
            </label>
          </fieldset>
          <fieldset role="group">
            <input type="email" placeholder="Email" />
            <input type="submit" value="Subscribe" />
          </fieldset>
          <fieldset role="group">
            <HTMLIcon
              type="remove"
              data-cap="start"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((quantity) => quantity - 1)}
            />
            <input
              type="number"
              aria-label="Quantity"
              value={getQuantity()}
              onInput={(event) =>
                setQuantity(event.currentTarget.valueAsNumber || 0)
              }
            />
            <HTMLIcon
              type="add"
              data-cap="end"
              aria-label="Increase quantity"
              onClick={() => setQuantity((quantity) => quantity + 1)}
            />
          </fieldset>
          <fieldset role="search">
            <input type="search" placeholder="Search" />
            <input type="submit" value="Search" />
          </fieldset>
          <button type="submit">Submit</button>
        </form>
      </section>

      <section>
        <h2>Table</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Date</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Income</td>
              <td>
                <HTMLDate value={new Date(2026, 9, 1)} />
              </td>
              <td>
                <HTMLNumber value={1234.5} money highlight />
              </td>
            </tr>
            <tr>
              <td>Expense</td>
              <td>
                <HTMLDate value={new Date(2026, 9, 15)} />
              </td>
              <td>
                <HTMLNumber value={-321} money highlight />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td />
              <td>
                <HTMLNumber value={913.5} money />
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section>
        <h2>Accordion</h2>
        <details open>
          <summary>Open by default</summary>
          <p>Accordion content.</p>
        </details>
        <details>
          <summary>Closed by default</summary>
          <p>Accordion content.</p>
        </details>
      </section>

      <section>
        <h2>Card</h2>
        <article>
          <header>Card header</header>
          <p>Card body.</p>
          <footer>Card footer</footer>
        </article>
        <article aria-busy="true" />
      </section>

      <section>
        <h2>Navigation</h2>
        <nav aria-label="breadcrumb">
          <ul>
            <li>
              <a href="#/">Home</a>
            </li>
            <li>
              <a href="#/styleguide">Section</a>
            </li>
            <li>Page</li>
          </ul>
        </nav>
        <nav>
          <ul>
            <li>
              <strong>Brand</strong>
            </li>
          </ul>
          <ul>
            <li>
              <a href="#/styleguide">Link</a>
            </li>
            <li>
              <a href="#/styleguide" aria-current="page">
                Current
              </a>
            </li>
            <li>
              <button type="button">Action</button>
            </li>
          </ul>
        </nav>
      </section>

      <section>
        <h2>Feedback</h2>
        <progress value={60} max={100} />
        <progress />
        <p>
          <span data-tooltip="Tooltip text">Hover for tooltip</span>
        </p>
        <p>
          <For each={TOOLTIP_PLACEMENTS}>
            {(placement) => (
              <>
                <button
                  type="button"
                  data-tooltip={`Tooltip ${placement}`}
                  data-placement={placement}
                >
                  {placement}
                </button>{" "}
              </>
            )}
          </For>
        </p>
      </section>

      <section>
        <h2>Icons</h2>
        <p>
          <HTMLIcon type="home" /> Inline icon, <HTMLIcon type="settings" />{" "}
          sized to the line height.
        </p>
        <p>
          <HTMLIcon type="add" onClick={() => setIsDialogOpen(true)} />{" "}
          Clickable icon opens the dialog.
        </p>
      </section>

      <section>
        <h2>Dialog</h2>
        <button type="button" onClick={() => setIsDialogOpen(true)}>
          Open dialog
        </button>
        <HTMLDialog
          open={getIsDialogOpen()}
          onClose={() => setIsDialogOpen(false)}
        >
          <article>
            <header>
              <h3>Dialog</h3>
              <HTMLIcon
                type="close"
                data-cap="end"
                onClick={() => setIsDialogOpen(false)}
              />
            </header>
            <p>Click the backdrop or press Escape to close.</p>
            <footer>
              <button type="button" onClick={() => setIsDialogOpen(false)}>
                Close
              </button>
            </footer>
          </article>
        </HTMLDialog>
      </section>

      <section>
        <h2>Figure</h2>
        <figure>
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23ccc'/%3E%3C/svg%3E"
            alt="Placeholder"
          />
          <figcaption>Figure caption</figcaption>
        </figure>
      </section>

      <section>
        <header>
          <h2>List</h2>
          <HTMLIcon
            type="delete_sweep"
            data-cap="end"
            aria-label="Remove all items"
            onClick={() => setItems([])}
          />
        </header>
        <ul>
          <For each={getItems()}>
            {(item, getIndex) => (
              <li>
                {item}
                <HTMLIcon
                  type="delete"
                  data-cap="end"
                  aria-label={`Remove ${item}`}
                  onClick={() => removeItem(getIndex())}
                />
              </li>
            )}
          </For>
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addItem();
          }}
        >
          <fieldset role="group">
            <input
              aria-label="New item"
              placeholder="New item"
              value={getDraft()}
              onInput={(event) => setDraft(event.currentTarget.value)}
            />
            <HTMLIcon
              type="add"
              data-cap="end"
              aria-label="Add item"
              onClick={addItem}
            />
          </fieldset>
        </form>
      </section>
    </>
  );
}
