export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  isFinal: boolean;
  timestamp: Date;
}

export interface AudioVisualizerProps {
  stream: MediaStream | null;
  isListening: boolean;
}