/* global _, WaveSurfer, Audio, URL */

// Utility to listen to range changes in a slider
function onRangeChange(r,f) {
  var n,c,m;
  r.addEventListener("input",function(e){n=1;c=e.target.value;if(c!=m)f(e);m=c;});
  r.addEventListener("change",function(e){if(!n)f(e);});
}

/*
// FIX: something in here breaks scrubbing
var dropzoneId = 'holder'

window.addEventListener('dragenter', function(e) {
  if (e.target.id != dropzoneId) {
    e.preventDefault()
    e.dataTransfer.effectAllowed = 'none'
    e.dataTransfer.dropEffect = 'none'
  }
}, false)

window.addEventListener('dragover', function(e) {
  if (e.target.id != dropzoneId) {
    e.preventDefault()
    e.dataTransfer.effectAllowed = 'none'
    e.dataTransfer.dropEffect = 'none'
  }
})

window.addEventListener('drop', function(e) {
  if (e.target.id != dropzoneId) {
    e.preventDefault()
    e.dataTransfer.effectAllowed = 'none'
    e.dataTransfer.dropEffect = 'none'
  }
})
*/

// File dropping
var holder = document.getElementById('holder')
holder.ondragover = function (e) {
  this.className = 'hover'
  e.preventDefault()
  return false
}
holder.ondragend = function (e) {
  this.className = ''
  e.preventDefault()
  return false
}
holder.ondrop = function (e) {
  this.className = ''
  e.preventDefault()

  var file = e.dataTransfer.files[0]
  document.getElementById('title').innerHTML = 'Transcribing ' + file.name
  // var reader = new FileReader()
  // `loadBlob` doesn’t work with `backend: MediaElement`
  // wavesurfer.loadBlob(file)
  // This works with blobs and the MediaElement backend, see https://github.com/katspaugh/wavesurfer.js/issues/904#issuecomment-269513492
  var audio = new Audio()
  audio.src = URL.createObjectURL(file)
  wavesurfer.load(audio)
  document.getElementsByTagName('body')[0].classList.add('file-loaded')
  return false
}

var previousRegion
var skipBackOnResumeBy = 3
var skipBackOnNextPlay = true

// https://wavesurfer-js.org/docs/
var wavesurfer = WaveSurfer.create({
  container: '#waveform-display',
  waveColor: '#4e9dca',
  progressColor: '#6bbeed',
  backend: 'MediaElement' // crucial, as mediaElement can change playbackRate with constant pitch
})
wavesurfer.on('ready', function () {
  var timeline = Object.create(WaveSurfer.Timeline)

  timeline.init({
    wavesurfer: wavesurfer,
    container: '#waveform-timeline',
    notchPercentHeight: 5,
    primaryFontColor: '#4e9dca',
    secondaryFontColor: '#6bbeed',
    primaryColor: '#4e9dca',
    secondaryColor: '#6bbeed'
  })

  wavesurfer.enableDragSelection({
    loop: 'true'
  })
})

wavesurfer.on('finish', function (event) {
  document.getElementById('play-pause').innerHTML = 'Play'
  wavesurfer.seekTo(0)
})

// Pressing play after pause skips back n seconds, so you have some overlap.
// We don’t want this to happen if the user seeks deliberately
wavesurfer.on('seek', function (event) {
  skipBackOnNextPlay = false
})

wavesurfer.on('audioprocess', _.throttle(function (event) {
  updateTime(event)
}, 500))

wavesurfer.on('seek', _.throttle(function (event) {
  updateTime(wavesurfer.getCurrentTime())
}, 500))

var updateTime = function (time) {
  var hours = leftPad(Math.floor(time / 3600))
  var minutes = leftPad(Math.floor(time / 60))
  var seconds = leftPad(Math.floor(time % 60))
  document.getElementById('time').innerHTML = ' - ' + hours + ':' + minutes + ':' + seconds
}

var leftPad = function (value) {
  if (value.toString().length === 1) {
    return '0' + value.toString()
  }
  return value
}

wavesurfer.on('waveform-ready', function (event) {
  document.getElementsByTagName('body')[0].classList.add('waveform-ready')
})

window.addEventListener('keyup', function (event) {
  if (event.keyCode === 27) {
    togglePlayPause()
  }
})

document.getElementById('play-pause').addEventListener('click', function () {
  togglePlayPause()
})

document.getElementById('remove-loop').addEventListener('click', function () {
  wavesurfer.clearRegions()
  document.getElementsByTagName('body')[0].classList.remove('is-looping')
})

onRangeChange(document.getElementById('playback-rate'), function (event) {
  wavesurfer.setPlaybackRate(parseFloat(document.getElementById('playback-rate').value, 10))
})

// TODO: this should happen in response to a wavesurfer event
var togglePlayPause = function () {
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause()
    document.getElementById('play-pause').innerHTML = 'Play'
  } else {
    // Skip back to time 3 seconds earlier, but never before 0
    var startTime = wavesurfer.getCurrentTime()
    if (skipBackOnNextPlay) {
      startTime = Math.max(0, wavesurfer.getCurrentTime() - skipBackOnResumeBy)
    } else {
      skipBackOnNextPlay = true
    }
    wavesurfer.play(startTime)
    document.getElementById('play-pause').innerHTML = 'Pause'
  }
}

// https://wavesurfer-js.org/plugins/regions.html
wavesurfer.on('region-created', function (region) {
  // because 'region-created' fires before the region creation is complete,
  // we wait for this first update to end (end of the mouse drag)
  wavesurfer.once('region-update-end', function (region) {
    // we only ever want to have one region
    if (previousRegion) {
      previousRegion.remove()
    }
    previousRegion = region
    wavesurfer.play(region.start)
    document.getElementsByTagName('body')[0].classList.add('is-looping')
  })
})

console.log('achange')

// Resize waveform display on viewport resize
window.addEventListener('resize', _.debounce(function () {
  wavesurfer.drawer.containerWidth = wavesurfer.drawer.container.clientWidth
  wavesurfer.drawBuffer()
}, 500))

// wavesurfer.load('inter.m4a')
// document.getElementsByTagName('body')[0].classList.add('file-loaded')

window.onbeforeunload = function () {
  return 'Please make sure you’ve saved your work before leaving this page'
}
