Add-Type -AssemblyName System.Speech

$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice('Microsoft Zira Desktop')
$voice.Rate = -1
$voice.SetOutputToWaveFile((Join-Path $PSScriptRoot '..\public\media\product-tours\captain-full-phone-story.wav'))
$voice.Speak('Running a team comes with enough moving parts. Captain keeps the whole match week in your pocket. On your team home screen, you can see the match ahead, who is responding, and what needs attention right now. Send one availability request, and see who is in before you solve a lineup. When it is time to build, pull together a lineup using the real players and match context. Then compare the projected outcome before you commit. Check the opponent and pairing picture, so match day does not start with guesswork. Once you have made the call, turn it into a clear message. Review the plan, choose your audience, and send it right from your phone. The Weekly Brief keeps your next action close, and the Team Brief keeps notes, opponent context, and the plan together. You can keep practice connected to the work in front of the team. And after the match, record the scorecard, check every court, and share the result with the team. That is the Captain flow: less chasing, more confidence, all from your phone.')
$voice.Dispose()
