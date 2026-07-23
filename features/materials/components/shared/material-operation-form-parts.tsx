"use client";

import React from "react";

export function DocumentForm(props: any): React.JSX.Element {
  return <div className="space-y-4">{props.children}</div>;
}

export function ItemRows(props: any): React.JSX.Element {
  return <div className="space-y-3">{props.children}</div>;
}
