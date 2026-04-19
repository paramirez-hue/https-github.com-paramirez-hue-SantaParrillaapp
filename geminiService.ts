
import { GoogleGenAI, Type } from "@google/genai";

export const getSmartSuggestions = async (currentMenu: any[], currentOrders: any[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analiza el siguiente menú y pedidos actuales para dar 3 consejos estratégicos de ventas o gestión para hoy.
      Menú: ${JSON.stringify(currentMenu)}
      Pedidos Recientes: ${JSON.stringify(currentOrders)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              impact: { type: Type.STRING, description: 'Alta, Media o Baja' }
            },
            required: ['title', 'description', 'impact']
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Error in Gemini service:", error);
    return [];
  }
};

export const generateUpsellSuggestion = async (cartItems: any[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Basado en estos productos: ${JSON.stringify(cartItems)}, sugiere un producto adicional. Responde solo con el nombre y una breve razón.`,
    });
    return response.text || null;
  } catch (error) {
    return null;
  }
};

export const improveDescription = async (foodName: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Redacta una descripción corta, irresistible y gourmet para un plato llamado "${foodName}". Máximo 15 palabras.`,
    });
    return response.text?.trim() || "";
  } catch (error) {
    return "";
  }
};

export const generateFoodImage = async (foodName: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A high-quality professional food photography of a ${foodName} served on a plate, warm lighting, restaurant style, 4k, bokeh background.` }]
      },
      config: {
        imageConfig: { aspectRatio: "4:3" }
      }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};
