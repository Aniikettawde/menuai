import type { Metadata } from "next";
import QrGeneratorClient from "./QrGeneratorClient";

export const metadata: Metadata = {
  title: "Free QR Code Generator | Dinezy",
  description:
    "Turn any link into a QR code instantly. 100% free, no sign-up, no limits, no watermark.",
};

export default function QrGeneratorPage() {
  return <QrGeneratorClient />;
}