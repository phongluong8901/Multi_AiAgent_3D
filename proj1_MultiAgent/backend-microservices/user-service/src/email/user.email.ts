import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // true cho port 465, false cho các port khác
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendEmail = async (to: string, subject: string, htmlContent: string) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Claw Office" <support@clawoffice.local>',
            to,
            subject,
            html: htmlContent,
        });
    } catch (error: any) {
        throw new Error(`Gửi email thất bại: ${error.message}`);
    }
};