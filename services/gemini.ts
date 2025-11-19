import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LessonContent, AssessmentResult, ChatMessage, ChatResponse } from "../types";

// Initialize the Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_FAST = 'gemini-2.5-flash';

/**
 * Generates lesson content (vocabulary and sentence patterns) for a given topic.
 */
export const generateLessonContent = async (topic: string): Promise<LessonContent> => {
  const prompt = `Create an English learning lesson plan for the topic: "${topic}".
  Target audience: Vietnamese speakers learning English.
  Include 5 key vocabulary words with Vietnamese translation and context usage.
  Include 3 common sentence patterns relevant to the topic with examples and Vietnamese translations.
  Return JSON only.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING },
      vocabulary: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            translation: { type: Type.STRING },
            context: { type: Type.STRING },
          },
        },
      },
      patterns: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pattern: { type: Type.STRING },
            example: { type: Type.STRING },
            translation: { type: Type.STRING },
          },
        },
      },
    },
    required: ['topic', 'vocabulary', 'patterns'],
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as LessonContent;
  } catch (error) {
    console.error("Error generating lesson:", error);
    throw error;
  }
};

/**
 * Generates a chat response acting as a conversational partner, optionally analyzing audio.
 */
export const generateChatResponse = async (
  history: ChatMessage[],
  topic: string,
  audioData?: { base64: string; mimeType: string }
): Promise<ChatResponse> => {
  const systemInstruction = `You are a friendly and helpful English conversational partner role-playing the topic: "${topic}".
  
  Your goals:
  1. Keep the conversation flowing naturally with concise responses (1-3 sentences).
  2. IF audio is provided, analyze the user's pronunciation. 
     - If pronunciation is good, set 'pronunciationFeedback' to null or a brief praise.
     - If there are errors, set 'pronunciationFeedback' to a helpful tip explaining the mistake and how to fix it (in Vietnamese).
  3. If no audio is provided, set 'pronunciationFeedback' to null.
  
  The user is a learner, so speak clearly but naturally.`;

  // Construct the history for the model
  // We need to handle the last message specially if audio is provided
  const messages = history.map((msg, index) => {
    // If it's the last message (user's current turn) and we have audio data
    if (index === history.length - 1 && msg.role === 'user' && audioData) {
      return {
        role: msg.role,
        parts: [
          { 
            inlineData: { 
              mimeType: audioData.mimeType, 
              data: audioData.base64 
            } 
          },
          // We can also include the text as a hint, or rely solely on audio. 
          // Let's rely on audio for the most accurate pronunciation check, 
          // but include text context if needed.
        ],
      };
    }
    return {
      role: msg.role,
      parts: [{ text: msg.text }],
    };
  });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      response: { type: Type.STRING },
      pronunciationFeedback: { type: Type.STRING, nullable: true },
    },
    required: ['response'],
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: messages,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const result = JSON.parse(text);
    return {
      text: result.response,
      pronunciationFeedback: result.pronunciationFeedback
    };

  } catch (error) {
    console.error("Chat error:", error);
    return { text: "Sorry, I'm having trouble connecting right now." };
  }
};

/**
 * Analyzes the conversation history and provides assessment feedback.
 */
export const generateAssessment = async (
  history: ChatMessage[],
  topic: string
): Promise<AssessmentResult> => {
  // Filter out only the user's messages for detailed analysis, but keep context
  const conversationText = history
    .map((msg) => `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.text}`)
    .join('\n');

  const prompt = `Analyze the following English conversation practice on the topic "${topic}".
  
  Conversation:
  ${conversationText}
  
  Provide an assessment for the Student (User) in JSON format including:
  1. Scores (0-100) for Grammar, Vocabulary (appropriate usage), and Fluency/Relevance.
  2. A short overall constructive comment (in Vietnamese).
  3. A list of specific corrections. Identify grammatical errors or awkward phrasing from the Student's turns, show the correction, and explain why (explanation in Vietnamese).`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      scores: {
        type: Type.OBJECT,
        properties: {
          grammar: { type: Type.NUMBER },
          vocabulary: { type: Type.NUMBER },
          fluency: { type: Type.NUMBER },
        },
      },
      feedback: { type: Type.STRING, description: "Short constructive feedback in Vietnamese" },
      overallComment: { type: Type.STRING, description: "Summary of performance in Vietnamese" },
      corrections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING },
            correction: { type: Type.STRING },
            explanation: { type: Type.STRING, description: "Explanation in Vietnamese" },
          },
        },
      },
    },
    required: ['scores', 'feedback', 'overallComment', 'corrections'],
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No assessment generated");
    return JSON.parse(text) as AssessmentResult;
  } catch (error) {
    console.error("Assessment error:", error);
    // Fallback mock data in case of error
    return {
      scores: { grammar: 0, vocabulary: 0, fluency: 0 },
      feedback: "Could not generate feedback at this time.",
      overallComment: "Please try again later.",
      corrections: []
    };
  }
};