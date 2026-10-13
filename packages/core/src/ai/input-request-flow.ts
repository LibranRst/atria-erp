import type { InputField, RequestUserInputPayload } from "./input-request";

/** Compatibility for stored model-generated forms that used a create-client sentinel. */
export function normalizeInputRequestPayload(
  rawPayload: RequestUserInputPayload,
): RequestUserInputPayload {
  const projectCreation =
    rawPayload.workflow === "CREATE_PROJECT" ||
    (/buat|tambah|baru|create|new/i.test(rawPayload.actionTitle) &&
      /proyek|project/i.test(rawPayload.actionTitle) &&
      rawPayload.fields.some(
        (field) =>
          field.type === "text" &&
          (field.key === "projectName" || /nama\s+proyek|project\s+name/i.test(field.label)),
      ));
  const payload: RequestUserInputPayload = projectCreation
    ? {
        ...rawPayload,
        workflow: "CREATE_PROJECT",
        description: "Lengkapi data proyek. Budget awal mengikuti Pengaturan ERP.",
        fields: rawPayload.fields.filter(
          (field) =>
            !/budgetcap|capratio|rapcap|rapratio|plafon|ceiling|margin|targetgross|grosspercentage|grossamount|allocationratio|budgetratio/i.test(
              field.key.replace(/[_\s-]/g, ""),
            ) &&
            !/plafon|budget cap|ceiling|target.*margin|rasio.*(?:rap|budget|anggaran)|persentase.*(?:rap|budget|anggaran)|alokasi.*kategori/i.test(
              field.label,
            ),
        ),
      }
    : rawPayload;
  const client = payload.fields.find(
    (field) =>
      field.type === "select" &&
      field.options?.some((option) => /(?:klien|client)\s*baru|new\s*client/i.test(option.label)),
  );
  const create = client?.options?.find((option) =>
    /(?:klien|client)\s*baru|new\s*client/i.test(option.label),
  );
  if (!client || !create) return payload;
  const name = payload.fields.find(
    (field) =>
      field.key === "newClientName" ||
      (field.type === "text" && /nama.*klien|client.*name/i.test(field.label)),
  );
  const phone = payload.fields.find(
    (field) =>
      field.key === "newClientPhone" ||
      (field.type === "text" && /(?:telepon|phone|nomor).*klien|client.*phone/i.test(field.label)),
  );
  const condition = { fieldKey: client.key, equals: create.value };
  const fields = payload.fields.map((field): InputField => {
    if (field.key === client.key)
      return {
        ...field,
        label: "Klien",
        options: field.options?.map((option) =>
          option.value === create.value ? { ...option, label: "Klien baru" } : option,
        ),
      };
    if (field.key === name?.key)
      return {
        ...field,
        label: field.label.replace(/\s*\(jika[^)]*\)\s*$/i, ""),
        required: true,
        visibleWhen: condition,
        groupWith: client.key,
      };
    if (field.key === phone?.key)
      return { ...field, visibleWhen: condition, groupWith: client.key };
    return field;
  });
  if (!name && fields.length < 10) {
    fields.splice(fields.findIndex((field) => field.key === client.key) + 1, 0, {
      key: "newClientName",
      label: "Nama klien baru",
      type: "text",
      required: true,
      placeholder: "Nama klien yang akan didaftarkan",
      visibleWhen: condition,
      groupWith: client.key,
    });
  }
  return { ...payload, fields };
}

export function inputFieldVisible(
  field: InputField,
  values: Readonly<Record<string, string>>,
): boolean {
  return !field.visibleWhen || values[field.visibleWhen.fieldKey] === field.visibleWhen.equals;
}
export function wizardPrimarySteps(
  payload: RequestUserInputPayload,
  values: Readonly<Record<string, string>>,
): readonly number[] {
  return payload.fields.flatMap((field, index) =>
    !field.groupWith && inputFieldVisible(field, values) ? [index] : [],
  );
}
export function wizardStepFields(
  payload: RequestUserInputPayload,
  primaryKey: string,
  values: Readonly<Record<string, string>>,
): readonly InputField[] {
  return payload.fields.filter(
    (field) =>
      (field.key === primaryKey || field.groupWith === primaryKey) &&
      inputFieldVisible(field, values),
  );
}
