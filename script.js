const daySelect = document.getElementById('daySelect');
const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const exploreBtn = document.getElementById('exploreBtn');
const randomBtn = document.getElementById('randomBtn');
const resultContainer = document.getElementById('resultContainer');
const loader = document.getElementById('loader');
const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');

let autoAdvanceTimer = null;
let currentYear = 2026;

// Global Canvas (Background Stars)
const canvas = document.getElementById('starsCanvas');
const ctx = canvas.getContext('2d');

// Space Cluster Canvas (Rotating Planet)
const spaceCanvas = document.getElementById('spaceInteractiveCanvas');
const sCtx = spaceCanvas.getContext('2d');

const NASA_API_KEY = 'DEMO_KEY';

// --- Web Audio Engine ---
let audioCtx = null;
let delayNode, feedbackGain, reverbNode, reverbGain, chorusNode, chorusLFO, droneOsc, droneGain;
let masterGain, filterNode;
let modulationActive = true;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(audioCtx.destination);

    // Chorus
    chorusNode = audioCtx.createDelay();
    chorusNode.delayTime.value = 0.02;
    chorusLFO = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    chorusLFO.frequency.value = 0.5;
    lfoGain.gain.value = 0.003;
    chorusLFO.connect(lfoGain);
    lfoGain.connect(chorusNode.delayTime);
    chorusLFO.start();

    // Delay with Feedback
    delayNode = audioCtx.createDelay(2.0);
    delayNode.delayTime.value = 0.4;
    feedbackGain = audioCtx.createGain();
    feedbackGain.gain.value = 0.3;

    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);

    // Reverb
    reverbNode = audioCtx.createConvolver();
    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.5;
    createReverbPulse();

    // FX Chain: Chorus -> Delay -> Reverb -> Master
    chorusNode.connect(delayNode);
    delayNode.connect(reverbGain);
    reverbGain.connect(masterGain);

    // Drone
    droneOsc = audioCtx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 55;
    droneGain = audioCtx.createGain();
    droneGain.gain.value = 0.1;

    const droneLowpass = audioCtx.createBiquadFilter();
    droneLowpass.type = 'lowpass';
    droneLowpass.frequency.value = 150;

    droneOsc.connect(droneLowpass);
    droneLowpass.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();

    // Start Modulation Loop
    animateModulation();
}

async function createReverbPulse() {
    if (!audioCtx) return;
    const len = audioCtx.sampleRate * 2.5;
    const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const data = buf.getChannelData(c);
        for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
        }
    }
    reverbNode.buffer = buf;
}

function connectAudioSource(element) {
    if (!audioCtx) initAudio();
    if (element.captured) return true;

    try {
        const source = audioCtx.createMediaElementSource(element);
        source.connect(masterGain); // Dry
        source.connect(chorusNode); // Wet
        element.captured = true;
        return true;
    } catch (e) {
        console.warn("Audio capture blocked (CORS):", e);
        return false;
    }
}

// --- Online Modulation Logic ---
const modParams = {
    delay: { el: 'delayFader', modEl: 'modDelay' },
    chorus: { el: 'chorusFader', modEl: 'modChorus' },
    reverb: { el: 'reverbFader', modEl: 'modReverb' },
    drone: { el: 'droneFader', modEl: 'modDrone' }
};

function animateModulation() {
    if (!modulationActive || !audioCtx) return;

    const time = Date.now() * 0.001;

    Object.keys(modParams).forEach((key, i) => {
        const p = modParams[key];
        const fader = document.getElementById(p.el);
        if (!fader) return;

        const baseVal = parseFloat(fader.value);
        const drift = Math.sin(time * (0.3 + i * 0.2)) * 0.05;
        const modulatedVal = Math.max(0, Math.min(1, baseVal + drift));

        // Update indicators (visual only)
        const indicator = document.getElementById(p.modEl);
        if (indicator) {
            indicator.style.width = (modulatedVal * 100) + '%';
        }

        // Apply to Audio Nodes
        if (key === 'delay' && delayNode) {
            delayNode.delayTime.setTargetAtTime(modulatedVal * 1.5, audioCtx.currentTime, 0.1);
            feedbackGain.gain.setTargetAtTime(0.2 + modulatedVal * 0.5, audioCtx.currentTime, 0.1);
        }
        if (key === 'chorus' && chorusNode) {
            chorusNode.delayTime.setTargetAtTime(0.01 + modulatedVal * 0.04, audioCtx.currentTime, 0.1);
        }
        if (key === 'reverb' && reverbGain) {
            reverbGain.gain.setTargetAtTime(modulatedVal * 0.8, audioCtx.currentTime, 0.1);
        }
        if (key === 'drone' && droneGain) {
            droneGain.gain.setTargetAtTime(modulatedVal * 0.2, audioCtx.currentTime, 0.1);
            droneOsc.frequency.setTargetAtTime(55 + (currentYear % 50) + drift * 20, audioCtx.currentTime, 0.5);
        }
    });

    requestAnimationFrame(animateModulation);
}

// --- Global Stars ---
let stars = [];
function initStars() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < 200; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 1.5,
            speed: Math.random() * 0.05 + 0.02,
            hue: Math.random() * 360
        });
    }
}

function animateStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
        s.y += s.speed;
        s.hue += 0.1;
        if (s.y > canvas.height) s.y = 0;
        ctx.fillStyle = `hsl(${s.hue}, 70%, 70%)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });
    requestAnimationFrame(animateStars);
}

// --- Rotating Planet Projector ---
let planetDots = [];
let rotationAngle = 0;
let planetHue = 200;
let rotationSpeed = 0.005;

function initPlanet() {
    const container = spaceCanvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    spaceCanvas.width = rect.width || 300;
    spaceCanvas.height = rect.height || 300;
    planetDots = [];

    const count = 300;
    const radius = Math.min(spaceCanvas.width, spaceCanvas.height) * 0.35;

    for (let i = 0; i < count; i++) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        planetDots.push({
            x: Math.cos(theta) * Math.sin(phi) * radius,
            y: Math.sin(theta) * Math.sin(phi) * radius,
            z: Math.cos(phi) * radius,
            size: Math.random() * 2 + 1
        });
    }
}

function animatePlanet() {
    sCtx.clearRect(0, 0, spaceCanvas.width, spaceCanvas.height);
    const cx = spaceCanvas.width / 2;
    const cy = spaceCanvas.height / 2;
    rotationAngle += rotationSpeed;

    const projected = planetDots.map(d => {
        const cosY = Math.cos(rotationAngle);
        const sinY = Math.sin(rotationAngle);
        const xRot = d.x * cosY - d.z * sinY;
        const zRot = d.x * sinY + d.z * cosY;
        const perspective = 500 / (500 + zRot);
        const scale = perspective;
        return {
            x: cx + xRot * scale,
            y: cy + d.y * scale,
            z: zRot,
            scale: scale,
            alpha: (zRot + 300) / 600
        };
    }).sort((a, b) => b.z - a.z);

    projected.forEach(p => {
        sCtx.fillStyle = `hsla(${planetHue}, 80%, 70%, ${p.alpha})`;
        sCtx.beginPath();
        sCtx.arc(p.x, p.y, p.scale * 2, 0, Math.PI * 2);
        sCtx.fill();
    });
    requestAnimationFrame(animatePlanet);
}

// --- Data Logic ---
function initSelectors() {
    daySelect.innerHTML = ''; monthSelect.innerHTML = ''; yearSelect.innerHTML = '';
    for (let i = 1; i <= 31; i++) {
        const val = i.toString().padStart(2, '0');
        daySelect.add(new Option(val, val));
    }
    for (let i = 1; i <= 12; i++) {
        const val = i.toString().padStart(2, '0');
        monthSelect.add(new Option(val, val));
    }
    for (let i = 2026; i >= 1900; i--) {
        yearSelect.add(new Option(i, i.toString()));
    }
}

function setRandomDate() {
    daySelect.selectedIndex = Math.floor(Math.random() * 31);
    monthSelect.selectedIndex = Math.floor(Math.random() * 12);
    yearSelect.selectedIndex = Math.floor(Math.random() * (2026 - 1900));
}

// Initialization flow
initStars();
animateStars();
initSelectors();
initPlanet();
animatePlanet();

startBtn.onclick = () => {
    initAudio();
    startOverlay.style.opacity = '0';
    setTimeout(() => {
        startOverlay.classList.add('hidden');
    }, 1000);

    // Start first load with a slight delay for audio stability
    setTimeout(() => {
        setRandomDate();
        exploreBtn.click();
    }, 500);
};

randomBtn.onclick = () => {
    setRandomDate();
    exploreBtn.click();
};

window.onresize = () => {
    initStars();
    initPlanet();
};

exploreBtn.onclick = async () => {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    const d = daySelect.value;
    const m = monthSelect.value;
    const y = yearSelect.value;
    currentYear = parseInt(y);
    const selectedDate = `${y}-${m}-${d}`;

    planetHue = (currentYear * 1.5) % 360;
    rotationSpeed = 0.003 + (currentYear % 50) / 10000;

    resultContainer.classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const [nasaData, archivePhoto, archiveVideo, newsData, atmosphere] = await Promise.all([
            fetchSpaceData(selectedDate),
            fetchArchivePhoto(selectedDate),
            fetchArchiveVideo(selectedDate),
            fetchArchiveNews(selectedDate),
            generateAtmosphereSummary(selectedDate)
        ]);
        renderResults(selectedDate, nasaData, archivePhoto, archiveVideo, newsData, atmosphere);
    } catch (error) {
        console.error("Explore error:", error);
    } finally {
        loader.classList.add('hidden');
        resultContainer.classList.remove('hidden');
    }
};

async function fetchSpaceData(date) {
    try {
        const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}&date=${date}`);
        const data = await response.json();
        return data.url ? data : { title: "Космічний об'єкт" };
    } catch (e) { return { title: "Глибокий Космос" }; }
}

async function fetchArchivePhoto(date) {
    try {
        const response = await fetch(`https://archive.org/advancedsearch.php?q=date:${date} AND mediatype:image&output=json&limit=1`);
        const data = await response.json();
        const item = data.response.docs[0];
        return item ? { title: item.title, img: `https://archive.org/services/img/${item.identifier}` } : { title: "Архівна візуалізація", img: "https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=1000" };
    } catch (e) {
        return { title: "Архівна візуалізація", img: "https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=1000" };
    }
}

async function fetchArchiveVideo(date) {
    try {
        const response = await fetch(`https://archive.org/advancedsearch.php?q=date:${date} AND mediatype:movies&output=json&limit=1`);
        const data = await response.json();
        const item = data.response.docs[0];
        if (!item) return { title: "Відео-хроніка відсутня", id: null, duration: 0, url: null };

        try {
            const metaRes = await fetch(`https://archive.org/metadata/${item.identifier}`);
            const metaData = await metaRes.json();
            let duration = 0;
            let videoUrl = null;

            if (metaData.files) {
                const videoFile = metaData.files.find(f => f.format === 'MPEG4' || f.name.endsWith('.mp4'));
                if (videoFile) {
                    duration = parseFloat(videoFile.duration) || 0;
                    videoUrl = `https://archive.org/download/${item.identifier}/${videoFile.name}`;
                }
            }
            return { title: item.title, id: item.identifier, duration: duration || 45, url: videoUrl };
        } catch (e) {
            return { title: item.title, id: item.identifier, duration: 45, url: null };
        }
    } catch (e) { return { title: "Відео-хроніка відсутня", id: null, duration: 0, url: null }; }
}

function scheduleNextMemory(seconds) {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    // Increased max limit to 3600s (1 hour) to avoid cutting off long videos
    const delay = Math.max(15, Math.min(seconds, 3600));
    autoAdvanceTimer = setTimeout(() => {
        randomBtn.click();
    }, delay * 1000);
}

async function fetchArchiveNews(date) {
    try {
        const response = await fetch(`https://archive.org/advancedsearch.php?q=date:${date} AND subject:(news OR highlights)&output=json&limit=3`);
        const data = await response.json();
        return data.response.docs.map(doc => doc.title);
    } catch (e) { return []; }
}

async function generateAtmosphereSummary(date) {
    const dStr = date.split('-').reverse().join('.');
    return `Аналітичний звіт ${dStr}. Спектральний аналіз завершено. Рівень фонової активності стабільний.`;
}

function renderResults(date, nasa, photo, video, news, atmosphere) {
    document.getElementById('displayDate').textContent = date.split('-').reverse().join('.');
    document.getElementById('aiAtmosphere').textContent = atmosphere;

    const videoMedia = document.getElementById('videoMedia');
    videoMedia.innerHTML = '';

    if (video.url) {
        const v = document.createElement('video');
        v.src = video.url;
        v.autoplay = true;
        v.muted = false;
        v.playsInline = true;
        v.crossOrigin = "anonymous";
        v.style.width = "100%";
        v.style.height = "100%";
        v.style.objectFit = "cover";

        v.onplay = () => {
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            connectAudioSource(v);
        };

        v.onended = () => {
            console.log("Video finished.");
        };

        videoMedia.appendChild(v);
    } else if (video.id) {
        videoMedia.innerHTML = `<iframe id="activeIframe" src="https://archive.org/embed/${video.id}&autoplay=1&mute=0" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    } else {
        videoMedia.innerHTML = `<img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1000">`;
    }

    document.getElementById('videoDesc').textContent = video.title;
    document.getElementById('archiveMedia').innerHTML = `<img src="${photo.img}">`;
    document.getElementById('archiveDesc').textContent = photo.title;

    const newsArchive = document.getElementById('newsArchive');
    if (news.length > 0) {
        newsArchive.innerHTML = news.map(n => `<div class="news-item">${n}</div>`).join('');
    } else {
        newsArchive.innerHTML = `<canvas id="newsSpaceCanvas" class="news-space-canvas"></canvas><div class="news-item" style="border:none; text-align:center; padding-top:20px; opacity:0.7;">МЕРЕЖЕВА ТИША...</div>`;
        initNewsSpaceAnimation();
    }
}

function initNewsSpaceAnimation() {
    const nCanvas = document.getElementById('newsSpaceCanvas');
    if (!nCanvas) return;
    const nCtx = nCanvas.getContext('2d');
    const rect = nCanvas.parentElement.getBoundingClientRect();
    nCanvas.width = rect.width;
    nCanvas.height = rect.height;
    const dots = Array.from({ length: 30 }, () => ({ x: Math.random() * nCanvas.width, y: Math.random() * nCanvas.height, z: Math.random() * nCanvas.width }));

    function anim() {
        if (!document.getElementById('newsSpaceCanvas')) return;
        nCtx.fillStyle = 'black';
        nCtx.fillRect(0, 0, nCanvas.width, nCanvas.height);
        nCtx.fillStyle = 'white';
        dots.forEach(d => {
            d.z -= 1;
            if (d.z <= 0) d.z = nCanvas.width;
            const k = 128 / d.z;
            const px = (d.x * k + nCanvas.width / 2) % nCanvas.width;
            const py = (d.y * k + nCanvas.height / 2) % nCanvas.height;
            nCtx.beginPath();
            nCtx.arc(px, py, (1 - d.z / nCanvas.width) * 1.5, 0, Math.PI * 2);
            nCtx.fill();
        });
        requestAnimationFrame(anim);
    }
    anim();
}
