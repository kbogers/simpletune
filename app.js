// SimpleTune - Guitar Tuner
// Uses Web Audio API with autocorrelation for pitch detection

// Standard guitar tuning frequencies (in Hz)
const GUITAR_STRINGS = [
    { note: 'E', octave: 2, freq: 82.41, label: 'E2' },
    { note: 'A', octave: 2, freq: 110.00, label: 'A' },
    { note: 'D', octave: 3, freq: 146.83, label: 'D' },
    { note: 'G', octave: 3, freq: 196.00, label: 'G' },
    { note: 'B', octave: 3, freq: 246.94, label: 'B' },
    { note: 'E', octave: 4, freq: 329.63, label: 'E4' }
];

// All notes for chromatic detection
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// A4 = 440 Hz reference
const A4_FREQ = 440;
const A4_MIDI = 69;

// Tuning thresholds
const IN_TUNE_CENTS = 5; // Within ±5 cents is considered in tune
const MIN_VOLUME = 0.01; // Minimum RMS volume to detect pitch

// Smoothing
const EMA_ALPHA = 0.2; // Exponential moving average smoothing factor (0.1-0.3, lower = smoother)

// Audio context and nodes
let audioContext = null;
let analyser = null;
let mediaStream = null;
let isListening = false;
let animationId = null;
let lockedStringIndex = null; // Index of locked string, or null if unlocked
let smoothedFrequency = null; // Smoothed frequency value for EMA

// DOM elements
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');
const noteEl = document.querySelector('.note');
const octaveEl = document.querySelector('.octave');
const hzValueEl = document.querySelector('.hz-value');
const centsValueEl = document.querySelector('.cents-value');
const meterSegmentsEl = document.getElementById('meterSegments');
const stringButtons = document.querySelectorAll('.string');

// Initialize
startBtn.addEventListener('click', toggleListening);
initializeMeter();
initializeStringButtons();

async function toggleListening() {
    if (isListening) {
        stopListening();
    } else {
        await startListening();
    }
}

async function startListening() {
    try {
        // Request microphone access
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            } 
        });

        // Create audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create analyser node
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 4096; // Higher for better frequency resolution
        analyser.smoothingTimeConstant = 0.8;

        // Connect microphone to analyser
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);

        isListening = true;
        updateUI();
        statusEl.textContent = 'Listening...';
        statusEl.classList.remove('error');

        // Start pitch detection loop
        detectPitch();

    } catch (error) {
        console.error('Microphone access error:', error);
        statusEl.textContent = 'Microphone access denied';
        statusEl.classList.add('error');
    }
}

function stopListening() {
    isListening = false;

    // Stop animation loop
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Stop media stream
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Close audio context
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    // Reset smoothing
    smoothedFrequency = null;

    // Reset UI
    resetDisplay();
    updateUI();
    statusEl.textContent = '';
}

function updateUI() {
    if (isListening) {
        startBtn.classList.add('listening');
        startBtn.innerHTML = `
            <span class="material-symbols-rounded">mic_off</span>
            <span>Stop</span>
        `;
    } else {
        startBtn.classList.remove('listening');
        startBtn.innerHTML = `
            <span class="material-symbols-rounded">mic</span>
            <span>Start Tuning</span>
        `;
    }
}

function initializeMeter() {
    // Create 25 segments: 12 flat (left), 1 center, 12 sharp (right)
    const segments = [];
    
    // Flat segments (left to center)
    for (let i = 12; i >= 1; i--) {
        const segment = document.createElement('div');
        segment.className = 'meter-segment';
        if (i === 1) {
            segment.classList.add('flat-1');
        } else if (i <= 2) {
            segment.classList.add('flat-2');
        } else if (i <= 4) {
            segment.classList.add('flat-3');
        } else if (i <= 7) {
            segment.classList.add('flat-4');
        } else if (i <= 10) {
            segment.classList.add('flat-5');
        } else {
            segment.classList.add('flat-extreme');
        }
        segments.push(segment);
    }
    
    // Center segment
    const centerSegment = document.createElement('div');
    centerSegment.className = 'meter-segment center';
    segments.push(centerSegment);
    
    // Sharp segments (center to right)
    for (let i = 1; i <= 12; i++) {
        const segment = document.createElement('div');
        segment.className = 'meter-segment';
        if (i === 1) {
            segment.classList.add('sharp-1');
        } else if (i <= 2) {
            segment.classList.add('sharp-2');
        } else if (i <= 4) {
            segment.classList.add('sharp-3');
        } else if (i <= 7) {
            segment.classList.add('sharp-4');
        } else if (i <= 10) {
            segment.classList.add('sharp-5');
        } else {
            segment.classList.add('sharp-extreme');
        }
        segments.push(segment);
    }
    
    meterSegmentsEl.append(...segments);
}

function initializeStringButtons() {
    stringButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => toggleStringLock(index));
    });
}

function toggleStringLock(index) {
    if (lockedStringIndex === index) {
        // Unlock
        lockedStringIndex = null;
        stringButtons[index].classList.remove('locked');
    } else {
        // Lock to this string
        lockedStringIndex = index;
        // Remove lock from all other strings
        stringButtons.forEach((btn, i) => {
            if (i === index) {
                btn.classList.add('locked');
            } else {
                btn.classList.remove('locked');
            }
        });
    }
}

function resetDisplay() {
    noteEl.textContent = '—';
    noteEl.classList.remove('in-tune');
    octaveEl.textContent = '';
    hzValueEl.textContent = '—';
    centsValueEl.textContent = '0';
    
    // Clear all segments
    const segments = meterSegmentsEl.querySelectorAll('.meter-segment');
    segments.forEach(seg => seg.classList.remove('active'));
    
    stringButtons.forEach(btn => {
        btn.classList.remove('active', 'in-tune');
    });
    
    // Note: Don't reset lockedStringIndex - keep lock state even when not listening
}

function detectPitch() {
    if (!isListening) return;

    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(buffer);

    // Calculate RMS volume
    let rms = 0;
    for (let i = 0; i < bufferLength; i++) {
        rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / bufferLength);

    // Only process if there's enough signal
    if (rms > MIN_VOLUME) {
        const frequency = autoCorrelate(buffer, audioContext.sampleRate);
        
        if (frequency !== -1) {
            // Apply exponential moving average smoothing
            if (smoothedFrequency === null) {
                // Initialize with first valid reading
                smoothedFrequency = frequency;
            } else {
                // EMA: smoothed = alpha * new + (1 - alpha) * previous
                smoothedFrequency = EMA_ALPHA * frequency + (1 - EMA_ALPHA) * smoothedFrequency;
            }
            updateDisplay(smoothedFrequency);
        }
    } else {
        // Fade out display when no signal
        smoothedFrequency = null; // Reset smoothing when signal is lost
        noteEl.classList.remove('in-tune');
        const segments = meterSegmentsEl.querySelectorAll('.meter-segment');
        segments.forEach(seg => seg.classList.remove('active'));
        stringButtons.forEach(btn => btn.classList.remove('active', 'in-tune'));
    }

    animationId = requestAnimationFrame(detectPitch);
}

// Autocorrelation algorithm for pitch detection
function autoCorrelate(buffer, sampleRate) {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = -1;
    
    // Minimum and maximum periods to check (in samples)
    // For guitar: roughly 80Hz (low E) to 400Hz (high E)
    const minPeriod = Math.floor(sampleRate / 400); // ~110 samples at 44.1kHz
    const maxPeriod = Math.floor(sampleRate / 80);   // ~551 samples at 44.1kHz
    
    // Scan through all possible periods
    for (let offset = minPeriod; offset < Math.min(MAX_SAMPLES, maxPeriod); offset++) {
        let sum = 0;
        let sumSq1 = 0;
        let sumSq2 = 0;

        // Calculate autocorrelation with normalization
        for (let i = 0; i < MAX_SAMPLES - offset; i++) {
            const val1 = buffer[i];
            const val2 = buffer[i + offset];
            sum += val1 * val2;
            sumSq1 += val1 * val1;
            sumSq2 += val2 * val2;
        }
        
        // Normalized correlation coefficient
        const norm = Math.sqrt(sumSq1 * sumSq2);
        if (norm > 0) {
            const correlation = sum / norm;
            
            // Track the best correlation
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        }
    }

    // Only return if we found a good correlation
    if (bestCorrelation > 0.2 && bestOffset > 0) {
        return sampleRate / bestOffset;
    }
    
    return -1;
}

function updateDisplay(frequency) {
    let cents;
    let displayNote;
    let displayOctave;
    
    if (lockedStringIndex !== null) {
        // Locked to a specific string - show deviation from that string's target
        const lockedString = GUITAR_STRINGS[lockedStringIndex];
        cents = Math.round(1200 * Math.log2(frequency / lockedString.freq));
        displayNote = lockedString.note;
        displayOctave = lockedString.octave;
    } else {
        // Not locked - show detected note
        const noteInfo = getNoteFromFrequency(frequency);
        cents = noteInfo.cents;
        displayNote = noteInfo.note;
        displayOctave = noteInfo.octave;
    }
    
    // Update note display
    noteEl.textContent = displayNote;
    octaveEl.textContent = displayOctave;
    hzValueEl.textContent = frequency.toFixed(1);
    
    // Update cents display
    centsValueEl.textContent = cents >= 0 ? `+${cents}` : cents;
    
    // Update meter segments (cents range: -50 to +50, mapped to 25 segments)
    const clampedCents = Math.max(-50, Math.min(50, cents));
    const segments = meterSegmentsEl.querySelectorAll('.meter-segment');
    const numSegments = segments.length;
    
    if (numSegments === 0) return; // Safety check
    
    // Map -50 to +50 cents to segment indices 0 to (numSegments - 1)
    // With 25 segments: -50 maps to 0, 0 maps to 12 (center), +50 maps to 24
    const centsRange = 100; // -50 to +50
    const segmentIndex = Math.round((clampedCents + 50) / (centsRange / (numSegments - 1)));
    const clampedSegmentIndex = Math.max(0, Math.min(numSegments - 1, segmentIndex));
    
    // Clear all segments
    segments.forEach(seg => {
        if (seg) seg.classList.remove('active');
    });
    
    // Check if in tune first
    const isInTune = Math.abs(cents) <= IN_TUNE_CENTS;
    const centerIndex = Math.floor(numSegments / 2); // Center segment index
    
    if (isInTune) {
        // In tune - only light center segment (green)
        if (segments[centerIndex]) {
            segments[centerIndex].classList.add('active');
        }
    } else {
        // Not in tune - light segments from just after center to current position
        // (don't light the center segment itself when not in tune)
        if (clampedSegmentIndex < centerIndex) {
            // Flat - light from just before center to flat side
            for (let i = centerIndex - 1; i >= clampedSegmentIndex; i--) {
                if (segments[i]) {
                    segments[i].classList.add('active');
                }
            }
        } else {
            // Sharp - light from just after center to sharp side
            for (let i = centerIndex + 1; i <= clampedSegmentIndex; i++) {
                if (segments[i]) {
                    segments[i].classList.add('active');
                }
            }
        }
    }
    
    if (isInTune) {
        noteEl.classList.add('in-tune');
    } else {
        noteEl.classList.remove('in-tune');
    }
    
    // Update string indicators
    updateStringIndicators(frequency, isInTune);
}

function getNoteFromFrequency(frequency) {
    // Calculate MIDI note number from frequency
    const midiNote = 12 * Math.log2(frequency / A4_FREQ) + A4_MIDI;
    const roundedMidi = Math.round(midiNote);
    
    // Calculate cents deviation from the nearest note
    const cents = Math.round((midiNote - roundedMidi) * 100);
    
    // Get note name and octave
    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;
    
    return {
        note: NOTE_NAMES[noteIndex],
        octave: octave,
        midi: roundedMidi,
        cents: cents,
        frequency: frequency
    };
}

function updateStringIndicators(frequency, isInTune) {
    // If locked, only update the locked string
    if (lockedStringIndex !== null) {
        stringButtons.forEach((btn, index) => {
            btn.classList.remove('active', 'in-tune');
            if (index === lockedStringIndex) {
                if (isInTune) {
                    btn.classList.add('in-tune');
                } else {
                    btn.classList.add('active');
                }
            }
        });
        return;
    }
    
    // Not locked - find the closest guitar string
    let closestString = null;
    let minDistance = Infinity;
    
    GUITAR_STRINGS.forEach((string, index) => {
        // Calculate cents distance from this string's target frequency
        const centsFromString = 1200 * Math.log2(frequency / string.freq);
        const distance = Math.abs(centsFromString);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestString = index;
        }
    });
    
    // Update string button states (but preserve locked state)
    stringButtons.forEach((btn, index) => {
        // Don't remove 'locked' class
        btn.classList.remove('active', 'in-tune');
        
        if (index === closestString && minDistance < 100) {
            if (isInTune && minDistance < IN_TUNE_CENTS) {
                btn.classList.add('in-tune');
            } else {
                btn.classList.add('active');
            }
        }
    });
}
