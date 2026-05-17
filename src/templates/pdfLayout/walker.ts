// Walker: traverse uma árvore LayoutNode e produz React tree do react-pdf.
//
// Lida com:
//   - Tipos primitivos (Document/Page/View/Text/Image)
//   - Mustache interpolation em strings
//   - Each (loop sobre arrays)
//   - If (conditional)
//   - Checkbox (atalho semântico [x]/[ ] + label)
//   - visibleWhen em qualquer nó

import { createElement, Fragment, type ReactElement } from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import type {
  LayoutNode, DocumentNode, PageNode, ViewNode, TextNode,
  ImageNode, EachNode, IfNode, CheckboxNode,
} from "./types";
import { Ctx, getPath, interpolate, evaluateVisibility } from "./interpolate";

let keyCounter = 0;
function nextKey(): string {
  return `n_${keyCounter++}`;
}

/**
 * Renderiza um nó (e seus filhos) em React tree. ctx é o contexto atual
 * — geralmente filled_data + metadata; em Each, fica enriquecido com a
 * variável do loop.
 */
export function renderNode(node: LayoutNode, ctx: Ctx): ReactElement | null {
  if (node.visibleWhen && !evaluateVisibility(node.visibleWhen, ctx)) {
    return null;
  }

  switch (node.type) {
    case "Document":
      return renderDocument(node, ctx);
    case "Page":
      return renderPage(node, ctx);
    case "View":
      return renderView(node, ctx);
    case "Text":
      return renderText(node, ctx);
    case "Image":
      return renderImage(node, ctx);
    case "Each":
      return renderEach(node, ctx);
    case "If":
      return renderIf(node, ctx);
    case "Checkbox":
      return renderCheckbox(node, ctx);
    default:
      console.warn("[pdf-walker] Tipo de nó desconhecido:", (node as { type?: string }).type);
      return null;
  }
}

function renderChildren(children: LayoutNode[] | undefined, ctx: Ctx): ReactElement[] {
  if (!children) return [];
  return children
    .map((c) => renderNode(c, ctx))
    .filter((el): el is ReactElement => el !== null);
}

function renderDocument(node: DocumentNode, ctx: Ctx): ReactElement {
  return createElement(Document, { key: nextKey() }, ...renderChildren(node.children, ctx));
}

function renderPage(node: PageNode, ctx: Ctx): ReactElement {
  return createElement(
    Page,
    {
      key: nextKey(),
      size: node.size ?? "A4",
      orientation: node.orientation,
      style: node.style,
    },
    ...renderChildren(node.children, ctx),
  );
}

function renderView(node: ViewNode, ctx: Ctx): ReactElement {
  return createElement(
    View,
    { key: nextKey(), style: node.style },
    ...renderChildren(node.children, ctx),
  );
}

function renderText(node: TextNode, ctx: Ctx): ReactElement {
  const props = { key: nextKey(), style: node.style };
  if (typeof node.children === "string") {
    return createElement(Text, props, interpolate(node.children, ctx));
  }
  if (Array.isArray(node.children)) {
    return createElement(Text, props, ...renderChildren(node.children, ctx));
  }
  return createElement(Text, props);
}

function renderImage(node: ImageNode, ctx: Ctx): ReactElement {
  const src = interpolate(node.src, ctx);
  if (!src) return createElement(Fragment, { key: nextKey() });
  return createElement(Image, { key: nextKey(), src, style: node.style });
}

function renderEach(node: EachNode, ctx: Ctx): ReactElement {
  const arr = getPath(ctx, node.bind);
  if (!Array.isArray(arr) || arr.length === 0) {
    if (node.empty) {
      return createElement(Fragment, { key: nextKey() }, ...renderChildren(node.empty, ctx));
    }
    return createElement(Fragment, { key: nextKey() });
  }

  const elements: ReactElement[] = [];
  arr.forEach((item, index) => {
    const itemCtx: Ctx = {
      ...ctx,
      [node.itemAs]: item,
      _index: index,
      _isFirst: index === 0,
      _isLast: index === arr.length - 1,
    };
    if (index > 0 && node.separator) {
      const sep = renderNode(node.separator, itemCtx);
      if (sep) elements.push(sep);
    }
    for (const child of node.children) {
      const el = renderNode(child, itemCtx);
      if (el) elements.push(el);
    }
  });
  return createElement(Fragment, { key: nextKey() }, ...elements);
}

function renderIf(node: IfNode, ctx: Ctx): ReactElement | null {
  const truthy = evaluateVisibility(node.when, ctx);
  const branch = truthy ? node.children : (node.otherwise ?? []);
  return createElement(Fragment, { key: nextKey() }, ...renderChildren(branch, ctx));
}

function renderCheckbox(node: CheckboxNode, ctx: Ctx): ReactElement {
  const value = getPath(ctx, node.bind);
  let marked = false;
  if (node.equals !== undefined) {
    marked = value === node.equals;
  } else if (node.whenContains !== undefined) {
    marked = Array.isArray(value) && value.includes(node.whenContains as never);
  } else {
    marked = Boolean(value);
  }

  // Layout: caixinha quadrada com "✓" se marked, ao lado o label.
  // Tudo dentro de uma View flex-row pra ficar inline.
  return createElement(
    View,
    {
      key: nextKey(),
      style: { flexDirection: "row", alignItems: "center", gap: 4, ...node.style },
    },
    createElement(
      View,
      {
        key: nextKey(),
        style: {
          width: 9,
          height: 9,
          borderWidth: 0.7,
          borderColor: "#222",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      marked
        ? createElement(Text, { key: nextKey(), style: { fontSize: 8, lineHeight: 1 } }, "x")
        : null,
    ),
    createElement(
      Text,
      { key: nextKey(), style: { fontSize: 9 } },
      interpolate(node.label, ctx),
    ),
  );
}
