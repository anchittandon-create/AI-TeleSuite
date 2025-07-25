
"use client";

// This component is deprecated and no longer used by the voice agent pages.
// It has been replaced by a simple dropdown of preset voices.
// This file is kept to prevent build errors from potential lingering imports,
// but it should ideally be deleted if no longer imported anywhere.

import React from 'react';

export function VoiceSampleUploader() {
  console.warn("VoiceSampleUploader is deprecated and should be removed.");
  return null; 
}
