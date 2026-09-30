import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

export default async function handler(req, res) {
  // Permissões de segurança
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use o método GET.' });
  }

  const config = {
    imap: {
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host: process.env.IMAP_HOST || 'email-ssl.com.br',
      port: 993,
      tls: true,
      authTimeout: 10000
    }
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Busca e-mails não lidos dos últimos 3 dias
    const searchCriteria = ['UNSEEN', ['SINCE', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)]];
    
    // Deixamos a string vazia '' para baixar o e-mail completo (com os anexos)
    const fetchOptions = { bodies: [''], markSeen: false }; 
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    const emailsExtraidos = [];

    for (let item of messages) {
      // Pega o corpo bruto do e-mail
      const all = item.parts.find(p => p.which === '');
      const id = item.attributes.uid;
      const idHeader = "Imap-Id: "+id+"\r\n";
      
      const mail = await simpleParser(idHeader + all.body);
      
      // Inicia o texto com o corpo do e-mail
      let textoProposta = "--- CORPO DO E-MAIL ---\n" + (mail.text || '');
      let pdfBase64 = null; // <- NOVA VARIÁVEL PARA O MODO AVANÇADO

      // Extrai os anexos
      if (mail.attachments && mail.attachments.length > 0) {
        for (let att of mail.attachments) {
          if (att.contentType === 'application/pdf') {
            // Em vez de usar o pdf-parse (que quebra tabelas), convertemos para Base64.
            // Assim o Google Gemini lá na outra API vai conseguir ler a "imagem" do PDF com 100% de precisão!
            pdfBase64 = att.content.toString('base64');
          } else if (att.contentType.includes('text/') || att.contentType.includes('csv')) {
            textoProposta += "\n\n--- TEXTO DO ANEXO (" + att.filename + ") ---\n" + att.content.toString('utf-8');
          }
        }
      }

      emailsExtraidos.push({
        remetente: mail.from?.text || 'Desconhecido',
        assunto: mail.subject || 'Sem Assunto',
        texto_proposta: textoProposta,
        pdfBase64: pdfBase64, // <- ENVIANDO O CÓDIGO DO PDF PARA A TELA
        data: mail.date
      });
    }

    connection.end();
    
    res.status(200).json({ success: true, emails: emailsExtraidos });

  } catch (error) {
    console.error("Erro ao conectar no IMAP Locaweb:", error);
    res.status(500).json({ error: 'Falha ao acessar a caixa de e-mails.', detalhes: error.message });
  }
}
