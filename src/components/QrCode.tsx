"use client";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  value: string;
  size?: number;
}

export default function QrCode({ value, size = 160 }: Props) {
  return (
    <div className="inline-flex rounded-2xl overflow-hidden border border-white/10 bg-white p-3 shadow-lg">
      <QRCodeSVG
        value={value}
        size={size}
        bgColor="#ffffff"
        fgColor="#0a0f1e"
        level="M"
      />
    </div>
  );
}
