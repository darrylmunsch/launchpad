// ─── Typed DOM Helpers ───

/** Create an element with attributes and children */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string> | null,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') {
        element.className = value;
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element.setAttribute(key, value);
      }
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }
  return element;
}

/** Query a single element, throw if not found */
export function $(selector: string, parent: ParentNode = document): HTMLElement {
  const el = parent.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

/** Query all matching elements */
export function $$(selector: string, parent: ParentNode = document): HTMLElement[] {
  return Array.from(parent.querySelectorAll<HTMLElement>(selector));
}

/** Set innerHTML safely — only use for trusted content */
export function setHTML(element: HTMLElement, html: string): void {
  element.innerHTML = html;
}

/** Remove all children from an element */
export function clearChildren(element: HTMLElement): void {
  element.textContent = '';
}

/** SVG helper — creates SVG from a template string */
export function svg(html: string): SVGElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild as SVGElement;
}
