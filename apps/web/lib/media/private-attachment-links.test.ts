import { expect, test } from "bun:test";
import {
  browserPrivateAttachmentResult,
  rebasePrivateAttachmentLinks,
} from "./private-attachment-links";

const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const path = `/api/media/attachments/${id}`;
const oldOrigin = "https://old.atria.test";
const newOrigin = "https://new.atria.test";

test("nested HTTP DTOs keep data/types while old proofs use the new cookie-bearing origin", (): void => {
  const date = new Date("2026-10-06T00:00:00Z");
  const data = {
    costs: [{ amount: "123.45", receiptImageUrl: `${oldOrigin}${path}`, paidAt: date }],
    map: new Map([["id", id]]),
  };
  expect(rebasePrivateAttachmentLinks(data, newOrigin, [oldOrigin])).toEqual({
    ...data,
    costs: [{ ...data.costs[0], receiptImageUrl: `${newOrigin}${path}` }],
  });
  expect(data.costs[0].receiptImageUrl).toBe(`${oldOrigin}${path}`);
  expect(rebasePrivateAttachmentLinks(data, undefined, [oldOrigin])).toBe(data);
});

test("foreign origins, credentials, malformed IDs and non-attachment URLs remain untouched", (): void => {
  const values = [
    "https://foreign.test" + path,
    `${oldOrigin}${path}?url=secret`,
    `${oldOrigin}${path}#fragment`,
    `${oldOrigin}/api/media/attachments/not-id`,
    `${oldOrigin}/projects/${id}`,
    `https://user:pass@old.atria.test${path}`,
    `https://old.atria.test.evil${path}`,
    `Catatan ${oldOrigin}${path}`,
    "https://ik.imagekit.io/account/proof.jpg",
  ];
  expect(rebasePrivateAttachmentLinks(values, newOrigin, [oldOrigin])).toEqual(values);
});

test("direct uploads are rebound only after matching their registered attachment ID", (): void => {
  const upload = {
    fileId: id,
    url: `${oldOrigin}${path}`,
    fileName: "proof.jpg",
    mimeType: "image/jpeg",
    size: 100,
  };
  expect(browserPrivateAttachmentResult(upload, newOrigin)).toEqual({
    ...upload,
    url: `${newOrigin}${path}`,
  });
  for (const url of [
    `${oldOrigin}/api/media/attachments/dddddddd-dddd-4ddd-8ddd-dddddddddddd`,
    `${oldOrigin}${path}?x=1`,
    "https://ik.imagekit.io/account/proof.jpg",
  ]) {
    expect(() => browserPrivateAttachmentResult({ ...upload, url }, newOrigin)).toThrow();
  }
});
