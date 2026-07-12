export async function generateSampleQRCode(
  sampleId: string,
  sampleNumber: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
): Promise<string> {
  const QRCode = await import("qrcode")
  const url = `${baseUrl}/samples/${sampleId}`
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  })
}

export async function generateSampleQRCodeSvg(
  sampleId: string,
  sampleNumber: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
): Promise<string> {
  const QRCode = await import("qrcode")
  const url = `${baseUrl}/samples/${sampleId}`
  return QRCode.toString(url, {
    type: "svg",
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  })
}
