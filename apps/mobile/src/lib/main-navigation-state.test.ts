import { expect, test } from "bun:test";
import {
  activeRouteCanGoBack,
  workspaceChromeLocation,
  workspaceStackToRestore,
  type NavigationTree,
} from "./main-navigation-state";

function workspacePage(name: string): NavigationTree {
  return {
    type: "stack",
    index: 0,
    routes: [
      {
        name: "(tabs)",
        state: {
          type: "tab",
          index: 0,
          routes: [{ name, state: { type: "stack", index: 0, routes: [{ name: "index" }] } }],
        },
      },
    ],
  };
}

test("route sheets retain the underlying workspace identity without inventing Back", () => {
  const page = workspacePage("projects");
  const presented: NavigationTree = {
    ...page,
    index: 1,
    routes: [...page.routes, { name: "modal/project" }],
  };
  const chrome = workspaceChromeLocation(presented, "/modal/project");
  expect(chrome.pathname).toBe("/projects");
  expect(chrome.hasBack).toBe(false);
  expect(chrome.sheetPresented).toBe(true);
  expect(presented.index).toBe(1);
  expect(chrome.state?.index).toBe(0);
});

test("nested route sheets preserve project detail identity and its existing Back", () => {
  const state: NavigationTree = {
    type: "stack",
    index: 0,
    routes: [
      {
        name: "__root",
        state: {
          type: "stack",
          index: 1,
          routes: [
            {
              name: "(tabs)",
              state: {
                type: "tab",
                index: 0,
                routes: [
                  {
                    name: "projects",
                    state: {
                      type: "stack",
                      index: 1,
                      routes: [
                        { name: "index" },
                        { name: "[projectId]/index", params: { projectId: "project-42" } },
                      ],
                    },
                  },
                ],
              },
            },
            { name: "modal/project" },
          ],
        },
      },
    ],
  };
  const chrome = workspaceChromeLocation(state, "/modal/project");
  expect(chrome.pathname).toBe("/projects/project-42");
  expect(chrome.hasBack).toBe(true);
  expect(chrome.sheetPresented).toBe(true);
});

test("multiple presented forms retain Persetujuan's peer-page Back state", () => {
  const page = workspacePage("approvals");
  const chrome = workspaceChromeLocation(
    {
      ...page,
      index: 2,
      routes: [...page.routes, { name: "modal/project" }, { name: "expenses/new" }],
    },
    "/expenses/new",
  );
  expect(chrome.pathname).toBe("/approvals");
  expect(chrome.hasBack).toBe(true);
  expect(chrome.state?.index).toBe(0);
});

test("sheet presentation within a nested stack resolves the source screen", () => {
  const chrome = workspaceChromeLocation(
    {
      type: "tab",
      index: 0,
      routes: [
        {
          name: "projects",
          state: {
            type: "stack",
            index: 1,
            routes: [{ name: "index" }, { name: "modal/project" }],
          },
        },
      ],
    },
    "/modal/project",
  );
  expect(chrome.pathname).toBe("/projects");
  expect(chrome.hasBack).toBe(false);
  expect(chrome.sheetPresented).toBe(true);
});

test("normal route changes and auth routes use the current pathname immediately", () => {
  const state = workspacePage("ledger");
  const chrome = workspaceChromeLocation(state, "/ledger");
  expect(chrome.pathname).toBe("/ledger");
  expect(chrome.state).toBe(state);
  expect(chrome.sheetPresented).toBe(false);
  expect(workspaceChromeLocation(workspacePage("projects"), "/projects").pathname).toBe(
    "/projects",
  );
  expect(
    workspaceChromeLocation({ type: "stack", routes: [{ name: "login" }] }, "/login"),
  ).toMatchObject({ pathname: "/login", sheetPresented: false, hasBack: false });
  expect(workspaceChromeLocation(undefined, "/profile/password").pathname).toBe(
    "/profile/password",
  );
});

test("direct-open sheets without a source page fall back to hidden launch chrome", () => {
  expect(
    workspaceChromeLocation(
      { type: "stack", index: 0, routes: [{ name: "modal/project" }] },
      "/modal/project",
    ),
  ).toEqual({ pathname: "/", state: undefined, sheetPresented: true, hasBack: false });
  expect(workspaceChromeLocation(undefined, "/expenses/new").pathname).toBe("/");
});

test("Back follows the active route, not an inactive tab's detail stack", () => {
  const state = {
    type: "stack",
    index: 0,
    routes: [
      {
        name: "(tabs)",
        state: {
          type: "tab",
          index: 0,
          routes: [
            { name: "ledger", state: { type: "stack", index: 0, routes: [{ name: "index" }] } },
            {
              name: "projects",
              state: { type: "stack", index: 1, routes: [{ name: "index" }, { name: "detail" }] },
            },
          ],
        },
      },
    ],
  };
  expect(activeRouteCanGoBack(state)).toBe(false);
  expect(
    activeRouteCanGoBack({ ...state, index: 1, routes: [...state.routes, { name: "approvals" }] }),
  ).toBe(true);
});

test("restore existing tabs targets the workspace inside Expo __root", () => {
  const stack = {
    key: "workspace",
    index: 1,
    routes: [{ name: "(tabs)" }, { name: "approvals/index" }],
  };
  expect(
    workspaceStackToRestore({ key: "outer", index: 0, routes: [{ name: "__root", state: stack }] }),
  ).toBe("workspace");
  expect(workspaceStackToRestore({ ...stack, index: 0 })).toBeNull();
  expect(workspaceStackToRestore({ index: 0, routes: [{ name: "login" }] })).toBeNull();
});
