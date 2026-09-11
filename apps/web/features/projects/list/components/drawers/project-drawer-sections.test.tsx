import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ProjectClientFields,
  ProjectDetailFields,
  ProjectEditStateFields,
} from "./project-drawer-sections";

describe("project drawer sections hairline divider layout", () => {
  test("ProjectClientFields renders as fragment without nested divide-y wrapper divs", () => {
    const html = renderToStaticMarkup(
      <ProjectClientFields
        isNewClient={false}
        clientId="client-1"
        clientOptions={[{ value: "client-1", label: "Client One" }]}
        newClientName=""
        newClientEmail=""
        newClientPhone=""
        newClientAddress=""
        onClientModeChange={() => undefined}
        onClientIdChange={() => undefined}
        onNewClientNameChange={() => undefined}
        onNewClientEmailChange={() => undefined}
        onNewClientPhoneChange={() => undefined}
        onNewClientAddressChange={() => undefined}
      />,
    );

    expect(html).not.toContain("divide-y");
    expect(html).toContain("Jenis klien");
    expect(html).toContain("Klien Terdaftar");
  });

  test("ProjectClientFields in new-client mode renders without inner divide-y wrapper", () => {
    const html = renderToStaticMarkup(
      <ProjectClientFields
        isNewClient={true}
        clientId=""
        clientOptions={[]}
        newClientName="John"
        newClientEmail="john@example.com"
        newClientPhone="08123456789"
        newClientAddress="Jakarta"
        onClientModeChange={() => undefined}
        onClientIdChange={() => undefined}
        onNewClientNameChange={() => undefined}
        onNewClientEmailChange={() => undefined}
        onNewClientPhoneChange={() => undefined}
        onNewClientAddressChange={() => undefined}
      />,
    );

    expect(html).not.toContain("divide-y");
    expect(html).toContain("Nama Klien");
    expect(html).toContain("No. Telepon");
    expect(html).toContain("Email");
    expect(html).toContain("Alamat Klien");
  });

  test("ProjectDetailFields renders without inner divide-y wrapper", () => {
    const html = renderToStaticMarkup(
      <ProjectDetailFields
        startDate="2026-01-01"
        endDate="2026-06-01"
        location="Menteng"
        roomArea="Living Room"
        projectType="RESIDENTIAL"
        onStartDateChange={() => undefined}
        onEndDateChange={() => undefined}
        onLocationChange={() => undefined}
        onRoomAreaChange={() => undefined}
        onProjectTypeChange={() => undefined}
      />,
    );

    expect(html).not.toContain("divide-y");
    expect(html).toContain("Tanggal Mulai");
    expect(html).toContain("Tanggal Selesai");
    expect(html).toContain("Lokasi");
  });

  test("ProjectEditStateFields renders without inner divide-y wrapper", () => {
    const html = renderToStaticMarkup(
      <ProjectEditStateFields
        status="ACTIVE"
        financialHealth="HEALTHY"
        onStatusChange={() => undefined}
        onFinancialHealthChange={() => undefined}
      />,
    );

    expect(html).not.toContain("divide-y");
    expect(html).toContain("Status Proyek");
    expect(html).toContain("Kesehatan Finansial");
  });
});
