export const vNodeHasChildren = (vNode: any) =>
  vNode &&
  vNode.children &&
  Array.isArray(vNode.children) &&
  vNode.children.length;
