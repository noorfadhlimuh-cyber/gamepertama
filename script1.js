const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 500;

// Elemen UI
const turnMsg = document.getElementById('turn-message');
const scoreRedEl = document.getElementById('score-red');
const scoreBlueEl = document.getElementById('score-blue');
const animContainer = document.getElementById('anim-container');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const gameOverScreen = document.getElementById('game-over');
const winnerText = document.getElementById('winner-text');
const winnerAnim = document.getElementById('winner-anim');
const restartBtn = document.getElementById('restart-btn');

// State Game
let score = { red: 0, blue: 0 };
let currentTurn = 'red'; // 'red' atau 'blue'
let isDragging = false;
let draggedPlayer = null;
let dragStart = { x: 0, y: 0 };
let mousePos = { x: 0, y: 0 };
let isPlaying = false;
let gameOver = false;

// Audio Context
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playWhistle() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function playCheer() {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 2; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; 
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1000;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);
    
    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}

// Objek Game
class Entity {
    constructor(x, y, radius, color, team = null) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.team = team;
        this.vx = 0;
        this.vy = 0;
        this.mass = radius;
        this.friction = 0.98;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.closePath();

        // Inner detail for coin
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();
        ctx.closePath();
    }

    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Batas henti absolut untuk mencegah bug tidak bisa gerak (Velocity Threshold)
        if (Math.abs(this.vx) < 0.2) this.vx = 0;
        if (Math.abs(this.vy) < 0.2) this.vy = 0;

        this.x += this.vx;
        this.y += this.vy;

        // Tumbukan Tembok (Batas Lapangan)
        if (this.x - this.radius < 0) { this.x = this.radius; this.vx *= -1; }
        if (this.x + this.radius > canvas.width) { this.x = canvas.width - this.radius; this.vx *= -1; }
        
        // Tumbukan Tembok Atas/Bawah dengan toleransi tiang gawang
        const isInsideGoalY = this.y > 17