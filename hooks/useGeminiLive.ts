import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { ChatMessage } from '../types';

interface UseGeminiLiveReturn {
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  messages: ChatMessage[];
  volume: number; // For visualization
  error: string | null;
  inputMediaStream: MediaStream | null;
}

const generateImageTool: FunctionDeclaration = {
  name: 'generate_image',
  description: 'Generate an image based on the user\'s description. Use this when the user asks to see, draw, or create an image.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: 'The description of the image to generate. If the user speaks in Urdu, translate the core visual concept to English for better results.',
      },
    },
    required: ['prompt'],
  },
};

export const useGeminiLive = (): UseGeminiLiveReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [inputMediaStream, setInputMediaStream] = useState<MediaStream | null>(null);

  // Refs for cleanup and processing
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const currentTurnRef = useRef<{ input: string; output: string }>({ input: '', output: '' });
  
  // Animation frame for volume visualizer
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualizerFrameRef = useRef<number | null>(null);

  const disconnect = useCallback(() => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then((session) => session.close()).catch(() => {});
      sessionPromiseRef.current = null;
    }

    // Stop all audio playback
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    audioSourcesRef.current.clear();

    // Close audio contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Stop media stream
    if (inputMediaStream) {
      inputMediaStream.getTracks().forEach(track => track.stop());
      setInputMediaStream(null);
    }

    // Stop visualizer
    if (visualizerFrameRef.current) {
      cancelAnimationFrame(visualizerFrameRef.current);
    }

    setIsConnected(false);
    nextStartTimeRef.current = 0;
  }, [inputMediaStream]);

  const updateVolume = () => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      // Calculate average volume
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setVolume(avg);
      visualizerFrameRef.current = requestAnimationFrame(updateVolume);
    }
  };

  // Helper to generate image
  const executeGenerateImage = async (prompt: string): Promise<string | null> => {
    try {
      if (!process.env.API_KEY) return null;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (e) {
      console.error("Image generation failed", e);
      return null;
    }
  };

  const connect = useCallback(async () => {
    setError(null);
    try {
      if (!process.env.API_KEY) {
        throw new Error("API Key not found");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Setup Audio Contexts
      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const inputCtx = new InputContextClass({ sampleRate: 16000 });
      inputAudioContextRef.current = inputCtx;
      
      const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const outputCtx = new OutputContextClass({ sampleRate: 24000 });
      outputAudioContextRef.current = outputCtx;

      // Setup output node
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      // Get Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setInputMediaStream(stream);

      // Setup Visualizer
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      visualizerFrameRef.current = requestAnimationFrame(updateVolume);

      // Connect session
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }, 
          },
          systemInstruction: { parts: [{ text: "You are QaseemAiwala, a helpful Islamic assistant. You speak Urdu. Verify Hadiths strictly. If a Hadith is fabricated (Maudhu), reject it politely. If authentic, explain briefly. You can also generate images if the user asks. Use the `generate_image` tool for this. When generating an image, confirm to the user you are doing it. Keep responses concise." }] },
          tools: [{ functionDeclarations: [generateImageTool] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            
            // Setup Input Processing
            const source = inputCtx.createMediaStreamSource(stream);
            source.connect(analyser); // Connect to visualizer
            
            // Send audio to Gemini
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(err => {
                  console.error("Error sending input:", err);
              });
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination); // Required for script processor to run
            sourceNodeRef.current = source;
          },
          onmessage: async (msg: LiveServerMessage) => {
            const { serverContent, toolCall } = msg;

            // Handle Tool Calls (Image Generation)
            if (toolCall) {
              for (const call of toolCall.functionCalls) {
                if (call.name === 'generate_image') {
                  const prompt = (call.args as any).prompt;
                  // Notify user in chat effectively (optional, usually audio handles it, but visual cue is good)
                  
                  // Execute generation
                  const imageUrl = await executeGenerateImage(prompt);
                  let result = "failed";

                  if (imageUrl) {
                    result = "success";
                    // Add image message to chat
                    setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      role: 'model',
                      text: `Generated image for: ${prompt}`,
                      image: imageUrl,
                      isFinal: true,
                      timestamp: new Date()
                    }]);
                  }

                  // Send response back
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: {
                        id: call.id,
                        name: call.name,
                        response: { result: result }
                      }
                    });
                  });
                }
              }
            }

            // Handle Transcriptions
            if (serverContent?.inputTranscription) {
               const text = serverContent.inputTranscription.text;
               if (text) {
                 currentTurnRef.current.input += text;
                 // Update partial user message
                 setMessages(prev => {
                   const last = prev[prev.length - 1];
                   if (last && last.role === 'user' && !last.isFinal) {
                     return [...prev.slice(0, -1), { ...last, text: currentTurnRef.current.input }];
                   } else {
                     return [...prev, { id: Date.now().toString(), role: 'user', text: currentTurnRef.current.input, isFinal: false, timestamp: new Date() }];
                   }
                 });
               }
            }

            if (serverContent?.outputTranscription) {
              const text = serverContent.outputTranscription.text;
              if (text) {
                currentTurnRef.current.output += text;
                // Update partial model message
                 setMessages(prev => {
                   const last = prev[prev.length - 1];
                   if (last && last.role === 'model' && !last.isFinal) {
                     return [...prev.slice(0, -1), { ...last, text: currentTurnRef.current.output }];
                   } else {
                     return [...prev, { id: Date.now().toString(), role: 'model', text: currentTurnRef.current.output, isFinal: false, timestamp: new Date() }];
                   }
                 });
              }
            }

            if (serverContent?.turnComplete) {
              // Finalize messages
              setMessages(prev => prev.map(m => ({ ...m, isFinal: true })));
              currentTurnRef.current = { input: '', output: '' };
            }

            // Handle Audio Output
            const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              const uint8 = base64ToUint8Array(base64Audio);
              const audioBuffer = await decodeAudioData(uint8, ctx);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);

              // Schedule playback
              const currentTime = ctx.currentTime;
              const startTime = Math.max(currentTime, nextStartTimeRef.current);
              source.start(startTime);
              nextStartTimeRef.current = startTime + audioBuffer.duration;
              
              audioSourcesRef.current.add(source);
              source.onended = () => audioSourcesRef.current.delete(source);
            }

            // Handle Interruption
            if (serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => s.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              currentTurnRef.current.output = ''; // Clear output buffer on interrupt
            }
          },
          onclose: () => {
            setIsConnected(false);
          },
          onerror: (e) => {
            console.error(e);
            setError("Connection error encountered.");
            setIsConnected(false);
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect");
      setIsConnected(false);
    }
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
    messages,
    volume,
    error,
    inputMediaStream
  };
};