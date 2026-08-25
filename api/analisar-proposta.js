import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Configuração de segurança (CORS) para aceitar requisições do seu front-end
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { textoProposta } = req.body;

    if (!textoProposta) {
      return res.status(400).json({ error: 'Nenhum texto fornecido para análise.' });
    }

    // Chama o Google Gemini usando a chave secreta que escondemos na Vercel
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // O Prompt Mestre que ensina a IA a agir como compradora
    const prompt = `
      Você é um assistente sênior de suprimentos. 
      Analise o texto abaixo, que é uma proposta comercial/cotação recebida de um fornecedor.
      Extraia as informações e me devolva ESTRITAMENTE um formato JSON válido, sem nenhuma outra palavra antes ou depois.
      
      Formato esperado (use 0 se não achar o valor):
      {
        "fornecedor": "Nome do fornecedor",
        "cnpj": "CNPJ se houver",
        "prazo": "Prazo de entrega (ex: 7 dias)",
        "condicao": "Condição de pagamento",
        "frete": 150.00,
        "imposto": 0.00,
        "itens": [
           { "descricao": "Nome do item", "preco_unitario": 12.50 }
        ]
      }

      Texto da Proposta:
      ${textoProposta}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Limpa o texto caso a IA mande blocos de formatação markdown
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Devolve o JSON estruturado para a sua tela!
    res.status(200).json(JSON.parse(text));

  } catch (error) {
    console.error("Erro na API da IA:", error);
    res.status(500).json({ error: 'Erro ao processar a proposta com a Inteligência Artificial.' });
  }
}
