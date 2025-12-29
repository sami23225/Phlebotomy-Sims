
import { GoogleGenAI, Type } from "@google/genai";
import { Stats, Step, PatientResponse } from "../types";

// The API key is provided via environment variables in this environment.
// Using process.env.API_KEY directly as per @google/genai guidelines.
const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a contextual response from the 'patient' based on trainee input.
 */
export const getPatientResponse = async (
  userMessage: string,
  currentStep: Step,
  stats: Stats
): Promise<PatientResponse> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: `I am the trainee. I just said to the patient: "${userMessage}"` }] }],
    config: {
      systemInstruction: `You are "John Doe", a patient in a high-fidelity phlebotomy simulation. 
      You are naturally nervous about needles and medical procedures.
      Current Procedural Step: ${currentStep.label}.
      Your current pain/anxiety level is ${stats.painLevel}%.
      
      Respond as the patient. If the trainee is empathetic and explains steps clearly, your anxiety should decrease. 
      If they are clinical, cold, or confusing, your anxiety should increase.
      Keep the spoken response short (1-2 sentences).
      
      You MUST respond ONLY with a JSON object:
      {
        "response": "the spoken text",
        "anxietyChange": number (between -10 and 10)
      }`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          response: { type: Type.STRING },
          anxietyChange: { type: Type.NUMBER }
        },
        required: ["response", "anxietyChange"]
      }
    }
  });

  try {
    const text = response.text || '{"response": "...", "anxietyChange": 0}';
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse patient response", e);
    return { response: "I... I just want this to be over.", anxietyChange: 2 };
  }
};

/**
 * Provides real-time clinical guidance from an 'instructor'.
 */
export const getInstructorAdvice = async (
  currentStep: Step,
  needleAngle: number,
  needleDepth: number,
  stats: Stats,
  isTourniquetOn: boolean,
  isFlashbackVisible: boolean
): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ 
      parts: [{ 
        text: `Trainee State: 
        Step: ${currentStep.label}
        Needle Angle: ${needleAngle}° (Target 25°)
        Needle Depth: ${needleDepth}% (Target 75%)
        Patient Anxiety: ${stats.painLevel}%
        Tourniquet Applied: ${isTourniquetOn}
        Blood Flashback Observed: ${isFlashbackVisible}` 
      }] 
    }],
    config: {
      systemInstruction: "You are a world-class phlebotomy instructor. Provide a single, concise, professional sentence of advice to the trainee based on their current performance metrics. Be constructive and clinically precise."
    }
  });
  return response.text || "Ensure you are following standard safety protocols.";
};

/**
 * Generates a comprehensive final evaluation of the simulation session.
 */
export const generateFinalReview = async (
  stats: Stats,
  timer: number
): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [{ 
      parts: [{ 
        text: `Final Metrics: 
        Technique Accuracy: ${stats.technique}%
        Patient Comfort Score: ${100 - stats.painLevel}%
        Total Completion Time: ${timer} seconds
        Sample Volume Collected: ${stats.bloodVolume}%` 
      }] 
    }],
    config: {
      systemInstruction: "You are the Lead Clinical Auditor. Provide a 2-paragraph professional critique of the phlebotomy performance. The first paragraph should focus on technical proficiency and safety. The second paragraph should focus on bedside manner and patient communication. Use formal medical terminology."
    }
  });
  return response.text || "The evaluation report is currently being processed by the clinical department.";
};
