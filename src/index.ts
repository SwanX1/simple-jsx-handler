declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [elemName: string]: any;
    }
  }
}

type removeOn<T extends `${'on' | 'once'}:${string}`> = T extends `${'on' | 'once'}:${infer Rest}` ? Rest : never;

export type ElementAttributes = {
  [K in `${'on' | 'once'}:${keyof HTMLElementEventMap}`]?: (
    this: HTMLElement,
    event: HTMLElementEventMap[removeOn<K>]
  ) => void;
} & {
  [key: string]: unknown;
};

export type Renderable<T extends HTMLElement = HTMLElement> = (attributes: ElementAttributes, ...children: Node[]) => T;

export const _fragment = Symbol('_fragment');
const FRAGMENT_IDENTIFIER =
  'jsx-frag' +
  Array(5)
    .fill(null)
    .reduce(acc => acc + Math.random().toString(36).slice(2, 13), ''); // Long random string that probably won't collide with anything

interface RenderableOptions<T extends HTMLElement = HTMLElement> {
  attributes: Record<string, unknown>;
  events: {
    on: { [K in keyof HTMLElementEventMap]?: (this: T, event: HTMLElementEventMap[K]) => void };
    once: { [K in keyof HTMLElementEventMap]?: (this: T, event: HTMLElementEventMap[K]) => void };
  };
}

export function _createElement(tag: symbol, props: ElementAttributes, ...children: Node[]): HTMLElement;
export function _createElement<T extends HTMLElement>(
  tag: (attrs: ElementAttributes, ...children: Node[]) => T,
  props: ElementAttributes,
  ...children: Node[]
): T;
export function _createElement<TagName extends keyof JSX.IntrinsicElements>(
  tag: TagName,
  props: ElementAttributes,
  ...children: Node[]
): JSX.IntrinsicElements[TagName];
export function _createElement<TagName extends keyof HTMLElementTagNameMap>(
  tag: TagName,
  props: ElementAttributes,
  ...children: Node[]
): HTMLElementTagNameMap[TagName];
export function _createElement<TagName extends keyof HTMLElementDeprecatedTagNameMap>(
  tag: TagName,
  props: ElementAttributes,
  ...children: Node[]
): HTMLElementDeprecatedTagNameMap[TagName];
export function _createElement(
  tag: string | symbol | ((attrs: ElementAttributes, ...children: Node[]) => HTMLElement),
  attrs: ElementAttributes,
  ...children: Node[]
): HTMLElement {
  if (typeof tag === 'symbol') {
    if (tag !== _fragment) {
      throw new TypeError('Invalid symbol for _createElement function!');
    }
    tag = 'jsx-frag';
    attrs[FRAGMENT_IDENTIFIER] = '';
  }

  if (typeof tag === 'function') {
    return tag(attrs ?? {}, ...children);
  }

  const renderableOptions: RenderableOptions = {
    events: {
      on: {},
      once: {},
    },
    attributes: {},
  };

  for (const [key, value] of Object.entries(attrs || {})) {
    let isOnce = false;
    let isEvent = false;
    if (key.startsWith('on:') || (isOnce = key.startsWith('once:'))) {
      const eventName = key.substr(isOnce ? 5 : 3) as keyof HTMLElementEventMap;
      if (isOnce) {
        // @ts-expect-error yes i get it typescript i have no viable way to do this with types
        renderableOptions.events.once[eventName] = value;
      } else {
        // @ts-expect-error ...
        renderableOptions.events.on[eventName] = value;
      }
      isEvent = true;
    }
    if (!isEvent) {
      renderableOptions.attributes[key] = value;
    }
  }

  if (typeof tag !== 'string') {
    throw new TypeError('Tag is not a string.', {
      cause: {
        context: {
          tag,
          attributes: renderableOptions.attributes,
          events: {
            on: renderableOptions.events.on,
            once: renderableOptions.events.once,
          },
        },
      },
    });
  }
  const element = document.createElement(tag);

  for (const [eventName, value] of Object.entries(renderableOptions.events.once)) {
    if (checkEvent(eventName, value)) {
      element.addEventListener(eventName, function listener(e) {
        element.removeEventListener(eventName, listener);
        // @ts-expect-error ...
        value.call(element, e);
      });
    }
  }

  for (const [eventName, value] of Object.entries(renderableOptions.events.on)) {
    if (checkEvent(eventName, value)) {
      // @ts-expect-error ...
      element.addEventListener(eventName, value.bind(element));
    }
  }

  for (const [attribute, value] of Object.entries(renderableOptions.attributes)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    element.setAttribute(attribute, (value as any).toString());
  }

  for (const child of children) {
    if (child instanceof HTMLElement && child.hasAttribute(FRAGMENT_IDENTIFIER)) {
      child.childNodes.forEach(grandchild => element.appendChild(grandchild));
    } else {
      element.appendChild(typeof child.nodeType === 'undefined' ? document.createTextNode(child.toString()) : child);
    }
  }

  return element;
}

function checkEvent(eventName: string, value: unknown): boolean {
  if (`on${eventName}` in window) {
    if (typeof value === 'function') {
      return true;
    } else {
      console.warn(`Event "${eventName}" has no valid listener.`);
    }
  } else {
    console.warn(`Event name "${eventName}" is invalid.`);
  }
  return false;
}
