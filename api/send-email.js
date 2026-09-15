import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { to, subject, text, html } = req.body || {};
  if (!to) {
    return res.status(400).json({ success: false, error: "Destinatário 'to' é obrigatório." });
  }

  try {
    let smtpConfig = null;

    // 1. Variáveis de ambiente configuradas diretamente na Vercel
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT) === 465
      };
    }

    // 2. Se não estiver nas variáveis da Vercel, buscar no Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!smtpConfig && supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase.from('settings').select('value').eq('key', 'agf_smtp_config').single();
        if (data && data.value) {
          smtpConfig = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        }
      } catch (err) {
        console.warn('Erro ao consultar SMTP do Supabase:', err.message);
      }
    }

    // 2.1 Envio via API do Resend (Sem necessidade de senha de e-mail!)
    const resendKey = process.env.RESEND_API_KEY || smtpConfig?.resendApiKey;
    if (resendKey) {
      const fromEmail = process.env.RESEND_FROM || smtpConfig?.from || 'SysContábil AGF <onboarding@resend.dev>';
      const rRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject: subject || 'Notificação SysContábil',
          text: text || '',
          html: html || `<p>${text || ''}</p>`
        })
      });
      const rData = await rRes.json();
      if (rRes.ok) {
        return res.status(200).json({
          success: true,
          mode: 'resend_api',
          id: rData.id
        });
      } else {
        throw new Error(rData.message || 'Falha ao enviar via Resend API');
      }
    }

    // 3. Enviar via Nodemailer SMTP (Office 365, Gmail, Locaweb, etc.)
    if (smtpConfig && smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port) || 587,
        secure: smtpConfig.secure === true || parseInt(smtpConfig.port) === 465,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const info = await transporter.sendMail({
        from: smtpConfig.from || smtpConfig.user,
        to,
        subject: subject || 'SysContábil Notificação',
        text: text || '',
        html: html || text || ''
      });

      console.log('[Vercel Serverless] E-mail enviado com sucesso:', info.messageId);
      return res.status(200).json({
        success: true,
        mode: 'vercel_serverless_smtp',
        messageId: info.messageId
      });
    }

    // 4. Sem SMTP configurado ainda: simulação com sucesso
    return res.status(200).json({
      success: true,
      mode: 'simulated_no_smtp',
      message: 'Notificação processada no Vercel/Supabase. Para envio real, cadastre as credenciais SMTP no botão Configurar E-mail (SMTP).'
    });

  } catch (error) {
    console.error('Erro no envio do e-mail na Vercel:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Falha ao processar envio na Vercel'
    });
  }
}
