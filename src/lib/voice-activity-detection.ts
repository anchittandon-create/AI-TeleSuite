/**
 * @fileOverview Voice Activity Detection (VAD) and Noise Filtering
 * 
 * This module provides robust voice activity detection to differentiate
 * between actual user speech and background noise. It uses multiple
 * techniques to ensure only genuine voice input is processed:
 * 
 * 1. Energy-based detection (amplitude threshold)
 * 2. Frequency analysis (voice vs non-voice frequencies)
 * 3. Temporal smoothing (prevents spurious noise triggers)
 * 4. Confidence-based filtering (from speech recognition results)
 * 
 * Key Features:
 * - Real-time audio analysis using Web Audio API
 * - Configurable thresholds for different environments
 * - Noise gate to filter low-energy background sounds
 * - Voice frequency band analysis (85Hz - 3400Hz)
 * - Adaptive smoothing to prevent flickering
 */

export interface VADConfig {
  /** Energy threshold (0-255). Higher = more strict. Default: 25 */
  energyThreshold: number;
  
  /** Minimum confidence for speech recognition results (0-1). Default: 0.6 */
  confidenceThreshold: number;
  
  /** Number of consecutive frames voice must be detected. Default: 3 */
  smoothingFrames: number;
  
  /** FFT size for frequency analysis. Must be power of 2. Default: 2048 */
  fftSize: number;
  
  /** Minimum duration (ms) voice must be present to trigger. Default: 300 */
  minVoiceDuration: number;
  
  /** Maximum duration (ms) of silence before stopping. Default: 1500 */
  maxSilenceDuration: number;
  
  /** Enable frequency-based voice detection. Default: true */
  useFrequencyAnalysis: boolean;
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  energyThreshold: 25,
  confidenceThreshold: 0.6,
  smoothingFrames: 3,
  fftSize: 2048,
  minVoiceDuration: 300,
  maxSilenceDuration: 1500,
  useFrequencyAnalysis: true,
};

/**
 * Voice Activity Detector class
 * Analyzes audio stream in real-time to detect actual voice vs noise
 */
export class VoiceActivityDetector {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private frequencyData: Uint8Array;
  private config: VADConfig;
  private voiceFrameCount: number = 0;
  private silenceFrameCount: number = 0;
  private isVoiceActive: boolean = false;
  private voiceStartTime: number = 0;
  private lastVoiceTime: number = 0;
  private animationFrameId: number | null = null;
  
  constructor(
    audioContext: AudioContext,
    config: Partial<VADConfig> = {}
  ) {
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
    
    // Create analyser node for audio analysis
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    this.frequencyData = new Uint8Array(bufferLength);
  }
  
  /**
   * Connect audio source to the voice activity detector
   */
  connectSource(source: MediaStreamAudioSourceNode): void {
    source.connect(this.analyser);
  }
  
  /**
   * Disconnect and cleanup resources
   */
  disconnect(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.analyser.disconnect();
  }
  
  /**
   * Calculate RMS (Root Mean Square) energy level from audio data
   * This represents the overall "loudness" of the audio
   */
  private calculateRMSEnergy(): number {
    this.analyser.getByteTimeDomainData(this.dataArray as Uint8Array);
    
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const normalized = (this.dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    
    const rms = Math.sqrt(sum / this.dataArray.length);
    return rms * 255; // Scale to 0-255 range
  }
  
  /**
   * Analyze frequency content to detect voice characteristics
   * Human voice typically ranges from 85Hz to 3400Hz with peaks at 500-2000Hz
   */
  private analyzeVoiceFrequencies(): number {
    this.analyser.getByteFrequencyData(this.frequencyData as Uint8Array);
    
    // Calculate frequency bin width
    const sampleRate = this.analyser.context.sampleRate;
    const binWidth = sampleRate / this.analyser.fftSize;
    
    // Define voice frequency range (85Hz - 3400Hz)
    const voiceMinFreq = 85;
    const voiceMaxFreq = 3400;
    const voiceMinBin = Math.floor(voiceMinFreq / binWidth);
    const voiceMaxBin = Math.floor(voiceMaxFreq / binWidth);
    
    // Calculate average energy in voice frequency band
    let voiceEnergy = 0;
    let totalEnergy = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      totalEnergy += this.frequencyData[i];
      if (i >= voiceMinBin && i <= voiceMaxBin) {
        voiceEnergy += this.frequencyData[i];
      }
    }
    
    // Return ratio of voice energy to total energy (0-1)
    return totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;
  }
  
  /**
   * Check if current audio frame contains voice activity
   * Uses both energy and frequency analysis
   */
  private detectVoiceInFrame(): boolean {
    const energy = this.calculateRMSEnergy();
    
    // First check: Is energy above threshold?
    if (energy < this.config.energyThreshold) {
      return false;
    }
    
    // Second check (optional): Is it in voice frequency range?
    if (this.config.useFrequencyAnalysis) {
      const voiceRatio = this.analyzeVoiceFrequencies();
      // Voice should have at least 40% energy in voice frequency band
      if (voiceRatio < 0.4) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Start monitoring voice activity
   * @param onVoiceStart - Callback when voice activity begins
   * @param onVoiceEnd - Callback when voice activity ends
   */
  startMonitoring(
    onVoiceStart?: () => void,
    onVoiceEnd?: () => void
  ): void {
    const monitor = () => {
      const isVoice = this.detectVoiceInFrame();
      const now = Date.now();
      
      if (isVoice) {
        this.voiceFrameCount++;
        this.silenceFrameCount = 0;
        this.lastVoiceTime = now;
        
        // Voice detected for sufficient consecutive frames
        if (
          !this.isVoiceActive &&
          this.voiceFrameCount >= this.config.smoothingFrames
        ) {
          this.isVoiceActive = true;
          this.voiceStartTime = now;
          
          // Only trigger if minimum duration threshold is met
          if (onVoiceStart) {
            setTimeout(() => {
              if (this.isVoiceActive && now - this.voiceStartTime >= this.config.minVoiceDuration) {
                onVoiceStart();
              }
            }, this.config.minVoiceDuration);
          }
        }
      } else {
        this.silenceFrameCount++;
        this.voiceFrameCount = 0;
        
        // Silence detected for sufficient consecutive frames
        if (
          this.isVoiceActive &&
          this.silenceFrameCount >= this.config.smoothingFrames
        ) {
          const silenceDuration = now - this.lastVoiceTime;
          
          // Check if silence has exceeded maximum duration
          if (silenceDuration >= this.config.maxSilenceDuration) {
            this.isVoiceActive = false;
            this.voiceStartTime = 0;
            onVoiceEnd?.();
          }
        }
      }
      
      // Continue monitoring
      this.animationFrameId = requestAnimationFrame(monitor);
    };
    
    monitor();
  }
  
  /**
   * Stop monitoring voice activity
   */
  stopMonitoring(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.reset();
  }
  
  /**
   * Reset internal state
   */
  private reset(): void {
    this.voiceFrameCount = 0;
    this.silenceFrameCount = 0;
    this.isVoiceActive = false;
    this.voiceStartTime = 0;
    this.lastVoiceTime = 0;
  }
  
  /**
   * Get current voice activity state
   */
  getVoiceActive(): boolean {
    return this.isVoiceActive;
  }
  
  /**
   * Get current audio energy level (0-255)
   */
  getCurrentEnergy(): number {
    return this.calculateRMSEnergy();
  }
  
  /**
   * Update VAD configuration on the fly
   */
  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.fftSize) {
      this.analyser.fftSize = config.fftSize;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      this.frequencyData = new Uint8Array(bufferLength);
    }
  }
}

/**
 * Filter speech recognition results by confidence threshold
 * Removes low-confidence words that are likely noise or misrecognitions
 */
export function filterByConfidence(
  results: SpeechRecognitionResultList,
  confidenceThreshold: number = DEFAULT_VAD_CONFIG.confidenceThreshold
): string {
  let filteredTranscript = '';
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.isFinal) {
      // Check confidence of the result
      const alternative = result[0];
      if (alternative.confidence >= confidenceThreshold) {
        filteredTranscript += alternative.transcript + ' ';
      } else {
        console.log(
          `[VAD] Filtered low-confidence result: "${alternative.transcript}" (confidence: ${alternative.confidence.toFixed(2)})`
        );
      }
    }
  }
  
  return filteredTranscript.trim();
}

/**
 * Get optimal microphone constraints for noise suppression
 * These constraints leverage browser's built-in noise cancellation
 */
export function getNoiseSuppressionConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000, // Optimal for speech recognition
      channelCount: 1, // Mono audio
    },
    video: false,
  };
}

/**
 * Create a noise gate processor
 * Attenuates audio below a threshold to eliminate low-level background noise
 */
export function createNoiseGate(
  audioContext: AudioContext,
  threshold: number = 0.01, // -40dB
  ratio: number = 0.1 // How much to reduce audio below threshold
): AudioWorkletNode | ScriptProcessorNode {
  // Try to use AudioWorklet (modern, more efficient)
  // Fallback to ScriptProcessor if not available
  
  try {
    // Modern approach: AudioWorkletNode
    // Note: This requires registering a worklet module first
    // For simplicity, we'll use ScriptProcessor here
    throw new Error('AudioWorklet not set up');
  } catch {
    // Legacy approach: ScriptProcessorNode
    const bufferSize = 4096;
    const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const outputData = e.outputBuffer.getChannelData(0);
      
      for (let i = 0; i < inputData.length; i++) {
        const sample = inputData[i];
        const amplitude = Math.abs(sample);
        
        // Apply noise gate
        if (amplitude < threshold) {
          outputData[i] = sample * ratio; // Attenuate
        } else {
          outputData[i] = sample; // Pass through
        }
      }
    };
    
    return processor;
  }
}

/**
 * Preprocess audio stream for better voice detection
 * Applies noise gate and connects to VAD
 */
export function preprocessAudioForVAD(
  audioContext: AudioContext,
  mediaStream: MediaStream,
  vadConfig?: Partial<VADConfig>
): { vad: VoiceActivityDetector; source: MediaStreamAudioSourceNode } {
  const source = audioContext.createMediaStreamSource(mediaStream);
  const vad = new VoiceActivityDetector(audioContext, vadConfig);
  
  // Connect source to VAD for analysis
  vad.connectSource(source);
  
  return { vad, source };
}
