/* eslint-disable max-classes-per-file */
/**
 * Virtual DOM classes - EXACT implementation matching virtual-dom@2.x
 *
 * This is a faithful reproduction of virtual-dom's VNode and VText classes
 * to eliminate the security vulnerability (CVE-2025-57352) in virtual-dom's
 * transitive dependency min-document, while maintaining 100% API compatibility.
 *
 * Based on: https://github.com/Matt-Esch/virtual-dom
 */

const version = '2';
const noProperties = {};
const noChildren: any[] = [];

/**
 * Helper to check if something is a VNode (internal)
 */
// eslint-disable-next-line no-underscore-dangle
function _isVNode(x: any): boolean {
  return x && x.type === 'VirtualNode';
}

/**
 * Helper to check if something is a Widget
 */
function isWidget(x: any): boolean {
  return x && x.type === 'Widget';
}

/**
 * Helper to check if something is a Thunk
 */
function isThunk(x: any): boolean {
  return x && x.type === 'Thunk';
}

/**
 * Helper to check if something is a VHook
 */
function isVHook(x: any): boolean {
  return (
    x &&
    ((typeof x.hook === 'function' && !Object.prototype.hasOwnProperty.call(x, 'hook')) ||
      (typeof x.unhook === 'function' && !Object.prototype.hasOwnProperty.call(x, 'unhook')))
  );
}

/**
 * VNode - Represents an HTML element in the virtual DOM tree
 * EXACT copy of virtual-dom/vnode/vnode.js
 */
export class VNode {
  tagName: any;
  properties: any;
  children: any;
  key: any;
  namespace: any;
  count: number;
  hasWidgets: boolean;
  hasThunks: boolean;
  hooks: any;
  descendantHooks: boolean;
  version: string;
  type: string;
  constructor(tagName: any, properties: any, children: any, key: any, namespace: any) {
    this.tagName = tagName;
    this.properties = properties || noProperties;
    this.children = children || noChildren;
    this.key = key != null ? String(key) : undefined;
    this.namespace = typeof namespace === 'string' ? namespace : null;
    this.version = version;
    this.type = 'VirtualNode';

    const count = (children && children.length) || 0;
    let descendants = 0;
    let hasWidgets = false;
    let hasThunks = false;
    let descendantHooks = false;
    let hooks;

    // Check properties for hooks
    // eslint-disable-next-line no-restricted-syntax
    for (const propName in properties) {
      if (Object.prototype.hasOwnProperty.call(properties, propName)) {
        const property = properties[propName];
        if (isVHook(property) && property.unhook) {
          if (!hooks) {
            hooks = {};
          }
          (hooks as any)[propName] = property;
        }
      }
    }

    // Calculate descendants and check for widgets/thunks
    for (let i = 0; i < count; i += 1) {
      const child = children[i];
      if (_isVNode(child)) {
        descendants += child.count || 0;

        if (!hasWidgets && child.hasWidgets) {
          hasWidgets = true;
        }

        if (!hasThunks && child.hasThunks) {
          hasThunks = true;
        }

        if (!descendantHooks && (child.hooks || child.descendantHooks)) {
          descendantHooks = true;
        }
      } else if (!hasWidgets && isWidget(child)) {
        if (typeof child.destroy === 'function') {
          hasWidgets = true;
        }
      } else if (!hasThunks && isThunk(child)) {
        hasThunks = true;
      }
    }

    this.count = count + descendants;
    this.hasWidgets = hasWidgets;
    this.hasThunks = hasThunks;
    this.hooks = hooks;
    this.descendantHooks = descendantHooks;
  }
}

/**
 * VText - Represents a text node in the virtual DOM tree
 * EXACT copy of virtual-dom/vnode/vtext.js
 */
export class VText {
  text: string;
  version: string;
  type: string;
  constructor(text: any) {
    this.text = String(text);
    this.version = version;
    this.type = 'VirtualText';
  }
}

/**
 * Check if a value is a VNode (exported for compatibility)
 */
export function isVNode(vnode: any): boolean {
  return vnode && vnode.type === 'VirtualNode';
}

/**
 * Check if a value is a VText (exported for compatibility)
 */
export function isVText(vtext: any): boolean {
  return vtext && vtext.type === 'VirtualText';
}
