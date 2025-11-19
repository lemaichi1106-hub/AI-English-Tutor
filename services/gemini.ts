import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LessonContent, AssessmentResult, ChatMessage, ChatResponse } from "../types";

// Initialize the Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_FAST = 'gemini-2.5-flash';

// --- Helper to ensure JSON parsing is robust ---
const cleanAndParseJSON = (text: string) => {
  try {
    // Remove Markdown code block syntax if present
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // Handle cases where there might be text before or after the JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Parse Error:", e, "Original Text:", text);
    throw new Error("Failed to parse AI response.");
  }
};

/**
 * Generates lesson content (vocabulary and sentence patterns) for a given topic.
 */
export const generateLessonContent = async (topic: string): Promise<LessonContent> => {
  const prompt = `Create an English learning lesson plan for the topic: "${topic}".
  Target audience: Vietnamese speakers learning English.
  
  Generate a strict JSON object containing:
  1. 'topic': The topic title.
  2. 'vocabulary': An array of 5 key words. For each item, you MUST provide non-empty values for:
     - 'word': ONLY the English word (e.g., "Barista"). Do not include the translation here.
     - 'translation': The Vietnamese meaning.
     - 'context': A complete English sentence using the word.
     - 'phonetic': IPA transcription (e.g. /bəˈrɪstə/).
     - 'pronunciationTip': Specific advice for Vietnamese speakers in Vietnamese.
  3. 'patterns': An array of 3 common sentence patterns with 'pattern', 'example', and 'translation'.

  Ensure all fields are filled. Do not return empty strings or nulls.`;

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
            phonetic: { type: Type.STRING },
            pronunciationTip: { type: Type.STRING },
          },
          required: ['word', 'translation', 'context', 'phonetic', 'pronunciationTip']
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
    return cleanAndParseJSON(text) as LessonContent;
  } catch (error) {
    console.error("Error generating lesson:", error);
    throw error;
  }
};

/**
 * Generates a chat response with suggestions for the user.
 */
export const generateChatResponse = async (
  history: ChatMessage[],
  topic: string,
  audioData?: { base64: string; mimeType: string }
): Promise<ChatResponse> => {
  const systemInstruction = `You are a friendly and helpful English conversational partner role-playing the topic: "${topic}".
  
  Your goals:
  1. Keep the conversation flowing naturally with concise responses (1-3 sentences).
  2. Do not provide corrections or feedback during the conversation. Just reply to the content.
  3. The user is a learner, so speak clearly but naturally.
  4. ALWAYS provide 3 short, simple, natural suggested responses for the user to say next.`;

  // Construct the history for the model
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
          // We can also include the text as a hint if available
          ...(msg.text ? [{ text: msg.text }] : [])
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
      suggestions: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "3 short suggested replies for the user"
      }
    },
    required: ['response', 'suggestions'],
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
    
    const result = cleanAndParseJSON(text);
    return {
      text: result.response,
      // Feedback is now deferred to the Assessment phase
      pronunciationFeedback: null,
      suggestions: result.suggestions || []
    };

  } catch (error) {
    console.error("Chat error:", error);
    return { text: "Sorry, I'm having trouble connecting right now." };
  }
};

/**
 * Analyzes the conversation history and provides assessment feedback.
 * This now handles ALL feedback (grammar, pronunciation implied by transcription errors, etc).
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
  3. A list of specific corrections. Identify grammatical errors, awkward phrasing, or likely pronunciation issues (based on phonetic misinterpretations) from the Student's turns. Show the correction, and explain why (explanation in Vietnamese).`;

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
    return cleanAndParseJSON(text) as AssessmentResult;
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