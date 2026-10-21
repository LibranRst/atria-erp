"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { transitionEaseSmooth } from "@/lib/utils/motion";
import { AppIcon } from "../icon/app-icon";
import { FormField } from "./basic-form-controls";
import { cx } from "./form-control-utils";
import { useFormFieldAssociation } from "./form-field-association-context";
import { useFormPresentation } from "./form-presentation-context";

export interface ColorPresetOption {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
}

export interface HsvColor {
  readonly h: number; // 0..360
  readonly s: number; // 0..1
  readonly v: number; // 0..1
}

/**
 * Konversi kode warna HEX (3/6 karakter) ke HSV float.
 * Menghasilkan model warna yang stabil untuk kanvas 2D picker.
 */
export function hexToHsv(hex: string): HsvColor {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (clean.length !== 6) {
    return { h: 0, s: 0, v: 0 };
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) {
    return { h: 0, s: 0, v: 0 };
  }

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max / 255;

  if (d !== 0) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h, s, v };
}

/**
 * Konversi HSV float ke kode warna HEX #RRGGBB standar.
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const normH = ((h % 360) + 360) % 360;
  const clampS = Math.max(0, Math.min(1, s));
  const clampV = Math.max(0, Math.min(1, v));

  const c = clampV * clampS;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = clampV - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (normH < 60) {
    r = c;
    g = x;
  } else if (normH < 120) {
    r = x;
    g = c;
  } else if (normH < 180) {
    g = c;
    b = x;
  } else if (normH < 240) {
    g = x;
    b = c;
  } else if (normH < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (n: number): string =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Normalisasi format HEX string ke format #RRGGBB uppercase.
 */
export function normalizeHex(val: string): string {
  let clean = val.trim();
  if (clean && !clean.startsWith("#")) {
    clean = `#${clean}`;
  }
  return clean.slice(0, 7).toUpperCase();
}

/**
 * Validasi apakah string adalah HEX 6 digit valid.
 */
export function isValidHex(val: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(val);
}

export interface CustomColorPickerProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (hex: string) => void;
  readonly presets?: readonly ColorPresetOption[];
  readonly disabled?: boolean;
  readonly className?: string;
  readonly ariaLabel?: string;
}

/**
 * Custom Color Picker interaktif yang 100% mengikuti Paduna Design System & iOS form style.
 * Menggunakan kanvas saturasi/brightness HSV, slider hue pelangi, input HEX langsung,
 * serta preset cepat dengan highlight aktif.
 */
export function CustomColorPicker({
  id,
  value,
  onChange,
  presets,
  disabled = false,
  className,
  ariaLabel = "Pemilih warna kustom",
}: CustomColorPickerProps): React.JSX.Element {
  const association = useFormFieldAssociation();
  const generatedId = useId();
  const controlId = id ?? association?.controlId ?? `${generatedId}-color`;
  const paletteId = `${generatedId}-palette`;
  const keyboardHintId = `${generatedId}-keyboard`;
  const grouped = useFormPresentation() === "grouped";
  const reduced = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  // State input string & previous external value mirror
  const [prevValue, setPrevValue] = useState(value);
  const [hexInput, setHexInput] = useState(() => normalizeHex(value || "#000000"));

  // Hue dijaga sebagai state mandiri (0..360) agar tidak terpengaruh kuantisasi 8-bit RGB saat dragging Sat/Val
  const [hue, setHue] = useState(() => hexToHsv(value || "#000000").h);
  const [sat, setSat] = useState(() => hexToHsv(value || "#000000").s);
  const [val, setVal] = useState(() => hexToHsv(value || "#000000").v);

  const hueRef = useRef(hue);
  const satRef = useRef(sat);
  const valRef = useRef(val);

  const satAreaRef = useRef<HTMLDivElement>(null);
  const hueTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingSat = useRef(false);
  const isDraggingHue = useRef(false);

  // React idiomatic pattern: synchronize state during render when external prop changes
  if (value !== prevValue) {
    setPrevValue(value);
    if (isValidHex(value)) {
      setHexInput(value.toUpperCase());
      const nextHsv = hexToHsv(value);
      // Jaga Hue yang ada jika warna desaturasi / mendekati hitam atau putih
      if (nextHsv.s > 0.05 && nextHsv.v > 0.05) {
        setHue(nextHsv.h);
      }
      setSat(nextHsv.s);
      setVal(nextHsv.v);
    }
  }

  useEffect(() => {
    hueRef.current = hue;
    satRef.current = sat;
    valRef.current = val;
  }, [hue, sat, val]);

  const updateSatValAndEmit = useCallback(
    (nextSat: number, nextVal: number): void => {
      satRef.current = nextSat;
      valRef.current = nextVal;
      setSat(nextSat);
      setVal(nextVal);
      const nextHex = hsvToHex(hueRef.current, nextSat, nextVal);
      setHexInput(nextHex);
      onChange(nextHex);
    },
    [onChange],
  );

  const updateHueAndEmit = useCallback(
    (nextHue: number): void => {
      hueRef.current = nextHue;
      setHue(nextHue);
      const nextHex = hsvToHex(nextHue, satRef.current, valRef.current);
      setHexInput(nextHex);
      onChange(nextHex);
    },
    [onChange],
  );

  const handleSatPointer = useCallback(
    (clientX: number, clientY: number): void => {
      const area = satAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

      const s = x / rect.width;
      const v = 1 - y / rect.height;

      updateSatValAndEmit(s, v);
    },
    [updateSatValAndEmit],
  );

  const handleHuePointer = useCallback(
    (clientX: number): void => {
      const track = hueTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const h = (x / rect.width) * 360;
      updateHueAndEmit(h);
    },
    [updateHueAndEmit],
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent): void => {
      if (isDraggingSat.current) {
        handleSatPointer(e.clientX, e.clientY);
      } else if (isDraggingHue.current) {
        handleHuePointer(e.clientX);
      }
    };

    const handlePointerUp = (): void => {
      isDraggingSat.current = false;
      isDraggingHue.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handleSatPointer, handleHuePointer]);

  // Support Eyedropper API jika didukung browser (Chromium / Safari modern)
  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  const handleEyeDropper = async (): Promise<void> => {
    try {
      const globalWindow = window as unknown as Record<string, unknown>;
      const EyeDropperClass = globalWindow.EyeDropper;
      if (typeof EyeDropperClass === "function") {
        const instance = new (
          EyeDropperClass as new () => {
            open: () => Promise<{ sRGBHex?: string }>;
          }
        )();
        const result = await instance.open();
        if (result?.sRGBHex) {
          const hex = result.sRGBHex.toUpperCase();
          setHexInput(hex);
          const nextHsv = hexToHsv(hex);
          hueRef.current = nextHsv.h;
          satRef.current = nextHsv.s;
          valRef.current = nextHsv.v;
          setHue(nextHsv.h);
          setSat(nextHsv.s);
          setVal(nextHsv.v);
          onChange(hex);
        }
      }
    } catch {
      // User cancelled picker
    }
  };

  const pureHueColor = `hsl(${Math.round(hue)}, 100%, 50%)`;

  return (
    <div className={cx("space-y-3", className)}>
      {/* Baris 1: Swatch Pemicu, Input HEX & Toggle Popover */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Swatch Lingkaran Interaktif */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cx(
            "relative h-12 w-12 shrink-0 rounded-full shadow-control ring-1 ring-ring-control outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            disabled && "cursor-not-allowed opacity-50",
          )}
          style={{ backgroundColor: value || "#000000" }}
          aria-label={`${ariaLabel}. Warna saat ini: ${value}`}
          aria-expanded={isOpen}
          aria-controls={paletteId}
        >
          <span className="sr-only">Buka kontrol warna visual</span>
        </button>

        {/* Input HEX Monospaced yang dapat diedit langsung */}
        <div className="relative min-w-0 flex-1 basis-24">
          <input
            id={controlId}
            type="text"
            disabled={disabled}
            value={hexInput}
            maxLength={7}
            onChange={(e) => {
              const raw = normalizeHex(e.target.value);
              setHexInput(raw);
              if (isValidHex(raw)) {
                const nextHsv = hexToHsv(raw);
                if (nextHsv.s > 0.05 && nextHsv.v > 0.05) {
                  setHue(nextHsv.h);
                  hueRef.current = nextHsv.h;
                }
                setSat(nextHsv.s);
                setVal(nextHsv.v);
                satRef.current = nextHsv.s;
                valRef.current = nextHsv.v;
                onChange(raw);
              }
            }}
            onBlur={() => {
              if (isValidHex(hexInput)) {
                setHexInput(hexInput.toUpperCase());
                onChange(hexInput.toUpperCase());
              } else {
                setHexInput(normalizeHex(value || "#000000"));
              }
            }}
            placeholder="#181817"
            aria-label={`${ariaLabel}: kode HEX`}
            aria-describedby={association?.describedBy}
            aria-invalid={association?.invalid || undefined}
            required={association?.required}
            className={cx(
              "min-h-12 w-full font-mono text-support font-bold text-on-surface uppercase outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              grouped
                ? "border-0 bg-transparent px-0"
                : "rounded-full border border-outline-variant/35 bg-surface-container-lowest px-5 shadow-control",
              "placeholder:text-on-surface-variant focus:border-accent",
              disabled && "cursor-not-allowed opacity-50",
            )}
          />
        </div>

        {/* Tombol Eyedropper jika didukung */}
        {hasEyeDropper && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleEyeDropper}
            className={cx(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-control outline-none hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring",
              disabled && "cursor-not-allowed opacity-50",
            )}
            aria-label="Ambil warna dari layar (Eyedropper)"
          >
            <AppIcon name="palette" className="icon-xs" />
          </button>
        )}

        {/* Tombol Toggle Palet Kustom */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cx(
            "flex min-h-12 items-center gap-1.5 rounded-full px-3 text-meta font-bold outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            isOpen
              ? "bg-primary text-on-primary shadow-primary"
              : "border border-outline-variant/35 bg-surface-container-lowest text-on-surface shadow-control hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring",
            disabled && "cursor-not-allowed opacity-50",
          )}
          aria-expanded={isOpen}
          aria-controls={paletteId}
          aria-label="Sesuaikan warna di palet visual"
        >
          <AppIcon name="tune" className="icon-xs" />
          <span>{isOpen ? "Tutup" : "Sesuaikan"}</span>
        </button>
      </div>

      {/* Accordion Palet Kustom Visual (HSV Gradient Canvas & Hue Slider) */}
      <AnimatePresence initial={false}>
        {isOpen && !disabled && (
          <motion.div
            id={paletteId}
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : transitionEaseSmooth}
            className="overflow-hidden"
          >
            <div className="rounded-inset bg-surface-container-low p-3">
              <div className="space-y-3">
                <p id={keyboardHintId} className="text-support text-on-surface-variant">
                  Panah kiri/kanan mengubah saturasi; atas/bawah mengubah kecerahan.
                </p>
                {/* Kanvas 2D: Saturasi (Horizontal) x Brightness (Vertikal) */}
                <div
                  ref={satAreaRef}
                  tabIndex={0}
                  onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>): void => {
                    const step = event.shiftKey ? 0.1 : 0.01;
                    let nextSat = satRef.current;
                    let nextVal = valRef.current;
                    if (event.key === "ArrowLeft") nextSat -= step;
                    else if (event.key === "ArrowRight") nextSat += step;
                    else if (event.key === "ArrowUp") nextVal += step;
                    else if (event.key === "ArrowDown") nextVal -= step;
                    else if (event.key === "Home") nextVal = 0;
                    else if (event.key === "End") nextVal = 1;
                    else return;
                    event.preventDefault();
                    updateSatValAndEmit(
                      Math.max(0, Math.min(1, nextSat)),
                      Math.max(0, Math.min(1, nextVal)),
                    );
                  }}
                  onPointerDown={(e) => {
                    isDraggingSat.current = true;
                    isDraggingHue.current = false;
                    handleSatPointer(e.clientX, e.clientY);
                  }}
                  className="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-icon ring-1 ring-ring-control outline-none select-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  style={{
                    backgroundColor: pureHueColor,
                    backgroundImage: `
                      linear-gradient(to top, #000000, transparent),
                      linear-gradient(to right, #FFFFFF, transparent)
                    `,
                  }}
                  role="slider"
                  aria-label="Saturasi dan kecerahan warna"
                  aria-describedby={keyboardHintId}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(val * 100)}
                  aria-valuetext={`Saturasi ${Math.round(sat * 100)}%, Nilai ${Math.round(val * 100)}%`}
                >
                  {/* Thumb Penanda Warna Aktif */}
                  <div
                    className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-control ring-1 ring-ring-control"
                    style={{
                      left: `${sat * 100}%`,
                      top: `${(1 - val) * 100}%`,
                      backgroundColor: value,
                    }}
                  />
                </div>

                {/* Slider Hue Pelangi (0° - 360°) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-support font-bold text-on-surface-variant">
                    <span>Spektrum warna</span>
                    <span className="font-mono tabular-nums">{Math.round(hue)}°</span>
                  </div>
                  <div
                    ref={hueTrackRef}
                    tabIndex={0}
                    onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>): void => {
                      const step = event.shiftKey ? 10 : 1;
                      let nextHue = hueRef.current;
                      if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextHue -= step;
                      else if (event.key === "ArrowRight" || event.key === "ArrowUp")
                        nextHue += step;
                      else if (event.key === "Home") nextHue = 0;
                      else if (event.key === "End") nextHue = 360;
                      else if (event.key === "PageUp") nextHue += 10;
                      else if (event.key === "PageDown") nextHue -= 10;
                      else return;
                      event.preventDefault();
                      updateHueAndEmit(Math.max(0, Math.min(360, nextHue)));
                    }}
                    onPointerDown={(e) => {
                      isDraggingHue.current = true;
                      isDraggingSat.current = false;
                      handleHuePointer(e.clientX);
                    }}
                    className="relative flex min-h-12 w-full cursor-pointer touch-none items-center rounded-full ring-1 ring-ring-control outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    style={{
                      background:
                        "linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)",
                    }}
                    role="slider"
                    aria-label="Spektrum warna hue"
                    aria-valuemin={0}
                    aria-valuemax={360}
                    aria-valuenow={Math.round(hue)}
                  >
                    {/* Thumb Penanda Hue */}
                    <div
                      className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-control ring-1 ring-ring-control"
                      style={{
                        left: `${(hue / 360) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Baris 2: Quick-Pick Presets Studio */}
      {presets && presets.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-support font-bold text-on-surface-variant">
            Pilihan Cepat Studio:
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {presets.map((preset) => {
              const isSelected = value.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const normalized = preset.hex.toUpperCase();
                    setHexInput(normalized);
                    const nextHsv = hexToHsv(normalized);
                    hueRef.current = nextHsv.h;
                    satRef.current = nextHsv.s;
                    valRef.current = nextHsv.v;
                    setHue(nextHsv.h);
                    setSat(nextHsv.s);
                    setVal(nextHsv.v);
                    onChange(normalized);
                  }}
                  className={cx(
                    "flex min-h-12 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-meta font-bold outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                    isSelected
                      ? "bg-primary text-on-primary shadow-primary"
                      : "border border-outline-variant/25 bg-surface-container-lowest text-on-surface shadow-control hover:bg-surface-container-low",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                  aria-pressed={isSelected}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/60"
                    style={{ backgroundColor: preset.hex }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FormField wrapper untuk ColorPicker.
 */
export function ColorPickerField({
  id,
  label,
  value,
  onChange,
  presets,
  helper,
  error,
  required,
  disabled,
}: {
  readonly id?: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (hex: string) => void;
  readonly presets?: readonly ColorPresetOption[];
  readonly helper?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
}): React.JSX.Element {
  const generatedId = useId();
  const controlId = id ?? `${generatedId}-control`;
  const messageId = helper || error ? `${generatedId}-message` : undefined;

  return (
    <FormField
      label={label}
      helper={helper}
      error={error}
      htmlFor={controlId}
      helperId={messageId}
      required={required}
    >
      <CustomColorPicker
        id={controlId}
        value={value}
        onChange={onChange}
        presets={presets}
        disabled={disabled}
        ariaLabel={label}
      />
    </FormField>
  );
}
