const daySelect = document.getElementById('daySelect');
const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const exploreBtn = document.getElementById('exploreBtn');
const randomBtn = document.getElementById('randomBtn');
const resultContainer = document.getElementById('resultContainer');
const loader = document.getElementById('loader');

// Global Canvas (Background Stars)
const canvas = document.getElementById('starsCanvas');
const ctx = canvas.getContext('2d');

// Space Cluster Canvas (Rotating Planet)
const spaceCanvas = document.getElementById('spaceInteractiveCanvas');
const sCtx = spaceCanvas.getContext('2d');

const NASA_API_KEY = 'DEMO_KEY';

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
    const rect = spaceCanvas.parentElement.getBoundingClientRect();
    spaceCanvas.width = rect.width;
    spaceCanvas.height = rect.height;
    planetDots = [];

    // Create spherical point cloud
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

    // Sort dots by Z for depth effect
    const projected = planetDots.map(d => {
        // Rotate around Y axis
        const cosY = Math.cos(rotationAngle);
        const sinY = Math.sin(rotationAngle);

        const xRot = d.x * cosY - d.z * sinY;
        const zRot = d.x * sinY + d.z * cosY;

        // Depth projection
        const perspective = 500 / (500 + zRot);
        const scale = perspective;

        return {
            x: cx + xRot * scale,
            y: cy + d.y * scale,
            z: zRot,
            scale: scale,
            alpha: (zRot + 300) / 600 // fade based on depth
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
    const days = 31;
    for (let i = 1; i <= days; i++) {
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
    const days = daySelect.options.length;
    const months = monthSelect.options.length;
    const years = yearSelect.options.length;
    
    daySelect.selectedIndex = Math.floor(Math.random() * days);
    monthSelect.selectedIndex = Math.floor(Math.random() * months);
    yearSelect.selectedIndex = Math.floor(Math.random() * years);
}

initStars();
animateStars();
initSelectors();
initPlanet();
animatePlanet();

// Trigger random on start
setRandomDate();
exploreBtn.click();

randomBtn.onclick = () => {
    setRandomDate();
    exploreBtn.click();
};

window.onresize = () => {
    initStars();
    initPlanet();
};

exploreBtn.onclick = async () => {
    const d = daySelect.value;
    const m = monthSelect.value;
    const y = yearSelect.value;
    const selectedDate = `${y}-${m}-${d}`;

    planetHue = (parseInt(y) * 1.5) % 360;
    rotationSpeed = 0.003 + (parseInt(y) % 50) / 10000;

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
        console.error(error);
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
        return { title: item.title, img: `https://archive.org/services/img/${item.identifier}` };
    } catch (e) {
        return { title: "Архівна візуалізація", img: "https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=1000" };
    }
}

async function fetchArchiveVideo(date) {
    try {
        const response = await fetch(`https://archive.org/advancedsearch.php?q=date:${date} AND mediatype:movies&output=json&limit=1`);
        const data = await response.json();
        const item = data.response.docs[0];
        return { title: item.title, id: item.identifier };
    } catch (e) { return { title: "Відео-хроніка відсутня", id: null }; }
}

async function fetchArchiveNews(date) {
    try {
        const response = await fetch(`https://archive.org/advancedsearch.php?q=date:${date} AND subject:(news OR highlights)&output=json&limit=3`);
        const data = await response.json();
        const docs = data.response.docs;
        return docs.length > 0 ? docs.map(doc => doc.title) : [];
    } catch (e) { return []; }
}

async function generateAtmosphereSummary(date) {
    const y = parseInt(date.split('-')[0]);
    const dStr = date.split('-').reverse().join('.');

    let era = "";
    let vibe = "";
    if (y < 1920) { era = "епоха великих змін та зародження модерну"; vibe = "пам'ять планети зберігається у зернистих чорно-білих кадрах та рідкісних документах"; }
    else if (y < 1950) { era = "час глобальних потрясінь та механічного прогресу"; vibe = "атмосфера наповнена звуками радіо та шумом великих заводів"; }
    else if (y < 1990) { era = "аналоговий розквіт та космічна гонка"; vibe = "світ стає кольоровим, а людина вперше дивиться на Землю збоку"; }
    else { era = "цифрова революція та інформаційний океан"; vibe = "кожна секунда життя фіксується у мільярдах байт даних"; }

    return `Аналітичний звіт для часового вектора ${dStr}. Це була ${era}, коли людство активно формувало свій завтрашній день. ${vibe}. Зафіксовані дані вказують на високу інтенсивність історичних подій. Візуальна пам'ять цього періоду є критично важливою для розуміння еволюції нашої цивілізації.`;
}

function renderResults(date, nasa, photo, video, news, atmosphere) {
    document.getElementById('displayDate').textContent = date.split('-').reverse().join('.');
    document.getElementById('aiAtmosphere').textContent = atmosphere;

    const videoMedia = document.getElementById('videoMedia');
    if (video.id) {
        // Adding autoplay and looping parameters for IA embed
        videoMedia.innerHTML = `<iframe src="https://archive.org/embed/${video.id}&autoplay=1&loop=1&playlist=${video.id}" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    } else {
        videoMedia.innerHTML = `<img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1000">`;
    }
    document.getElementById('videoDesc').textContent = video.title;

    const archiveMedia = document.getElementById('archiveMedia');
    archiveMedia.innerHTML = `<img src="${photo.img}">`;
    document.getElementById('archiveDesc').textContent = photo.title;

    const newsArchive = document.getElementById('newsArchive');
    if (news.length > 0) {
        newsArchive.innerHTML = news.map(n => `<div class="news-item">${n}</div>`).join('');
    } else {
        newsArchive.innerHTML = `
            <canvas id="newsSpaceCanvas" class="news-space-canvas"></canvas>
            <div class="news-item" style="border:none; text-align:center; padding-top:20px; opacity:0.7;">
                МЕРЕЖЕВА ТИША: ПОДІЙ НЕ ЗНАЙДЕНО...<br>ПЕРЕХІД У ГЛИБОКИЙ КОСМОС
            </div>
        `;
        initNewsSpaceAnimation();
    }

    document.getElementById('spaceDesc').textContent = nasa.title + " | Спектральний аналіз епохи завершено.";
}

let newsAnimId = null;
function initNewsSpaceAnimation() {
    if (newsAnimId) cancelAnimationFrame(newsAnimId);
    const nCanvas = document.getElementById('newsSpaceCanvas');
    if (!nCanvas) return;
    const nCtx = nCanvas.getContext('2d');
    const rect = nCanvas.parentElement.getBoundingClientRect();
    nCanvas.width = rect.width;
    nCanvas.height = rect.height;
    
    const dots = [];
    for(let i=0; i<50; i++) {
        dots.push({
            x: Math.random() * nCanvas.width,
            y: Math.random() * nCanvas.height,
            z: Math.random() * nCanvas.width,
            s: Math.random() * 2
        });
    }

    function anim() {
        nCtx.fillStyle = 'black';
        nCtx.fillRect(0, 0, nCanvas.width, nCanvas.height);
        nCtx.fillStyle = 'white';
        dots.forEach(d => {
            d.z -= 2;
            if (d.z <= 0) d.z = nCanvas.width;
            const k = 128 / d.z;
            const px = d.x * k + nCanvas.width/2;
            const py = d.y * k + nCanvas.height/2;
            const size = (1 - d.z / nCanvas.width) * 3;
            nCtx.beginPath();
            nCtx.arc(px % nCanvas.width, py % nCanvas.height, size, 0, Math.PI*2);
            nCtx.fill();
        });
        newsAnimId = requestAnimationFrame(anim);
    }
    anim();
}
