type Child = Node | string | null | undefined | false;

type Props<K extends keyof HTMLElementTagNameMap> = Partial<{
  className: string;
  text: string;
  attrs: Record<string, string | undefined>;
  on: Partial<{
    [E in keyof HTMLElementEventMap]: (event: HTMLElementEventMap[E]) => void;
  }>;
  dataset: Record<string, string>;
  props: Partial<HTMLElementTagNameMap[K]>;
}>;

/** Tiny element builder; keeps UI code declarative without a framework. */
export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props<K> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (props.className) el.className = props.className;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (value !== undefined) el.setAttribute(name, value);
  }
  for (const [name, value] of Object.entries(props.dataset ?? {})) {
    el.dataset[name] = value;
  }
  if (props.props) Object.assign(el, props.props);
  for (const [type, handler] of Object.entries(props.on ?? {})) {
    el.addEventListener(type, handler as EventListener);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
};
