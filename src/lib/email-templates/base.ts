/**
 * Template base de e-mail — layout wrapper responsivo.
 * Todos os templates específicos usam este wrapper.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cachola.cloud'

export function wrapInLayout(
  title: string,
  body: string,
  ctaUrl?: string,
  ctaLabel?: string,
  preheader?: string,
): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#F5F4F0;">${preheader}</div>`
    : ''

  const ctaHtml =
    ctaUrl && ctaLabel
      ? `<tr>
          <td align="center" style="padding:24px 0 8px;">
            <a href="${APP_URL}${ctaUrl}"
              style="display:inline-block;background:#7C8D78;color:#ffffff;font-size:14px;
                     font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;
                     letter-spacing:0.2px;">
              ${ctaLabel}
            </a>
          </td>
        </tr>`
      : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheaderHtml}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F4F0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:560px;background:#FFFFFF;border-radius:12px;border:1px solid #E8E6E1;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#7C8D78;padding:20px 28px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">
                Cachola OS
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 28px 8px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1A1A1A;line-height:1.3;">
                ${title}
              </h1>
              ${body}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${ctaHtml}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px 24px;border-top:1px solid #EEF0EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
                Este e-mail foi enviado automaticamente pelo sistema Cachola OS.<br />
                Se você não esperava esta mensagem, pode ignorá-la com segurança.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
