$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$root = Join-Path $repo 'artifacts\tenaceiq-intro-2026-08-14'
$workRoot = Join-Path $root 'cutdown-work'
$delivery = Join-Path $root 'delivery'
$music = Join-Path $root 'audio\music-bed.wav'
$ffmpeg = Join-Path $repo 'artifacts\usta-walkthrough-2026-08-13\tooling\node_modules\ffmpeg-static\ffmpeg.exe'

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

function Wrap-Caption([string]$text, [int]$maxLength) {
  $words = $text.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
  $lines = [System.Collections.Generic.List[string]]::new()
  $current = ''
  foreach ($word in $words) {
    $candidate = if ($current) { "$current $word" } else { $word }
    if ($candidate.Length -gt $maxLength -and $current) {
      $lines.Add($current)
      $current = $word
    } else {
      $current = $candidate
    }
  }
  if ($current) { $lines.Add($current) }
  return $lines -join '\N'
}

function Render-Cutdown {
  param(
    [string]$Name,
    [string]$Orientation,
    [string]$NarrationName,
    [string[]]$SceneNames,
    [double]$TargetDuration,
    [int]$Width,
    [int]$Height
  )

  $job = Join-Path $workRoot "$Name-$Orientation"
  $videoDir = Join-Path $job 'video'
  $audioDir = Join-Path $job 'audio'
  New-Item -ItemType Directory -Force -Path $job, $videoDir, $audioDir, $delivery | Out-Null

  $imageDir = Join-Path $workRoot $Orientation
  $narrationDir = Join-Path $root "audio\narration-$NarrationName"
  $phrases = Get-Content -Raw (Join-Path $root "narration-$NarrationName.json") | ConvertFrom-Json
  if ($phrases.Count -ne $SceneNames.Count) { throw "Scene and narration counts do not match for $Name-$Orientation" }

  $sources = @()
  $rawDurations = @()
  for ($index = 0; $index -lt $phrases.Count; $index++) {
    $number = '{0:D2}' -f ($index + 1)
    $source = Join-Path $narrationDir "narration-$number.mp3"
    $sources += $source
    $rawDurations += Get-AudioDuration $source
  }

  $pad = 0.24
  $speed = ($rawDurations | Measure-Object -Sum).Sum / ($TargetDuration - ($pad * $phrases.Count))
  $fontSize = if ($Orientation -eq 'vertical') { 43 } else { 38 }
  $marginV = if ($Orientation -eq 'vertical') { 105 } else { 52 }
  $maxCaption = if ($Orientation -eq 'vertical') { 37 } else { 68 }

  $ass = @(
    '[Script Info]', 'ScriptType: v4.00+', "PlayResX: $Width", "PlayResY: $Height", 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    "Style: Captions,Arial,$fontSize,&H00FFFFFF,&H000000FF,&H00101B2C,&H98020A14,-1,0,0,0,100,100,0,0,3,1.5,0,2,70,70,$marginV,1", '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  )
  $vtt = @('WEBVTT', '')
  $videoList = @()
  $audioList = @()
  $timeline = 0.0

  for ($index = 0; $index -lt $phrases.Count; $index++) {
    $number = '{0:D2}' -f ($index + 1)
    $duration = ($rawDurations[$index] / $speed) + $pad
    $image = Join-Path $imageDir ($SceneNames[$index] + '.png')
    $videoClip = Join-Path $videoDir "scene-$number.mp4"
    $audioClip = Join-Path $audioDir "narration-$number.wav"

    if ($Orientation -eq 'vertical') {
      $motion = "scale=1100:1956,crop=1080:1920:x='10+8*sin(t/6)':y='18+8*cos(t/7)',format=yuv420p"
    } else {
      $motion = "scale=1960:1103,crop=1920:1080:x='20+14*sin(t/6)':y='11+8*cos(t/7)',format=yuv420p"
    }
    & $ffmpeg -y -hide_banner -loglevel error -loop 1 -i $image -t $duration -r 30 -vf $motion -an -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p $videoClip
    if ($LASTEXITCODE -ne 0) { throw "Failed to render $Name-$Orientation scene $number" }
    $videoList += "file '$($videoClip.Replace("'", "''"))'"

    & $ffmpeg -y -hide_banner -loglevel error -i $sources[$index] -af "atempo=$speed,aresample=48000,aformat=sample_fmts=s16:channel_layouts=mono,highpass=f=80,acompressor=threshold=-18dB:ratio=2.2:attack=12:release=180,volume=1.08,apad=pad_dur=$pad,pan=stereo|c0=c0|c1=c0" -t $duration -c:a pcm_s16le $audioClip
    if ($LASTEXITCODE -ne 0) { throw "Failed to prepare $Name narration $number" }
    $audioList += "file '$($audioClip.Replace("'", "''"))'"

    $caption = [string]$phrases[$index]
    $caption = $caption.Replace('Ten Ace I Q', 'TenAceIQ').Replace('ten ace I Q dot com', 'tenaceiq.com')
    $captionStart = $timeline + 0.05
    $captionEnd = $timeline + ($rawDurations[$index] / $speed)
    $vtt += @((Format-VttTime $captionStart) + ' --> ' + (Format-VttTime $captionEnd), $caption, '')
    $ass += 'Dialogue: 0,' + (Format-AssTime $captionStart) + ',' + (Format-AssTime $captionEnd) + ',Captions,,0,0,0,,{\fad(80,80)}' + (Wrap-Caption $caption $maxCaption)
    $timeline += $duration
  }

  $videoListPath = Join-Path $videoDir 'concat.txt'
  $audioListPath = Join-Path $audioDir 'concat.txt'
  $assPath = Join-Path $job 'captions.ass'
  $vttName = "tenaceiq-$Name-$Orientation.vtt"
  [System.IO.File]::WriteAllLines($videoListPath, $videoList)
  [System.IO.File]::WriteAllLines($audioListPath, $audioList)
  [System.IO.File]::WriteAllLines($assPath, $ass)
  [System.IO.File]::WriteAllLines((Join-Path $delivery $vttName), $vtt)

  $silentVideo = Join-Path $job 'silent.mp4'
  $voiceTrack = Join-Path $job 'voice.wav'
  & $ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $videoListPath -c copy $silentVideo
  if ($LASTEXITCODE -ne 0) { throw "Failed to concatenate $Name-$Orientation video" }
  & $ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $audioListPath -c:a pcm_s16le $voiceTrack
  if ($LASTEXITCODE -ne 0) { throw "Failed to concatenate $Name-$Orientation narration" }

  $base = if ($Name -eq 'commercial-30s') { 'TenAceIQ-commercial-30s' } else { 'TenAceIQ-teaser-15s' }
  $clean = Join-Path $delivery "$base-$Orientation-clean.mp4"
  $captioned = Join-Path $delivery "$base-$Orientation-captioned.mp4"
  $mix = "[1:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[voice_sc][voice_mix];[2:a]atrim=0:$TargetDuration,volume=0.17[music];[music][voice_sc]sidechaincompress=threshold=0.025:ratio=7:attack=8:release=380[ducked];[ducked][voice_mix]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.94[aout]"
  & $ffmpeg -y -hide_banner -loglevel error -i $silentVideo -i $voiceTrack -i $music -filter_complex $mix -map 0:v -map '[aout]' -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -t $TargetDuration -movflags +faststart $clean
  if ($LASTEXITCODE -ne 0) { throw "Failed to render $Name-$Orientation clean master" }

  $relativeAss = $assPath.Substring($repo.Length + 1).Replace('\', '/')
  & $ffmpeg -y -hide_banner -loglevel error -i $clean -vf "subtitles=$relativeAss" -map 0:v -map 0:a -c:v libx264 -preset medium -crf 19 -c:a copy -movflags +faststart $captioned
  if ($LASTEXITCODE -ne 0) { throw "Failed to render $Name-$Orientation captioned master" }

  Write-Output ("RENDERED={0} DURATION={1:N2}s VOICE_SPEED={2:N3}" -f $captioned, $TargetDuration, $speed)
}

$commercialScenes = @('01-intro', '02-explore', '03-matchup', '04-team', '05-organize', '06-outro')
$teaserScenes = @('01-intro', '07-montage', '06-outro')
Render-Cutdown -Name 'commercial-30s' -Orientation 'horizontal' -NarrationName '30s' -SceneNames $commercialScenes -TargetDuration 29.7 -Width 1920 -Height 1080
Render-Cutdown -Name 'commercial-30s' -Orientation 'vertical' -NarrationName '30s' -SceneNames $commercialScenes -TargetDuration 29.7 -Width 1080 -Height 1920
Render-Cutdown -Name 'teaser-15s' -Orientation 'horizontal' -NarrationName '15s' -SceneNames $teaserScenes -TargetDuration 14.7 -Width 1920 -Height 1080
Render-Cutdown -Name 'teaser-15s' -Orientation 'vertical' -NarrationName '15s' -SceneNames $teaserScenes -TargetDuration 14.7 -Width 1080 -Height 1920

Get-ChildItem -LiteralPath $delivery -Filter 'TenAceIQ-*-captioned.mp4' | Sort-Object Name | Select-Object Name, Length, LastWriteTime
