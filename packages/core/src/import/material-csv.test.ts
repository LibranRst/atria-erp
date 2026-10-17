import { expect, test } from "bun:test";
import { parseCsvTable } from "./csv";
import {
  MATERIAL_CATALOG_CSV_TEMPLATE,
  OPENING_INVENTORY_CSV_TEMPLATE,
  parseMaterialCatalogCsv,
  parseOpeningInventoryCsv,
} from "./material-csv";

test("operational imports reject shifted cells before preview, keeping the generic parser compatible", (): void => {
  const shifted = "material_name,location_name,quantity,unit_cost\nMultipleks,Gudang,10,25,100000";
  expect(() => parseOpeningInventoryCsv(shifted)).toThrow("Baris 2: jumlah kolom");
  expect(() =>
    parseOpeningInventoryCsv("material_code,location_name,quantity,unit_cost\nPLY,Gudang,10"),
  ).toThrow("3 dari 4");
  expect(parseCsvTable(shifted).rows[0]).toHaveLength(5);
});

test("strict material mappers reject duplicate normalized headers and preserve required-header validation", (): void => {
  expect(() =>
    parseMaterialCatalogCsv("name, NAME ,category,unit,location\nA,B,Panel,lembar,Gudang"),
  ).toThrow("Kolom CSV duplikat: name");
  expect(() =>
    parseOpeningInventoryCsv(
      "material_name,location_name,quantity, QUANTITY ,unit_cost\nA,Gudang,1,2,3",
    ),
  ).toThrow("Kolom CSV duplikat: quantity");
  expect(() => parseMaterialCatalogCsv("name,unit\nA,m")).toThrow("category, location");
});

test("quoted delimiters, CRLF, BOM, escaped quotes, multiline content and cents remain source values", (): void => {
  const catalog = parseMaterialCatalogCsv(
    '\uFEFFname,category,unit,location,last_purchase_price,specification\r\n"Panel, putih",Panel,m2,Gudang,1234.56,"Baris ""satu""\nBaris dua"\r\n',
  );
  expect(catalog.rows[0]).toMatchObject({
    name: "Panel, putih",
    lastPurchasePrice: 1234.56,
    specification: 'Baris "satu"\nBaris dua',
  });
  expect(
    parseOpeningInventoryCsv(
      'material_name,location_name,quantity,unit_cost\n"Panel, putih",Gudang,1.25,1234.56',
    ).rows[0],
  ).toMatchObject({ materialName: "Panel, putih", quantity: 1.25, unitCost: 1234.56 });
});

test("download templates round-trip through their own strict mapper without shifting optional cells", (): void => {
  expect(parseMaterialCatalogCsv(MATERIAL_CATALOG_CSV_TEMPLATE).rows[0]).toMatchObject({
    name: "Multipleks 18mm",
    code: "PLY-18",
    color: "Natural",
    lastPurchasePrice: 250000,
  });
  expect(parseOpeningInventoryCsv(OPENING_INVENTORY_CSV_TEMPLATE).rows[0]).toMatchObject({
    materialCode: "PLY-18",
    quantity: 10,
    unitCost: 250000,
  });
});
