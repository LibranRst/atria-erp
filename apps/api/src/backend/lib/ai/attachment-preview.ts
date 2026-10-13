/** A bounded chat preview must tell the model and user when its source is incomplete. */
export function boundedAttachmentPreview(
  text: string,
  maxLines = 100,
  maxCharacters = 8000,
): string {
  const lines = text.split("\n"),
    selected = lines.slice(0, maxLines).join("\n");
  const truncated = lines.length > maxLines || selected.length > maxCharacters;
  const preview = selected.slice(0, maxCharacters);
  return truncated
    ? `${preview}\n[PREVIEW TIDAK LENGKAP: sumber memiliki ${lines.length} baris; batas preview ${maxLines} baris/${maxCharacters} karakter. Jangan mengklaim seluruh invoice/data sudah dibaca atau membuat usulan lengkap. Minta sumber dipecah atau rincian yang belum terbaca.]`
    : preview;
}
