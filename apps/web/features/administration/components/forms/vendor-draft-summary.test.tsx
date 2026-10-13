import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VendorDraftSummary } from "./vendor-draft-summary";

describe("vendor draft summary", () => {
  test("optional payment details distinguish absent and partial information", () => {
    const render = (
      bankName: string,
      bankAccountNumber: string,
      bankAccountHolder: string,
    ): string =>
      renderToStaticMarkup(
        <VendorDraftSummary
          name="PT Sumber Interior"
          phone="081234567890"
          bankName={bankName}
          bankAccountNumber={bankAccountNumber}
          bankAccountHolder={bankAccountHolder}
          status="Vendor baru"
        />,
      );
    expect(render("", "", "")).toContain("Belum diisi · opsional");
    expect(render("BCA", "", "")).toContain("1/3 rincian diisi");
    const complete = render("BCA", "001122334455", "PT Sumber Interior");
    expect(complete).toContain("BCA");
    expect(complete).not.toContain("001122334455");
    expect(complete).toContain("tidak mencatat tagihan atau pembayaran");
  });
});
