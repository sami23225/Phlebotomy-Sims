
import React from 'react';

export type GameState = 'welcome' | 'procedure' | 'results';

export interface Stats {
  patientSafety: number;
  technique: number;
  painLevel: number;
  bloodVolume: number;
}

export interface Feedback {
  type: 'info' | 'success' | 'error';
  message: string;
}

export interface ChatMessage {
  role: 'trainee' | 'patient' | 'instructor';
  text: string;
}

export interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface PatientResponse {
  response: string;
  anxietyChange: number;
}
