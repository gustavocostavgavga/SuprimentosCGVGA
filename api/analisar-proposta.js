import { GoogleGenerativeAI } from '@google/generative-ai';

// ===================================================================
// DESBLOQUEIO DE LIMITE DE MEMÓRIA DA VERCEL
// Necessário para permitir que PDFs pesados cheguem até aqui (padrão é 1MB)
// ===================================================================
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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
    // AGORA RECEBEMOS: O texto do e-mail, o PDF convertido e os itens da cotação
    const { textoProposta, pdfBase64, itensSolicitados } = req.body;

    if (!textoProposta && !pdfBase64) {
      return res.status(400).json({ error: 'Nenhum dado (texto ou PDF) fornecido para análise.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // O NOVO PROMPT MESTRE (Modo Avançado com Cruzamento Semântico)
    const promptText = `
      Você é um analista sênior de suprimentos e orçamento. Sua missão é extrair dados comerciais da proposta fornecida (no PDF em anexo e/ou no texto a seguir).
      
      Texto da proposta no corpo do e-mail (caso o PDF não tenha todas as informações): 
      "${textoProposta || 'Sem texto'}"

      Abaixo está a lista exata de ITENS SOLICITADOS em formato JSON pelo sistema:
      ${JSON.stringify(itensSolicitados)}

      TAREFA:
      1. Encontre a Razão Social do fornecedor, CNPJ, Frete Total (R$), Prazo de Entrega e Condição de Pagamento.
      2. Extraia a tabela de preços.
      3. MÁGICA DE SINÔNIMOS: O fornecedor quase nunca escreve o nome do insumo idêntico ao nosso sistema. Ex: Solicitamos "Cabo Flex 2,5mm", ele cotou "Fio Cobre 2.5mm BWF". 
      Você DEVE cruzar semanticamente os itens da proposta com a lista de ITENS SOLICITADOS.

      Você DEVE retornar APENAS um objeto JSON válido, sem crases, sem formatação markdown.
      Estrutura OBRIGATÓRIA de resposta:
      {
        "fornecedor": "Razao Social",
        "cnpj": "XX.XXX.XXX/XXXX-XX",
        "frete": 150.00,
        "prazo": "10 dias",
        "condicao": "30/60/90 dias",
        "imposto": 0,
        "itens": [
          {
            "id": "COLOQUE_AQUI_O_ID_DO_ITEM_SOLICITADO_QUE_DEU_MATCH",
            "descricaoFornecedor": "A descrição exata que o fornecedor usou na cotação",
            "preco_unitario": 25.50
          }
        ]
      }
      Seja preciso. Se um item solicitado não constar na proposta, não o inclua na resposta.
    `;

    // ARRAY DE DADOS: Combina as instruções com o arquivo PDF (se ele existir)
    const parts = [{ text: promptText }];
    
    if (pdfBase64) {
        parts.push({
            inlineData: {
                data: pdfBase64,
                mimeType: "application/pdf"
            }
        });
    }

    // Passamos o array "parts" inteiro para o Gemini (Textos + Arquivos)
    const result = await model.generateContent(parts);
    const response = await result.response;
    let text = response.text();

    // Limpa o texto caso a IA mande blocos de formatação markdown
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Devolve o JSON estruturado para a sua tela!
    res.status(200).json(JSON.parse(text));

  } catch (error) {
    console.error("Erro na API da IA:", error);
    res.status(500).json({ error: 'Erro ao processar a proposta com a Inteligência Artificial.', detalhes: error.message });
  }
}
