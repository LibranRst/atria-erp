import { describe, expect, mock, test } from "bun:test";
import { Children, Fragment, createElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

mock.module("react-native", () => ({
  View: "NativeView",
  Text: "NativeText",
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    hairlineWidth: 1,
  },
}));
mock.module("@/theme", () => ({
  theme: { spacing: {}, colors: {}, fonts: {}, typography: {}, radii: {}, opacityColors: {} },
}));

const { FormSection } = await import("./form-section");

type ElementProps = {
  readonly children?: ReactNode;
  readonly id?: string;
  readonly style?: unknown;
};
type RowIdentity = {
  readonly wrapperKey: string | null;
  readonly childKey: string | null;
  readonly type: ReactElement["type"];
};

function element(node: ReactNode): ReactElement<ElementProps> {
  if (!isValidElement<ElementProps>(node)) throw new Error("Expected a form element");
  return node;
}
function FieldProbe(_props: ElementProps): React.JSX.Element {
  return createElement("field-probe");
}
function SelectProbe(_props: ElementProps): React.JSX.Element {
  return createElement("select-probe");
}
function field(id: string, key?: string): ReactElement<ElementProps> {
  return createElement(FieldProbe, { id, key });
}
function select(id: string): ReactElement<ElementProps> {
  return createElement(SelectProbe, { id });
}
function rowWrappers(children: ReactNode): readonly ReactElement<ElementProps>[] {
  // Execute the production hook-free component, rather than duplicating its flattening policy.
  const section = element(FormSection({ children }));
  const provider = element(Children.toArray(section.props.children).at(-1));
  const group = element(provider.props.children);
  const rows: ReactElement<ElementProps>[] = [];
  Children.forEach(group.props.children, (node: ReactNode): void => {
    rows.push(element(node));
  });
  return rows;
}
function identities(children: ReactNode): ReadonlyMap<string, RowIdentity> {
  const rows = new Map<string, RowIdentity>();
  for (const wrapper of rowWrappers(children)) {
    const child = element(wrapper.props.children);
    if (!child.props.id) throw new Error("Expected a named probe row");
    rows.set(child.props.id, {
      wrapperKey: wrapper.key,
      childKey: child.key,
      type: child.type,
    });
  }
  return rows;
}
function projectClientRows(isNewClient: boolean): readonly ReactNode[] {
  return [
    field("name"),
    select("clientKind"),
    isNewClient
      ? createElement(
          Fragment,
          null,
          field("newClientName"),
          field("email"),
          field("phone"),
          field("address"),
        )
      : select("client"),
    select("projectManager"),
  ];
}

describe("grouped form row reconciliation identity", () => {
  test("existing/new/existing client fields preserve prefix and PM identities", () => {
    const existing = identities(projectClientRows(false));
    const newClient = identities(projectClientRows(true));
    const restored = identities(projectClientRows(false));
    for (const id of ["name", "clientKind", "projectManager"]) {
      expect(newClient.get(id)).toEqual(existing.get(id));
      expect(restored.get(id)).toEqual(existing.get(id));
    }
    expect(newClient.has("client")).toBe(false);
    expect(newClient.has("newClientName")).toBe(true);
    expect(restored.has("newClientName")).toBe(false);
  });

  test("nested fragments namespace otherwise identical local child keys", () => {
    const rows = identities([
      createElement(
        Fragment,
        { key: "first" },
        field("first.name"),
        createElement(Fragment, { key: "nested" }, field("first.nested.name")),
      ),
      createElement(Fragment, { key: "second" }, field("second.name")),
    ]);
    expect(rows.size).toBe(3);
    expect(new Set([...rows.values()].map((row: RowIdentity) => row.wrapperKey)).size).toBe(3);
    expect(rows.get("first.name")?.wrapperKey).toContain("first");
    expect(rows.get("first.nested.name")?.wrapperKey).toContain("nested");
    expect(rows.get("second.name")?.wrapperKey).toContain("second");
  });

  test("explicit keyed rows preserve identity when reordered", () => {
    const before = identities([field("alpha", "alpha"), field("beta", "beta")]);
    const after = identities([field("beta", "beta"), field("alpha", "alpha")]);
    expect(after.get("alpha")).toEqual(before.get("alpha"));
    expect(after.get("beta")).toEqual(before.get("beta"));
  });

  test("explicit keys containing path delimiters cannot collide with fragment descendants", () => {
    const rows = identities([
      createElement(Fragment, { key: "first" }, field("nested")),
      field("direct", "first/.0"),
    ]);
    expect(rows.get("nested")?.wrapperKey).not.toBe(rows.get("direct")?.wrapperKey);
  });

  test("keyed fragment groups preserve descendant identities when reordered", () => {
    const first = createElement(Fragment, { key: "first" }, field("one"), field("two"));
    const second = createElement(Fragment, { key: "second" }, field("three"));
    const before = identities([first, second]);
    const after = identities([second, first]);
    for (const id of ["one", "two", "three"]) expect(after.get(id)).toEqual(before.get(id));
  });

  test("nulls and booleans stay absent while text and divider placement are preserved", () => {
    const rows = rowWrappers([null, false, "helper text", 0, field("last", "last")]);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.props.children).toBe("helper text");
    expect(rows[1]?.props.children).toBe(0);
    expect(element(rows[2]?.props.children).props.id).toBe("last");
    expect(rows[0]?.props.style).toBeUndefined();
    expect(rows[1]?.props.style).toMatchObject({ borderTopWidth: 1 });
    expect(rows[2]?.props.style).toMatchObject({ borderTopWidth: 1 });
  });
});
