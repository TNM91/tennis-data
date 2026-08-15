$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$root = Join-Path $repo 'artifacts\tenaceiq-intro-2026-08-14\tier-deep-dives'
$frames = Join-Path $root 'frames'
$productFrames = Join-Path $repo 'artifacts\tenaceiq-intro-2026-08-14\premium-v4-final\frames'
$music = Join-Path $repo 'artifacts\tenaceiq-intro-2026-08-14\premium-v4-final\audio\premium-music-bed.wav'
$delivery = Join-Path $repo 'artifacts\tenaceiq-intro-2026-08-14\delivery\tier-deep-dives'
$ffmpeg = Join-Path $repo 'artifacts\usta-walkthrough-2026-08-13\tooling\node_modules\ffmpeg-static\ffmpeg.exe'
New-Item -ItemType Directory -Force -Path $delivery | Out-Null

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

function Wrap-Caption([string]$text, [int]$maxLength = 70) {
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

$tiers = Get-Content -Raw (Join-Path $root 'tiers.json') | ConvertFrom-Json
$summary = @()

foreach ($tier in $tiers) {
  $id = [string]$tier.id
  $name = [string]$tier.name
  $job = Join-Path $root "work\$id"
  $videoDir = Join-Path $job 'video'
  $audioDir = Join-Path $job 'audio'
  New-Item -ItemType Directory -Force -Path $job, $videoDir, $audioDir | Out-Null

  $productFrame = Join-Path $productFrames ([string]$tier.page)
  $sceneImages = @(
    (Join-Path $frames "$id-01-opener.png"),
    $productFrame,
    (Join-Path $frames "$id-03-outcome.png")
  )
  $phrases = Get-Content -Raw (Join-Path $root "narration-$id.json") | ConvertFrom-Json
  $narrationDir = Join-Path $root "audio\$id"
  $pads = @(0.45, 0.52, 0.82)
  $transition = 0.22
  $sceneDurations = @()
  $videoClips = @()
  $audioList = @()
  $timeline = 0.0
  $totalDuration = 0.0
  $vtt = @('WEBVTT', '')
  $ass = @(
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Captions,Arial,37,&H00FFFFFF,&H000000FF,&H001B1207,&H8E1F1608,-1,0,0,0,100,100,0,0,3,1.5,0,2,110,110,50,1', '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  )

  for ($index = 0; $index -lt 3; $index++) {
    $number = '{0:D2}' -f ($index + 1)
    $audioSource = Join-Path $narrationDir "narration-$number.mp3"
    $audioDuration = Get-AudioDuration $audioSource
    $duration = [Math]::Round($audioDuration + $pads[$index], 3)
    $totalDuration += $duration
    $sceneDurations += $duration
    $videoDuration = if ($index -gt 0) { $duration + $transition } else { $duration }

    $videoClip = Join-Path $videoDir "scene-$number.mp4"
    & $ffmpeg -y -hide_banner -loglevel error -loop 1 -i $sceneImages[$index] -t $videoDuration -r 30 -vf 'scale=1920:1080:flags=lanczos,format=yuv420p' -an -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p $videoClip
    if ($LASTEXITCODE -ne 0) { throw "Failed to render $id scene $number" }
    $videoClips += $videoClip

    $audioClip = Join-Path $audioDir "narration-$number.wav"
    & $ffmpeg -y -hide_banner -loglevel error -i $audioSource -af "aresample=48000,aformat=sample_fmts=s16:channel_layouts=mono,highpass=f=75,acompressor=threshold=-19dB:ratio=2:attack=14:release=200,volume=1.06,apad=pad_dur=$($pads[$index]),pan=stereo|c0=c0|c1=c0" -t $duration -c:a pcm_s16le $audioClip
    if ($LASTEXITCODE -ne 0) { throw "Failed to prepare $id narration $number" }
    $audioList += "file '$($audioClip.Replace("'", "''"))'"

    $caption = ([string]$phrases[$index]).Replace('Ten Ace I Q', 'TenAceIQ')
    $captionStart = $timeline + 0.06
    $captionEnd = $timeline + $audioDuration
    $vtt += @((Format-VttTime $captionStart) + ' --> ' + (Format-VttTime $captionEnd), $caption, '')
    $ass += 'Dialogue: 0,' + (Format-AssTime $captionStart) + ',' + (Format-AssTime $captionEnd) + ',Captions,,0,0,0,,{\fad(90,90)}' + (Wrap-Caption $caption)
    $timeline += $duration
  }

  $audioListPath = Join-Path $audioDir 'concat.txt'
  $assPath = Join-Path $job 'captions.ass'
  $vttPath = Join-Path $delivery "TenAceIQ-$id-deep-dive.vtt"
  [System.IO.File]::WriteAllLines($audioListPath, $audioList)
  [System.IO.File]::WriteAllLines($assPath, $ass)
  [System.IO.File]::WriteAllLines($vttPath, $vtt)

  $silentVideo = Join-Path $job 'silent.mp4'
  $offset1 = [Math]::Round($sceneDurations[0] - $transition, 3).ToString([System.Globalization.CultureInfo]::InvariantCulture)
  $offset2 = [Math]::Round($sceneDurations[0] + $sceneDurations[1] - (2 * $transition), 3).ToString([System.Globalization.CultureInfo]::InvariantCulture)
  & $ffmpeg -y -hide_banner -loglevel error -i $videoClips[0] -i $videoClips[1] -i $videoClips[2] -filter_complex "[0:v][1:v]xfade=transition=fade:duration=$transition`:offset=$offset1[v1];[v1][2:v]xfade=transition=fade:duration=$transition`:offset=$offset2[v2]" -map '[v2]' -t $totalDuration -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p $silentVideo
  if ($LASTEXITCODE -ne 0) { throw "Failed to assemble $id visuals" }

  $voice = Join-Path $job 'voice.wav'
  & $ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $audioListPath -c:a pcm_s16le $voice
  if ($LASTEXITCODE -ne 0) { throw "Failed to assemble $id voice" }

  $clean = Join-Path $delivery "TenAceIQ-$id-deep-dive-clean.mp4"
  $captioned = Join-Path $delivery "TenAceIQ-$id-deep-dive-captioned.mp4"
  $mix = "[1:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[voice_sc][voice_mix];[2:a]atrim=0:$totalDuration,volume=0.15[music];[music][voice_sc]sidechaincompress=threshold=0.025:ratio=7:attack=10:release=400[ducked];[ducked][voice_mix]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.94[aout]"
  & $ffmpeg -y -hide_banner -loglevel error -i $silentVideo -i $voice -i $music -filter_complex $mix -map 0:v -map '[aout]' -c:v copy -c:a aac -b:a 224k -ar 48000 -ac 2 -t $totalDuration -movflags +faststart $clean
  if ($LASTEXITCODE -ne 0) { throw "Failed to mix $id deep dive" }

  $relativeAss = $assPath.Substring($repo.Length + 1).Replace('\', '/')
  & $ffmpeg -y -hide_banner -loglevel error -i $clean -vf "subtitles=$relativeAss" -map 0:v -map 0:a -c:v libx264 -preset medium -crf 16 -c:a copy -movflags +faststart $captioned
  if ($LASTEXITCODE -ne 0) { throw "Failed to caption $id deep dive" }

  $poster = Join-Path $delivery "TenAceIQ-$id-deep-dive-poster.jpg"
  & $ffmpeg -y -hide_banner -loglevel error -ss 1.0 -i $captioned -frames:v 1 -q:v 2 $poster
  $summary += [pscustomobject]@{ Tier = $name; Duration = [Math]::Round($totalDuration, 2); File = $captioned; Size = (Get-Item $captioned).Length }
}

$summary | Format-Table -AutoSize
