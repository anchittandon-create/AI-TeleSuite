
export type ConfigPatch = {
  voiceAgent?: {
    bargeIn?: boolean;
    tts?: { interruptible?: boolean };
    asr?: { partialResults?: boolean };
    turnTaking?: { silenceDetection?: { appliedValueMs?: number; vadHangoverMs?: number; minSpeechMs?: number } };
    inactivity?: { reminderMs?: number; reminderMaxRepeats?: number; cooldownMs?: number; gate?: string };
    kb?: { autoRetrieve?: boolean; rerank?: boolean; maxChunks?: number; noConsentPrompt?: boolean };
    ui?: { transcript?: { colorCoding?: boolean } };
    // ...add only the fields you intend to enforce
  };
};

export function applyConfigPatch(patch: ConfigPatch, ctrl: {
  setBargeIn(v:boolean):void;
  setSilence(turnMs:number, hangMs:number, minSpeechMs:number):void;
  setInactivity(ms:number, repeats:number, cooldown:number):void;
  setKB(auto:boolean, max:number, rerank:boolean):void;
  setTranscriptColors(v:boolean):void;
}) {
  const va = patch.voiceAgent || {};
  if (va.bargeIn !== undefined) ctrl.setBargeIn(!!va.bargeIn);
  const sd = va.turnTaking?.silenceDetection;
  if (sd?.appliedValueMs !== undefined) {
    ctrl.setSilence(sd.appliedValueMs, sd.vadHangoverMs ?? 60, sd.minSpeechMs ?? 80);
  }
  const ia = va.inactivity;
  if (ia?.reminderMs !== undefined) {
    ctrl.setInactivity(ia.reminderMs, ia.reminderMaxRepeats ?? 1, ia.cooldownMs ?? 2000);
  }
  const kb = va.kb;
  if (kb?.autoRetrieve !== undefined) {
    ctrl.setKB(!!kb.autoRetrieve, kb.maxChunks ?? 6, !!kb.rerank);
  }
  const ui = va.ui?.transcript;
  if (ui?.colorCoding !== undefined) ctrl.setTranscriptColors(!!ui.colorCoding);
}
