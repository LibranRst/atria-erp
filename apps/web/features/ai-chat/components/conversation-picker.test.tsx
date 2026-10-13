import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ConversationPicker, formatUpdatedAt } from "./conversation-picker";
import { ConversationHistoryWorkspace, groupConversations } from "./conversation-history-workspace";

const now = new Date("2026-08-14T12:00:00Z");

describe("penulisan waktu percakapan", () => {
  test("menyebut yang baru saja diperbarui sebagai baru saja", () => {
    expect(formatUpdatedAt("2026-08-14T11:59:40Z", now)).toBe("Baru saja");
  });

  test("memakai menit dan jam untuk rentang hari ini", () => {
    expect(formatUpdatedAt("2026-08-14T11:20:00Z", now)).toBe("40 menit lalu");
    expect(formatUpdatedAt("2026-08-14T08:00:00Z", now)).toBe("4 jam lalu");
  });

  test("menyebut kemarin dan hitungan hari untuk minggu ini", () => {
    expect(formatUpdatedAt("2026-08-13T10:00:00Z", now)).toBe("Kemarin");
    expect(formatUpdatedAt("2026-08-11T10:00:00Z", now)).toBe("3 hari lalu");
  });

  test("beralih ke tanggal untuk percakapan lama", () => {
    // Setelah seminggu, "12 hari lalu" tidak lagi membantu memilih.
    expect(formatUpdatedAt("2026-07-20T10:00:00Z", now)).toContain("2026");
  });
});

describe("daftar percakapan", () => {
  test("menyatakan keadaan kosong dengan kalimat, bukan daftar kosong", () => {
    const html = renderToStaticMarkup(
      <ConversationPicker
        conversations={[]}
        activeId={null}
        loading={false}
        onSelect={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(html).toContain("Belum ada percakapan tersimpan");
  });

  test("menandai percakapan yang sedang dibuka", () => {
    const html = renderToStaticMarkup(
      <ConversationPicker
        conversations={[
          { id: "c1", title: "Sisa budget material", updatedAt: now.toISOString() },
          { id: "c2", title: "Tagihan vendor", updatedAt: now.toISOString() },
        ]}
        activeId="c1"
        loading={false}
        onSelect={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(html).toContain("sedang dibuka");
    expect(html).toContain('aria-current="true"');
  });

  test("memberi judul cadangan pada percakapan yang belum berjudul", () => {
    const html = renderToStaticMarkup(
      <ConversationPicker
        conversations={[{ id: "c1", title: null, updatedAt: now.toISOString() }]}
        activeId={null}
        loading={false}
        onSelect={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(html).toContain("Percakapan baru");
  });

  test("setiap tombol hapus punya label yang bisa dibedakan", () => {
    const html = renderToStaticMarkup(
      <ConversationPicker
        conversations={[{ id: "c1", title: "Sisa budget material", updatedAt: now.toISOString() }]}
        activeId={null}
        loading={false}
        onSelect={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(html).toContain("Hapus percakapan Sisa budget material");
  });

  test("menampilkan kerangka saat daftar sedang dimuat", () => {
    const html = renderToStaticMarkup(
      <ConversationPicker
        conversations={[]}
        activeId={null}
        loading
        onSelect={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(html).toContain("Memuat daftar percakapan");
  });
});

describe("pengelompokan history workspace", () => {
  test("mengelompokkan berdasarkan aktivitas tanpa mengubah urutan", () => {
    const items = [
      { id: "a", title: "Hari ini", updatedAt: "2026-08-14T10:00:00Z", messageCount: 2 },
      { id: "b", title: "Kemarin", updatedAt: "2026-08-13T10:00:00Z", messageCount: 4 },
      { id: "c", title: "Minggu", updatedAt: "2026-08-10T10:00:00Z", messageCount: 6 },
      { id: "d", title: "Lama", updatedAt: "2026-07-01T10:00:00Z", messageCount: 8 },
    ];

    expect(groupConversations(items, now).map((group) => group.label)).toEqual([
      "Hari ini",
      "Kemarin",
      "7 hari terakhir",
      "Lebih lama",
    ]);
  });

  test("memimpin dengan new chat, preferensi, search, dan skeleton struktural", () => {
    const html = renderToStaticMarkup(
      <ConversationHistoryWorkspace
        activeId={null}
        onSelect={() => undefined}
        onNewConversation={() => undefined}
        onActiveDeleted={() => undefined}
      />,
    );

    expect(html).toContain("Mulai percakapan baru");
    expect(html).toContain("Preferensi asisten");
    expect(html).toContain("Cari judul percakapan");
    expect(html).toContain("Memuat riwayat");
  });
});
