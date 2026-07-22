import { createElement, type ReactNode } from "react";

/**
 * Lightweight markers for lesson descriptions:
 * - **bold**
 * - *italic*
 * - __underline__
 */
export function renderLessonDescription(input: string): ReactNode {
  const nodes: ReactNode[] = [];
  let key = 0;
  let i = 0;
  let plain = "";

  const flushPlain = () => {
    if (!plain) return;
    nodes.push(plain);
    plain = "";
  };

  const findClosing = (marker: string, from: number): number => {
    let idx = from;
    while (idx < input.length) {
      const found = input.indexOf(marker, idx);
      if (found === -1) return -1;
      // Prefer longer markers already handled; for "*", skip if it's part of "**"
      if (marker === "*" && input.startsWith("**", found)) {
        idx = found + 2;
        continue;
      }
      return found;
    }
    return -1;
  };

  while (i < input.length) {
    if (input.startsWith("**", i)) {
      const end = findClosing("**", i + 2);
      if (end !== -1) {
        flushPlain();
        nodes.push(createElement("strong", { key: key++ }, input.slice(i + 2, end)));
        i = end + 2;
        continue;
      }
    }

    if (input.startsWith("__", i)) {
      const end = findClosing("__", i + 2);
      if (end !== -1) {
        flushPlain();
        nodes.push(createElement("u", { key: key++ }, input.slice(i + 2, end)));
        i = end + 2;
        continue;
      }
    }

    if (input[i] === "*" && !input.startsWith("**", i)) {
      const end = findClosing("*", i + 1);
      if (end !== -1) {
        flushPlain();
        nodes.push(createElement("em", { key: key++ }, input.slice(i + 1, end)));
        i = end + 1;
        continue;
      }
    }

    plain += input[i];
    i += 1;
  }

  flushPlain();
  return nodes;
}
