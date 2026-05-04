import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  family: 4
});

export const sendOtpMail = async (to, otp) => {
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to,
    subject: "Reset Your Password",
    html: `<p>
            Your OTP for password reset is <b>${otp}</b>. It expires in 5 minutes.
        </p>`
  })
}

export const sendDeliveryOtpMail = async (customer, otp) => {
  try {
    await transporter.sendMail({
    from: process.env.MAIL_USER,
    to:customer.email,
    subject: "Delivery OTP",
    html: `<p>
            Your OTP for delivery is <b>${otp}</b>. It expires in 5 minutes.
        </p>`
  })
  } catch (error) {
    console.log("mail error func",error);
    
  }
}

export const sendWelcomeMail = async (to, fullname) => {
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to,
    subject: "Welcome to DesiZapp App 🎉",
    html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2>Welcome, ${fullname}!</h2>
    <p>
        Your account has been created successfully. We’re excited to have you on board!
    </p>
    <p>
        You can now log in and start exploring all the features we’ve built for you.
    </p>
    <p>
        If you have any questions, feel free to reach out to our support team.
    </p>
    <hr style="border:none; border-top:1px solid #ddd; margin:20px 0;" />
    <p style="margin:0;">
        Best Regards,<br/>
        <strong>DesiZapp Team</strong>
    </p>
    <p style="margin:5px 0 0 0; font-size:12px; color:#888;">
        📍 Murwara, Madhya Pradesh, India<br/>
        ✉️ support@DesiZappeee.com | 🌐 www.DesiZappeee.com
    </p>
</div>
        `
  });
};
