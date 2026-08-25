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

    // Busca e-mails não lidos dos últimos 3 dias que tenham "proposta" ou "cotação" no assunto
    const searchCriteria = ['UNSEEN', ['SINCE', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)]];
    const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: false }; // markSeen: false para não marcar como lido durante os testes
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    const emailsExtraidos = [];

    for (let item of messages) {
      const all = item.parts.find(p => p.which === 'TEXT');
      const id = item.attributes.uid;
      const idHeader = "Imap-Id: "+id+"\r\n";
      
      const mail = await simpleParser(idHeader + all.body);
      
      // Aqui simplificamos: pegamos o texto do corpo do e-mail para a IA ler. 
      // Numa versão avançada, leríamos o anexo PDF usando 'pdf-parse'.
      emailsExtraidos.push({
        remetente: mail.from.text,
        assunto: mail.subject,
        texto_proposta: mail.text,
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
