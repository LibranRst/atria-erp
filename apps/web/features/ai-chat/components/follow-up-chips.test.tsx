import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FollowUpChips, readFollowUps } from "./follow-up-chips";

describe("pembacaan saran lanjutan", () => {
  test("mengambil daftar pertanyaan dari keluaran tool", () => {
    expect(readFollowUps({ questions: ["Kategori mana yang paling boros?"] })).toEqual([
      "Kategori mana yang paling boros?",
    ]);
  });

  test("mengembalikan daftar kosong untuk keluaran yang tidak cocok", () => {
    // Bentuk yang tidak dikenali tidak boleh menjatuhkan seluruh balasan.
    expect(readFollowUps({ error: "ditolak" })).toEqual([]);
    expect(readFollowUps(null)).toEqual([]);
    expect(readFollowUps({ questions: "bukan array" })).toEqual([]);
  });
});

describe("chip saran lanjutan", () => {
  test("merender tiap pertanyaan sebagai tombol", () => {
    const html = renderToStaticMarkup(
      <FollowUpChips
        questions={["Bagaimana kebutuhan materialnya?", "Siapa yang mengajukan?"]}
        onSelect={() => undefined}
        disabled={false}
      />,
    );

    expect(html).toContain("Bagaimana kebutuhan materialnya?");
    expect(html).toContain("Siapa yang mengajukan?");
    expect(html).toContain("Pertanyaan lanjutan");
  });

  test("tidak merender apa pun ketika tidak ada saran", () => {
    expect(
      renderToStaticMarkup(
        <FollowUpChips questions={[]} onSelect={() => undefined} disabled={false} />,
      ),
    ).toBe("");
  });

  test("menonaktifkan chip selama jawaban masih berjalan", () => {
    const html = renderToStaticMarkup(
      <FollowUpChips questions={["Sisa budget?"]} onSelect={() => undefined} disabled />,
    );

    expect(html).toContain("disabled");
  });
});
