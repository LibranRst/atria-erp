"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppIcon } from "../icon/app-icon";
import { FormField } from "./basic-form-controls";
import { cx } from "./form-control-utils";

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
  readonly value: string;
  readonly onChange: (hex: string) => void;
  readonly presets?: readonly ColorPresetOption[];
  readonly disabled?: boolean;
  readonly className?: string;
  readonly ariaLabel?: string;
}

/**
 * Custom Color Picker interaktif yang 100% mengikuti Atria Design System & iOS form style.
 * Menggunakan kanvas saturasi/brightness HSV, slider hue pelangi, input HEX langsung,
 * serta preset cepat dengan highlight aktif.
 */
export function CustomColorPicker({
  value,
  onChange,
  presets,
  disabled = false,
  className,
  ariaLabel = "Pemilih warna kustom",
}: CustomColorPickerProps): React.JSX.Element {
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
    (nextSat: number, nextVal: number) => {
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
    (nextHue: number) => {
      hueRef.current = nextHue;
      setHue(nextHue);
      const nextHex = hsvToHex(nextHue, satRef.current, valRef.current);
      setHexInput(nextHex);
      onChange(nextHex);
    },
    [onChange],
  );

  const handleSatPointer = useCallback(
    (clientX: number, clientY: number) => {
      const area = satAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

      const s = x / rect.width;
      const v = 1 - y / rect.height;

      updateSatValAndEmit(s, v);
    },
    [updateSatValAndEmit],
  );

  const handleHuePointer = useCallback(
    (clientX: number) => {
      const track = hueTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
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
  const hasEyeDropper =
    typeof window !== "undefined" && "EyeDropper" in window;

  const handleEyeDropper = async (): Promise<void> => {
    try {
      const globalWindow = window as unknown as Record<string, unknown>;
      const EyeDropperClass = globalWindow.EyeDropper;
      if (typeof EyeDropperClass === "function") {
        const instance = new (EyeDropperClass as new () => {
          open: () => Promise<{ sRGBHex?: string }>;
        })();
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
      <div className="flex items-center gap-3">
        {/* Swatch Lingkaran Interaktif */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cx(
            "relative h-9 w-9 shrink-0 rounded-full border border-white/80 shadow-control ring-1 ring-ring-control transition-all outline-none",
            "hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-focus-ring",
            disabled && "cursor-not-allowed opacity-50",
          )}
          style={{ backgroundColor: value || "#000000" }}
          aria-label={`${ariaLabel}. Warna saat ini: ${value}`}
          aria-expanded={isOpen}
        >
          <span className="sr-only">Buka kontrol warna visual</span>
        </button>

        {/* Input HEX Monospaced yang dapat diedit langsung */}
        <div className="relative min-w-0 flex-1">
          <input
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
            aria-label="Input kode warna HEX"
            className={cx(
              "h-9 w-full rounded-full border border-outline-variant/35 bg-surface-container-lowest px-3.5 font-mono text-xs font-bold text-on-surface uppercase shadow-control transition outline-none",
              "placeholder:text-on-surface-variant/55 focus:border-accent focus:ring-2 focus:ring-focus-ring",
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
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant/35 bg-surface-container-lowest text-on-surface-variant shadow-control transition outline-none",
              "hover:bg-surface-container-low hover:text-on-surface active:scale-95 focus-visible:ring-2 focus-visible:ring-focus-ring",
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
            "flex h-9 items-center gap-1.5 rounded-full px-3 text-meta font-bold transition outline-none active:scale-[0.97]",
            isOpen
              ? "bg-primary text-on-primary shadow-primary"
              : "border border-outline-variant/35 bg-surface-container-lowest text-on-surface shadow-control hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring",
            disabled && "cursor-not-allowed opacity-50",
          )}
          aria-expanded={isOpen}
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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              height: { duration: 0.28, ease: [0.32, 0.94, 0.6, 1] },
              opacity: { duration: 0.2, ease: "linear" },
            }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low/60 p-3 shadow-sm backdrop-blur-sm">
              <div className="space-y-3">
                {/* Kanvas 2D: Saturasi (Horizontal) x Brightness (Vertikal) */}
                <div
                  ref={satAreaRef}
                  onPointerDown={(e) => {
                    isDraggingSat.current = true;
                    isDraggingHue.current = false;
                    handleSatPointer(e.clientX, e.clientY);
                  }}
                  className="relative h-36 w-full cursor-crosshair touch-none select-none rounded-xl overflow-hidden shadow-inner ring-1 ring-black/10"
                  style={{
                    backgroundColor: pureHueColor,
                    backgroundImage: `
                      linear-gradient(to top, #000000, transparent),
                      linear-gradient(to right, #FFFFFF, transparent)
                    `,
                  }}
                  role="slider"
                  aria-label="Saturasi dan kecerahan warna"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(val * 100)}
                  aria-valuetext={`Saturasi ${Math.round(sat * 100)}%, Nilai ${Math.round(val * 100)}%`}
                >
                  {/* Thumb Penanda Warna Aktif */}
                  <div
                    className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30"
                    style={{
                      left: `${sat * 100}%`,
                      top: `${(1 - val) * 100}%`,
                      backgroundColor: value,
                    }}
                  />
                </div>

                {/* Slider Hue Pelangi (0° - 360°) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant">
                    <span>Spektrum Spektrum (Hue)</span>
                    <span className="font-mono tabular-nums">{Math.round(hue)}°</span>
                  </div>
                  <div
                    ref={hueTrackRef}
                    onPointerDown={(e) => {
                      isDraggingHue.current = true;
                      isDraggingSat.current = false;
                      handleHuePointer(e.clientX);
                    }}
                    className="relative h-4 w-full cursor-pointer touch-none select-none rounded-full shadow-inner ring-1 ring-black/10"
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
                      className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-md ring-1 ring-black/20"
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
          <span className="text-[11px] font-bold text-on-surface-variant">
            Pilihan Cepat Studio:
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {presets.map((preset) => {
              const isSelected =
                value.toLowerCase() === preset.hex.toLowerCase();
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
                    "flex min-h-9 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-meta font-bold transition active:scale-[0.97]",
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
        value={value}
        onChange={onChange}
        presets={presets}
        disabled={disabled}
        ariaLabel={label}
      />
    </FormField>
  );
}
