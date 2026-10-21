import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { measureContentSizeTarget } from "./content-size-motion";

const document = new Window().document;

test("target measurement restores live animation styles after successful measurement", () => {
  const first = document.createElement("div"),
    second = document.createElement("div");
  first.style.height = "72.5px";
  second.style.height = "13px";
  document.body.append(first, second);
  try {
    const result = measureContentSizeTarget(
      [
        { element: first, targetHeight: "auto" },
        { element: second, targetHeight: 0 },
      ],
      () => [first.style.height, second.style.height],
    );
    expect(result).toEqual(["auto", "0px"]);
    expect([first.style.height, second.style.height]).toEqual(["72.5px", "13px"]);
  } finally {
    first.remove();
    second.remove();
  }
});

test("failed target measurement cannot leave disclosure styles altered", () => {
  const element = document.createElement("div");
  element.style.height = "123.5px";
  document.body.append(element);
  try {
    expect(() =>
      measureContentSizeTarget([{ element, targetHeight: 0 }], () => {
        throw new Error("measurement failed");
      }),
    ).toThrow("measurement failed");
    expect(element.style.height).toBe("123.5px");
  } finally {
    element.remove();
  }
});
