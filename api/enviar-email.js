import nodemailer from 'nodemailer';

// ===================================================================
// ESTA É A CONFIGURAÇÃO MÁGICA QUE DESBLOQUEIA O LIMITE DE TAMANHO
// Aumenta o limite de recebimento da Vercel de 1MB para 10MB
// ===================================================================
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use o método POST.' });

  try {
    // A variável 'anexos' já está sendo recebida aqui com suporte a múltiplos arquivos
    const { fornecedores, rcData, anexos } = req.body;

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

    // Prepara a mensagem adicional/escopo (se existir) mantendo as quebras de linha com white-space: pre-wrap
    const mensagemAdicionalHtml = rcData.mensagemAdicional ? `
      <div style="background: #e8f0e9; padding: 15px; border-left: 4px solid #24783d; border-radius: 4px; margin: 20px 0;">
        <strong style="color: #0d3b1f; font-size: 14px;">OBSERVAÇÕES DA COTAÇÃO:</strong>
        <div style="margin-top: 10px; font-size: 13px; color: #333; white-space: pre-wrap; font-family: inherit;">${rcData.mensagemAdicional}</div>
      </div>
    ` : '';

    for (const f of fornecedores) {
      if (!f.email) continue; // Pula os que não tem e-mail

      const mailOptions = {
        from: `"${rcData.respNome} - Casagrande Urbanismo" <${process.env.IMAP_USER}>`,
        to: f.email,
        subject: `Cotação de Material/Serviços - Processo ${rcData.numero}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2>Solicitação de Cotação</h2>
            <p>Olá equipe da <strong>${f.nome}</strong>,</p>
            <p>Gostaríamos de solicitar uma proposta comercial para os itens abaixo, referentes ao nosso processo <strong>${rcData.numero}</strong>.</p>
            
            ${mensagemAdicionalHtml}

            <div style="background: #f4f5f7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <ul style="margin: 0; padding-left: 20px;">${itemsHtml}</ul>
            </div>

            <p><strong>Prazo Máximo de Resposta:</strong> ${rcData.prazo || 'O mais breve possível'}</p>
            <p><strong>Empresa de Faturamento (SPE):</strong> ${rcData.speInfo}</p>
            <p><strong>Local de Entrega:</strong> ${rcData.local}</p>
            <p><strong>Condição de Pagamento Esperada:</strong> ${rcData.cond || 'A combinar'}</p>
            
            <!-- AVISO DE ATENÇÃO AOS ANEXOS -->
            <p style="color: #8A2E2E; font-weight: bold; margin-top: 25px; font-size: 14px; border: 1px dashed #8A2E2E; padding: 10px; border-radius: 4px; background: #fff3f3;">
              ⚠️ IMPORTANTE: Caso existam arquivos em anexo a este e-mail (Projetos ou Escopo Executivo), é OBRIGATÓRIA a leitura e análise do detalhamento técnico antes da formulação da proposta.
            </p>
            
            <p style="color: #163b6b; font-weight: bold; margin-top: 20px;">
              Por favor, respondam a este e-mail anexando sua proposta comercial (PDF) ou informando os valores diretamente no corpo do texto.
            </p>
            
            <p>Atenciosamente,<br><strong>${rcData.respNome}</strong><br>Gestão de Suprimentos</p>
          </div>
        `,
        // Anexa os múltiplos PDFs convertidos que vieram do navegador
        attachments: anexos && anexos.length > 0 ? anexos.map(anexo => ({
            filename: anexo.filename,
            content: Buffer.from(anexo.content, 'base64')
        })) : []
      };
      
      await transporter.sendMail(mailOptions);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error("Erro no envio:", error);
    res.status(500).json({ error: 'Falha ao enviar.', detalhes: error.message });
  }
}
