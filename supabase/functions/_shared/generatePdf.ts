// @ts-ignore
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'
// @ts-ignore
import QRCode from 'https://esm.sh/qrcode@1.5.4'

const LOGO_URL = 'https://noihnuouftyvsvzybwer.supabase.co/storage/v1/object/public/images/logo/logo-2026.png'

/** Safe base64 encode for large Uint8Arrays (avoids call-stack overflow) */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// Site color palette (0–1 range)
const C = {
  bgDark:    rgb(0.102, 0.031, 0.125),   // #1a0820
  bgMid:     rgb(0.161, 0.063, 0.200),   // #290a33
  bgCard:    rgb(0.141, 0.047, 0.180),   // card bg
  orange:    rgb(0.851, 0.353, 0.169),   // #d95a2b
  orangeB:   rgb(0.941, 0.478, 0.235),   // #f07a3c
  cream:     rgb(0.957, 0.906, 0.816),   // #f4e7d0
  creamDim:  rgb(0.600, 0.540, 0.470),
  creamFade: rgb(0.300, 0.260, 0.220),
  white:     rgb(1, 1, 1),
  border:    rgb(0.220, 0.110, 0.300),
}

function hex(r: number, g: number, b: number) { return rgb(r/255, g/255, b/255) }

export interface TicketOrder {
  buyer_name:   string
  buyer_email:  string
  ticket_tiers: { name: string } | null
}

export interface TicketItem {
  ticket_number: string
  scan_token:    string
}

export async function generateTicketPdf(
  order:   TicketOrder,
  tickets: TicketItem[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  // Fonts
  const fontBold  = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg   = await doc.embedFont(StandardFonts.Helvetica)

  // Logo
  let logoImage: any = null
  try {
    const res       = await fetch(LOGO_URL)
    const logoBytes = new Uint8Array(await res.arrayBuffer())
    logoImage       = await doc.embedPng(logoBytes)
  } catch (e) { console.error('Logo load failed:', e) }

  // One page per ticket
  for (const ticket of tickets) {
    const page   = doc.addPage([595, 842])  // A4 portrait
    const W      = 595
    const H      = 842

    // ── Full dark background ─────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.bgDark })

    // ── Decorative top gradient band ─────────────────────────
    // Simulate gradient with layered rects (orange → transparent)
    const bandH = 160
    page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: C.orange })
    // Overlay dark gradient to blend into bg
    for (let i = 0; i < 40; i++) {
      const alpha = i / 40
      page.drawRectangle({
        x: 0, y: H - bandH + (bandH * i / 40),
        width: W, height: bandH / 40 + 1,
        color: C.bgDark,
        opacity: alpha * 0.55,
      })
    }

    // ── Header text ──────────────────────────────────────────
    page.drawText('OPENLUCHTFUIF', {
      x: 36, y: H - 58,
      size: 34, font: fontBold, color: C.cream,
    })
    page.drawText('PELLENBERG', {
      x: 36, y: H - 84,
      size: 15, font: fontBold, color: C.cream, opacity: 0.75,
    })
    page.drawText('ZATERDAG 29 AUGUSTUS 2026  ·  EDITIE XIV', {
      x: 36, y: H - 108,
      size: 9.5, font: fontReg, color: C.cream, opacity: 0.6,
    })

    // Logo (right side of header)
    if (logoImage) {
      const dims = logoImage.scaleToFit(130, 100)
      page.drawImage(logoImage, {
        x: W - dims.width - 30,
        y: H - bandH + (bandH - dims.height) / 2 + 5,
        width: dims.width, height: dims.height,
      })
    }

    // ── Main ticket card ─────────────────────────────────────
    const cX = 30, cY = 68, cW = W - 60, cH = H - bandH - 88
    page.drawRectangle({
      x: cX, y: cY, width: cW, height: cH,
      color: C.bgCard,
      borderColor: C.border,
      borderWidth: 1,
    })

    // Orange left accent strip
    page.drawRectangle({ x: cX, y: cY, width: 5, height: cH, color: C.orange })

    // ── QR code (left column) ────────────────────────────────
    const qrDataUrl = await QRCode.toDataURL(ticket.scan_token, {
      errorCorrectionLevel: 'H', width: 250, margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
    const qrBase64  = qrDataUrl.split(',')[1]
    const qrBin     = atob(qrBase64)
    const qrBytes   = new Uint8Array(qrBin.length)
    for (let i = 0; i < qrBin.length; i++) qrBytes[i] = qrBin.charCodeAt(i)
    const qrImg     = await doc.embedPng(qrBytes)

    const qrSize = 200
    const qrX    = cX + 36
    const qrY    = cY + (cH / 2) - (qrSize / 2) + 10

    // White QR surround
    page.drawRectangle({ x: qrX - 10, y: qrY - 10, width: qrSize + 20, height: qrSize + 20, color: C.white })
    page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize })

    // Scan label below QR
    page.drawText('TOON AAN DE INGANG', {
      x: qrX + qrSize / 2 - 52, y: qrY - 26,
      size: 8, font: fontBold, color: C.orangeB,
    })

    // ── Details (right column) ───────────────────────────────
    const dX = cX + qrSize + 72
    const dW = cW - (qrSize + 72) - 20

    // Ticket number badge
    page.drawRectangle({
      x: dX, y: cY + cH - 72, width: dW, height: 44,
      color: C.bgMid, borderColor: C.border, borderWidth: 1,
    })
    page.drawText('TICKET NR', {
      x: dX + 12, y: cY + cH - 54,
      size: 7.5, font: fontReg, color: C.orangeB,
    })
    page.drawText(ticket.ticket_number, {
      x: dX + 12, y: cY + cH - 68,
      size: 13, font: fontBold, color: C.cream,
    })

    // Divider
    page.drawLine({
      start: { x: dX, y: cY + cH - 84 },
      end:   { x: dX + dW, y: cY + cH - 84 },
      thickness: 0.5, color: C.border,
    })

    // Info rows
    const rows: [string, string][] = [
      ['NAAM',       order.buyer_name],
      ['CATEGORIE',  order.ticket_tiers?.name ?? 'Ticket'],
      ['DATUM',      'Zaterdag 29 augustus 2026'],
      ['TIJD',       'Deuren open vanaf 16:00'],
      ['LOCATIE',    'Kleine Ganzendries'],
      ['',           'Pellenberg'],
    ]

    let ry = cY + cH - 104
    for (const [label, value] of rows) {
      if (label) {
        page.drawText(label, { x: dX, y: ry, size: 7.5, font: fontReg, color: C.creamDim })
        ry -= 14
      }
      page.drawText(value, { x: dX, y: ry, size: 12, font: label ? fontBold : fontReg, color: C.cream })
      ry -= label ? 30 : 18
    }

    // ── Perforated tear line ─────────────────────────────────
    const tearY  = cY + 52
    const dashW  = 7, gapW = 5
    let   dx     = cX + 15
    while (dx < cX + cW - 15) {
      page.drawLine({
        start: { x: dx, y: tearY },
        end:   { x: Math.min(dx + dashW, cX + cW - 15), y: tearY },
        thickness: 0.5, color: C.creamFade, opacity: 0.45,
      })
      dx += dashW + gapW
    }
    // Below tear line: terms
    page.drawText('NIET OVERDRAAGBAAR  -  BEWAAR DIT TICKET ZORGVULDIG', {
      x: cX + 16, y: tearY - 18,
      size: 7, font: fontReg, color: C.creamFade, opacity: 0.5,
    })

    // ── Footer ───────────────────────────────────────────────
    page.drawText('openluchtfuif3212@gmail.com', {
      x: 36, y: 36, size: 8, font: fontReg, color: C.creamFade, opacity: 0.5,
    })
    page.drawText('© 2026 Openluchtfuif 3212 VZW · Pellenberg', {
      x: W - 200, y: 36, size: 8, font: fontReg, color: C.creamFade, opacity: 0.5,
    })
  }

  return await doc.save()
}
