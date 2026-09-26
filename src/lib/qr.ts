import "server-only";
import QRCode from "qrcode";
import { appUrl } from "./email";

export function scanUrl(qrCodeToken: string): string {
  return `${appUrl()}/scan/${qrCodeToken}`;
}

/** QR code vectoriel (SVG) pointant vers /scan/{qr_code_token}. */
export async function qrSvg(qrCodeToken: string): Promise<string> {
  return QRCode.toString(scanUrl(qrCodeToken), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
