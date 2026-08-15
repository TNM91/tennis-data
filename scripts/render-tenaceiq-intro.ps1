$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$root = Join-Path $repo 'artifacts\tenaceiq-intro-2026-08-14'
$ffmpeg = Join-Path $repo 'artifacts\usta-walkthrough-2026-08-13\tooling\node_modules\ffmpeg-static\ffmpeg.exe'
$work = Join-Path $root 'work'
$videoDir = Join-Path $work 'video'
$audioDir = Join-Path $work 'audio'
$delivery = Join-Path $root 'delivery'
$narrationDir = Join-Path $root 'audio\narration'
$music = Join-Path $root 'audio\music-bed.wav'

New-Item -ItemType Directory -Force -Path $videoDir, $audioDir, $delivery | Out-Null

$phrases = Get-Content -Raw (Join-Path $root 'narration.json') | ConvertFrom-Json
$sceneImages = 1..9 | ForEach-Object {
  $prefix = '{0:D2}' -f $_
  Get-ChildItem -LiteralPath $work -Filter "$prefix-*.png" | Select-Object -First 1 -ExpandProperty FullName
}

function Get-AudioDuration([string]$path) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $details = (& $ffmpeg -hide_banner -i $path 2>&1 | Out-String)
  } finally {
    $ErrorActionPreference = $previous
  }
  $match = [regex]::Match($details, 'Duration: ([0-9:.]+)')
  if (-not $match.Success) { throw "Could not read duration for $path" }
  return [TimeSpan]::Parse($match.Groups[1].Value).TotalSeconds
}

function Format-VttTime([double]$seconds) {
  $span = [TimeSpan]::FromSeconds($seconds)
  return '{0:00}:{1:00}:{2:00}.{3:000}' -f [Math]::Floor($span.TotalHours), $span.Minutes, $span.Seconds, $span.Milliseconds
}

function Format-SrtTime([double]$seconds) {
  return (Format-VttTime $seconds).Replace('.', ',')
}

function Format-AssTime([double]$seconds) {
  $span = [TimeSpan]::FromSeconds($seconds)
  return '{0}:{1:00}:{2:00}.{3:00}' -f [Math]::Floor($span.TotalHours), $span.Minutes, $span.Seconds, [Math]::Floor($span.Milliseconds / 10)
}

function Wrap-Caption([string]$text) {
  if ($text.Length -le 72) { return $text }
  $midpoint = [Math]::Floor($text.Length / 2)
  $before = $text.LastIndexOf(' ', $midpoint)
  $after = $text.IndexOf(' ', $midpoint)
  $split = if ($before -gt 34) { $before } elseif ($after -gt 0) { $after } else { $midpoint }
  return $text.Substring(0, $split) + '\N' + $text.Substring($split + 1)
}

$videoList = @()
$audioList = @()
$vtt = @('WEBVTT', '')
$srt = @()
$ass = @(
  '[Script Info]',
  'ScriptType: v4.00+',
  'PlayResX: 1920',
  'PlayResY: 1080',
  'WrapStyle: 2',
  'ScaledBorderAndShadow: yes',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Captions,Arial,38,&H00FFFFFF,&H000000FF,&H00101B2C,&H98020A14,-1,0,0,0,100,100,0,0,3,1.4,0,2,110,110,52,1',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
)

$timeline = 0.0
$totalDuration = 0.0
$narrationSpeed = 1.15

for ($index = 0; $index -lt 9; $index++) {
  $number = '{0:D2}' -f ($index + 1)
  $audioSource = Join-Path $narrationDir "narration-$number.mp3"
  $audioDuration = (Get-AudioDuration $audioSource) / $narrationSpeed
  $pad = if ($index -eq 8) { 0.75 } else { 0.42 }
  $duration = [Math]::Round($audioDuration + $pad, 3)
  $fadeOutStart = [Math]::Max(0, $duration - 0.22)
  $totalDuration += $duration

  $videoClip = Join-Path $videoDir "scene-$number.mp4"
  $motion = if ($index % 2 -eq 0) {
    "scale=1980:1114,crop=1920:1080:x='30+24*sin(t/7)':y='17+12*cos(t/8)',format=yuv420p"
  } else {
    "scale=1980:1114,crop=1920:1080:x='30-24*sin(t/7)':y='17-12*cos(t/8)',format=yuv420p"
  }
  & $ffmpeg -y -hide_banner -loglevel error -loop 1 -i $sceneImages[$index] -t $duration -r 30 -vf $motion -an -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p $videoClip
  if ($LASTEXITCODE -ne 0) { throw "Failed to render scene $number" }
  $videoList += "file '$($videoClip.Replace("'", "''"))'"

  $audioClip = Join-Path $audioDir "narration-$number.wav"
  & $ffmpeg -y -hide_banner -loglevel error -i $audioSource -af "atempo=$narrationSpeed,aresample=48000,aformat=sample_fmts=s16:channel_layouts=mono,highpass=f=80,acompressor=threshold=-18dB:ratio=2.2:attack=12:release=180,volume=1.08,apad=pad_dur=$pad,pan=stereo|c0=c0|c1=c0" -t $duration -c:a pcm_s16le $audioClip
  if ($LASTEXITCODE -ne 0) { throw "Failed to prepare narration $number" }
  $audioList += "file '$($audioClip.Replace("'", "''"))'"

  $captionStart = $timeline + 0.08
  $captionEnd = $timeline + $audioDuration
  $caption = [string]$phrases[$index]
  $caption = $caption.Replace('Ten Ace I Q', 'TenAceIQ').Replace('ten ace I Q dot com', 'tenaceiq.com')
  $vtt += @((Format-VttTime $captionStart) + ' --> ' + (Format-VttTime $captionEnd), $caption, '')
  $srt += @([string]($index + 1), (Format-SrtTime $captionStart) + ' --> ' + (Format-SrtTime $captionEnd), $caption, '')
  $assText = Wrap-Caption $caption
  $ass += 'Dialogue: 0,' + (Format-AssTime $captionStart) + ',' + (Format-AssTime $captionEnd) + ',Captions,,0,0,0,,{\fad(100,100)}' + $assText
  $timeline += $duration
}

$videoListPath = Join-Path $videoDir 'concat.txt'
$audioListPath = Join-Path $audioDir 'concat.txt'
[System.IO.File]::WriteAllLines($videoListPath, $videoList)
[System.IO.File]::WriteAllLines($audioListPath, $audioList)
[System.IO.File]::WriteAllLines((Join-Path $delivery 'tenaceiq-intro.vtt'), $vtt)
[System.IO.File]::WriteAllLines((Join-Path $root 'tenaceiq-intro.srt'), $srt)
[System.IO.File]::WriteAllLines((Join-Path $root 'tenaceiq-intro.ass'), $ass)

$silentVideo = Join-Path $work 'silent-master.mp4'
$voiceTrack = Join-Path $work 'voice-master.wav'
& $ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $videoListPath -c copy $silentVideo
if ($LASTEXITCODE -ne 0) { throw 'Failed to concatenate scene video.' }
& $ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $audioListPath -c:a pcm_s16le $voiceTrack
if ($LASTEXITCODE -ne 0) { throw 'Failed to concatenate narration.' }

$clean = Join-Path $delivery 'TenAceIQ-intro-flagship-clean.mp4'
$audioMix = "[1:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[voice_sc][voice_mix];[2:a]atrim=0:$totalDuration,volume=0.155[music];[music][voice_sc]sidechaincompress=threshold=0.025:ratio=7:attack=8:release=420[ducked];[ducked][voice_mix]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.94[aout]"
& $ffmpeg -y -hide_banner -loglevel error -i $silentVideo -i $voiceTrack -i $music -filter_complex $audioMix -map 0:v -map '[aout]' -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -t $totalDuration -movflags +faststart $clean
if ($LASTEXITCODE -ne 0) { throw 'Failed to render clean flagship master.' }

$captioned = Join-Path $delivery 'TenAceIQ-intro-flagship-captioned.mp4'
$relativeAss = 'artifacts/tenaceiq-intro-2026-08-14/tenaceiq-intro.ass'
& $ffmpeg -y -hide_banner -loglevel error -i $clean -vf "subtitles=$relativeAss" -map 0:v -map 0:a -c:v libx264 -preset medium -crf 19 -c:a copy -movflags +faststart $captioned
if ($LASTEXITCODE -ne 0) { throw 'Failed to render captioned flagship master.' }

$poster = Join-Path $delivery 'TenAceIQ-intro-poster.jpg'
& $ffmpeg -y -hide_banner -loglevel error -ss 1.2 -i $captioned -frames:v 1 -q:v 2 $poster
if ($LASTEXITCODE -ne 0) { throw 'Failed to render poster.' }

Get-Item $clean, $captioned, $poster, (Join-Path $delivery 'tenaceiq-intro.vtt') | Select-Object FullName, Length, LastWriteTime
Write-Output ('TOTAL_DURATION_SECONDS=' + [Math]::Round($totalDuration, 3))
