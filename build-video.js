const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = 'demo-screenshots';
const OUTPUT = path.join(SCREENSHOTS_DIR, 'promo-video.mp4');
const TEMP = path.join(SCREENSHOTS_DIR, 'tmp');
const FPS = 25;
const PAD = 0.4; // extra seconds per segment after narration ends

const narrations = [
  'Meet Acudex, your AI-powered study companion. Upload your notes, PDFs, and textbooks, and let AI do the rest.',
  'Track your study progress on the dashboard. See your active streak, and recent activity at a glance.',
  'Your personal library keeps all your study materials organized in one place. Upload and access anything, anytime.',
  'Convert your notes into AI-generated notes, FAQs, MCQs, and more for quick revision. Perfect for last-minute exam prep.',
  'Practice with AI-generated exam questions. Get instant evaluations, feedback and detailed explanations for every answer.',
  'Choose a plan that works for you. Start free with two documents, or go premium for unlimited access and features.',
  'Register now for free 3 months premium for the first 100 users.'
];

// Segment 7 uses pricing screenshot (matches "register now for free")
const screenshots = [
  '01-landing.png', '02-dashboard.png', '03-library.png',
  '04-slides.png', '05-exam.png', '06-pricing.png', '06-pricing.png'
];

const edgeTtsBin = 'C:\\Users\\VI\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\edge-tts.exe';
const ffprobeBin = 'ffprobe';

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'pipe', timeout: opts.timeout || 120000, maxBuffer: 100 * 1024 * 1024, windowsHide: true, ...opts }).toString();
  } catch (e) {
    const s = (e.stderr?.toString() || '') + (e.stdout?.toString() || '');
    const errs = s.split('\n').filter(l => /[Ee]rror/i.test(l) || /[Ff]ailed/i.test(l) || /[Ii]nvalid/i.test(l));
    if (errs.length) errs.slice(0, 3).forEach(l => console.error('    ' + l.trim()));
    return s;
  }
}

function getAudioDuration(wavPath) {
  const out = run(`"${ffprobeBin}" -v error -show_entries format=duration -of csv=p=0 "${wavPath}"`);
  return parseFloat(out.trim()) || 0;
}

if (!fs.existsSync(TEMP)) fs.mkdirSync(TEMP, { recursive: true });

// ---- Step 1: Generate TTS ----
console.log('=== Step 1: TTS (edge-tts — Neerja Expressive) ===');
const wavFiles = [];
const durations = [];
for (let i = 0; i < narrations.length; i++) {
  const wav = path.resolve(TEMP, `n${String(i+1).padStart(2,'0')}.wav`);
  wavFiles.push(wav);
  console.log(`  ${i+1}. ${narrations[i].substring(0, 60)}...`);
  run(`"${edgeTtsBin}" --voice en-IN-NeerjaExpressiveNeural --text ${JSON.stringify(narrations[i])} --write-media "${wav}"`, { timeout: 30000 });
  const dur = getAudioDuration(wav);
  durations.push(dur);
  console.log(`     duration: ${dur.toFixed(1)}s`);
}

// ---- Step 2: Create video segments with matching durations ----
console.log('=== Step 2: Video segments ===');
const segFiles = [];
const segDurations = [];
for (let i = 0; i < screenshots.length; i++) {
  const img = path.resolve(SCREENSHOTS_DIR, screenshots[i]);
  const out = path.resolve(TEMP, `s${String(i+1).padStart(2,'0')}.mp4`);
  segFiles.push(out);
  const segDur = durations[i] + PAD;
  segDurations.push(segDur);
  const nf = Math.round(segDur * FPS);
  console.log(`  ${i+1}. ${screenshots[i]} (${segDur.toFixed(1)}s)`);
  const vf = `zoompan=z=if(lte(on\\,1)\\,1\\,min(1.05\\,1+on*0.05/${nf})):d=${nf}:s=1440x900:fps=${FPS},format=yuv420p`;
  run(`ffmpeg -loop 1 -i "${img}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -vf "${vf}" -t ${segDur} -c:v libx264 -preset fast -crf 23 -c:a aac -ar 44100 -ac 2 -shortest -y "${out}"`);
  if (!fs.existsSync(out) || fs.statSync(out).size < 10000) {
    console.log('    fallback (no zoom)');
    run(`ffmpeg -loop 1 -i "${img}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${segDur} -c:v libx264 -preset fast -crf 23 -c:a aac -ar 44100 -ac 2 -shortest -y "${out}"`);
  }
}

// ---- Step 3: Concat segments ----
console.log('=== Step 3: Concat ===');
const concatVideo = path.resolve(TEMP, 'concat.mp4');
const absPaths = segFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
fs.writeFileSync(path.join(TEMP, 'list.txt'), absPaths);
run(`ffmpeg -f concat -safe 0 -i "${path.join(TEMP, 'list.txt')}" -c copy -y "${concatVideo}"`);

if (!fs.existsSync(concatVideo) || fs.statSync(concatVideo).size < 50000) {
  console.log('  demuxer failed, trying concat filter...');
  const inputs = segFiles.map(f => `-i "${f}"`).join(' ');
  const streams = segFiles.map((_, i) => `[${i}:v][${i}:a]`).join('');
  const filter = `${streams}concat=n=${segFiles.length}:v=1:a=1[outv][outa]`;
  run(`ffmpeg ${inputs} -filter_complex "${filter}" -map "[outv]" -map "[outa]" -c:v libx264 -preset fast -crf 23 -c:a aac -ar 44100 -ac 2 -shortest -y "${concatVideo}"`);
}

if (!fs.existsSync(concatVideo) || fs.statSync(concatVideo).size < 50000) {
  console.error('FATAL: cannot create video');
  process.exit(1);
}

// ---- Step 4: Build TTS audio and mix ----
console.log('=== Step 4: Build TTS audio ===');
const absWavs = wavFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
fs.writeFileSync(path.join(TEMP, 'wav-list.txt'), absWavs);
run(`ffmpeg -f concat -safe 0 -i "${path.join(TEMP, 'wav-list.txt')}" -c copy -y "${path.join(TEMP, 'full.wav')}"`);

const totalDur = segDurations.reduce((a, b) => a + b, 0);
run(`ffmpeg -i "${path.join(TEMP, 'full.wav')}" -af "apad=whole_dur=${totalDur}" -c:a pcm_s16le -y "${path.resolve(TEMP, 'padded.wav')}"`);

console.log(`  Video total: ${totalDur.toFixed(1)}s`);

console.log('=== Step 5: Final mix ===');
run(
  `ffmpeg -i "${concatVideo}" -i "${path.resolve(TEMP, 'padded.wav')}" ` +
  `-c:v copy -c:a aac -b:a 128k -ar 44100 -ac 2 -map 0:v -map 1:a -shortest -movflags +faststart -y "${OUTPUT}"`
);

if (fs.existsSync(OUTPUT)) {
  const mb = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
  console.log(`=== DONE: ${OUTPUT} (${mb} MB, ${totalDur.toFixed(1)}s) ===`);
  fs.rmSync(TEMP, { recursive: true, force: true });
} else {
  console.error('FAILED');
}
