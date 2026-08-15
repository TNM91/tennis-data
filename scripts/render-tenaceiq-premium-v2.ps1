$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$root = Join-Path $repo 'artifacts\tenaceiq-intro-2026-08-14\premium-v4-final'
$frames = Join-Path $root 'frames'
$work = Join-Path $root 'work'
$videoDir = Join-Path $work 'video'
$audioDir = Join-Path $work 'audio'
$narrationDir = Join-Path $root 'audio\narration'
$music = Join-Path $root 'audio\premium-music-bed.wav'
$delivery = Join-Path $repo 'artifacts\tenaceiq-intro-2026-08-14\delivery'
$ffmpeg = Join-Path $repo 'artifacts\usta-walkthrough-2026-08-13\tooling\node_modules\ffmpeg-static\ffmpeg.exe'
New-Item -ItemType Directory -Force -Path $work, $videoDir, $audioDir, $delivery | Out-Null

function Get-AudioDuration([string]$path) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $details = (& $ffmpeg -hide_banner -i $path 2>&1 | Out-String) } finally { $ErrorActionPreference = $previous }
  $match = [regex]::Match($details, 'Duration: ([0-9:.]+)')
  if (-not $match.Success) { throw "Could not read duration for $path" }
  return [TimeSpan]::Parse($match.Groups[1].Value).TotalSeconds
}

function Format-VttTime([double]$seconds) {
  $span = [TimeSpan]::FromSeconds($seconds)
  return '{0:00}:{1:00}:{2:00}.{3:000}' -f [Math]::Floor($span.TotalHours), $span.Minutes, $span.Seconds, $span.Milliseconds
}

function Format-AssTime([double]$seconds) {
  $span = [TimeSpan]::FromSeconds($seconds)
  return '{0}:{1:00}:{2:00}.{3:00}' -f [Math]::Floor($span.TotalHours), $span.Minutes, $span.Seconds, [Math]::Floor($span.Milliseconds / 10)
}

function Wrap-Caption([string]$text, [int]$maxLength = 72) {
  $words = $text.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
  $lines = [System.Collections.Generic.List[string]]::new()
  $current = ''
  foreach ($word in $words) {
    $candidate = if ($current) { "$current $word" } else { $word }
    if ($candidate.Length -gt $maxLength -and $current) { $lines.Add($current); $current = $word } else { $current = $candidate }
  }
  if ($current) { $lines.Add($current) }
  return $lines -join '\N'
}

$phrases = Get-Content -Raw (Join-Path $root 'narration.json') | ConvertFrom-Json
$sceneImages = 1..11 | ForEach-Object {
  $prefix = '{0:D2}' -f $_
  Get-ChildItem -LiteralPath $frames -Filter "$prefix-*.png" | Select-Object -First 1 -ExpandProperty FullName
}

$videoList = @()
$sceneDurations = @()
$transitionDuration = 0.22
$audioList = @()
$vtt = @('WEBVTT', '')
$ass = @(
  '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Captions,Arial,37,&H00FFFFFF,&H000000FF,&H001B1207,&H8E1F1608,-1,0,0,0,100,100,0,0,3,1.5,0,2,110,110,50,1', '',
  '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
)

$timeline = 0.0
$totalDuration = 0.0
$narrationSpeed = 1.10
for ($index = 0; $index -lt 11; $index++) {
  $number = '{0:D2}' -f ($index + 1)
  $audioSource = Join-Path $narrationDir "narration-$number.mp3"
  $audioDuration = (Get-AudioDuration $audioSource) / $narrationSpeed
  $pad = if ($index -eq 10) { 0.9 } else { 0.52 }
  $duration = [Math]::Round($audioDuration + $pad, 3)
  $totalDuration += $duration
  $sceneDurations += $duration
  $videoDuration = if ($index -gt 0) { $duration + $transitionDuration } else { $duration }

  $videoClip = Join-Path $videoDir "scene-$number.mp4"
  & $ffmpeg -y -hide_banner -loglevel error -loop 1 -i $sceneImages[$index] -t $videoDuration -r 30 -vf 'scale=1920:1080:flags=lanczos,format=yuv420p' -an -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p $videoClip
  if ($LASTEXITCODE -ne 0) { throw "Failed to render premium scene $number" }
  $videoList += $videoClip

  $audioClip = Join-Path $audioDir "narration-$number.wav"
  & $ffmpeg -y -hide_banner -loglevel error -i $audioSource -af "atempo=$narrationSpeed,aresample=48000,aformat=sample_fmts=s16:channel_layouts=mono,highpass=f=75,acompressor=threshold=-19dB:ratio=2:attack=14:release=200,volume=1.06,apad=pad_dur=$pad,pan=stereo|c0=c0|c1=c0" -t $duration -c:a pcm_s16le $audioClip
  if ($LASTEXITCODE -ne 0) { throw "Failed to prepare premium narration $number" }
  $audioList += "file '$($audioClip.Replace("'", "''"))'"

  $caption = [string]$phrases[$index]
  $caption = $caption.Replace('Ten Ace I Q', 'TenAceIQ').Replace('ten ace I Q dot com', 'tenaceiq.com')
  $captionStart = $timeline + 0.07
  $captionEnd = $timeline + $audioDuration
  $vtt += @((Format-VttTime $captionStart) + ' --> ' + (Format-VttTime $captionEnd), $caption, '')
  $ass += 'Dialogue: 0,' + (Format-AssTime $captionStart) + ',' + (Format-AssTime $captionEnd) + ',Captions,,0,0,0,,{\fad(90,90)}' + (Wrap-Caption $caption)
  $timeline += $duration
}

$audioListPath = Join-Path $audioDir 'concat.txt'
$assPath = Join-Path $root 'captions.ass'
$vttPath = Join-Path $delivery 'tenaceiq-final-flagship-master-v2.vtt'
[System.IO.File]::WriteAllLines($audioListPath, $audioList)
[System.IO.File]::WriteAllLines($assPath, $ass)
[System.IO.File]::WriteAllLines($vttPath, $vtt)

$silentVideo = Join-Path $work 'silent-master.mp4'
$voiceTrack = Join-Path $work 'voice-master.wav'
$videoArgs = @('-y', '-hide_banner', '-loglevel', 'error')
foreach ($videoClip in $videoList) { $videoArgs += @('-i', $videoClip) }
$xfadeParts = @()
$runningDuration = [double]$sceneDurations[0]
for ($index = 1; $index -lt $videoList.Count; $index++) {
  $inputA = if ($index -eq 1) { '[0:v]' } else { '[v' + ($index - 1) + ']' }
  $inputB = '[' + $index + ':v]'
  $output = '[v' + $index + ']'
  $offset = [Math]::Round($runningDuration - $transitionDuration, 3).ToString([System.Globalization.CultureInfo]::InvariantCulture)
  $xfadeParts += $inputA + $inputB + 'xfade=transition=fade:duration=0.22:offset=' + $offset + $output
  $runningDuration += [double]$sceneDurations[$index]
}
$videoArgs += @('-filter_complex', ($xfadeParts -join ';'), '-map', '[v10]', '-t', $totalDuration, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', $silentVideo)
& $ffmpeg @videoArgs
if ($LASTEXITCODE -ne 0) { throw 'Failed to assemble premium video transitions.' }
& $ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $audioListPath -c:a pcm_s16le $voiceTrack
if ($LASTEXITCODE -ne 0) { throw 'Failed to concatenate premium narration.' }

$clean = Join-Path $delivery 'TenAceIQ-final-flagship-master-v2-clean.mp4'
$captioned = Join-Path $delivery 'TenAceIQ-final-flagship-master-v2-captioned.mp4'
$mix = "[1:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[voice_sc][voice_mix];[2:a]atrim=0:$totalDuration,volume=0.15[music];[music][voice_sc]sidechaincompress=threshold=0.025:ratio=7:attack=10:release=430[ducked];[ducked][voice_mix]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.94[aout]"
& $ffmpeg -y -hide_banner -loglevel error -i $silentVideo -i $voiceTrack -i $music -filter_complex $mix -map 0:v -map '[aout]' -c:v copy -c:a aac -b:a 256k -ar 48000 -ac 2 -t $totalDuration -movflags +faststart $clean
if ($LASTEXITCODE -ne 0) { throw 'Failed to render premium clean master.' }

$relativeAss = $assPath.Substring($repo.Length + 1).Replace('\', '/')
& $ffmpeg -y -hide_banner -loglevel error -i $clean -vf "subtitles=$relativeAss" -map 0:v -map 0:a -c:v libx264 -preset slow -crf 16 -c:a copy -movflags +faststart $captioned
if ($LASTEXITCODE -ne 0) { throw 'Failed to render premium captioned master.' }

$poster = Join-Path $delivery 'TenAceIQ-final-flagship-master-v2-poster.jpg'
& $ffmpeg -y -hide_banner -loglevel error -ss 1.2 -i $captioned -frames:v 1 -q:v 2 $poster
if ($LASTEXITCODE -ne 0) { throw 'Failed to render premium poster.' }

Get-Item $clean, $captioned, $poster, $vttPath | Select-Object FullName, Length, LastWriteTime
Write-Output ('TOTAL_DURATION_SECONDS=' + [Math]::Round($totalDuration, 3))
