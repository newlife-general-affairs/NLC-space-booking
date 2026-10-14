const nodemailer = require('nodemailer');

require('dotenv').config();

// MAIL_ENABLED=false → 不寄信、只記 log（staging 與正式共用資料庫，避免寄給真實使用者）
const MAIL_ENABLED = process.env.MAIL_ENABLED !== 'false';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendBookingConfirmation = async (userEmail, bookingDetails) => {
  let timeInfoHtml = '';
  if (bookingDetails.slots && Array.isArray(bookingDetails.slots) && bookingDetails.slots.length > 0) {
    timeInfoHtml = bookingDetails.slots.map((s, idx) => `
      <li style="margin-bottom: 8px;">
        <strong>時段 ${idx + 1}：</strong> ${s.date} ${s.startTime} - ${s.endTime}
      </li>
    `).join('');
  } else {
    timeInfoHtml = `
      <li><strong>使用日期：</strong> ${bookingDetails.date}</li>
      <li><strong>使用時段：</strong> ${bookingDetails.startTime} - ${bookingDetails.endTime}</li>
    `;
  }

  const mailOptions = {
    from: '"空間租借系統" <no-reply@spaces.test>',
    to: userEmail,
    subject: '🎉 預約成功通知：' + bookingDetails.roomName,
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #4f46e5;">您好，預約已完成！</h2>
        <p>以下是您的預約詳細資訊：</p>
        <ul style="background: #f9fafb; padding: 15px 30px; border-radius: 5px;">
          <li style="margin-bottom: 12px;"><strong>預約空間：</strong> ${bookingDetails.roomName}</li>
          ${timeInfoHtml}
        </ul>
        <p>如需取消預約，請登入系統進行操作。</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <small style="color: #999;">此信件為系統自動發送，請勿直接回覆。</small>
      </div>
    `
  };

  await deliver(mailOptions, '通知信');
};

const sendRoomPassword = async (userEmail, roomName, password) => {
  const mailOptions = {
    from: '"空間租借系統" <no-reply@spaces.test>',
    to: userEmail,
    subject: '🔑 場地存取密碼通知：' + roomName,
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #4f46e5;">您的場地存取密碼</h2>
        <p>您預約的場地 <strong>${roomName}</strong> 已經核准並產生密碼。</p>
        <div style="background: #f9fafb; padding: 15px 30px; border-radius: 5px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 2px;">
          ${password}
        </div>
        <p>請妥善保管此密碼，並於借用時間內使用該密碼進入場地。</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <small style="color: #999;">此信件為系統自動發送，請勿直接回覆。</small>
      </div>
    `
  };

  await deliver(mailOptions, '密碼信');
};

async function deliver(mailOptions, label) {
  if (!MAIL_ENABLED) {
    console.log(`[mail] MAIL_ENABLED=false，略過寄送${label}：${mailOptions.subject} → ${mailOptions.to}`);
    return;
  }
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`${label}已成功發送至：`, mailOptions.to);
    console.log('預覽郵件連結: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('郵件發送失敗：', error);
  }
}

module.exports = { sendBookingConfirmation, sendRoomPassword };
