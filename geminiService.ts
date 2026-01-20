
import { GoogleGenAI, Type } from "@google/genai";

// Guidelines suggest creating the instance right before the API call to ensure the latest API key from process.env.API_KEY is used.

export const getSmartSuggestions = async (currentMenu: any[], currentOrders: any[]) => {
  try {
    // Initializing right before use as per guidelines to handle potential dynamic API key updates.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Using gemini-3-pro-preview for complex strategic reasoning tasks as per guidelines.
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

    // Extract text property directly from the response (property, not a method).
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Error in Gemini service:", error);
    return [];
  }
};

export const generateUpsellSuggestion = async (cartItems: any[]) => {
  try {
    // Initializing right before use as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Using gemini-3-flash-preview for a simpler text-based suggestion task.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Basado en estos productos en el carrito: ${JSON.stringify(cartItems)}, sugiere un producto adicional que combine bien para aumentar el ticket promedio. Responde solo con el nombre del producto y una breve razón.`,
    });
    // Use .text property directly.
    return response.text || null;
  } catch (error) {
    console.error("Error in Gemini upsell service:", error);
    return null;
  }
};
