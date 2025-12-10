// src/auth/validation/email/email.service.ts
import * as nodemailer from 'nodemailer';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  /** Enviar código de verificación */
  async sendVerificationCode(to: string, code: string) {
    const subject =
      'Tu código de verificación (10 min) – Congreso Internacional TI';

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${this.configService.get('EMAIL_FROM_NAME') ?? 'Congreso Internacional TI'}" <${this.configService.get('EMAIL_USER')}>`,
      to,
      subject,
      html: this.generateVerificationTemplate(code),
      text: this.generateVerificationText(code),
      headers: {
        'X-Entity-Ref-ID': Date.now().toString(),
        'X-Mailer': 'NestJS/Nodemailer',
      },
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Correo enviado a ${to}`);
    } catch (error) {
      this.logger.error(`❌ Error enviando correo a ${to}`, error.stack);
      throw new InternalServerErrorException(
        'No se pudo enviar el correo de verificación',
      );
    }
  }

  /** Texto plano (fallback) */
  private generateVerificationText(code: string): string {
    const appName = this.configService.get('APP_NAME') ?? 'Congreso Internacional TI';
    const support =
      this.configService.get('SUPPORT_EMAIL') ??
      this.configService.get('EMAIL_USER') ??
      '';
    return `${appName}

Tu código de verificación es: ${code}
Este código expira en 10 minutos.

Si no solicitaste este código, puedes ignorar este mensaje.
Soporte: ${support}`;
  }

  /** Plantilla HTML profesional y compatible con clientes de correo */
  /** Plantilla HTML alternativa */
private generateVerificationTemplate(code: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Código de verificación</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f5f7fa;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #333;
    }
    .container {
      max-width: 620px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 6px 18px rgba(0,0,0,0.08);
    }
    .header {
      background: linear-gradient(135deg, #132953, #24A1E4);
      color: #ffffff;
      text-align: center;
      padding: 40px 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      color: #cde7ff;
    }
    .content {
      padding: 36px 28px;
      text-align: center;
    }
    .content h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #132953;
    }
    .code-box {
      display: inline-block;
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 10px;
      padding: 18px 24px;
      margin: 24px 0;
      background: #f0f4ff;
      border-radius: 10px;
      color: #132953;
      border: 2px dashed #24A1E4;
    }
    .cta {
      margin: 28px 0;
    }
    .cta a {
      background: #24A1E4;
      color: #ffffff;
      text-decoration: none;
      padding: 14px 26px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 8px;
      display: inline-block;
    }
    .event-info {
      text-align: left;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
      font-size: 14px;
      color: #444;
    }
    .footer {
      background: #132953;
      color: #a8b3c9;
      text-align: center;
      padding: 20px;
      font-size: 13px;
    }
    .footer a {
      color: #24A1E4;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Encabezado -->
    <div class="header">
      <h1>3er Congreso Internacional TI</h1>
      <p>Tecnologías de la Información • Innovación Digital</p>
    </div>

    <!-- Contenido -->
    <div class="content">
      <h2>Tu código de verificación</h2>
      <p>Introduce este código en la plataforma para completar tu registro. El código vence en <strong>10 minutos</strong>.</p>
      <div class="code-box">${code}</div>

      <!-- Info evento -->
      <div class="event-info">
        <p><strong> Fecha:</strong> 12–14 de noviembre 2025</p>
        <p><strong> Lugar:</strong> Universidad Tecnológica de Tecamachalco (UTTECAM)</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>© 2025 Congreso Internacional de Tecnologías de la Información</p>
      <p>Contacto: <a href="mailto:elitdesing046@gmail.com">elitdesing046@gmail.com</a></p>
      <p>Si no solicitaste este código, ignora este mensaje.</p>
    </div>
  </div>
</body>
</html>
  `;
}
}