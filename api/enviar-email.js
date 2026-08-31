import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use o método POST.' });

  try {
    const { fornecedores, rcData } = req.body;

    const transporter = nodemailer.createTransport({
      host: process.env.IMAP_HOST || 'email-ssl.com.br',
      port: 465,
      secure: true,
      auth: {
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASS
      }
    });

    // Monta a lista de itens formatada em HTML
    const itemsHtml = rcData.itens.map(i => `<li><b>${i.qtd} ${i.unid}</b> - ${i.desc}</li>`).join('');

    for (const f of fornecedores) {
      if (!f.email) continue; // Pula os que não tem e-mail (vão via WhatsApp)

      const mailOptions = {
        from: `"${rcData.respNome} - Casagrande Urbanismo" <${process.env.IMAP_USER}>`,
        to: f.email,
        subject: `Cotação de Material - Processo ${rcData.numero}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2>Solicitação de Cotação</h2>
            <p>Olá equipe da <strong>${f.nome}</strong>,</p>
            <p>Gostaríamos de solicitar uma proposta comercial para os itens abaixo, referentes ao nosso processo <strong>${rcData.numero}</strong>.</p>
            
            <div style="background: #f4f5f7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <ul style="margin: 0; padding-left: 20px;">${itemsHtml}</ul>
            </div>

            <p><strong>Prazo Máximo de Resposta:</strong> ${rcData.prazo || 'O mais breve possível'}</p>
            <p><strong>Local de Entrega:</strong> ${rcData.local}</p>
            <p><strong>Condição de Pagamento Esperada:</strong> ${rcData.cond || 'A combinar'}</p>
            
            <p style="color: #163b6b; font-weight: bold; margin-top: 30px;">
              Por favor, respondam a este e-mail anexando sua proposta comercial (PDF) ou informando os valores diretamente no corpo do texto.
            </p>
            
            <p>Atenciosamente,<br><strong>${rcData.respNome}</strong><br>Gestão de Suprimentos</p>
          </div>
        `
      };
      
      await transporter.sendMail(mailOptions);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error("Erro no envio:", error);
    res.status(500).json({ error: 'Falha ao enviar.', detalhes: error.message });
  }
}
