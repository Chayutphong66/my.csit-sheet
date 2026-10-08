const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

function layout(title, body, action) {
  const button = action ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="background:#5b48d6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:700">${escapeHtml(action.label)}</a></p>` : ''
  return `<!doctype html><html lang="th"><body style="margin:0;background:#f5f5f2;font-family:Arial,sans-serif;color:#1f2328"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #ddd;border-radius:12px"><tr><td style="padding:28px"><div style="font-weight:900;color:#5b48d6">CSIT SHEET</div><h1 style="font-size:24px">${escapeHtml(title)}</h1>${body}${button}<p style="color:#656d76;font-size:13px">หากคุณไม่ได้ดำเนินการนี้ คุณสามารถเพิกเฉยต่ออีเมลฉบับนี้ได้<br>CSIT Sheet · Community Academic Document Sharing</p></td></tr></table></td></tr></table></body></html>`
}

export function renderEmail(template, data = {}) {
  const name = escapeHtml(data.displayName || data.username || 'สมาชิก')
  const templates = {
    emailVerification: { subject: 'ยืนยันอีเมล CSIT Sheet · Verify your email', html: layout('ยืนยันอีเมลของคุณ', `<p>สวัสดี ${name}</p><p>กดปุ่มด้านล่างเพื่อยืนยันอีเมลสำหรับบัญชี CSIT Sheet ลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุ</p>`, { label: 'ยืนยันอีเมล · Verify email', url: data.url }) },
    passwordReset: { subject: 'รีเซ็ตรหัสผ่าน CSIT Sheet · Reset password', html: layout('รีเซ็ตรหัสผ่าน', `<p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ ลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุใน ${escapeHtml(data.minutes)} นาที</p>`, { label: 'ตั้งรหัสผ่านใหม่ · Reset password', url: data.url }) },
    passwordChanged: { subject: 'รหัสผ่าน CSIT Sheet ถูกเปลี่ยนแล้ว', html: layout('เปลี่ยนรหัสผ่านสำเร็จ', '<p>รหัสผ่านบัญชีของคุณถูกเปลี่ยนแล้ว หากไม่ใช่คุณ กรุณาติดต่อผู้ดูแลทันที</p>') },
    displayNameChanged: { subject: 'ชื่อที่แสดงใน CSIT Sheet ถูกเปลี่ยนแล้ว', html: layout('อัปเดตชื่อที่แสดงสำเร็จ', `<p>ชื่อที่แสดงเปลี่ยนเป็น <strong>${escapeHtml(data.displayName)}</strong> แล้ว การเปลี่ยนครั้งถัดไปทำได้หลัง ${escapeHtml(data.nextChangeAt)}.</p>`) },
    profileChangeDecision: { subject: `คำขอเปลี่ยน${data.category === 'PROGRAM' ? 'สาขา' : 'รุ่น'}: ${data.status}`, html: layout('ผลการตรวจสอบคำขอ', `<p>คำขอเปลี่ยน${data.category === 'PROGRAM' ? 'สาขา' : 'รุ่น'}เป็น <strong>${escapeHtml(data.requestedValue)}</strong> มีสถานะ <strong>${escapeHtml(data.status)}</strong>.</p>${data.reason ? `<p>หมายเหตุ: ${escapeHtml(data.reason)}</p>` : ''}`) },
    newFollower: { subject: 'มีผู้ติดตามคุณบน CSIT Sheet', html: layout('ผู้ติดตามใหม่', `<p><strong>@${escapeHtml(data.followerUsername)}</strong> เริ่มติดตามคุณแล้ว</p>`, data.url ? { label: 'ดูโปรไฟล์', url: data.url } : null) },
    followedDocument: { subject: 'เอกสารใหม่จากผู้ที่คุณติดตาม', html: layout('มีเอกสารใหม่', `<p><strong>${escapeHtml(data.title)}</strong> โดย @${escapeHtml(data.username)}</p>`, { label: 'ดูเอกสาร', url: data.url }) },
    security: { subject: 'การแจ้งเตือนความปลอดภัย CSIT Sheet', html: layout('Security notification', `<p>${escapeHtml(data.message)}</p>`) }
  }
  if (!templates[template]) throw new Error('Unknown email template')
  return { ...templates[template], text: templates[template].html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }
}
