param(
  [string]$ScreenshotsDir = "demo-screenshots",
  [string]$OutputFile = "demo-screenshots\promo-video.mp4"
)

$ErrorActionPreference = "Stop"
$ffmpeg = "ffmpeg"

$fps = 25
$segDur = 4.5
$xFadeDur = 0.4

$screenshots = @(
  "01-landing.png", "02-dashboard.png", "03-library.png",
  "04-slides.png", "05-exam.png", "06-pricing.png", "07-settings.png"
)

$narrations = @(
  "Meet Acu, your AI-powered study companion. Upload your notes, PDFs, and textbooks, and let AI do the rest.",
  "Track your study progress on the dashboard. See your active streak, upcoming exams, and recent activity at a glance.",
  "Your personal library keeps all your study materials organized in one place. Upload and access anything, anytime.",
  "Convert your notes into beautiful, AI-generated slides for quick revision. Perfect for last-minute exam prep.",
  "Practice with AI-generated exam questions. Get instant feedback and detailed explanations for every answer.",
  "Choose a plan that works for you. Start free with two documents, or go premium for unlimited access and features.",
  "Customize your experience in Settings. Your data is synced to the cloud for access across all your devices."
)

$tempDir = Join-Path $ScreenshotsDir "tmp"
if (!(Test-Path $tempDir)) { New-Item $tempDir -ItemType Directory -Force | Out-Null }

# --- Step 1: Generate TTS ---
Write-Host "=== Step 1: TTS Narration ===" -ForegroundColor Cyan
try {
  Add-Type -AssemblyName System.Speech
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try { $synth.SelectVoice("Microsoft Zira Desktop") } catch { }
  $synth.Rate = 0
} catch {
  Write-Warning "TTS unavailable, using silent audio."
  $synth = $null
}

$wavFiles = @()
for ($i = 0; $i -lt $narrations.Count; $i++) {
  $w = Join-Path $tempDir "n$('{0:D2}' -f ($i+1)).wav"
  Write-Host "  $($i+1). $($narrations[$i].Substring(0,[Math]::Min(50,$narrations[$i].Length)))"
  if ($synth) {
    $synth.SetOutputToWaveFile($w)
    $synth.Speak($narrations[$i])
    $synth.SetOutputToNull()
  }
  $wavFiles += $w
}
if ($synth) { $synth.Dispose() }

# Concat all WAV into one
$fullAudio = Join-Path $tempDir "full.wav"
$wavList = $wavFiles | ForEach-Object { "file '$_'" }
Set-Content -Path (Join-Path $tempDir "wavs.txt") -Value ($wavList -join "`n")
& $ffmpeg -f concat -safe 0 -i (Join-Path $tempDir "wavs.txt") -c copy $fullAudio -y 2>$null

# --- Step 2: Create each video segment with Ken Burns ---
Write-Host "=== Step 2: Video Segments ===" -ForegroundColor Cyan
$segFiles = @()
for ($i = 0; $i -lt $screenshots.Count; $i++) {
  $img = Join-Path $ScreenshotsDir $screenshots[$i]
  $out = Join-Path $tempDir "s$('{0:D2}' -f ($i+1)).mp4"
  $segFiles += $out
  
  $nf = [Math]::Round($segDur * $fps)
  $hf = [Math]::Round($xFadeDur * $fps)
  
  # Ken Burns zoom + slight pan, add silent audio for filter compatibility
  $vf = "zoompan=z='if(lte(on,1),1,min(1.05,1+on*0.05/$nf))':d=$nf:s=1440x900:fps=$fps,format=yuv420p"
  
  Write-Host "  $($i+1). $($screenshots[$i])"
  # Create with silent audio channel
  $null = & $ffmpeg -loop 1 -i "$img" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -vf "$vf" -t $segDur -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -y $out 2>&1
  
  if (!(Test-Path $out)) {
    Write-Warning "    fallback: no zoom"
    $null = & $ffmpeg -loop 1 -i "$img" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t $segDur -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -y $out 2>&1
  }
}

# --- Step 3: Concat video segments with crossfade ---
Write-Host "=== Step 3: Crossfade concat ===" -ForegroundColor Cyan
$inputArgs = @()
for ($i = 0; $i -lt $segFiles.Count; $i++) {
  $inputArgs += "-i"
  $inputArgs += "`"$($segFiles[$i])`""
}

# Build filter complex: xfade video + acrossfade audio
$filters = @()
for ($i = 0; $i -lt $segFiles.Count; $i++) {
  $filters += "[$i:v]setpts=PTS-STARTPTS[v$i];"
  $filters += "[$i:a]aresample=44100[a$i];"
}

# Video crossfade chain
$vPrev = "[v0]"
for ($i = 1; $i -lt $segFiles.Count; $i++) {
  $off = ($i-1) * ($segDur - $xFadeDur)
  $vPrev = "xf$i"
  $filters += "[xf$($i-1)][v$i]xfade=transition=fade:duration=$xFadeDur:offset=$off[xf$i];"
}
# Fix: first xfade uses [v0][v1]
$vFinal = "[xf$($segFiles.Count-1)]"

# Audio crossfade chain
$aPrev = "[a0]"
for ($i = 1; $i -lt $segFiles.Count; $i++) {
  $off = ($i-1) * ($segDur - $xFadeDur)
  $aPrev = "af$i"
  $filters += "[af$($i-1)][a$i]acrossfade=d=$xFadeDur:c1=nofade[af$i];"
}
$aFinal = "[af$($segFiles.Count-1)]"

# Handle special case for single segment
if ($segFiles.Count -eq 1) {
  $vFinal = "[v0]"
  $aFinal = "[a0]"
} else {
  # Replace first iteration (xfade filter doesn't start with xf0)
  $filters[2] = "[v0][v1]xfade=transition=fade:duration=$xFadeDur:offset=0[xf1];"
  $filters[2 + $segFiles.Count] = "[a0][a1]acrossfade=d=$xFadeDur:c1=nofade[af1];"
}

$filterStr = $filters -join ""

$concatVideo = Join-Path $tempDir "concat.mp4"
$ffmpegArgs = @(
  $inputArgs -join " ",
  "-filter_complex", "`"$filterStr`"",
  "-map", $vFinal,
  "-map", $aFinal,
  "-c:v", "libx264", "-preset", "fast", "-crf", "23",
  "-c:a", "aac", "-b:a", "128k",
  "-shortest",
  "-y", "`"$concatVideo`""
)
$ffCmd = "& $ffmpeg $($ffmpegArgs -join ' ') 2>&1"
$ffOut = Invoke-Expression $ffCmd

if (!(Test-Path $concatVideo)) {
  Write-Warning "Crossfade failed, using plain concat..."
  Set-Content -Path (Join-Path $tempDir "concat-list.txt") -Value ($segFiles | ForEach-Object { "file '$_'" })
  & $ffmpeg -f concat -safe 0 -i (Join-Path $tempDir "concat-list.txt") -c copy $concatVideo -y 2>$null
}

if (!(Test-Path $concatVideo)) {
  Write-Error "Video creation failed."
  exit 1
}

# --- Step 4: Overlay TTS audio ---
Write-Host "=== Step 4: Mix TTS audio ===" -ForegroundColor Cyan

# Get video duration
$vd = $segFiles.Count * $segDur

# Pad audio to match video
$paddedAudio = Join-Path $tempDir "padded.wav"
& $ffmpeg -i $fullAudio -af "apad=whole_dur=$vd" -c:a pcm_s16le -y $paddedAudio 2>$null

# Final mix
& $ffmpeg -i $concatVideo -i $paddedAudio -c:v copy -c:a aac -b:a 128k -map 0:v -map 1:a -shortest -movflags +faststart -y $OutputFile 2>$null

if ($LASTEXITCODE -eq 0 -and (Test-Path $OutputFile)) {
  Write-Host "=== VIDEO CREATED: $OutputFile ===" -ForegroundColor Green
  Write-Host "  Size: $((Get-Item $OutputFile).Length / 1MB -as [int]) MB" -ForegroundColor Green
  Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
} else {
  Write-Error "Final render failed."
}
