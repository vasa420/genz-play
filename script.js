// ==========================================
// 1. AUDIO & SPEECH SYSTEM
// ==========================================
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

// ==========================================
// 1.5. NETWORK & SOCKET SYSTEM
// ==========================================
let socket;
try {
    socket = io(); // Connects to the same host as the client
} catch (e) {
    console.warn("Socket.io not found! Multiplayer will be disabled.");
}

// --- Integrated Background Music ---
window.masterVolume = parseInt(localStorage.getItem('carrom_master_volume') || "70");
window.bgMusic = new Audio('https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3');
window.bgMusic.loop = true;
window.bgMusic.volume = (window.masterVolume / 100) * 0.4; // Scaled by master volume
window.isMusicEnabled = localStorage.getItem('carrom_bg_music') !== 'false';
window.maxFps = localStorage.getItem('carrom_fps_limit') || 'Unlimited';
window.lastFrameTime = performance.now();
window.isSaveMatchHistoryEnabled = localStorage.getItem('carrom_save_match_history') !== 'false';
window.isSfxEnabled = localStorage.getItem('carrom_sfx_enabled') !== 'false';
window.particleLevel = localStorage.getItem('carrom_particle_level') || 'MAX';
console.log("Audio System initialized. Master Volume:", window.masterVolume, "Music enabled:", window.isMusicEnabled, "FPS Limit:", window.maxFps, "Save Match History:", window.isSaveMatchHistoryEnabled, "SFX Enabled:", window.isSfxEnabled, "Particles:", window.particleLevel);

window.toggleBackgroundMusic = function (forcedState) {
    if (forcedState !== undefined) {
        window.isMusicEnabled = forcedState;
    } else {
        window.isMusicEnabled = !window.isMusicEnabled;
    }
    localStorage.setItem('carrom_bg_music', window.isMusicEnabled ? 'true' : 'false');

    if (window.isMusicEnabled) {
        if (window.bgMusic.paused) {
            window.bgMusic.currentTime = 0;
            window.bgMusic.play().catch(e => console.warn("Music playback pending user interaction."));
        }
    } else {
        window.bgMusic.pause();
    }
};

// Global User Interaction Listener to ensure music starts as soon as user clicks anywhere
window.addEventListener('mousedown', function startMusicOnce() {
    if (window.isMusicEnabled && window.bgMusic && window.bgMusic.paused && (gameState === 'MENU' || gameState === 'LOGIN')) {
        window.bgMusic.play().catch(e => { });
    }
}, { once: false });

window.playSound = function (type) {
    if (!window.isSfxEnabled) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Attempt full screen safely on user interaction
    if (type === 'hit' || type === 'reveal' || type === 'beep') {
        window.requestFullScreen();
    }

    const volScale = (window.masterVolume || 70) / 100;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const time = audioCtx.currentTime;

    if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, time);
        osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);
        gain.gain.setValueAtTime(0.5 * volScale, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.start(); osc.stop(time + 0.1);
    } else if (type === 'pocket') {
        const freqs = [800, 1500, 400, 1200, 1000, 150];
        const f = freqs[window.equippedSoundId || 0];
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, time);
        gain.gain.setValueAtTime(0.5 * volScale, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        osc.start(); osc.stop(time + 0.3);
    } else if (type === 'beep') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, time);
        gain.gain.setValueAtTime(0.1 * volScale, time);
        osc.start(); osc.stop(time + 0.1);
    } else if (type === 'claim') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, time);
        osc.frequency.setValueAtTime(600, time + 0.1);
        osc.frequency.setValueAtTime(1000, time + 0.2);
        gain.gain.setValueAtTime(0.5 * volScale, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.start(); osc.stop(time + 0.5);
    } else if (type === 'slowmo') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(10, time + 2.5);
        gain.gain.setValueAtTime(0.8 * volScale, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 2.5);
        osc.start(); osc.stop(time + 2.5);
    } else if (type === 'foul') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(50, time + 0.25);
        gain.gain.setValueAtTime(0.6 * volScale, time);
        gain.gain.linearRampToValueAtTime(0.01, time + 0.25);
        osc.start(); osc.stop(time + 0.25);
    }
    else if (type === 'intro') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.exponentialRampToValueAtTime(20, time + 2.5);
        gain.gain.setValueAtTime(0.8 * volScale, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 2.5);
        osc.start(); osc.stop(time + 2.5);
    } else if (type === 'reveal') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.linearRampToValueAtTime(800, time + 0.5);
        gain.gain.setValueAtTime(0.2 * volScale, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.start(); osc.stop(time + 0.5);
    }
};

let hasFemaleVoice = localStorage.getItem('hasFemaleVoice') === 'true';

// --- Better Voice Synthesis Handling ---
let voiceCache = { male: null, female: null, generic: null };
function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    let voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        voiceCache.male = voices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('mark') || v.name.toLowerCase().includes('guy')) || voices[0];
        voiceCache.female = voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('victoria') || v.name.toLowerCase().includes('karen')) || voices[0];
        voiceCache.generic = voices[0];
    }
}
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
}

window.speakMessage = function (t, forceVoice = null) {
    if (!t) return;
    currentMessage = t; messageDisplayTime = Date.now();
    if ('speechSynthesis' in window) {
        // Cancel any previous speech to clear queue immediately
        window.speechSynthesis.cancel();

        let msg = new SpeechSynthesisUtterance(t);
        msg.volume = (window.masterVolume || 70) / 100;
        // Reduce rate slightly for better clarity
        msg.rate = 0.9;

        if (forceVoice === 'male') {
            if (voiceCache.male) msg.voice = voiceCache.male;
        } else if (hasFemaleVoice) {
            if (voiceCache.female) msg.voice = voiceCache.female;
        } else if (voiceCache.generic) {
            msg.voice = voiceCache.generic;
        }

        window.speechSynthesis.speak(msg);
    }
    let inp = document.getElementById('custom-msg-input'); if (inp) inp.value = "";
};

window.switchToHorrorGame = function() {
    window.playSound('hit');
    window.requestFullScreen();
    currentMessage = "⚠️ WARNING: ENTERING HORROR REALM...";
    messageDisplayTime = Date.now() + 2000;
    setTimeout(() => {
        window.location.href = 'horror_game.html';
    }, 1500);
};

window.requestFullScreen = function() {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen =
        docEl.requestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.webkitRequestFullScreen ||
        docEl.msRequestFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        if (requestFullScreen) {
            requestFullScreen.call(docEl).catch(err => {
                console.warn(`Fullscreen request failed: ${err.message}`);
            });
        }
    }
};

// ==========================================
// 1.8. PROFESSIONAL CUSTOM MODAL SYSTEM
// ==========================================
window.showCustomModal = function (options) {
    const existing = document.querySelector('.custom-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';

    let html = `
        <div class="custom-modal-box" style="animation: modalEntrance 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;">
            <div class="custom-modal-title">${options.title || 'SYSTEM NOTICE'}</div>
            <div class="custom-modal-message">${options.message || ''}</div>
    `;

    if (options.type === 'prompt') {
        html += `
            <div class="custom-modal-input-container">
                <input type="text" class="custom-modal-input" id="modal-prompt-input" value="${options.defaultValue || ''}" placeholder="Type here..." autofocus>
            </div>
        `;
    }

    html += `<div class="custom-modal-actions">`;

    if (options.type === 'confirm' || options.type === 'prompt') {
        html += `<button class="custom-modal-btn custom-modal-btn-cancel" id="modal-cancel-btn">${options.cancelText || 'CANCEL'}</button>`;
    }

    html += `<button class="custom-modal-btn custom-modal-btn-confirm" id="modal-confirm-btn">${options.confirmText || 'PROCEED'}</button>`;

    html += `</div></div>`;

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add('active'), 10);

    const input = overlay.querySelector('#modal-prompt-input');
    const confirmBtn = overlay.querySelector('#modal-confirm-btn');
    const cancelBtn = overlay.querySelector('#modal-cancel-btn');

    const closeModal = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };

    confirmBtn.onclick = () => {
        const val = input ? input.value : true;
        closeModal();
        if (options.onConfirm) options.onConfirm(val);
    };

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            closeModal();
            if (options.onCancel) options.onCancel();
        };
    }

    if (input) {
        setTimeout(() => input.focus(), 100);
        input.onkeyup = (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape' && cancelBtn) cancelBtn.click();
        };
    }
};

window.customAlert = (msg, title = "ALERT") => {
    return new Promise(resolve => {
        window.showCustomModal({ title, message: msg, type: 'alert', onConfirm: resolve });
    });
};

window.customConfirm = (msg, title = "CONFIRMATION") => {
    return new Promise(resolve => {
        window.showCustomModal({
            title,
            message: msg,
            type: 'confirm',
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        });
    });
};

window.customPrompt = (msg, def = "", title = "INPUT REQUIRED") => {
    return new Promise(resolve => {
        window.showCustomModal({
            title,
            message: msg,
            type: 'prompt',
            defaultValue: def,
            onConfirm: val => resolve(val),
            onCancel: () => resolve(null)
        });
    });
};
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const SIZE = 600;

// Fix canvas blurring on high-DPI displays
let dpr = window.devicePixelRatio || 1;
canvas.width = SIZE * dpr;
canvas.height = SIZE * dpr;
canvas.style.width = SIZE + 'px';
canvas.style.height = SIZE + 'px';
ctx.scale(dpr, dpr);

const POCKET_RADIUS = 35;
const COIN_R = 12;
const STRIKER_R = 18;
const FRICTION = 0.975;
const RESTITUTION = 0.75;
const TURN_TIME_LIMIT = 15000;

// ==========================================
// 3. VARIABLES & GAME STATE
// ==========================================
window.timeScale = 1.0;
window.isCinematic = false;
window.camera = { x: SIZE / 2, y: SIZE / 2, scale: 1.0, rotation: 0 };
window.cameraTarget = { x: SIZE / 2, y: SIZE / 2, scale: 1.0, rotation: 0 };

window.getSimMouse = function (mx, my) {
    let dx = mx - SIZE / 2; let dy = my - SIZE / 2; let rot = -window.camera.rotation;
    return { x: SIZE / 2 + (dx * Math.cos(rot) - dy * Math.sin(rot)), y: SIZE / 2 + (dx * Math.sin(rot) + dy * Math.cos(rot)) };
};

// New Mode Variables
window.isPinkSlip = false; window.inBossRush = false; window.bossRushStage = 0;
window.infectionTimeLeft = 0; window.infectionTimerId = null; window.gunGameLevel = 7; window.gunGameLevelAI = 7;
window.petTargetCoin = null;
window.lastShotByPet = false;

window.triggerCinematic = function (px, py) {
    window.isCinematic = true; window.timeScale = 0.15; window.cameraTarget = { x: px, y: py, scale: 2.8, rotation: window.camera.rotation }; window.playSound('slowmo');
    currentMessage = "🎥 FINAL SHOT! 🎥"; messageDisplayTime = Date.now() + 3000;
    clearTimeout(window.cinematicTimeoutId);
    window.cinematicTimeoutId = setTimeout(() => { if (window.isCinematic) { window.timeScale = 1.0; window.isCinematic = false; } }, 3000);
};

// Event & Updates Feed System
window.eventFeeds = [
    { type: 'NEW', title: 'PHONE MESSAGE HORROR', desc: 'Can you survive the mysterious texts? Stay alive in the night!', icon: '📱', color: '#FF3E3E' },
    { type: 'EVENT', title: 'T-TOURNAMENT FINALS', desc: 'Join the grand stage and win $10,000!', icon: '🏆', color: '#FFD700' },
    { type: 'UPDATE', title: 'TITAN STRIKER (NEW)', desc: 'New heavy-weight striker added to shop.', icon: '🦾', color: '#00FFFF' },
    { type: 'EVENT', title: 'MIDNIGHT HUSTLE', desc: 'Extreme difficulty mode open now!', icon: '🌙', color: '#8A2BE2' },
    { type: 'UPDATE', title: 'PHYSICS OVERHAUL', desc: 'Smoother collisions and realistic friction.', icon: '⚙️', color: '#FF4500' },
    { type: 'EVENT', title: 'TEE EVENTS LIVE', desc: 'Participate in exclusive T-Series matches.', icon: '🎯', color: '#FF8C00' },
    { type: 'UPDATE', title: 'MULTIPLAYER BETA', desc: 'Real-time 2v2 matches now available.', icon: '🌐', color: '#FF0033' },
    { type: 'EVENT', title: 'GOLDEN COIN RUSH', desc: 'Double rewards for every pocketed coin!', icon: '💰', color: '#39FF14' },
    { type: 'UPDATE', title: 'PET EVOLUTION', desc: 'Pets can now level up and assist more.', icon: '🐾', color: '#FF1493' },
    { type: 'UPDATE', title: 'NEW BOARD: NEON', desc: 'Light up the arcade with Neon Slate.', icon: '🌈', color: '#ADFF2F' },
    { type: 'UPDATE', title: 'VOICE FX ADDED', desc: 'New female voice packs in the shop.', icon: '🎙️', color: '#E0B0FF' },
    { type: 'NEW', title: 'CHESS MASTER MODE', desc: 'The brand new premium big board Chess arena!', icon: '♟️', color: '#FFFFFF' },
    { type: 'OFFER', title: 'LUCKY SPIN BONUS', desc: 'Guaranteed rare items in today\'s spin.', icon: '🎰', color: '#FF00FF' },
    { type: 'EVENT', title: 'ZOMBIE OUTBREAK', desc: 'Survive endless waves to unlock exclusive pets.', icon: '🧟', color: '#00FF00' },
    { type: 'UPDATE', title: 'SMOOTH ANIMATIONS', desc: 'Silky 60FPS UI and cinematic board effects.', icon: '✨', color: '#1E90FF' },
    { type: 'PROMO', title: '70% OFF SEASON PASS', desc: 'Get the premium battle pass for a huge discount!', icon: '🎟️', color: '#FFD700' },
    { type: 'FEATURE', title: 'LIVE SPECTATING', desc: 'Watch global pro players in real-time.', icon: '👁️', color: '#FF3333' },
    { type: 'BOUNTY', title: 'BEAT THE CREATOR', desc: 'Defeat AI Boss level 5 for $500,000!', icon: '👹', color: '#8B0000' },
    { type: 'EVENT', title: 'NEON FESTIVAL', desc: 'Unlock glow-in-the-dark coins and strikers.', icon: '🌃', color: '#00FFFF' },
    { type: 'UPDATE', title: 'CLAN WARS TEASER', desc: 'Guilds are forming. Prepare for battle.', icon: '⚔️', color: '#C0C0C0' },
    { type: 'OFFER', title: 'MYSTIC CHEST DROPS', desc: 'Open chests for a chance at legendary gear.', icon: '🧰', color: '#9370DB' },
    { type: 'FEATURE', title: '3D SHOWCASE', desc: 'Flaunt your best boards in the 3D gallery.', icon: '🖼️', color: '#FF69B4' },
    { type: 'EVENT', title: 'WEEKEND XP BOOST', desc: 'Earn 3x experience all weekend long!', icon: '⚡', color: '#FFFF00' }
];
window.currentFeedIndex = 0;
window.lastFeedUpdate = 0;

// Player Save Data
let playerName = localStorage.getItem('playerName') || "GUEST PLAYER";
let savedMoney = localStorage.getItem('playerMoney');
let playerMoney = savedMoney !== null && !isNaN(savedMoney) ? parseInt(savedMoney) : 900;

// ==========================================
// 3.0. GOOGLE & CLERK AUTH SYSTEM INTEGRATION
// ==========================================
window.initializedClerk = false;

// Google Login Handler
window.handleGoogleLogin = function (response) {
    try {
        console.log("Google Login Response received");
        // Decode the JWT (credential)
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const user = JSON.parse(jsonPayload);
        console.log("Google User:", user);

        playerName = user.name || user.given_name || "GOOGLE USER";
        localStorage.setItem('playerName', playerName);

        // Visual feedback
        currentMessage = `WELCOME, ${playerName.toUpperCase()}!`;
        messageDisplayTime = Date.now() + 3000;
        window.playSound('reveal');

        // Set avatar if possible (or just store it)
        if (user.picture) {
            localStorage.setItem('playerAvatar', user.picture);
        }

        updateLocalProfileUI(playerName, user.picture || '👤');

        // Auto-enter the arcade
        setTimeout(() => {
            if (document.getElementById('login-screen').style.display !== 'none' && !window.enteringArcadeInProgress) {
                triggerLoginTransition();
            }
        }, 1000);

    } catch (e) {
        console.error("Error handling Google Login:", e);
    }
};

async function initClerk() {
    const publishableKey = "pk_test_c3VidGxlLW5hcndoYWwtNTAuY2xlcmsuYWNjb3VudHMuZGV2JA"; // User needs to update this

    if (publishableKey === "pk_test_c3VidGxlLW5hcndoYWwtNTAuY2xlcmsuYWNjb3VudHMuZGV2JA") {
        console.warn("Clerk Publishable Key not set. Falling back to legacy login.");
        document.getElementById('legacy-login-ui').style.display = 'block';
        return;
    }

    try {
        const clerk = new Clerk(publishableKey);
        await clerk.load();
        window.Clerk = clerk;
        window.initializedClerk = true;

        if (clerk.user) {
            handleClerkSession(clerk.user);
        } else {
            showClerkSignIn();
        }

        clerk.addListener(({ user }) => {
            if (user) {
                handleClerkSession(user);
            } else {
                console.log("No active user session.");
                localStorage.removeItem('playerName');
                showClerkSignIn();
            }
        });
    } catch (err) {
        console.error("Clerk initialization failed:", err);
        document.getElementById('legacy-login-ui').style.display = 'block';
    }
}

function handleClerkSession(user) {
    playerName = user.fullName || user.firstName || user.username || "CLERK USER";
    localStorage.setItem('playerName', playerName);
    console.log("Authenticated as:", playerName);

    updateLocalProfileUI(playerName, user.imageUrl);

    // If we are on the login screen, automatically enter the arcade
    if (document.getElementById('login-screen').style.display !== 'none' && !window.enteringArcadeInProgress) {
        triggerLoginTransition();
    }
    updateClerkProfileUI(user);
}

function updateLocalProfileUI(name, imgUrl) {
    const profileCard = document.getElementById('player-profile-card');
    if (profileCard) {
        profileCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; padding: 6px 12px; background: rgba(0,0,0,0.85); border: 1.5px solid #00FFFF; border-radius: 12px; box-shadow: 0 0 15px rgba(0,255,255,0.15); backdrop-filter: blur(10px); transition: 0.3s;">
                <div onclick="window.showPlayerDetails()" style="cursor: pointer; display: flex; align-items: center; gap: 10px; flex: 1;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                    <div style="position: relative;">
                        <img src="${imgUrl}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #00FFFF; box-shadow: 0 0 10px rgba(0,255,255,0.3);" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjIyIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuMzVlbSIgZmlsbD0id2hpdGUiPvCfk6Q8L3RleHQ+PC9zdmc+';">
                        <div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; background: #39FF14; border-radius: 50%; border: 2px solid #000;"></div>
                    </div>
                    <div>
                        <div style="color: #FFF; font-weight: 900; font-size: 14px; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(255,255,255,0.3); line-height: 1.2;">${name}</div>
                        <div style="color: #00FFFF; font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">PRO LEVEL ${Math.floor(window.totalWins / 5) + 1}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button onclick="window.showPlayerDetails()" style="background: rgba(0,255,255,0.1); border: 1px solid #00FFFF; color: #00FFFF; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; font-size: 16px; padding: 0; animation: ringRotate 4s linear infinite;" onmouseover="this.style.background='#00FFFF'; this.style.color='#000';" onmouseout="this.style.background='rgba(0,255,255,0.1)'; this.style.color='#00FFFF';">⚙️</button>
                    <button onclick="location.reload()" style="background: rgba(255,51,51,0.1); border: 1px solid #FF3333; color: #FF3333; border-radius: 8px; padding: 0 12px; height: 32px; font-size: 10px; cursor: pointer; font-weight: 950; letter-spacing: 1px; transition: 0.2s;" onmouseover="this.style.background='#FF3333'; this.style.color='#000';" onmouseout="this.style.background='rgba(255,51,51,0.1)'; this.style.color='#FF3333';">EXIT</button>
                </div>
            </div>
        `;
    }
}

function showClerkSignIn() {
    const container = document.getElementById('clerk-signin-ui');
    if (window.Clerk && container) {
        window.Clerk.mountSignIn(container, {
            appearance: {
                theme: 'dark',
                variables: { colorPrimary: '#00FFFF' }
            }
        });
    }
}

function updateClerkProfileUI(user) {
    const profileCard = document.getElementById('player-profile-card');
    if (profileCard && user) {
        profileCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; padding: 6px 12px; background: rgba(0,0,0,0.85); border: 1.5px solid #00FFFF; border-radius: 12px; box-shadow: 0 0 15px rgba(0,255,255,0.15); backdrop-filter: blur(10px); transition: 0.3s;">
                <div onclick="window.showPlayerDetails()" style="cursor: pointer; display: flex; align-items: center; gap: 10px; flex: 1;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                    <div style="position: relative;">
                        <img src="${user.imageUrl}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #00FFFF; box-shadow: 0 0 10px rgba(0,255,255,0.3);">
                        <div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; background: #39FF14; border-radius: 50%; border: 2px solid #000;"></div>
                    </div>
                    <div>
                        <div style="color: #FFF; font-weight: 900; font-size: 14px; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(255,255,255,0.3); line-height: 1.2;">${user.fullName || user.firstName}</div>
                        <div style="color: #00FFFF; font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">PRO LEVEL ${Math.floor(window.totalWins / 5) + 1}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button onclick="window.showPlayerDetails()" style="background: rgba(0,255,255,0.1); border: 1px solid #00FFFF; color: #00FFFF; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; font-size: 16px; padding: 0; animation: ringRotate 4s linear infinite;" onmouseover="this.style.background='#00FFFF'; this.style.color='#000';" onmouseout="this.style.background='rgba(0,255,255,0.1)'; this.style.color='#00FFFF';">⚙️</button>
                    <button onclick="window.Clerk.signOut()" style="background: rgba(255,51,51,0.1); border: 1px solid #FF3333; color: #FF3333; border-radius: 8px; padding: 0 12px; height: 32px; font-size: 10px; cursor: pointer; font-weight: 950; letter-spacing: 1px; transition: 0.2s;" onmouseover="this.style.background='#FF3333'; this.style.color='#000';" onmouseout="this.style.background='rgba(255,51,51,0.1)'; this.style.color='#FF3333';">EXIT</button>
                </div>
            </div>
        `;
    }
}

// Call initClerk when script loads, but wait for the SDK script to be ready
window.addEventListener('load', () => {
    const checkClerk = setInterval(() => {
        if (typeof Clerk !== 'undefined') {
            clearInterval(checkClerk);
            initClerk();
        }
    }, 100);
    // Timeout after 5 seconds
    setTimeout(() => clearInterval(checkClerk), 5000);

    // Initialize Google Login manually as a secondary trigger
    if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: "731634414121-6nbfdnaetc5clc54h93ahrh9j17km0pl.apps.googleusercontent.com",
            callback: window.handleGoogleLogin
        });
        const containers = document.querySelectorAll('.g_id_signin');
        containers.forEach(container => {
            google.accounts.id.renderButton(container, {
                theme: "filled_blue",
                size: "large",
                shape: "pill",
                text: "signin_with",
                width: 280
            });
        });
    }
});

let equippedStrikerId = parseInt(localStorage.getItem('equippedStrikerId')) || 0;
let equippedCoinId = parseInt(localStorage.getItem('equippedCoinId')) || 0;
let equippedPocketEffectId = parseInt(localStorage.getItem('equippedPocketEffectId')) || 0;
let equippedBoardId = parseInt(localStorage.getItem('equippedBoardId')) || 0;
let equippedSoundId = parseInt(localStorage.getItem('equippedSoundId')) || 0;
let equippedPetId = parseInt(localStorage.getItem('equippedPetId')) || 0;
let equippedAvatarId = parseInt(localStorage.getItem('equippedAvatarId')) || 0;
let equippedTitleId = parseInt(localStorage.getItem('equippedTitleId')) || 0;
let hasPremiumEmote = localStorage.getItem('hasPremiumEmote') === 'true';

let currentShopView = 'menu'; let freestyleTargetScore = 120;

let hasVictoryEffect = localStorage.getItem('hasVictoryEffect') === 'true';
let hasMegaFireworks = localStorage.getItem('hasMegaFireworks') === 'true';
let unlockedEmotes = JSON.parse(localStorage.getItem('unlockedEmotes')) || ['😀', '😂', '🥰', '😢', '😭', '😡', '🤬', '😲', '👍', '👎'];
let hasPremiumPass = localStorage.getItem('hasPremiumPass') === 'true';

window.totalWins = parseInt(localStorage.getItem('totalWins')) || 0;
window.totalLosses = parseInt(localStorage.getItem('totalLosses')) || 0;
window.totalCoinsPocketed = parseInt(localStorage.getItem('totalCoinsPocketed')) || 0;
window.queenCaptures = parseInt(localStorage.getItem('queenCaptures')) || 0;

let matchesPlayed = parseInt(localStorage.getItem('matchesPlayed')) || 0;

// Dynamic Pass System
let currentPassRound = parseInt(localStorage.getItem('currentPassRound')) || 1;
let passMatchesPlayed = parseInt(localStorage.getItem('passMatchesPlayed')) || 0;
let passCooldownEndTime = parseInt(localStorage.getItem('passCooldownEndTime')) || 0;
let freePassClaims = JSON.parse(localStorage.getItem('freePassClaims')) || [false, false, false, false, false];
let premiumPassClaims = JSON.parse(localStorage.getItem('premiumPassClaims')) || [false, false, false, false, false];

// Daily Quests System
let dailyQuests = JSON.parse(localStorage.getItem('dailyQuests')) || [];
let questsDate = localStorage.getItem('questsDate') || "";
window.questRefreshes = parseInt(localStorage.getItem('questRefreshes')) || 0;

window.generateDailyQuests = function () {
    let today = new Date().toDateString();
    if (questsDate !== today || dailyQuests.length === 0) {
        window.questRefreshes = 0; localStorage.setItem('questRefreshes', 0);
        const questPool = [
            { id: 'win_zombie', desc: 'Win a game of Zombie Mode', target: 1 },
            { id: 'pocket_white_turn', desc: 'Pocket 3 White coins in a single turn', target: 3 },
            { id: 'defeat_boss', desc: 'Defeat a Boss in Boss Rush', target: 1 },
            { id: 'play_matches', desc: 'Play 5 Matches', target: 5 },
            { id: 'pocket_queen', desc: 'Pocket the Queen 2 times', target: 2 },
            { id: 'win_freestyle', desc: 'Win a Freestyle Match', target: 1 },
            { id: 'play_pink_slip', desc: 'Play a Pink Slip Match', target: 1 }
        ];
        let shuffled = questPool.sort(() => 0.5 - Math.random()).slice(0, 3);
        dailyQuests = shuffled.map(q => ({ ...q, progress: 0, claimed: false, reward: Math.floor(Math.random() * 16 + 5) * 100 }));
        localStorage.setItem('dailyQuests', JSON.stringify(dailyQuests));
        localStorage.setItem('questsDate', today);
    }
};

window.refreshQuests = async function () {
    if (window.questRefreshes > 0) {
        if (playerMoney < 100) { window.customAlert("Not enough cash to refresh!", "SHOP ERROR"); window.playSound('foul'); return; }
        playerMoney -= 100; localStorage.setItem('playerMoney', playerMoney); updateTopBar();
    }
    window.questRefreshes++; localStorage.setItem('questRefreshes', window.questRefreshes);
    const questPool = [{ id: 'win_zombie', desc: 'Win a game of Zombie Mode', target: 1 }, { id: 'pocket_white_turn', desc: 'Pocket 3 White coins in a single turn', target: 3 }, { id: 'defeat_boss', desc: 'Defeat a Boss in Boss Rush', target: 1 }, { id: 'play_matches', desc: 'Play 5 Matches', target: 5 }, { id: 'pocket_queen', desc: 'Pocket the Queen 2 times', target: 2 }, { id: 'win_freestyle', desc: 'Win a Freestyle Match', target: 1 }, { id: 'play_pink_slip', desc: 'Play a Pink Slip Match', target: 1 }];
    let shuffled = questPool.sort(() => 0.5 - Math.random()).slice(0, 3);
    dailyQuests = shuffled.map(q => ({ ...q, progress: 0, claimed: false, reward: Math.floor(Math.random() * 16 + 5) * 100 }));
    localStorage.setItem('dailyQuests', JSON.stringify(dailyQuests));
    window.playSound('beep'); renderSidebarShop();
};

window.updateQuest = function (id, amount = 1) {
    let updated = false;
    dailyQuests.forEach(q => {
        if (q.id === id && !q.claimed && q.progress < q.target) {
            q.progress += amount;
            if (q.progress > q.target) q.progress = q.target;
            updated = true;
            if (q.progress === q.target) {
                window.playSound('claim'); window.questNotifyTime = Date.now();
                setTimeout(() => window.customAlert(`📜 QUEST COMPLETED: ${q.desc}\nOpen Quests menu to claim your massive reward!`, "QUEST UPDATE"), 500);
            }
        }
    });
    if (updated) localStorage.setItem('dailyQuests', JSON.stringify(dailyQuests));
};

let coins = []; let striker = null; let particles = [];
let gameState = 'MENU'; let gameMode = 'CLASSIC'; let currentPlayer = 1;
let p1Coins = 0, p2Coins = 0, p1Points = 0, p2Points = 0;
let isQueenPocketed = false, queenPendingCover = false, playerCoveringQueen = null;
let coinsPocketedThisTurn = { white: 0, black: 0, queen: 0, strikerFoul: false };
let mouseX = 0, mouseY = 0; let botTimeoutId; let cinematicTimeoutId; let turnStartTime = 0; let winnerName = "";
window.is2v2 = false;
window.teamPoints = { team1: 0, team2: 0 }; // Team 1: Player 1 & 3, Team 2: Player 2 & 4
let gameOverTime = 0, foulMessageTime = 0, foulReason = "", queenCoverMessageTime = 0, goodMessageTime = 0;
let countdownStartTime = 0, countdownValue = 3, lastBeepValue = 0, passNotifyTime = 0; window.questNotifyTime = 0;
window.currentBet = 0; window.betErrorTime = 0;
window.zombieScore = 0; window.lastZombieSpawnTime = 0;
let currentEmote = ""; let emoteDisplayTime = 0; let currentMessage = ""; let messageDisplayTime = 0;
window.isSpectating = false; window.spectatingName = "";

// ==========================================
// 3.0. MULTIPLAYER CORE SYSTEM
// ==========================================
window.roomIdMP = null;
window.mpRoomId = null;
window.isMyTurnMP = false;
window.myPlayerIndexMP = 0;

window.createRoomMP = function (mode = 'lobby_2v2') {
    const rId = Math.floor(100000 + Math.random() * 900000).toString();
    window.roomIdMP = rId;
    window.mpRoomId = rId;
    socket.emit('join_room', { roomId: rId, playerName: playerName, isCreating: true });
    window.playSound('beep');
    window.mpState = mode;
    currentShopView = 'multiplayer';

    // Refresh friend invitations and recruits for a fresh room session
    window.resetMpFriends();

    renderSidebarShop();
};

window.joinRoomMP = function (forcedId = null, pass = "") {
    const rIdInputModal = document.getElementById('room-id-input');
    const rIdInputSidebar = document.getElementById('room-id-input-sidebar');

    let rId = "";
    if (forcedId) {
        rId = forcedId;
    } else if (rIdInputModal && rIdInputModal.value.trim() !== "") {
        rId = rIdInputModal.value.trim();
    } else if (rIdInputSidebar && rIdInputSidebar.value.trim() !== "") {
        rId = rIdInputSidebar.value.trim();
    } else {
        rId = window.mpRoomId;
    }

    if (!rId) { window.customAlert("Enter a Room ID!", "ID ERROR"); return; }
    if (String(rId).length < 6) { window.customAlert("ROOM ID WILL BE 6 DIGIT NUMBER ONLY", "ID ERROR"); return; }

    window.roomIdMP = rId;
    window.mpRoomId = rId;
    window.mpPassword = pass; // Store initial joining password
    socket.emit('join_room', { roomId: rId, playerName: playerName, password: pass });
    window.playSound('beep');
    window.mpState = 'lobby_2v2';
    currentShopView = 'multiplayer';
    renderSidebarShop();
};

// Redundant versions removed (consolidated in the Multiplayer section below)

window.syncMpPlayers = function (players) {
    let maxSlots = (window.mpState === 'lobby_1v1' || window.is1v1MP) ? 2 : 4;
    let newPlayers = new Array(maxSlots).fill(null);

    players.forEach(p => {
        if (p.index <= maxSlots) {
            let oldPlayer = window.mpPlayers ? window.mpPlayers.find(op => op && op.id === p.id) : null;
            newPlayers[p.index - 1] = {
                name: p.name,
                id: p.id,
                index: p.index,
                isMe: p.id === (socket ? socket.id : null),
                avatar: p.avatar || '👤',
                isAI: !!p.isAI,
                isReady: true,
                ping: p.isAI ? 1 : (oldPlayer ? oldPlayer.ping : undefined)
            };
        }
    });

    window.mpPlayers = newPlayers;
};

if (socket) {
    socket.on('player_joined', (data) => {
        const { players, roomId, selectedMode, hasPassword, petsAllowed, targetScore } = data;

        window.syncMpPlayers(players);
        window.mpHostJoinedPasswordProtected = hasPassword;
        if (data.password !== undefined) window.mpPassword = data.password;
        if (data.expiresIn) {
            window.mpPasswordExpiry = Date.now() + data.expiresIn;
            window.ensureMpLobbyTimer();
        }

        if (roomId) {
            window.mpRoomId = roomId;
            window.roomIdMP = roomId;
        }
        if (data.selectedMode) window.mpSelectedMode = data.selectedMode;
        if (data.petsAllowed !== undefined) window.mpPetsAllowed = data.petsAllowed;
        if (data.targetScore !== undefined) window.freestyleTargetScore = data.targetScore;
        if (data.infectionTime !== undefined) {
            window.infectionTimeLeft = data.infectionTime;
            updateUI();
        }

        const me = players.find(p => p.id === socket.id);
        if (me) {
            window.myPlayerIndexMP = me.index;
            // If I am Host and no password, start AI fill timer
            if (me.index === 1 && !hasPassword) {
                window.startRandomPlayerConnectTimer();
            } else if (window.randomPlayerTimer) {
                clearTimeout(window.randomPlayerTimer);
            }
        }

        // If game is already playing, jump in!
        if (data.roomState === 'PLAYING' && gameState !== 'PLAYING' && gameState !== 'MOVING' && gameState !== 'PLACING' && gameState !== 'AIMING' && gameState !== 'COUNTDOWN' && gameState !== 'SPINNING') {
            gameMode = data.selectedMode || 'CLASSIC';
            window.freestyleTargetScore = data.targetScore || 160;
            initGame();
            if (data.currentTurn) currentPlayer = data.currentTurn;
            if (data.coins && data.coins.length > 0) {
                // Pre-fill board with actual synced state
                data.coins.forEach((cData, i) => {
                    if (coins[i]) {
                        coins[i].x = cData.x; coins[i].y = cData.y;
                        coins[i].vx = cData.vx; coins[i].vy = cData.vy;
                        coins[i].active = cData.active;
                        if (cData.type) coins[i].type = cData.type;
                        if (cData.color) coins[i].color = cData.color;
                    } else {
                        let c = new Coin(cData.x, cData.y, COIN_R, cData.type || 'black', cData.color || '#333');
                        c.active = cData.active;
                        coins.push(c);
                    }
                });
            }
            window.isMyTurnMP = (currentPlayer === me.index);
            window.mpState = 'playing';
            currentShopView = 'menu';

            // Check if coins are moving to set correct state
            let someoneMoving = data.coins.some(c => c && (Math.abs(c.vx) > 0.01 || Math.abs(c.vy) > 0.01));
            gameState = someoneMoving ? 'MOVING' : 'PLACING';

            currentMessage = "🎮 JOINING ACTIVE MATCH...";
            messageDisplayTime = Date.now() + 3000;
            renderSidebarShop();
        } else {
            let pNames = players.map(p => p.name).join(", ");
            currentMessage = `👥 Players in Lobby: ${pNames}`;
            messageDisplayTime = Date.now() + 5000;
        }

        renderSidebarShop();
    });

    socket.on('room_password_updated', (data) => {
        window.mpPassword = data.password;
        if (currentShopView === 'multiplayer') renderSidebarShop();
        if (data.isExpired) window.playSound('foul');
    });

    window.ensureMpLobbyTimer = function () {
        // No longer needed - passwords don't expire automatically now
    };

    socket.on('wrong_password', async (data) => {
        if (data.message === 'PASSWORD_REQUIRED') {
            let p = await window.customPrompt("This room has password protected. Enter Password:", "", "LOCKED ROOM");
            if (p !== null) {
                window.joinRoomMP(p);
            } else {
                window.mpState = 'select';
                renderSidebarShop();
            }
        } else {
            window.customAlert(data.message, "ROOM ERROR");
            window.mpState = 'select';
            renderSidebarShop();
        }
    });

    socket.on('room_error', (data) => {
        window.customAlert(data.message, "ROOM ERROR");
        window.mpState = 'select';
        renderSidebarShop();
    });

    socket.on('room_full', (data) => {
        window.customAlert("ROOM FILLED", "LOBBY ERROR");
        window.mpState = 'select';
        renderSidebarShop();
    });

    socket.on('game_start', (data) => {
        const { room } = data;
        // Maintain fixed-size player array for consistent UI slots
        let maxSlots = (room.selectedMode && room.selectedMode.includes('1v1')) ? 2 : 4;
        if (window.mpState === 'lobby_1v1') maxSlots = 2;
        window.is2v2 = maxSlots === 4;
        window.is1v1MP = maxSlots === 2;

        window.syncMpPlayers(room.players);

        if (room.id) {
            window.mpRoomId = room.id;
            window.roomIdMP = room.id;
        }

        // Set the active game mode from room state (with local fallback)
        gameMode = room.selectedMode || window.mpSelectedMode || 'CLASSIC';
        window.freestyleTargetScore = room.targetScore || window.freestyleTargetScore || 160;
        window.mpPetsAllowed = (room.petsAllowed !== false);

        console.log(`Matching Starting! Mode: ${gameMode}, Target: ${window.freestyleTargetScore}`);

        initGame(); // Reset board
        window.isMyTurnMP = (currentPlayer === window.myPlayerIndexMP);

        if (window.isMyTurnMP) {
            currentMessage = "YOUR TURN!";
        } else if (window.mpPlayers && window.mpPlayers[currentPlayer - 1]) {
            currentMessage = `${window.mpPlayers[currentPlayer - 1].name.toUpperCase()}'S TURN!`;
        } else {
            currentMessage = "🎮 MATCH STARTING!";
        }
        messageDisplayTime = Date.now() + 3000;
        window.playSound('claim');

        // Disable AI
        const aiToggle = document.getElementById('ai-toggle');
        if (aiToggle) aiToggle.checked = false;

        // CRITICAL: Switch sidebar view to match mode
        window.mpState = 'playing';
        currentShopView = 'menu';
        renderSidebarShop();

        // Start the requested "in-room" countdown directly in the sidebar lobby area
        window.runInRoomLobbyTransition('lobby-participants-container', gameMode, () => {
            startCountdown();
            renderSidebarShop();
        });
    });

    socket.on('receive_shot', (data) => {
        if (!striker) return;
        striker.x = data.x;
        striker.y = data.y;
        striker.vx = data.vx;
        striker.vy = data.vy;
        gameState = 'MOVING';
        window.playSound('hit');
    });

    socket.on('update_striker_set', (pos) => {
        if (!striker || window.isMyTurnMP || gameState !== 'PLACING') return;
        striker.x = pos.x;
        striker.y = pos.y;
    });

    socket.on('update_coins', (data) => {
        data.forEach((cData, i) => {
            if (coins[i]) {
                coins[i].x = cData.x;
                coins[i].y = cData.y;
                coins[i].vx = cData.vx;
                coins[i].vy = cData.vy;
                coins[i].active = cData.active;
                if (cData.type) coins[i].type = cData.type;
                if (cData.color) coins[i].color = cData.color;
            } else {
                // New coin found! Create it (Useful for Zombie Mode spawns)
                let c = new Coin(cData.x, cData.y, COIN_R, cData.type || 'black', cData.color || '#333');
                c.vx = cData.vx || 0;
                c.vy = cData.vy || 0;
                c.active = cData.active !== false;
                coins.push(c);
            }
        });
    });

    socket.on('sync_timer', (data) => {
        if (window.myPlayerIndexMP !== 1) { // If I am NOT Host, sync with Host's timer
            window.infectionTimeLeft = data.time;
            updateUI();
        }
    });

    socket.on('turn_changed', (data) => {
        currentPlayer = data.turn;
        window.isMyTurnMP = (currentPlayer === window.myPlayerIndexMP);
        window.playSound('beep');
        if (window.isMyTurnMP) {
            currentMessage = "YOUR TURN!";
            messageDisplayTime = Date.now() + 2000;
        } else if (window.mpPlayers && window.mpPlayers[currentPlayer - 1]) {
            currentMessage = `${window.mpPlayers[currentPlayer - 1].name.toUpperCase()}'S TURN!`;
            messageDisplayTime = Date.now() + 2000;
        }
        // Fix: Ensure gameState is reset and striker is positioned for the new turn
        setupStriker();
    });

    socket.on('receive_emote', (data) => {
        currentEmote = data.emote.includes('!') ? "" : data.emote;
        if (!currentEmote) {
            currentMessage = `${data.playerName}: ${data.emote}`;
            messageDisplayTime = Date.now() + 3000;
        } else {
            emoteDisplayTime = Date.now();
        }
    });

    socket.on('player_left', (data) => {
        const { leaver, players } = data;

        // If I am the one who was kicked/left, go back to menu immediately
        if (leaver && leaver.id === socket.id) {
            window.is2v2 = false;
            window.is1v1MP = false;
            window.mpState = 'select';
            window.mpPlayers = null;
            window.mpRoomId = null;
            initGame();
            updateUI();
            renderSidebarShop();

            // Resume background music if we were in a match
            if (window.bgMusic && window.isMusicEnabled) {
                window.bgMusic.play().catch(e => { });
            }

            currentMessage = "👥 YOU HAVE BEEN REMOVED FROM THE ROOM";
            messageDisplayTime = Date.now() + 4000;
            return;
        }

        if (window.is2v2 && window.roomIdMP && leaver && !leaver.isAI) {
            let isTeam1 = (leaver.index === 1 || leaver.index === 3);
            let teamName = isTeam1 ? "TEAM BLUE" : "TEAM RED";
            let teammateIndex = isTeam1 ? (leaver.index === 1 ? 3 : 1) : (leaver.index === 2 ? 4 : 2);
            let teammate = players.find(p => p.index === teammateIndex);

            let isTeamEmpty = !teammate || teammate.isAI;

            if (isTeamEmpty) {
                currentMessage = `❌ ${teamName} LEFT`;
            } else {
                currentMessage = `❌ ${leaver.name.toUpperCase()} LEFT`;
            }
        } else {
            currentMessage = `❌ ${leaver ? leaver.name.toUpperCase() : 'PLAYER'} LEFT`;
        }

        messageDisplayTime = Date.now() + 3000;

        window.syncMpPlayers(players);
        renderSidebarShop();
    });

    socket.on('update_player_ping', (data) => {
        const { playerId, ping } = data;
        if (window.mpPlayers) {
            let p = window.mpPlayers.find(pl => pl && pl.id === playerId);
            if (p) {
                p.ping = ping;
            }
            if (currentShopView === 'multiplayer') {
                const focused = document.activeElement;
                // Don't re-render if user is currently interacting with an input/select
                if (!focused || (focused.tagName !== 'SELECT' && focused.tagName !== 'INPUT')) {
                    renderSidebarShop();
                }
            }
        }
    });

    socket.on('update_lobby_settings', (settings) => {
        if (settings.selectedMode !== undefined) window.mpSelectedMode = settings.selectedMode;
        if (settings.petsAllowed !== undefined) window.mpPetsAllowed = settings.petsAllowed;
        if (settings.targetScore !== undefined) window.freestyleTargetScore = settings.targetScore;
        if (settings.infectionTime !== undefined) window.infectionTimeLeft = settings.infectionTime;
        renderSidebarShop();
        updateUI();
    });
}

// ==========================================
// 3.1. PET ANIMATION SYSTEM
// ==========================================
let petAnim = { x: 45, y: 45, state: 'idle', timer: 0, targetX: 45, targetY: 45, speed: 1.0, typeId: 0, icon: '' };

function drawPetSystem() {
    if (gameState === 'MENU' || gameState === 'GAMEOVER' || window.mpPetsAllowed === false) return;
    let activePet = petShopItems.find(p => p.id === equippedPetId);
    if (!activePet || activePet.id === 0) return;

    petAnim.typeId = activePet.id;
    petAnim.icon = activePet.name.split(' ')[0]; // Emoji

    let isFlying = (petAnim.typeId === 8 || petAnim.typeId === 9 || petAnim.typeId === 10);
    let time = Date.now();

    // Pet AI Movement Logic
    let dx = petAnim.targetX - petAnim.x;
    let dy = petAnim.targetY - petAnim.y;
    let dist = Math.hypot(dx, dy);

    if (dist < petAnim.speed) {
        petAnim.x = petAnim.targetX;
        petAnim.y = petAnim.targetY;
        petAnim.timer--;
        petAnim.state = 'idle';

        if (petAnim.timer <= 0) {
            petAnim.state = 'moving';
            if (isFlying) {
                // Fly anywhere across the board
                petAnim.targetX = 50 + Math.random() * 500;
                petAnim.targetY = 50 + Math.random() * 500;
                petAnim.speed = 2.0;
                petAnim.timer = 150 + Math.random() * 200;
            } else {
                // Walk the wooden border
                let tracks = [{ x: 45, y: 45 }, { x: SIZE - 45, y: 45 }, { x: SIZE - 45, y: SIZE - 45 }, { x: 45, y: SIZE - 45 }];
                let currIdx = tracks.findIndex(t => Math.abs(t.x - petAnim.x) < 5 && Math.abs(t.y - petAnim.y) < 5);
                if (currIdx === -1) currIdx = 0;
                let nextIdx = Math.random() > 0.5 ? (currIdx + 1) % 4 : (currIdx + 3) % 4;
                petAnim.targetX = tracks[nextIdx].x;
                petAnim.targetY = tracks[nextIdx].y;
                petAnim.speed = 1.0;
                petAnim.timer = 50 + Math.random() * 100;
            }
        }
    } else {
        petAnim.state = 'moving';
        petAnim.x += (dx / dist) * petAnim.speed;
        petAnim.y += (dy / dist) * petAnim.speed;
    }

    ctx.save();
    ctx.translate(petAnim.x, petAnim.y);

    // Flip based on horizontal direction
    if (dx < 0) ctx.scale(-1, 1);

    // Hover logic for flying pets
    let hover = isFlying ? (petAnim.state === 'moving' ? 25 + Math.sin(time / 150) * 8 : 10) : 0;

    // Draw THICK Pet Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 25, 22 - (hover / 4), 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, -hover);

    // Draw THICK Wings or Legs
    if (isFlying) {
        let flap = petAnim.state === 'moving' ? Math.sin(time / 60) * 0.8 : 0.2;
        let wingColor = petAnim.typeId === 9 ? '#228B22' : (petAnim.typeId === 10 ? '#FFD700' : '#8B4513');
        ctx.fillStyle = wingColor;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';

        // Back Wing
        ctx.save(); ctx.rotate(-flap);
        ctx.beginPath(); ctx.ellipse(-22, 0, 20, 12, -Math.PI / 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();

        // Front Wing
        ctx.save(); ctx.rotate(flap);
        ctx.beginPath(); ctx.ellipse(22, 0, 20, 12, Math.PI / 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();

    } else if (petAnim.typeId === 5) {
        // Penguin: Only 2 legs
        let swing = petAnim.state === 'moving' ? Math.sin(time / 100) * 8 : 0;
        ctx.strokeStyle = '#FFA500'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-6, 15); ctx.lineTo(-6 - swing, 28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, 15); ctx.lineTo(6 + swing, 28); ctx.stroke();

    } else if (petAnim.typeId === 1) {
        // Dog: 4 real legs, brown body, wagging tail, small head
        let swing = petAnim.state === 'moving' ? Math.sin(time / 100) * 10 : 0;
        ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 6; ctx.lineCap = 'round';

        // 4 Legs
        ctx.beginPath(); ctx.moveTo(-15, 5); ctx.lineTo(-15 - swing, 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-5 + swing, 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(8 - swing, 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(18, 5); ctx.lineTo(18 + swing, 22); ctx.stroke();

        // Body
        ctx.fillStyle = '#8B4513';
        ctx.beginPath(); ctx.ellipse(2, 5, 22, 12, 0, 0, Math.PI * 2); ctx.fill();

        // Tail
        let wag = Math.sin(time / 50) * 5;
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-28, -8 + wag); ctx.lineWidth = 4; ctx.stroke();

    } else if (petAnim.typeId !== 3) {
        // Other Walkers: 4 thick legs
        let swing = petAnim.state === 'moving' ? Math.sin(time / 100) * 10 : 0;
        ctx.strokeStyle = '#222'; ctx.lineWidth = 7; ctx.lineCap = 'round';

        ctx.beginPath(); ctx.moveTo(-12, 15); ctx.lineTo(-12 - swing, 28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12, 15); ctx.lineTo(12 + swing, 28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, 15); ctx.lineTo(-2 + swing, 28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, 15); ctx.lineTo(16 - swing, 28); ctx.stroke();
    }

    // Body Bounce
    let bounce = (!isFlying && petAnim.state === 'moving') ? Math.abs(Math.sin(time / 100)) * 6 : (petAnim.state === 'idle' ? Math.sin(time / 200) * 2 : 0);
    ctx.translate(0, -bounce);

    // Glowing outline
    ctx.shadowColor = 'rgba(255, 255, 255, 1)';
    ctx.shadowBlur = 15;

    // Draw Head/Body based on type
    if (petAnim.typeId === 1) {
        // Small Head for the Dog
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(petAnim.icon, 22, -8);
    } else {
        // HUGE Head/Body for everything else
        ctx.font = '60px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(petAnim.icon, 0, 0);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
}

// ==========================================
// 3.5. VIDEO RECORDING SYSTEM (FIXED BUFFERING)
// ==========================================
let mediaRecorder; let recordedChunks = []; let recordedMatches = []; let isRecording = false;

window.startMatchRecording = function () {
    if (isRecording || !window.isSaveMatchHistoryEnabled) return;
    try {
        if (!canvas.captureStream) { console.warn("Video recording not supported in this browser."); return; }
        const stream = canvas.captureStream(30);

        let options = { mimeType: 'video/webm' };
        if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
            options = { mimeType: 'video/webm; codecs=vp8' };
        }

        mediaRecorder = new MediaRecorder(stream, options);
        recordedChunks = [];

        mediaRecorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = function () {
            setTimeout(() => {
                if (recordedChunks.length > 0) {
                    const blob = new Blob(recordedChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    recordedMatches.unshift({ id: Date.now(), name: `Match - ${gameMode} (${winnerName || 'Incomplete'})`, time: new Date().toLocaleTimeString(), url: url });
                    recordedChunks = [];
                }
            }, 150); // Buffer timeout to ensure data completely finishes pushing
        };

        // Start with no timeslice so it buffers perfectly as one file without crashing memory
        mediaRecorder.start();
        isRecording = true;
    } catch (e) {
        console.error("Recording error:", e);
        isRecording = false;
    }
};

window.stopMatchRecording = function (matchResultStr) {
    if (!isRecording || !mediaRecorder) return;
    winnerName = matchResultStr || winnerName;
    try {
        if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.requestData(); // Force push the final frames into the chunk array
            mediaRecorder.stop();
        }
    } catch (e) { console.log("Stop recording error", e); }
    isRecording = false;
};

window.playReplayVideo = function (url) {
    let modal = document.createElement('div'); modal.id = 'video-replay-modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); display: flex; justify-content: center; align-items: center; z-index: 9999; flex-direction: column;`;
    let html = `<div style="background: #111; padding: 15px; border-radius: 10px; border: 2px solid #00FFFF; box-shadow: 0 0 20px #00FFFF;"><h2 style="color: #FFF; margin-top: 0; text-align: center; font-family: sans-serif;">🎬 MATCH REPLAY</h2><video src="${url}" controls autoplay playsinline style="max-width: 90vw; max-height: 70vh; background: #000; border-radius: 5px;"></video><div style="text-align: center; margin-top: 15px;"><button onclick="document.getElementById('video-replay-modal').remove(); window.playSound('beep');" style="background: #FF0000; color: #FFF; border: none; padding: 10px 30px; font-size: 16px; font-weight: bold; border-radius: 5px; cursor: pointer;">CLOSE VIDEO</button><a href="${url}" download="CarromReplay.webm" style="background: #39FF14; color: #000; text-decoration: none; padding: 10px 30px; font-size: 16px; font-weight: bold; border-radius: 5px; cursor: pointer; margin-left: 10px; display: inline-block;">DOWNLOAD</a></div></div>`;
    modal.innerHTML = html; document.body.appendChild(modal); window.playSound('claim');
};

// ==========================================
// 4. TOURNAMENT & LOGIN SYSTEMS
// ==========================================
window.inTournament = false; window.tournamentRound = 0;
window.hasChampionBadge = localStorage.getItem('hasChampionBadge') === 'true';
let loginStreak = parseInt(localStorage.getItem('carrom_loginStreak')) || 0;
let lastLoginDate = localStorage.getItem('carrom_lastLoginDate') || "";
let dailyClaimedToday = false;
const dailyRewards = [50, 100, 150, 200, 300, 500, 1500];

window.checkDailyLogin = function () {
    let today = new Date().toDateString();
    if (lastLoginDate === today) { dailyClaimedToday = true; return; }
    let yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (lastLoginDate !== yesterday.toDateString() && lastLoginDate !== "") loginStreak = 0;
    showDailyLoginModal();
};

window.showDailyLoginModal = function () {
    let modal = document.createElement('div'); modal.id = 'daily-login-modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; z-index: 9999; flex-direction: column;`;
    let html = `<div style="background: #111; border: 3px solid #39FF14; border-radius: 10px; padding: 30px; text-align: center; max-width: 500px; box-shadow: 0 0 30px #39FF14;"><h1 style="color: #FFF; font-weight: 900; margin-bottom: 5px;">📅 DAILY LOGIN REWARD</h1><p style="color: #bbb; margin-bottom: 20px;">Come back every day for bigger rewards!</p><div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 25px;">`;
    for (let i = 0; i < 7; i++) {
        let isToday = (i === loginStreak); let isClaimed = (i < loginStreak);
        let boxBg = isToday ? '#39FF14' : (isClaimed ? '#444' : '#222'); let textColor = isToday ? '#000' : (isClaimed ? '#888' : '#FFF'); let border = isToday ? 'border: 2px solid #FFF;' : 'border: 1px solid #555;';
        html += `<div style="${border} background: ${boxBg}; color: ${textColor}; padding: 10px 5px; border-radius: 6px; width: 50px; font-weight: bold;"><div style="font-size: 10px; margin-bottom: 5px;">DAY ${i + 1}</div><div style="font-size: ${i === 6 ? '18px' : '14px'};">${i === 6 ? '🎁' : '$' + dailyRewards[i]}</div></div>`;
    }
    html += `</div><button onclick="claimDailyReward()" style="background: linear-gradient(45deg, #39FF14, #00FF00); color: #000; font-size: 20px; font-weight: 900; padding: 15px 40px; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 0 15px #39FF14;">CLAIM $${dailyRewards[loginStreak]}</button></div>`;
    modal.innerHTML = html; document.body.appendChild(modal); window.playSound('beep');
};

window.claimDailyReward = function () {
    playerMoney += dailyRewards[loginStreak]; localStorage.setItem('playerMoney', playerMoney); window.playSound('claim');
    loginStreak++; if (loginStreak >= 7) loginStreak = 0;
    localStorage.setItem('carrom_loginStreak', loginStreak); localStorage.setItem('carrom_lastLoginDate', new Date().toDateString());
    dailyClaimedToday = true; document.getElementById('daily-login-modal').remove(); updateTopBar();
};

window.startPinkSlip = async function () {
    if (equippedStrikerId === 0) { window.customAlert("You cannot wager the Rookie Striker! Equip a better Striker first.", "EQUIP ERROR"); return; }
    let item = shopItems.find(i => i.id === equippedStrikerId);
    if (!await window.customConfirm(`⚠️ PINK SLIP WAGER ⚠️\n\nYou are wagering your ${item.name}!\nIf you LOSE against the EXTREME Hustler Bot, you lose your striker permanently.\nIf you WIN, you earn $10,000!\n\nDo you accept the challenge?`, "ULTIMATE RISK")) return;
    window.isPinkSlip = true; gameMode = 'CLASSIC';
    const aiToggle = document.getElementById('ai-toggle'); const aiDiff = document.getElementById('ai-difficulty');
    if (aiToggle) aiToggle.checked = true; if (aiDiff) aiDiff.value = "extreme";
    window.currentBet = 0; initGame(); startCountdown();
};

window.startBossRush = async function () {
    if (!await window.customConfirm("👹 BOSS RUSH CAMPAIGN 👹\n\nPlay 3 matches in a row against cheating AI Bosses.\nBoss 1: The Giant (Huge Striker)\nBoss 2: The Sniper (Never Misses)\nBoss 3: The Illusionist (Invisible Moving Striker)\n\nWin to unlock the BOSS SLAYER title & avatar! Start?", "BOSS RUSH")) return;
    window.inBossRush = true; window.bossRushStage = 1; gameMode = 'CLASSIC';
    let aiToggle = document.getElementById('ai-toggle'); if (aiToggle) aiToggle.checked = true;
    window.currentBet = 0; initGame(); startCountdown();
};

window.handleBossRushEnd = async function (playerWon) {
    if (!window.inBossRush) return;
    if (playerWon) {
        window.updateQuest('defeat_boss', 1);
        window.bossRushStage++;
        if (window.bossRushStage > 3) {
            window.playSound('claim'); playerMoney += 10000; localStorage.setItem('playerMoney', playerMoney);
            let bAvatar = avatarItems.find(a => a.id === 6); let bTitle = titleItems.find(t => t.id === 6);
            if (bAvatar) bAvatar.owned = true; if (bTitle) bTitle.owned = true;
            localStorage.setItem('hasBossAvatar', 'true'); localStorage.setItem('hasBossTitle', 'true'); window.inBossRush = false;
            await window.customAlert("👹 YOU DEFEATED ALL BOSSES! 👹\nUnlocked: BOSS SLAYER Avatar & Title + $10,000!", "CONGRATULATIONS"); initGame();
        } else { await window.customAlert(`🔥 Boss ${window.bossRushStage - 1} Defeated! Prepare for Boss ${window.bossRushStage}...`, "BOSS DEFEATED"); initGame(); startCountdown(); }
    } else { window.inBossRush = false; await window.customAlert("💀 You were crushed by the Boss... Campaign Failed!", "GAME OVER"); initGame(); }
    updateTopBar(); renderSidebarShop();
};

// ==========================================
// 5. SHOP DATA & INVENTORIES
// ==========================================
const freePassRounds = {
    1: [{ req: 1, title: 'Tier 1', reward: '$20 Cash', type: 'money', amount: 20 }, { req: 2, title: 'Tier 2', reward: 'Wind Weaver', type: 'striker', id: 1 }, { req: 3, title: 'Tier 3', reward: '$45 Cash', type: 'money', amount: 45 }, { req: 4, title: 'Tier 4', reward: '$100 Cash', type: 'money', amount: 100 }, { req: 5, title: 'Tier 5', reward: 'Victory Fireworks', type: 'victory_effect' }],
    2: [{ req: 1, title: 'Tier 1', reward: 'Heart Emote ❤️', type: 'new_emote', emote: '❤️' }, { req: 2, title: 'Tier 2', reward: 'Simple Striker', type: 'striker', id: 12 }, { req: 3, title: 'Tier 3', reward: 'Carrom Coins', type: 'coin', id: 6 }, { req: 4, title: 'Tier 4', reward: '$50 Cash', type: 'money', amount: 50 }, { req: 5, title: 'Tier 5', reward: 'Female Voice FX', type: 'voice_female' }],
    3: [{ req: 1, title: 'Tier 1', reward: 'Party Emote 🥳', type: 'new_emote', emote: '🥳' }, { req: 2, title: 'Tier 2', reward: 'Simple Coins', type: 'coin', id: 7 }, { req: 3, title: 'Tier 3', reward: 'Pet Dog 🐶', type: 'pet', id: 1 }, { req: 4, title: 'Tier 4', reward: 'Free Board', type: 'board', id: 5 }, { req: 5, title: 'Tier 5', reward: 'Mega Fireworks', type: 'victory_effect_mega' }]
};

const premiumPassTiers = [{ req: 1, title: 'Tier 1', reward: '$1000 Cash', type: 'money', amount: 1000 }, { req: 2, title: 'Tier 2', reward: 'Legendary Striker', type: 'striker', id: 6 }, { req: 3, title: 'Tier 3', reward: 'Legendary Board', type: 'board', id: 4 }, { req: 4, title: 'Tier 4', reward: 'Epic Bass Sound', type: 'sound', id: 5 }, { req: 5, title: 'Tier 5', reward: 'Premium Emote 😎🔥👑', type: 'emote' }];

const shopItems = [
    { id: 0, name: 'Rookie Striker', price: 0, owned: true, power: 1.0, mass: 1.5, effect: 'none' },
    { id: 8, name: '👽 Alien Watch', price: 400, owned: localStorage.getItem('s_8') === 'true', power: 1.8, mass: 1.6, effect: 'alien' },
    { id: 9, name: '🔴 Monster Catch', price: 500, owned: localStorage.getItem('s_9') === 'true', power: 1.9, mass: 1.5, effect: 'monster' },
    { id: 10, name: '🕷️ Web Slinger', price: 600, owned: localStorage.getItem('s_10') === 'true', power: 2.1, mass: 1.4, effect: 'web' },
    { id: 11, name: '🛡️ Hero Shield', price: 700, owned: localStorage.getItem('s_11') === 'true', power: 2.3, mass: 1.7, effect: 'shield' },
    { id: 12, name: 'Simple Striker (Pass)', price: 9999, owned: localStorage.getItem('s_12') === 'true', power: 1.3, mass: 1.4, effect: 'none' },
    { id: 6, name: 'Legendary Striker', price: 9999, owned: localStorage.getItem('s_6') === 'true', power: 3.0, mass: 2.0, effect: 'quantum' },
    { id: 7, name: '🎰 Jackpot Striker', price: 88888, owned: localStorage.getItem('hasJackpotStriker') === 'true', power: 4.0, mass: 2.5, effect: 'void' }
];

const coinShopItems = [
    { id: 0, name: 'Default Coins', price: 0, owned: true, colorW: '#fff9e6', colorB: '#333' },
    { id: 5, name: '🤪 Cartoon Faces', price: 150, owned: localStorage.getItem('c_5') === 'true', colorW: '#FFD700', colorB: '#8A2BE2' },
    { id: 8, name: '🐻 Teddy Bears', price: 200, owned: localStorage.getItem('c_8') === 'true', colorW: '#D2691E', colorB: '#5C3317' },
    { id: 9, name: '🍬 Candy Pop', price: 250, owned: localStorage.getItem('c_9') === 'true', colorW: '#FF69B4', colorB: '#C71585' },
    { id: 10, name: '🌈 Rainbow Swirl', price: 300, owned: localStorage.getItem('c_10') === 'true', colorW: '#FFD700', colorB: '#4B0082' },
    { id: 11, name: '🎃 Spooky Toons', price: 350, owned: localStorage.getItem('c_11') === 'true', colorW: '#FF6600', colorB: '#2D0047' },
    { id: 6, name: 'Carrom Coins (Pass)', price: 9999, owned: localStorage.getItem('c_6') === 'true', colorW: '#F5DEB3', colorB: '#4B3621' },
    { id: 7, name: 'Simple Coins (Pass)', price: 9999, owned: localStorage.getItem('c_7') === 'true', colorW: '#FFFFFF', colorB: '#111111' }
];

const pocketEffects = [{ id: 0, name: 'Basic Sparks', price: 0, owned: true, colors: ['#FFD700', '#00FFFF', '#FF1493', '#39FF14'], count: 40 }, { id: 1, name: 'Blood Moon', price: 15, owned: localStorage.getItem('p_1') === 'true', colors: ['#FF0000', '#8B0000', '#FF4500', '#FFFFFF'], count: 50 }, { id: 2, name: 'Toxic Slime', price: 30, owned: localStorage.getItem('p_2') === 'true', colors: ['#39FF14', '#00FF00', '#ADFF2F', '#006400'], count: 50 }, { id: 3, name: 'Deep Space', price: 45, owned: localStorage.getItem('p_3') === 'true', colors: ['#8A2BE2', '#4B0082', '#0000FF', '#E0B0FF'], count: 60 }];

const boardShopItems = [{ id: 0, name: 'Classic Wood', price: 0, owned: true, boardColor: '#c19a6b', borderColor: '#4a2511' }, { id: 1, name: 'Mahogany Elegance', price: 40, owned: localStorage.getItem('b_1') === 'true', boardColor: '#8b5a2b', borderColor: '#3e1f0e' }, { id: 2, name: 'Midnight Slate', price: 80, owned: localStorage.getItem('b_2') === 'true', boardColor: '#4f6272', borderColor: '#1c2833' }, { id: 3, name: 'Neon Arcade', price: 120, owned: localStorage.getItem('b_3') === 'true', boardColor: '#1a0b2e', borderColor: '#ff007f' }, { id: 5, name: 'Free Board (Pass)', price: 9999, owned: localStorage.getItem('b_5') === 'true', boardColor: '#2b3b2c', borderColor: '#112211' }, { id: 4, name: 'Legendary Board', price: 9999, owned: localStorage.getItem('b_4') === 'true', boardColor: '#1a1a1a', borderColor: '#FFD700' }];

const soundShopItems = [{ id: 0, name: 'Default Pop', price: 0, owned: true }, { id: 1, name: 'Crystal Pluck', price: 6, owned: localStorage.getItem('so_1') === 'true' }, { id: 2, name: 'Arcade Blip', price: 10, owned: localStorage.getItem('so_2') === 'true' }, { id: 3, name: 'Laser Pew', price: 17, owned: localStorage.getItem('so_3') === 'true' }, { id: 4, name: 'Magic Chime', price: 19, owned: localStorage.getItem('so_4') === 'true' }, { id: 5, name: 'Epic Bass (Pass)', price: 9999, owned: localStorage.getItem('so_5') === 'true' }];

const avatarItems = [{ id: 0, icon: '👤', name: 'Default', price: 0, owned: true }, { id: 1, icon: '🥷', name: 'Ninja', price: 200, owned: localStorage.getItem('a_1') === 'true' }, { id: 2, icon: '🤖', name: 'Robot', price: 300, owned: localStorage.getItem('a_2') === 'true' }, { id: 3, icon: '👽', name: 'Alien', price: 400, owned: localStorage.getItem('a_3') === 'true' }, { id: 4, icon: '🐯', name: 'Tiger', price: 500, owned: localStorage.getItem('a_4') === 'true' }, { id: 5, icon: '👑', name: 'King', price: 1000, owned: localStorage.getItem('a_5') === 'true' }, { id: 6, icon: '👹', name: 'Boss Slayer', price: 99999, owned: localStorage.getItem('hasBossAvatar') === 'true' }];

const titleItems = [{ id: 0, text: 'Rookie', price: 0, owned: true }, { id: 1, text: 'The Sniper', price: 150, owned: localStorage.getItem('t_1') === 'true' }, { id: 2, text: 'Hustler', price: 250, owned: localStorage.getItem('t_2') === 'true' }, { id: 3, text: 'Pro Striker', price: 400, owned: localStorage.getItem('t_3') === 'true' }, { id: 4, text: 'Carrom Legend', price: 800, owned: localStorage.getItem('t_4') === 'true' }, { id: 5, text: 'Grandmaster', price: 1500, owned: localStorage.getItem('t_5') === 'true' }, { id: 6, text: 'BOSS SLAYER', price: 99999, owned: localStorage.getItem('hasBossTitle') === 'true' }];

const petShopItems = [
    { id: 0, name: 'No Pet', price: 0, owned: true, level: 0, desc: 'Play solo.' },
    { id: 1, name: '🐶 Dog', price: 250, owned: localStorage.getItem('pet_1') === 'true', level: 1, desc: 'Gives ideas (Highlights best coin)' },
    { id: 2, name: '🐱 Cat', price: 500, owned: localStorage.getItem('pet_2') === 'true', level: 2, desc: 'Gives idea + Laser aim line' },
    { id: 3, name: '🐍 Snake', price: 750, owned: localStorage.getItem('pet_3') === 'true', level: 3, desc: 'Laser line + Appreciates you!' },
    { id: 4, name: '🐄 Cow', price: 1000, owned: localStorage.getItem('pet_4') === 'true', level: 4, desc: 'Can take shots FOR you!' },
    { id: 5, name: '🐧 Penguin', price: 1250, owned: localStorage.getItem('pet_5') === 'true', level: 4, desc: 'Can take shots FOR you!' },
    { id: 6, name: '🐻 Bear', price: 1500, owned: localStorage.getItem('pet_6') === 'true', level: 4, desc: 'Can take shots FOR you!' },
    { id: 7, name: '🦌 Deer', price: 1500, owned: localStorage.getItem('pet_7') === 'true', level: 4, desc: 'Can take shots FOR you!' },
    { id: 8, name: '🦅 Eagle', price: 1800, owned: localStorage.getItem('pet_8') === 'true', level: 5, desc: 'Auto-play + NO FOULS!' },
    { id: 9, name: '🐉 Dragon', price: 2500, owned: localStorage.getItem('pet_9') === 'true', level: 5, desc: 'Auto-play + NO FOULS!' },
    { id: 10, name: '🦄 Unicorn', price: 5000, owned: localStorage.getItem('pet_10') === 'true', level: 5, desc: 'Auto-play + NO FOULS!' }
];

// ==========================================
// 6.5. LUCKY SPIN WHEEL SYSTEM 
// ==========================================
let wheelRotation = 0;
window.openLuckySpin = function () {
    let today = new Date().toDateString(); let isFree = localStorage.getItem('lastSpinDate') !== today;
    let modal = document.createElement('div'); modal.id = 'lucky-spin-modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); display: flex; justify-content: center; align-items: center; z-index: 9999; flex-direction: column;`;
    let prizes = [{ name: "BETTER LUCK NEXT TIME", val: 0, color: "#111" }, { name: "$50", val: 50, color: "#39FF14" }, { name: "BETTER LUCK NEXT TIME", val: 0, color: "#222" }, { name: "$100", val: 100, color: "#00FFFF" }, { name: "BETTER LUCK NEXT TIME", val: 0, color: "#111" }, { name: "$1000", val: 1000, color: "#FFD700" }, { name: "BETTER LUCK NEXT TIME", val: 0, color: "#222" }, { name: "BETTER LUCK NEXT TIME", val: 0, color: "#333" }];
    let c = document.createElement('canvas'); c.width = 400; c.height = 400; let cx = c.getContext('2d'); let step = (Math.PI * 2) / 8;
    for (let i = 0; i < 8; i++) { cx.beginPath(); cx.moveTo(200, 200); cx.arc(200, 200, 200, i * step, (i + 1) * step); cx.fillStyle = prizes[i].color; cx.fill(); cx.lineWidth = 4; cx.strokeStyle = "#555"; cx.stroke(); cx.save(); cx.translate(200, 200); cx.rotate(i * step + step / 2); cx.textAlign = "right"; if (prizes[i].val === 0) { cx.fillStyle = "#FFF"; cx.font = "bold 11px sans-serif"; cx.fillText(prizes[i].name, 185, 4); } else { cx.fillStyle = "#000"; cx.font = "bold 24px sans-serif"; cx.fillText(prizes[i].name, 185, 8); } cx.restore(); }
    let wheelData = c.toDataURL();
    let html = `<div style="position: relative; text-align: center;"><h1 style="color: #FFD700; text-shadow: 0 0 20px #FFD700; margin-bottom: 30px; font-weight: 900; letter-spacing: 3px; font-size: 40px;">LUCKY SPIN</h1><div style="position: absolute; top: 100px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 20px solid transparent; border-right: 20px solid transparent; border-top: 35px solid #FFF; z-index: 10; filter: drop-shadow(0 4px 5px rgba(0,0,0,0.8));"></div><img id="spin-wheel" src="${wheelData}" style="width: 380px; height: 380px; border-radius: 50%; border: 8px solid #FFF; box-shadow: 0 0 40px rgba(255,255,255,0.4); transition: transform 4s cubic-bezier(0.1, 0.7, 0.1, 1); transform: rotate(${wheelRotation}deg);"><div style="margin-top: 40px; display: flex; gap: 15px; justify-content: center;"><button id="do-spin-btn" style="background: ${isFree ? '#39FF14' : '#FFD700'}; color: #000; font-size: 20px; font-weight: 900; padding: 15px 40px; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 0 20px ${isFree ? '#39FF14' : '#FFD700'};">${isFree ? 'SPIN FOR FREE' : 'SPIN ($50)'}</button><button onclick="document.getElementById('lucky-spin-modal').remove(); window.playSound('beep');" style="background: #FF3333; color: #FFF; font-size: 16px; font-weight: bold; padding: 15px 30px; border: none; border-radius: 8px; cursor: pointer;">CLOSE</button></div></div>`;
    modal.innerHTML = html; document.body.appendChild(modal);
    let isSpinningLocal = false;
    document.getElementById('do-spin-btn').onclick = async function () {
        if (isSpinningLocal) return; let nowToday = new Date().toDateString(); let isCurrentlyFree = localStorage.getItem('lastSpinDate') !== nowToday;
        if (!isCurrentlyFree && playerMoney < 50) { await window.customAlert("NOT ENOUGH CASH TO SPIN!", "SPIN ERROR"); window.playSound('foul'); return; }
        if (isCurrentlyFree) { localStorage.setItem('lastSpinDate', nowToday); } else { playerMoney -= 50; localStorage.setItem('playerMoney', playerMoney); updateTopBar(); }
        isSpinningLocal = true; window.playSound('beep'); this.style.opacity = 0.5;
        let rand = Math.random(); let targetIndex; if (rand < 0.05) targetIndex = 5; else if (rand < 0.20) targetIndex = 3; else if (rand < 0.45) targetIndex = 1; else { let badLuckSlots = [0, 2, 4, 6, 7]; targetIndex = badLuckSlots[Math.floor(Math.random() * badLuckSlots.length)]; }
        let sliceCenter = (targetIndex * 45) + 22.5; let currentMod = wheelRotation % 360; let neededMod = (270 - sliceCenter) % 360; if (neededMod < 0) neededMod += 360;
        let spinAmount = (360 * 5) + (neededMod - currentMod) + (Math.random() * 30 - 15); if (spinAmount < 360 * 5) spinAmount += 360; wheelRotation += spinAmount;
        document.getElementById('spin-wheel').style.transform = `rotate(${wheelRotation}deg)`;
        let tickInt = setInterval(() => window.playSound('hit'), 150); setTimeout(() => clearInterval(tickInt), 3500);
        setTimeout(async () => {
            isSpinningLocal = false; let prize = prizes[targetIndex];
            if (prize.val > 0) { playerMoney += prize.val; localStorage.setItem('playerMoney', playerMoney); await window.customAlert(`🎉 You won $${prize.val}!`, "BIG WIN"); window.playSound('claim'); createCrackers(SIZE / 2, SIZE / 2, prize.color, true); } else { await window.customAlert("BETTER LUCK NEXT TIME!", "LUCKY SPIN"); window.playSound('foul'); }
            updateTopBar(); renderSidebarShop();
            let newBtnFree = localStorage.getItem('lastSpinDate') !== new Date().toDateString(); let btn = document.getElementById('do-spin-btn');
            if (btn) { btn.style.background = newBtnFree ? '#39FF14' : '#FFD700'; btn.innerText = newBtnFree ? 'SPIN FOR FREE' : 'SPIN ($50)'; btn.style.boxShadow = `0 0 15px ${newBtnFree ? '#39FF14' : '#FFD700'}`; btn.style.opacity = 1; }
        }, 4000);
    };
};

window.enterTournament = async function () {
    if (playerMoney < 500) { await window.customAlert("INVALID AMOUNT", "TOURNAMENT"); return; }
    if (!(await window.customConfirm("Pay $500 to enter the 8-Player Bracket Tournament?", "ENTER TOURNAMENT"))) return;
    playerMoney -= 500; localStorage.setItem('playerMoney', playerMoney); window.inTournament = true; window.tournamentRound = 0; updateTopBar(); window.playSound('claim');
    await window.customAlert("🏆 TOURNAMENT ENTERED! Match 1: Quarter-Final vs Bot (Easy)", "TOURNAMENT START"); gameMode = 'CLASSIC'; const aiToggle = document.getElementById('ai-toggle'); const aiDiff = document.getElementById('ai-difficulty'); if (aiToggle) aiToggle.checked = true; if (aiDiff) aiDiff.value = "easy";
    initGame(); startCountdown();
};

window.handleTournamentMatchEnd = async function (playerWon) {
    if (!window.inTournament) return;
    if (playerWon) {
        window.tournamentRound++;
        let diffMap = ['easy', 'medium', 'hard'];
        let roundNames = ['Quarter-Final', 'Semi-Final', 'FINAL'];
        if (window.tournamentRound >= 3) {
            window.inTournament = false; window.tournamentRound = 0;
            playerMoney += 5000; localStorage.setItem('playerMoney', playerMoney);
            window.hasChampionBadge = true; localStorage.setItem('hasChampionBadge', 'true');
            window.playSound('claim');
            await window.customAlert("🏆 TOURNAMENT CHAMPION! 🏆\nYou won $5,000 and the Champion Badge!", "VICTORY");
            initGame();
        } else {
            let diff = diffMap[window.tournamentRound] || 'hard';
            await window.customAlert(`🏆 You won! Next: ${roundNames[window.tournamentRound]} vs Bot (${diff.charAt(0).toUpperCase() + diff.slice(1)})`, "MATCH CLEAR");
            const aiDiff = document.getElementById('ai-difficulty');
            if (aiDiff) aiDiff.value = diff;
            initGame(); startCountdown();
        }
    } else {
        window.inTournament = false; window.tournamentRound = 0;
        await window.customAlert("💀 Tournament Over! You were eliminated.", "ELIMINATED");
        initGame();
    }
    updateTopBar(); renderSidebarShop();
};

// ==========================================
// 7. SHOP, PASS RESET & UI LOGIC
// ==========================================
function updateTopBar() {
    let walletMain = document.getElementById('wallet-display');
    if (walletMain) walletMain.innerText = `Wallet: $${playerMoney}`;

    let profileCard = document.getElementById('player-profile-card');
    if (profileCard) {
        let tWins = window.totalWins || 0;
        let totalMatches = (window.totalWins || 0) + (window.totalLosses || 0);
        let winRate = totalMatches > 0 ? Math.round((tWins / totalMatches) * 100) : 0;
        let champHtml = window.hasChampionBadge ? `<div style="text-align: center; margin-top: 5px; padding: 5px; background: rgba(255,215,0,0.1); border: 2px solid #FFD700; border-radius: 6px; color: #FFD700; font-weight: 900; font-size: 12px; text-shadow: 0 0 5px #FFD700;">🏆 CHAMPION 🏆</div>` : '';
        let activeAvatar = avatarItems.find(a => a.id === equippedAvatarId) || avatarItems[0];
        let activeTitle = titleItems.find(t => t.id === equippedTitleId) || titleItems[0];
        let safeName = playerName ? String(playerName).toUpperCase() : "GUEST PLAYER";

        let currAvatar = localStorage.getItem('playerAvatar');
        let avatarDisplay = currAvatar ? `<img src="${currAvatar}" style="width:32px; height:32px; border-radius:50%; margin-right:8px; object-fit:cover; border:1.5px solid #00FFFF; box-shadow:0 0 8px rgba(0,255,255,0.3);">` : `<div style="font-size: 28px; margin-right:8px;">${activeAvatar.icon}</div>`;

        profileCard.innerHTML = `
            <div style="background: #111; border: 1px solid #333; border-radius: 6px; padding: 10px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transition: 0.2s;">
                <div onclick="showPlayerDetails()" style="display:flex; align-items:center; cursor: pointer; margin-bottom: 10px;" onmouseover="this.style.transform='scale(1.02)';" onmouseout="this.style.transform='scale(1)';">
                    ${avatarDisplay}
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-weight:900; color:#FFD700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeName}</div>
                        <div style="color:#00FFFF; font-size:9px; font-weight:bold; background:#222; display:inline-block; padding:2px 4px; border-radius:3px; border:1px solid #00FFFF; margin-top:3px;">${activeTitle.text}</div>
                    </div>
                    <div style="text-align:right; font-size:10px; color:#bbb; min-width:45px;">
                        Wins: <span style="color:#39FF14">${tWins}</span><br>
                        WR: <span style="color:#00FFFF">${winRate}%</span>
                    </div>
                </div>
                ${champHtml}
                <button onclick="location.reload()" style="width: 100%; background: rgba(255,51,51,0.05); border: 1px solid #FF3333; color: #FF3333; border-radius: 4px; padding: 5px 10px; font-size: 10px; cursor: pointer; font-weight: bold; transition: 0.2s; margin-top: 5px;" onmouseover="this.style.background='#FF3333'; this.style.color='#000';" onmouseout="this.style.background='rgba(255,51,51,0.05)'; this.style.color='#FF3333';">EXIT</button>
            </div>`;
    }
}

window.showRoomQrCodeMP = function () {
    let joinUrl = `${window.location.origin}${window.location.pathname}?join=${window.mpRoomId}`;
    if (window.mpPassword) joinUrl += `&pass=${window.mpPassword}`;

    let modal = document.createElement('div');
    modal.id = 'qr-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:20000;backdrop-filter:blur(10px);`;

    let html = `<div style="background:#1a1a1a; padding:30px; border-radius:15px; text-align:center; border: 1px solid #333; box-shadow: 0 0 50px rgba(0,0,0,0.5);">`;
    html += `<h2 style="color:#FFF; margin-bottom:10px; font-weight:950; letter-spacing:2px; font-size:18px;">ROOM PASS: ${window.mpRoomId}</h2>`;
    html += `<div id="mp-qrcode-canvas" style="background:#FFF; padding:15px; border-radius:10px; margin:20px 0; display:inline-block;"></div>`;
    html += `<p style="color:#888; font-size:11px; margin-bottom:20px; text-transform:uppercase;">Scan this to join the room instantly.</p>`;
    html += `<button onclick="document.getElementById('qr-modal').remove()" style="width: 100%; padding:12px; background:#FF3333; color:#FFF; border:none; border-radius:8px; cursor:pointer; font-weight:950; font-size:12px; letter-spacing:1px;">CLOSE</button>`;
    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    new QRCode(document.getElementById("mp-qrcode-canvas"), {
        text: joinUrl,
        width: 180,
        height: 180,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
};

window.startQrScannerMP = function () {
    if (document.getElementById('qr-scanner-modal')) return;

    let modal = document.createElement('div');
    modal.id = 'qr-scanner-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:21000;backdrop-filter:blur(10px);`;

    let html = `<div style="width: 90%; max-width: 400px; text-align: center;">`;
    html += `<h2 style="color:#FFF; margin-bottom:20px; font-weight:950; letter-spacing:3px; font-size:16px; text-transform:uppercase;">SCAN JOIN CODE</h2>`;
    html += `<div id="qr-reader" style="width: 100%; border-radius: 12px; overflow: hidden; border: 2px solid #333; aspect-ratio: 1/1; background: #000;"></div>`;
    html += `<p style="color:#666; font-size:10px; margin-top:20px; text-transform:uppercase; letter-spacing:1px;">Point your camera at the host's QR code.</p>`;
    html += `<button id="stop-qr-scanner" style="margin-top:25px; width: 100%; padding:15px; background:#000; color:#FFF; border:1px solid #FF3333; border-radius:8px; cursor:pointer; font-weight:950; font-size:12px; letter-spacing:2px; text-transform:uppercase;">CANCEL</button>`;
    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    const html5QrCode = new Html5Qrcode("qr-reader");
    const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

    const stopScanner = async () => {
        try { if (html5QrCode.isScanning) await html5QrCode.stop(); } catch (e) { }
        if (document.getElementById('qr-scanner-modal')) document.getElementById('qr-scanner-modal').remove();
    };

    document.getElementById('stop-qr-scanner').onclick = stopScanner;

    // Use environment mode (back camera) - we try 'exact' first for mobile, fallback to general 'environment'
    html5QrCode.start({ facingMode: "environment" }, qrConfig, (decodedText) => {
        // Handle successful scan
        try {
            const url = new URL(decodedText);
            const params = new URLSearchParams(url.search);
            const roomId = params.get('join');
            const password = params.get('pass') || "";

            if (roomId && roomId.length === 6) {
                stopScanner();
                // Pass the password found in QR to automatic joining
                window.joinRoomMP(roomId, password);
            } else {
                window.customAlert("This QR code does not contain a valid Room link.", "INVALID QR");
            }
        } catch (e) {
            window.customAlert("Unable to recognize this QR format. Please scan a valid Room QR.", "SCAN ERROR");
        }
    }).catch(err => {
        console.error("Camera access failed:", err);
        window.customAlert("To scan QR codes, you must allow 'CAMERA PERMISSION' in your browser settings. \n\nPlease refresh and try again.", "CAMERA PERMISSION REQUIRED");
        stopScanner();
    });
};

window.showSettings = function () {
    window.playSound('beep');
    let modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10020;backdrop-filter:blur(10px);`;

    let html = `<div style="background:#0a0a0a; border:1px solid #222; border-radius:12px; padding:35px; width:340px; box-shadow:0 0 50px rgba(0,0,0,0.5); color:#fff; text-align:center; animation:modalEntrance 0.3s ease-out; position:relative;">`;
    html += `<button onclick="document.getElementById('settings-modal').remove(); window.playSound('foul');" style="position:absolute; top:15px; right:15px; background:none; border:none; color:#444; font-size:24px; cursor:pointer;" onmouseover="this.style.color='#FFF';" onmouseout="this.style.color='#444';">&times;</button>`;

    html += `<div style="font-size: 40px; margin-bottom: 15px; animation: ringRotate 5s linear infinite; display: inline-block;">⚙️</div>`;
    html += `<h2 style="color:#FFF; margin:0 0 10px; font-size:20px; font-weight:900; letter-spacing:3px; text-transform:uppercase;">GAME SETTINGS</h2>`;
    html += `<div style="height: 1px; background: linear-gradient(90deg, transparent, #333, transparent); margin-bottom: 25px;"></div>`;

    // Music Toggle (Duplicate of sidebar for convenience)
    let isMusicOn = window.isMusicEnabled;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #1a1a1a;">
                <span style="font-size:12px; font-weight:900; letter-spacing:1px; color:#888;">MUSIC</span>
                <button onclick="window.toggleBackgroundMusicFromSettings(this)" style="background:${isMusicOn ? '#39FF14' : '#333'}; color:${isMusicOn ? '#000' : '#888'}; border:none; padding:6px 15px; border-radius:4px; font-weight:900; font-size:10px; cursor:pointer;">${isMusicOn ? 'ON' : 'OFF'}</button>
            </div>`;

    // Master Volume Slider
    html += `<div style="background:#111; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #1a1a1a; text-align:left;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span style="font-size:12px; font-weight:900; letter-spacing:1px; color:#888;">MASTER VOLUME</span>
                    <span id="settings-vol-value" style="color:#00FFFF; font-size:12px; font-weight:900;">${window.masterVolume}%</span>
                </div>
                <input type="range" min="0" max="100" value="${window.masterVolume}" 
                    oninput="window.setMasterVolume(this.value); if(document.getElementById('settings-vol-value')) document.getElementById('settings-vol-value').innerText = this.value + '%';" 
                    style="width:100%; cursor:pointer; accent-color:#00FFFF;">
            </div>`;

    // SFX Toggle
    let isSfxOn = window.isSfxEnabled;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #1a1a1a;">
                <span style="font-size:12px; font-weight:900; letter-spacing:1px; color:#888;">SOUND FX</span>
                <button onclick="window.toggleSfxFromSettings(this)" style="background:${isSfxOn ? '#39FF14' : '#333'}; color:${isSfxOn ? '#000' : '#888'}; border:none; padding:6px 15px; border-radius:4px; font-weight:900; font-size:10px; cursor:pointer;">${isSfxOn ? 'ON' : 'OFF'}</button>
            </div>`;

    // Visuals Toggle
    let pLevel = window.particleLevel;
    let pBtnColor = pLevel === 'MAX' ? '#39FF14' : (pLevel === 'LOW' ? '#FFD700' : '#333');
    let pTextColor = pLevel === 'OFF' ? '#888' : '#000';
    html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #1a1a1a;">
                <span style="font-size:12px; font-weight:900; letter-spacing:1px; color:#888;">PARTICLES</span>
                <button onclick="window.toggleParticlesFromSettings(this)" style="background:${pBtnColor}; color:${pTextColor}; border:none; padding:6px 15px; border-radius:4px; font-weight:900; font-size:10px; cursor:pointer;">${pLevel}</button>
            </div>`;

    // FPS Limiter Dropdown
    let fpsOptions = ['30', '60', '120', '144', '240', 'Unlimited'];
    html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:15px; border-radius:8px; margin-bottom:12px; border:1px solid #1a1a1a;">
                <span style="font-size:12px; font-weight:900; letter-spacing:1px; color:#888;">FPS LIMITER</span>
                <select onchange="window.setFpsLimit(this.value)" style="background:#111; color:#00FFFF; border:1px solid #00FFFF; border-radius:4px; padding:6px 10px; font-weight:900; font-size:10px; cursor:pointer; outline:none;">
                    ${fpsOptions.map(opt => `<option value="${opt}" ${window.maxFps === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </div>`;

    // Save Match History Toggle
    let isHistoryOn = window.isSaveMatchHistoryEnabled;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:15px; border-radius:8px; margin-bottom:25px; border:1px solid #1a1a1a;">
                <span style="font-size:12px; font-weight:900; letter-spacing:1px; color:#888;">SAVE MATCH HISTORY</span>
                <button onclick="window.toggleSaveMatchHistory(this)" style="background:${isHistoryOn ? '#39FF14' : '#333'}; color:${isHistoryOn ? '#000' : '#888'}; border:none; padding:6px 15px; border-radius:4px; font-weight:900; font-size:10px; cursor:pointer;">${isHistoryOn ? 'ON' : 'OFF'}</button>
            </div>`;

    html += `<button onclick="document.getElementById('settings-modal').remove(); window.playSound('beep');" style="width:100%; padding:15px; background:transparent; color:#00FFFF; border:1px solid #00FFFF; border-radius:6px; font-weight:900; font-size:12px; letter-spacing:2px; cursor:pointer; text-transform:uppercase; transition:0.3s;" onmouseover="this.style.background='#00FFFF'; this.style.color='#000';" onmouseout="this.style.background='transparent'; this.style.color='#00FFFF';">CLOSE SETTINGS</button>`;

    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.toggleBackgroundMusicFromSettings = function (btn) {
    window.toggleBackgroundMusic();
    let isOn = window.isMusicEnabled;
    btn.innerText = isOn ? 'ON' : 'OFF';
    btn.style.background = isOn ? '#39FF14' : '#333';
    btn.style.color = isOn ? '#000' : '#888';
    window.playSound('beep');
};

window.toggleSaveMatchHistory = function (btn) {
    window.isSaveMatchHistoryEnabled = !window.isSaveMatchHistoryEnabled;
    localStorage.setItem('carrom_save_match_history', window.isSaveMatchHistoryEnabled ? 'true' : 'false');
    let isOn = window.isSaveMatchHistoryEnabled;
    btn.innerText = isOn ? 'ON' : 'OFF';
    btn.style.background = isOn ? '#39FF14' : '#333';
    btn.style.color = isOn ? '#000' : '#888';
    window.playSound('beep');
};

window.toggleSfxFromSettings = function (btn) {
    window.isSfxEnabled = !window.isSfxEnabled;
    localStorage.setItem('carrom_sfx_enabled', window.isSfxEnabled ? 'true' : 'false');
    let isOn = window.isSfxEnabled;
    btn.innerText = isOn ? 'ON' : 'OFF';
    btn.style.background = isOn ? '#39FF14' : '#333';
    btn.style.color = isOn ? '#000' : '#888';
    window.playSound('beep');
};

window.toggleParticlesFromSettings = function (btn) {
    const levels = ['MAX', 'LOW', 'OFF'];
    let idx = levels.indexOf(window.particleLevel);
    window.particleLevel = levels[(idx + 1) % levels.length];
    localStorage.setItem('carrom_particle_level', window.particleLevel);

    let pLevel = window.particleLevel;
    btn.innerText = pLevel;
    btn.style.background = pLevel === 'MAX' ? '#39FF14' : (pLevel === 'LOW' ? '#FFD700' : '#333');
    btn.style.color = pLevel === 'OFF' ? '#888' : '#000';
    window.playSound('beep');
};

window.showPlayerDetails = function () {
    window.playSound('beep');
    let tWins = window.totalWins || 0;
    let tLoss = window.totalLosses || 0;
    let totalMatches = tWins + tLoss;
    let winRate = totalMatches > 0 ? Math.round((tWins / totalMatches) * 100) : 0;
    let pCoins = window.totalCoinsPocketed || 0;
    let qCaps = window.queenCaptures || 0;
    let safeName = playerName ? String(playerName).toUpperCase() : "GUEST PLAYER";
    let activeAvatar = avatarItems.find(a => a.id === equippedAvatarId) || avatarItems[0];
    let activeTitle = titleItems.find(t => t.id === equippedTitleId) || titleItems[0];

    // Auto-migrate or find player ID
    let users = JSON.parse(localStorage.getItem('carrom_registered_users') || "[]");
    let foundUser = users.find(u => u.name.toLowerCase() === (playerName || "").toLowerCase());
    if (foundUser && !foundUser.id) {
        foundUser.id = '#' + Math.floor(10000 + Math.random() * 90000);
        foundUser.freeEditUsed = false;
        localStorage.setItem('carrom_registered_users', JSON.stringify(users));
    }
    let pId = foundUser ? foundUser.id : '#00000';

    let modal = document.createElement('div');
    modal.id = 'player-details-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;justify-content:center;align-items:center;z-index:10005;`;

    let html = `<div style="background:#111;border:2px solid #00FFFF;border-radius:14px;padding:30px;width:350px;box-shadow:0 0 30px rgba(0,255,255,0.2);color:#fff;font-family:sans-serif;animation:badgeSlideUp 0.3s ease-out;position:relative; max-height: 90vh; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;">`;

    // Close button
    html += `<button onclick="document.getElementById('player-details-modal').remove(); window.playSound('beep');" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>`;

    // Header
    html += `<div style="text-align:center;margin-bottom:20px;">`;
    let currPhoto = localStorage.getItem('playerAvatar');
    let photoDisplay = currPhoto ? `<img src="${currPhoto}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid #00FFFF; box-shadow:0 0 20px rgba(0,255,255,0.4); cursor:pointer;" onclick="window.triggerPhotoUpload()">` : `<div style="font-size:60px;line-height:1;margin-bottom:10px; cursor:pointer;" onclick="window.triggerPhotoUpload()">${activeAvatar.icon}</div>`;
    html += `<div style="position:relative; display:inline-block;">${photoDisplay}
        <div onclick="window.triggerPhotoUpload()" style="position:absolute; bottom:0; right:0; background:#00FFFF; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:2px solid #111; font-size:14px; box-shadow:0 0 10px #00FFFF;" title="Upload Photo">📷</div>
    </div>`;

    if (currPhoto) {
        html += `<div style="margin-top:10px;"><button onclick="window.removePhoto()" style="background:transparent; border:none; color:#FF3333; font-size:10px; font-weight:bold; cursor:pointer; text-decoration:underline;">REMOVE PHOTO</button></div>`;
    }

    html += `<input type="file" id="profile-photo-input" style="display:none;" accept="image/*" onchange="window.handlePhotoUpload(this)">`;
    html += `<h2 style="color:#FFD700;margin:10px 0 5px 0;font-size:24px;font-weight:900;letter-spacing:1px;">${safeName}</h2>`;
    html += `<div style="color:#888;font-size:12px;font-weight:bold;margin-bottom:8px;">ID: <span style="color:#FFF;">${pId}</span></div>`;
    html += `<div style="display:inline-block;background:#222;color:#00FFFF;border:1px solid #00FFFF;border-radius:4px;padding:3px 8px;font-size:12px;font-weight:bold;">${activeTitle.text}</div>`;
    if (window.hasChampionBadge) {
        html += `<div style="margin-top:8px;color:#FFD700;font-size:12px;font-weight:bold;">🏆 TOURNAMENT CHAMPION 🏆</div>`;
    }
    html += `</div>`;

    // Stats grid
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">`;

    function makeStatBox(label, value, color) {
        return `<div style="background:#222;border:1px solid #333;border-radius:8px;padding:12px 10px;text-align:center;">
            <div style="color:#888;font-size:11px;font-weight:bold;text-transform:uppercase;margin-bottom:5px;">${label}</div>
            <div style="color:${color};font-size:18px;font-weight:900;">${value}</div>
        </div>`;
    }

    html += makeStatBox('Matches', totalMatches, '#FFF');
    html += makeStatBox('Win Rate', winRate + '%', '#00FFFF');
    html += makeStatBox('Wins', tWins, '#39FF14');
    html += makeStatBox('Losses', tLoss, '#FF3333');
    html += makeStatBox('Coins Pocketed', pCoins, '#FFD700');
    html += makeStatBox('Queen Captures', qCaps, '#FF1493');

    html += `</div>`;

    let isInRoom = (window.mpRoomId && currentShopView === 'multiplayer');

    // Setting Bar - Integrated inside Profile Modal (Hidden in multiplayer room matches)
    if (!isInRoom) {
        let isMusicOn = window.isMusicEnabled;
        html += `<div style="background:#0a0a0a; border:1px solid #222; border-radius:12px; padding:15px; margin-bottom:20px; display:flex; flex-direction:column; gap:12px; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
            <div style="color:#444; font-size:10px; font-weight:950; letter-spacing:2px; text-transform:uppercase; text-align:left; border-bottom:1px solid #1a1a1a; padding-bottom:5px; margin-bottom:2px;">Settings Hub</div>
            
            <!-- Row: Background Music -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:16px;">🎵</span>
                    <span style="color:#FFF; font-size:11px; font-weight:900; letter-spacing:0.5px;">BACKGROUND MUSIC</span>
                </div>
                <button onclick="window.toggleBackgroundMusicFromPlayerModal(this)" style="background:${isMusicOn ? 'linear-gradient(45deg,#39FF14,#228B22)' : '#333'}; color:${isMusicOn ? '#000' : '#888'}; border:none; padding:8px 16px; border-radius:6px; font-weight:950; font-size:10px; cursor:pointer; transition:0.3s; min-width:85px;">${isMusicOn ? 'ENABLED' : 'DISABLED'}</button>
            </div>

            <!-- Row: Advanced Settings -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:16px;">🎮</span>
                    <span style="color:#FFF; font-size:11px; font-weight:900; letter-spacing:0.5px;">ADVANCED CONFIG</span>
                </div>
                <button onclick="window.showSettings(); document.getElementById('player-details-modal').remove();" style="background:#222; color:#00FFFF; border:1px solid #00FFFF; padding:8px 16px; border-radius:6px; font-weight:950; font-size:10px; cursor:pointer; transition:0.3s;" onmouseover="this.style.background='#00FFFF'; this.style.color='#000';" onmouseout="this.style.background='#222'; this.style.color='#00FFFF';">OPEN</button>
            </div>
        </div>`;
    }

    // Wallet
    html += `<div style="background:linear-gradient(45deg,#003300,#004400);border:1px solid #39FF14;border-radius:8px;padding:12px;text-align:center;margin-bottom:20px;">
        <div style="color:#ADFF2F;font-size:12px;font-weight:bold;margin-bottom:5px;">TOTAL WEALTH</div>
        <div style="color:#39FF14;font-size:24px;font-weight:900;">$${playerMoney}</div>
    </div>`;

    // Edit Profile & Delete Account Buttons (Hidden in multiplayer room matches)
    if (!isInRoom) {
        let freeCostText = (foundUser && !foundUser.freeEditUsed) ? "FREE" : "$70";
        html += `<div style="display:flex;justify-content:space-between;gap:10px;">
            <button onclick="window.editProfileName()" style="flex:1;background:#222;color:#00FFFF;border:1px solid #00FFFF;border-radius:6px;padding:10px;font-weight:bold;cursor:pointer;font-size:12px;transition:0.2s;" onmouseover="this.style.background='#00FFFF';this.style.color='#000';" onmouseout="this.style.background='#222';this.style.color='#00FFFF';">EDIT PROFILE (${freeCostText})</button>
            <button onclick="window.deletePlayerAccount()" style="flex:1;background:#330000;color:#FF3333;border:1px solid #FF3333;border-radius:6px;padding:10px;font-weight:bold;cursor:pointer;font-size:12px;transition:0.2s;" onmouseover="this.style.background='#FF3333';this.style.color='#000';" onmouseout="this.style.background='#330000';this.style.color='#FF3333';">DELETE ACCOUNT</button>
        </div>`;
    }

    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
};


window.toggleBackgroundMusicFromPlayerModal = function (btn) {
    window.toggleBackgroundMusic();
    let isOn = window.isMusicEnabled;
    btn.innerText = isOn ? 'ENABLED' : 'DISABLED';
    btn.style.background = isOn ? 'linear-gradient(45deg,#39FF14,#228B22)' : '#333';
    btn.style.color = isOn ? '#000' : '#888';
    window.playSound('beep');
};

window.setMasterVolume = function (val) {
    window.masterVolume = parseInt(val);
    localStorage.setItem('carrom_master_volume', window.masterVolume);
    if (window.bgMusic) {
        window.bgMusic.volume = (window.masterVolume / 100) * 0.4;
    }
};

window.triggerPhotoUpload = function () {
    let inp = document.getElementById('profile-photo-input');
    if (inp) inp.click();
};

window.handlePhotoUpload = function (input) {
    if (input.files && input.files[0]) {
        if (input.files[0].size > 2 * 1024 * 1024) {
            window.customAlert("File too large! Please use image under 2MB.", "ERROR");
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            localStorage.setItem('playerAvatar', e.target.result);
            window.customAlert("Profile photo updated successfully!", "SUCCESS");
            window.playSound('claim');
            const modal = document.getElementById('player-details-modal');
            if (modal) modal.remove();
            updateTopBar();
            window.showPlayerDetails(); // Refresh modal
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.removePhoto = function () {
    localStorage.removeItem('playerAvatar');
    window.customAlert("Profile photo removed.", "SUCCESS");
    window.playSound('foul');
    const modal = document.getElementById('player-details-modal');
    if (modal) modal.remove();
    updateTopBar();
    window.showPlayerDetails();
};

window.setFpsLimit = function (val) {
    window.maxFps = val;
    localStorage.setItem('carrom_fps_limit', val);
    window.lastFrameTime = performance.now();
    window.playSound('beep');
};

window.editProfileName = async function () {
    let users = JSON.parse(localStorage.getItem('carrom_registered_users') || "[]");
    let foundUser = users.find(u => u.name.toLowerCase() === (playerName || "").toLowerCase());
    if (!foundUser) return;

    let isFree = !foundUser.freeEditUsed;
    if (!isFree && playerMoney < 70) {
        window.customAlert("Not enough money! Profile edit costs $70.", "INSUFFICIENT FUNDS");
        window.playSound('foul');
        return;
    }

    let newName = await window.customPrompt("Enter new player name:", playerName || "", "PROFILE EDIT");
    if (newName && newName.trim() !== "") {
        newName = newName.trim();
        if (users.find(u => u.name.toLowerCase() === newName.toLowerCase())) {
            window.customAlert("This name is already registered by someone else!", "NAME TAKEN");
            window.playSound('foul');
            return;
        }

        // Apply costs and name update
        if (!isFree) {
            playerMoney -= 70;
            localStorage.setItem('playerMoney', playerMoney);
            updateTopBar();
        } else {
            foundUser.freeEditUsed = true;
        }

        foundUser.name = newName;
        localStorage.setItem('carrom_registered_users', JSON.stringify(users));
        playerName = newName;
        localStorage.setItem('playerName', newName);

        window.customAlert("Profile name updated successfully!", "SUCCESS");
        window.playSound('claim');

        const modal = document.getElementById('player-details-modal');
        if (modal) modal.remove();
        updateTopBar();
        window.showPlayerDetails(); // Refresh modal
    }
}

window.deletePlayerAccount = async function () {
    if (await window.customConfirm("Are you sure you want to DELETE your account? This action cannot be undone and will bring you back to the login screen.", "CRITICAL ACTION")) {
        let users = JSON.parse(localStorage.getItem('carrom_registered_users') || "[]");
        users = users.filter(u => u.name.toLowerCase() !== (playerName || "").toLowerCase());
        localStorage.setItem('carrom_registered_users', JSON.stringify(users));

        // Reset player state entirely
        localStorage.removeItem('playerName');
        localStorage.removeItem('playerMoney');
        localStorage.removeItem('equippedStrikerId');
        localStorage.removeItem('equippedCoinId');

        const pModal = document.getElementById('player-details-modal');
        if (pModal) pModal.remove();

        // Return to login
        document.getElementById('main-game').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('player-name-input').value = "";
        if (window.ambientRipplesInterval) clearInterval(window.ambientRipplesInterval);
        if (typeof jQuery !== 'undefined' && typeof $.fn.ripples === 'function') {
            $('#login-screen').ripples({ resolution: 512, dropRadius: 20, perturbance: 0.04, interactive: true });
            window.ambientRipplesInterval = setInterval(() => {
                if ($('#login-screen').is(':visible')) {
                    $('#login-screen').ripples('drop', Math.random() * window.innerWidth, Math.random() * window.innerHeight, 10 + Math.random() * 15, 0.01 + Math.random() * 0.02);
                }
            }, 3000);
        }
    }
}

window.switchShopView = function (view) { currentShopView = view; renderSidebarShop(); };

window.toggleGameMode = function () {
    if (gameState !== 'MENU') return;
    let modes = ['CLASSIC', 'FREESTYLE', 'DISC POOL', 'ZOMBIE', 'INFECTION', 'GUN GAME'];
    gameMode = modes[(modes.indexOf(gameMode) + 1) % modes.length];
    window.playSound('beep'); renderSidebarShop(); updateUI();
};

window.toggleTargetScore = function () { if (gameState !== 'MENU') return; if (freestyleTargetScore === 120) freestyleTargetScore = 140; else if (freestyleTargetScore === 140) freestyleTargetScore = 160; else freestyleTargetScore = 120; window.playSound('beep'); renderSidebarShop(); updateUI(); };

window.buyPremiumPass = function () {
    if (playerMoney >= 90) { playerMoney -= 90; localStorage.setItem('playerMoney', playerMoney); hasPremiumPass = true; localStorage.setItem('hasPremiumPass', 'true'); window.playSound('claim'); window.customAlert("🎉 CONGRATULATIONS! 💎 Premium Pass Unlocked!", "PREMIUM UNLOCKED"); checkPassCompletion(); updateTopBar(); renderSidebarShop(); if (window.renderEmoteBar) window.renderEmoteBar(); } else { window.customAlert("NOT ENOUGH CASH", "SHOP ERROR"); }
};

window.claimQuest = function (index) {
    let q = dailyQuests[index];
    if (q && q.progress >= q.target && !q.claimed) {
        q.claimed = true; playerMoney += q.reward; localStorage.setItem('playerMoney', playerMoney);
        localStorage.setItem('dailyQuests', JSON.stringify(dailyQuests)); window.playSound('claim'); updateTopBar(); renderSidebarShop(); window.customAlert(`🎉 Claimed $${q.reward} for completing quest!`, "QUEST REWARD");
    }
};

window.claimReward = function (type, index) {
    let isPremium = (type === 'premium');
    let fTierArr = freePassRounds[currentPassRound] || freePassRounds[1];
    let tiers = isPremium ? premiumPassTiers : fTierArr;
    let claims = isPremium ? premiumPassClaims : freePassClaims; let tier = tiers[index];
    if (isPremium && !hasPremiumPass) return;

    if (passMatchesPlayed >= tier.req && !claims[index]) {
        claims[index] = true; window.playSound('claim');
        if (isPremium) localStorage.setItem('premiumPassClaims', JSON.stringify(premiumPassClaims)); else localStorage.setItem('freePassClaims', JSON.stringify(freePassClaims));

        if (tier.type === 'money') { playerMoney += tier.amount; localStorage.setItem('playerMoney', playerMoney); window.customAlert(`Claimed ${tier.reward}!`, "PASS REWARD"); }
        else if (tier.type === 'striker') { let item = shopItems.find(i => i.id === tier.id); if (item) { item.owned = true; localStorage.setItem(`s_${item.id}`, 'true'); equippedStrikerId = tier.id; localStorage.setItem('equippedStrikerId', tier.id); window.customAlert(`Claimed & Equipped ${tier.reward}!`, "PASS REWARD"); } }
        else if (tier.type === 'coin') { let item = coinShopItems.find(i => i.id === tier.id); if (item) { item.owned = true; localStorage.setItem(`c_${item.id}`, 'true'); equippedCoinId = tier.id; localStorage.setItem('equippedCoinId', tier.id); applyEquippedCoins(); window.customAlert(`Claimed & Equipped ${tier.reward}!`, "PASS REWARD"); } }
        else if (tier.type === 'board') { let item = boardShopItems.find(i => i.id === tier.id); if (item) { item.owned = true; localStorage.setItem(`b_${item.id}`, 'true'); equippedBoardId = tier.id; localStorage.setItem('equippedBoardId', tier.id); window.customAlert(`Claimed & Equipped ${tier.reward}!`, "PASS REWARD"); } }
        else if (tier.type === 'sound') { let item = soundShopItems.find(i => i.id === tier.id); if (item) { item.owned = true; localStorage.setItem(`so_${item.id}`, 'true'); equippedSoundId = tier.id; localStorage.setItem('equippedSoundId', tier.id); window.customAlert(`Claimed & Equipped ${tier.reward}!`, "PASS REWARD"); window.playSound('pocket'); } }
        else if (tier.type === 'victory_effect') { hasVictoryEffect = true; localStorage.setItem('hasVictoryEffect', 'true'); window.customAlert(`Claimed ${tier.reward}!`, "PASS REWARD"); }
        else if (tier.type === 'victory_effect_mega') { hasMegaFireworks = true; localStorage.setItem('hasMegaFireworks', 'true'); window.customAlert(`Claimed ${tier.reward}!`, "PASS REWARD"); }
        else if (tier.type === 'emote') { hasPremiumEmote = true; window.customAlert(`Claimed ${tier.reward}!`, "PASS REWARD"); }
        else if (tier.type === 'new_emote') { if (!unlockedEmotes.includes(tier.emote)) unlockedEmotes.push(tier.emote); localStorage.setItem('unlockedEmotes', JSON.stringify(unlockedEmotes)); window.customAlert(`Claimed ${tier.reward}!`, "PASS REWARD"); }
        else if (tier.type === 'voice_female') { hasFemaleVoice = true; localStorage.setItem('hasFemaleVoice', 'true'); window.customAlert(`Claimed ${tier.reward}!`, "PASS REWARD"); }
        else if (tier.type === 'pet') { let item = petShopItems.find(i => i.id === tier.id); if (item) { item.owned = true; localStorage.setItem(`pet_${item.id}`, 'true'); window.customAlert(`Claimed ${tier.reward}!`, "PASS REWARD"); } }

        checkPassCompletion(); updateTopBar(); renderSidebarShop();
    }
};

function checkUnclaimedRewards() {
    let count = 0; let fTierArr = freePassRounds[currentPassRound] || freePassRounds[1];
    for (let i = 0; i < 5; i++) {
        if (passMatchesPlayed >= fTierArr[i].req && !freePassClaims[i]) count++;
        if (hasPremiumPass && passMatchesPlayed >= premiumPassTiers[i].req && !premiumPassClaims[i]) count++;
    }
    return count;
}

function checkPassCompletion() {
    let freeComplete = freePassClaims.every(c => c === true);
    if (freeComplete && passCooldownEndTime === 0) { passCooldownEndTime = Date.now() + 120000; localStorage.setItem('passCooldownEndTime', passCooldownEndTime); }
}

window.checkPassCooldown = function () {
    if (passCooldownEndTime > 0 && Date.now() >= passCooldownEndTime) {
        passCooldownEndTime = 0; passMatchesPlayed = 0; freePassClaims = [false, false, false, false, false];
        if (currentPassRound < 3) currentPassRound++; else currentPassRound = 1;
        localStorage.setItem('passCooldownEndTime', 0); localStorage.setItem('passMatchesPlayed', 0);
        localStorage.setItem('currentPassRound', currentPassRound); localStorage.setItem('freePassClaims', JSON.stringify(freePassClaims));
        return true;
    }
    return false;
};

window.resetGame = function () {
    clearTimeout(botTimeoutId); clearTimeout(window.cinematicTimeoutId); if (window.infectionTimerId) clearInterval(window.infectionTimerId);
    window.stopMatchRecording("Aborted"); window.inTournament = false; window.isPinkSlip = false; window.inBossRush = false; window.bossRushStage = 0; window.tournamentRound = 0; window.currentBet = 0;
    window.isSpectating = false; window.spectatingName = "";
    window.is2v2 = false; window.is1v1MP = false; window.roomIdMP = null; window.mpRoomId = null;
    const exitBtn = document.getElementById('exit-spectate-btn');
    if (exitBtn) exitBtn.style.display = 'none';

    // Resume background music on reset
    if (window.bgMusic && window.isMusicEnabled) {
        window.bgMusic.play().catch(e => { });
    }

    initGame(); updateTopBar();
};

// ==========================================
// 7.5. MULTIPLAYER HUB SYSTEM
// ==========================================
window.mpFriends = [
    { name: 'STRIKER_KING', avatar: '🥷', status: 'online', invited: false, likes: 124, wins: 45, losses: 12, coins: 450, queenStats: 8, wallet: 1250 },
    { name: 'CARROM_PRO99', avatar: '🤖', status: 'online', invited: false, likes: 89, wins: 32, losses: 28, coins: 310, queenStats: 4, wallet: 850 },
    { name: 'QUEEN_HUNTER', avatar: '🐯', status: 'in_match', invited: false, likes: 256, wins: 112, losses: 45, coins: 890, queenStats: 35, wallet: 4500 },
    { name: 'BOARD_MASTER', avatar: '👑', status: 'online', invited: false, likes: 412, wins: 156, losses: 32, coins: 1200, queenStats: 62, wallet: 9800 },
    { name: 'POCKET_ACE', avatar: '🦅', status: 'offline', invited: false, likes: 67, wins: 18, losses: 15, coins: 180, queenStats: 2, wallet: 400 },
    { name: 'NEON_STRIKER', avatar: '👽', status: 'online', invited: false, likes: 153, wins: 56, losses: 24, coins: 520, queenStats: 12, wallet: 2100 }
];

window.resetMpFriends = function () {
    if (!window.mpFriends) return;
    window.mpFriends.forEach(f => {
        f.invited = false;
        f.status = 'online'; // Ensure all friends are recruitable and don't "disappear"
    });
};

window.mpRoomCode = '';
window.mpLobbyTimerId = null;
window.mpSelectedMode = 'CLASSIC';

window.setMpMode = function (mode) {
    window.mpSelectedMode = mode;
    window.playSound('beep');
    renderSidebarShop();
};

window.createMultiplayerRoom = function () {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    window.playSound('beep');

    // Show 1v1 vs 2v2 selection modal
    let modal = document.createElement('div'); modal.id = 'mp-mode-select-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #1E90FF;border-radius:24px;padding:40px;text-align:center;max-width:500px;width:90%;box-shadow:0 0 60px rgba(30,144,255,0.4);animation:badgeSlideUp 0.4s ease-out;position:relative;overflow:hidden;">`;

    // background flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% -20%, rgba(30,144,255,0.25) 0%, transparent 60%); pointer-events:none;"></div>`;

    html += `<div style="font-size:50px;margin-bottom:10px;filter:drop-shadow(0 0 10px #1E90FF);position:relative;z-index:1;">🏠</div>`;
    html += `<h2 style="color:#FFF;margin:0 0 4px;font-size:26px;letter-spacing:4px;font-weight:900;text-shadow:0 0 15px rgba(255,255,255,0.3);">CREATE ROOM</h2>`;
    html += `<p style="color:#87CEFA;font-size:13px;margin:0 0 30px;letter-spacing:2px;font-weight:bold;opacity:0.8;">CHOOSE YOUR BATTLEGROUND</p>`;

    // Decorative line
    html += `<div style="width:70%;height:2px;background:linear-gradient(90deg,transparent,#1E90FF,transparent);margin:0 auto 30px;"></div>`;

    // 1v1 and 2v2 selection cards
    html += `<div style="display:flex;gap:20px;justify-content:center;margin-bottom:30px;">`;

    // 1v1 Card
    html += `<button id="mp-select-1v1" class="shimmer-effect" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #1E90FF;border-radius:16px;padding:30px 15px;cursor:pointer;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.borderColor='#39FF14';this.style.boxShadow='0 10px 30px rgba(57,255,20,0.4)'" onmouseout="this.style.transform='scale(1)';this.style.borderColor='#1E90FF';this.style.boxShadow='none'">`;
    html += `<div style="font-size:48px;margin-bottom:12px;">⚔️</div>`;
    html += `<div style="color:#FFF;font-size:22px;font-weight:950;letter-spacing:2px;margin-bottom:8px;">1 vs 1</div>`;
    html += `<div style="color:#87CEFA;font-size:12px;line-height:1.5;font-weight:bold;">SOLO DUEL<br><span style="color:#FFD700;">PRO BATTLE</span></div>`;
    html += `<div class="status-badge" style="position:absolute;top:10px;right:10px;background:#1E90FF;color:#FFF;font-size:9px;">CLASSIC</div>`;
    html += `</button>`;

    // 2v2 Card
    html += `<button id="mp-select-2v2" class="shimmer-effect" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #8A2BE2;border-radius:16px;padding:30px 15px;cursor:pointer;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.borderColor='#FF1493';this.style.boxShadow='0 10px 30px rgba(255,20,147,0.4)'" onmouseout="this.style.transform='scale(1)';this.style.borderColor='#8A2BE2';this.style.boxShadow='none'">`;
    html += `<div style="font-size:48px;margin-bottom:12px;">👥⚔️👥</div>`;
    html += `<div style="color:#FFF;font-size:22px;font-weight:950;letter-spacing:2px;margin-bottom:8px;">2 vs 2</div>`;
    html += `<div style="color:#D8BFD8;font-size:12px;line-height:1.5;font-weight:bold;">TEAM CO-OP<br><span style="color:#FF1493;">INVITE FRIENDS</span></div>`;
    html += `<div class="status-badge" style="position:absolute;top:10px;right:10px;background:linear-gradient(45deg,#FF1493,#8A2BE2);color:#FFF;font-size:9px;">TEAM</div>`;
    html += `</button>`;

    html += `</div>`;

    // Mode display
    html += `<div style="background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 25px;margin-bottom:25px;display:inline-flex;align-items:center;gap:10px;box-shadow:inset 0 0 10px rgba(0,0,0,0.5);"><span style="color:#888;font-size:11px;letter-spacing:2px;font-weight:900;">ACTIVE MODE:</span> <span style="color:#FFD700;font-weight:950;font-size:16px;letter-spacing:1.5px;text-shadow:0 0 10px rgba(255,215,0,0.4);">${window.mpSelectedMode}</span></div>`;

    // Cancel button
    html += `<div><button onclick="let m=document.getElementById('mp-mode-select-modal');if(m)m.remove();window.playSound('beep');" class="shimmer-effect" style="background:rgba(255,255,255,0.05);color:#888;border:1px solid #444;padding:12px 40px;font-weight:900;border-radius:10px;cursor:pointer;font-size:14px;transition:all 0.2s;letter-spacing:1px;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF';this.style.borderColor='#FF3333';this.style.boxShadow='0 0 15px rgba(255,51,51,0.4)'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#888';this.style.borderColor='#444';this.style.boxShadow='none'">LEAVE</button></div>`;
    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // 1v1 button handler
    document.getElementById('mp-select-1v1').addEventListener('click', () => {
        modal.remove();
        window.click1V1(true);
    });

    // 2v2 button handler
    document.getElementById('mp-select-2v2').addEventListener('click', () => {
        modal.remove();
        window.click2VS2(true);
    });
};

// ---- 1v1 ROOM CREATION ----
window.createRoom1v1 = function () {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    window.playSound('beep');

    // Show Invite Friend vs Random Player modal
    let modal = document.createElement('div'); modal.id = 'mp-1v1-choice-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #39FF14;border-radius:24px;padding:40px;text-align:center;max-width:520px;width:90%;box-shadow:0 0 60px rgba(57,255,20,0.3);animation:badgeSlideUp 0.4s ease-out;">`;
    html += `<div style="font-size:50px;margin-bottom:10px;filter:drop-shadow(0 0 10px #39FF14);">⚔️</div>`;
    html += `<h2 style="color:#FFF;margin:0 0 5px;font-size:26px;letter-spacing:4px;font-weight:900;">1 vs 1</h2>`;
    html += `<p style="color:#39FF14;font-size:13px;margin:0 0 30px;letter-spacing:2px;font-weight:bold;opacity:0.8;">SELECT YOUR OPPONENT TYPE</p>`;

    // Decorative line
    html += `<div style="width:70%;height:2px;background:linear-gradient(90deg,transparent,#39FF14,transparent);margin:0 auto 30px;"></div>`;

    // Three choice cards
    html += `<div style="display:flex;gap:15px;justify-content:center;margin-bottom:30px;">`;

    // Invite Friend Card
    html += `<button id="mp-1v1-invite" class="shimmer-effect neon-glow-green" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #39FF14;border-radius:16px;padding:25px 10px;cursor:pointer;transition:all 0.3s ease;position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.boxShadow='0 10px 25px rgba(57,255,20,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">`;
    html += `<div style="font-size:36px;margin-bottom:12px;">👥</div>`;
    html += `<div style="color:#FFF;font-size:15px;font-weight:900;letter-spacing:1.5px;line-height:1.2;">INVITE<br>FRIEND</div>`;
    html += `</button>`;

    // Random Player Card
    html += `<button id="mp-1v1-random" class="shimmer-effect" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #FF4500;border-radius:16px;padding:25px 10px;cursor:pointer;transition:all 0.3s ease;position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.borderColor='#FF4500';this.style.boxShadow='0 10px 25px rgba(255,69,0,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.borderColor='#FF4500';this.style.boxShadow='none'">`;
    html += `<div style="font-size:36px;margin-bottom:12px;">🎲</div>`;
    html += `<div style="color:#FFF;font-size:15px;font-weight:900;letter-spacing:1.5px;line-height:1.2;">RANDOM<br>PLAYER</div>`;
    html += `</button>`;

    // Generate Code Card
    html += `<button id="mp-1v1-generate" class="shimmer-effect neon-glow-purple" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #8A2BE2;border-radius:16px;padding:25px 10px;cursor:pointer;transition:all 0.3s ease;position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.boxShadow='0 10px 25px rgba(138,43,226,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">`;
    html += `<div style="font-size:36px;margin-bottom:12px;">🔑</div>`;
    html += `<div style="color:#FFF;font-size:15px;font-weight:900;letter-spacing:1.5px;line-height:1.2;">PRIVATE<br>ROOM</div>`;
    html += `</button>`;

    html += `</div>`;

    // Mode display
    html += `<div style="background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 20px;margin-bottom:25px;display:inline-block;"><span style="color:#888;font-size:10px;letter-spacing:2px;font-weight:900;">MODE:</span> <span style="color:#FFD700;font-weight:950;font-size:15px;letter-spacing:1px;">${window.mpSelectedMode}</span></div>`;

    // Cancel button
    html += `<div><button onclick="let m=document.getElementById('mp-1v1-choice-modal');if(m)m.remove();window.playSound('beep');" class="shimmer-effect" style="background:transparent;color:#888;border:1px solid #444;padding:12px 40px;font-weight:900;border-radius:10px;cursor:pointer;font-size:13px;transition:all 0.2s;letter-spacing:1px;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF';this.style.borderColor='#FF3333'" onmouseout="this.style.background='transparent';this.style.color='#888';this.style.borderColor='#444'">BACK</button></div>`;
    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Invite Friend handler
    document.getElementById('mp-1v1-invite').addEventListener('click', () => {
        modal.remove();
        window.invite1v1Friend();
    });

    // Random Player handler
    document.getElementById('mp-1v1-random').addEventListener('click', () => {
        modal.remove();
        window.random1v1Match();
    });

    // Generate Code handler
    document.getElementById('mp-1v1-generate').addEventListener('click', () => {
        modal.remove();
        window.generateCode1v1Match();
    });
};


window.generateCode1v1Match = function () {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    window.playSound('beep');

    let chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    window.mpRoomCode = '';
    for (let i = 0; i < 5; i++) window.mpRoomCode += chars[Math.floor(Math.random() * chars.length)];

    let modal = document.createElement('div'); modal.id = 'mp-lobby-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #8A2BE2;border-radius:24px;padding:40px;text-align:center;max-width:480px;width:90%;box-shadow:0 0 60px rgba(138,43,226,0.4);animation:badgeSlideUp 0.4s ease-out;position:relative;overflow:hidden;">`;

    // Shimmer and background flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% -20%, rgba(138,43,226,0.3) 0%, transparent 60%); pointer-events:none;"></div>`;

    html += `<div style="font-size:48px;margin-bottom:12px;filter:drop-shadow(0 0 15px #8A2BE2);">🔑</div>`;
    html += `<h2 style="color:#FFF;margin:0 0 5px;font-size:24px;letter-spacing:3px;font-weight:900;">BATTLE CODE</h2>`;
    html += `<p style="color:#D8BFD8;font-size:12px;margin:0 0 25px;letter-spacing:1px;font-weight:bold;opacity:0.8;">SHARE THIS WITH YOUR RIVAL</p>`;

    html += `<div class="shimmer-effect neon-glow-purple" style="background:rgba(0,0,0,0.6);border:2px solid #8A2BE2;border-radius:16px;padding:25px;margin-bottom:25px;position:relative;">`;
    html += `<div style="font-size:44px;font-weight:950;letter-spacing:12px;color:#FFF;text-shadow:0 0 20px rgba(138,43,226,0.8);font-family:monospace;margin-left:12px;">${window.mpRoomCode}</div>`;
    html += `</div>`;

    html += `<div style="display:flex; justify-content:center; margin-bottom: 25px;">`;
    html += `<div id="qrcode-container" class="neon-glow-purple" style="background:#FFF; padding:15px; border-radius:16px; box-shadow:0 0 30px rgba(138,43,226,0.4);"></div>`;
    html += `</div>`;

    html += `<div id="mp-lobby-waiting" style="color:#FFD700;font-size:15px;margin-bottom:30px;font-weight:900;letter-spacing:1px;text-transform:uppercase;"><span style="display:inline-block;animation:ping 1s infinite;vertical-align:middle;margin-right:8px;">📡</span> Finding Opponent...</div>`;

    html += `<div style="display:flex; gap:15px; justify-content:center;">`;
    html += `<button id="mp-lobby-launch" class="shimmer-effect" disabled style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.1);padding:15px 35px;font-weight:950;border-radius:12px;font-size:14px;cursor:not-allowed;text-transform:uppercase;letter-spacing:2px;flex:1;">START MATCH</button>`;
    html += `<button id="mp-lobby-cancel" onclick="window.cancelMultiplayerLobby()" class="shimmer-effect" style="background:rgba(255,51,51,0.2);color:#FF3333;border:2px solid #FF3333;padding:15px 35px;font-weight:950;border-radius:12px;cursor:pointer;font-size:14px;text-transform:uppercase;letter-spacing:2px;flex:1;transition:0.2s;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF'" onmouseout="this.style.background='rgba(255,51,51,0.2)';this.style.color='#FF3333'">ABANDON</button>`;
    html += `</div>`;

    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);


    setTimeout(() => {
        new QRCode(document.getElementById("qrcode-container"), {
            text: "carrom://join/" + window.mpRoomCode,
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }, 100);

    // Simulate opponent joining after ~4s
    window.mpLobbyTimerId = setTimeout(() => {
        let waitEl = document.getElementById('mp-lobby-waiting');
        if (!waitEl) return;
        window.playSound('claim');
        let opponents = ['STRIKER_KING', 'CARROM_PRO99', 'BOARD_MASTER'];
        let oppName = opponents[Math.floor(Math.random() * opponents.length)];
        window.mpLobbyOpponentJoined = oppName;
        waitEl.innerHTML = `<span style="color:#39FF14;font-weight:950;text-shadow:0 0 10px rgba(57,255,20,0.4);border:1px solid #39FF14;padding:8px 20px;border-radius:20px;background:rgba(57,255,20,0.1);">✅ TARGET ACQUIRED: ${oppName}</span>`;

        let launchBtn = document.getElementById('mp-lobby-launch');
        if (launchBtn) {
            launchBtn.disabled = false;
            launchBtn.classList.add('neon-glow-green'); // Use the utility class
            launchBtn.style.background = 'linear-gradient(135deg,#39FF14,#008000)';
            launchBtn.style.color = '#000';
            launchBtn.style.cursor = 'pointer';
            launchBtn.style.opacity = '1';
            launchBtn.onclick = function () {
                let m = document.getElementById('mp-lobby-modal');
                if (m) m.remove();
                window.startMultiplayerMatch(window.mpLobbyOpponentJoined);
            };
        }
    }, 4000);
};

// ---- 1v1 INVITE FRIEND ----
window.invite1v1Friend = function () {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    window.playSound('beep');

    let modal = document.createElement('div'); modal.id = 'mp-1v1-invite-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #39FF14;border-radius:24px;padding:35px;text-align:center;max-width:500px;width:90%;box-shadow:0 0 60px rgba(57,255,20,0.4);animation:badgeSlideUp 0.4s ease-out;max-height:85vh;overflow-y:auto;position:relative;overflow:hidden;">`;

    // background flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 10% 10%, rgba(57,255,20,0.15) 0%, transparent 50%); pointer-events:none;"></div>`;

    html += `<div style="font-size:48px;margin-bottom:12px;filter:drop-shadow(0 0 15px #39FF14);">👥</div>`;
    html += `<h2 style="color:#FFF;margin:0 0 5px;font-size:24px;letter-spacing:3px;font-weight:900;">FRIEND MATCH</h2>`;
    html += `<p style="color:#87CEFA;font-size:12px;margin:0 0 5px;font-weight:bold;opacity:0.8;letter-spacing:1px;">CHOOSE A FRIEND TO CHALLENGE</p>`;
    html += `<div style="display:inline-block;background:rgba(0,0,0,0.4);border:1px solid #1E90FF;color:#FFF;font-size:11px;padding:5px 15px;border-radius:20px;font-weight:950;margin-bottom:25px;letter-spacing:1px;">MODE: ${window.mpSelectedMode.toUpperCase()}</div>`;

    // Decorative line
    html += `<div style="width:70%;height:2px;background:linear-gradient(90deg,transparent,#39FF14,transparent);margin:0 auto 25px;"></div>`;

    // Friends list
    html += `<div style="color:#FFF;font-size:13px;font-weight:950;letter-spacing:2px;margin-bottom:15px;text-align:left;text-transform:uppercase;opacity:0.6;">👥 YOUR FRIENDS</div>`;

    let onlineFriends = window.mpFriends.filter(f => f.status === 'online');
    if (onlineFriends.length === 0) {
        html += `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:30px;color:#888;font-size:14px;font-weight:bold;letter-spacing:0.5px;">NO FRIENDS ONLINE AT THE MOMENT</div>`;
    } else {
        window.mpFriends.forEach((friend, i) => {
            let statusColor = friend.status === 'online' ? '#39FF14' : (friend.status === 'in_match' ? '#FFD700' : '#555');
            let statusText = friend.status === 'online' ? 'Online' : (friend.status === 'in_match' ? 'In Match' : 'Offline');
            let canInvite = friend.status === 'online';
            let glowClass = canInvite ? 'shimmer-effect' : '';
            let inviteBtnStyle = canInvite ? 'background:linear-gradient(135deg,#39FF14,#008000);color:#000;cursor:pointer;box-shadow:0 4px 12px rgba(57,255,20,0.3);' : 'background:rgba(255,255,255,0.05);color:#555;cursor:not-allowed;';

            html += `<div style="display:flex;align-items:center;padding:12px 15px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:16px;margin-bottom:10px;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);" onmouseover="this.style.background='rgba(57,255,20,0.08)';this.style.borderColor='#39FF14';this.style.transform='scale(1.02)'" onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.1)';this.style.transform='scale(1)'">`;
            html += `<div style="font-size:32px;margin-right:15px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${friend.avatar}</div>`;
            html += `<div style="flex:1;text-align:left;"><div style="color:#FFF;font-weight:950;font-size:15px;letter-spacing:0.5px;">${friend.name.toUpperCase()}</div>`;
            html += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><span style="display:inline-block;width:8px;height:8px;background:${statusColor};border-radius:50%;${friend.status === 'online' ? 'box-shadow:0 0 8px ' + statusColor + '; animation:pulse 1.5s infinite;' : ''}"></span><span style="color:${statusColor};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">${statusText}</span></div></div>`;
            html += `<button class="mp-1v1-friend-btn ${glowClass}" data-friend-index="${i}" ${canInvite ? '' : 'disabled'} style="padding:10px 20px;border:none;border-radius:10px;font-weight:950;font-size:12px;letter-spacing:1px;transition:all 0.2s;${inviteBtnStyle}" ${canInvite ? 'onmouseover="this.style.transform=\'scale(1.08)\'" onmouseout="this.style.transform=\'scale(1)\'"' : ''}>CHALLENGE</button>`;
            html += `</div>`;
        });
    }

    // Cancel button
    html += `<div style="margin-top:25px;"><button onclick="let m=document.getElementById('mp-1v1-invite-modal');if(m)m.remove();window.playSound('beep');" class="shimmer-effect" style="background:transparent;color:#888;border:1px solid #444;padding:12px 40px;font-weight:950;border-radius:12px;cursor:pointer;font-size:13px;transition:all 0.2s;letter-spacing:2px;text-transform:uppercase;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF';this.style.borderColor='#FF3333'" onmouseout="this.style.background='transparent';this.style.color='#888';this.style.borderColor='#444'">BACK</button></div>`;
    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);


    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Attach challenge button handlers
    document.querySelectorAll('.mp-1v1-friend-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            let idx = parseInt(this.getAttribute('data-friend-index'));
            let friend = window.mpFriends[idx];
            if (!friend || friend.status !== 'online') return;

            // Close the friend list modal
            let inviteModal = document.getElementById('mp-1v1-invite-modal');
            if (inviteModal) inviteModal.remove();
            window.playSound('beep');

            // Show Bet Match vs Friendly Match choice
            window.show1v1MatchTypeChoice(friend);
        });
    });
};

// ---- 1v1 BET vs FRIENDLY CHOICE ----
window.show1v1MatchTypeChoice = function (friend) {
    let modal = document.createElement('div'); modal.id = 'mp-1v1-type-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #1E90FF;border-radius:24px;padding:40px;text-align:center;max-width:500px;width:90%;box-shadow:0 0 60px rgba(30,144,255,0.4);animation:badgeSlideUp 0.4s ease-out;position:relative;overflow:hidden;">`;

    // background glow based on choice? No, let's stick to blue for now.
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% -20%, rgba(30,144,255,0.2) 0%, transparent 60%); pointer-events:none;"></div>`;

    // Header with opponent info
    html += `<div style="font-size:55px;margin-bottom:12px;filter:drop-shadow(0 0 10px rgba(255,255,255,0.3));">${friend.avatar}</div>`;
    html += `<h2 style="color:#FFF;margin:0 0 4px;font-size:26px;letter-spacing:3px;font-weight:900;text-shadow:0 0 15px rgba(255,255,255,0.2);">CHALLENGE ${friend.name.toUpperCase()}</h2>`;
    html += `<p style="color:#87CEFA;font-size:13px;margin:0 0 30px;letter-spacing:2px;font-weight:bold;opacity:0.8;">SELECT MATCH FORMAT</p>`;

    // Decorative line
    html += `<div style="width:70%;height:2px;background:linear-gradient(90deg,transparent,#1E90FF,transparent);margin:0 auto 30px;"></div>`;

    // Two cards
    html += `<div style="display:flex;gap:20px;justify-content:center;margin-bottom:30px;">`;

    // Bet Match Card
    html += `<button id="mp-1v1-bet-btn" class="shimmer-effect" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #FFD700;border-radius:16px;padding:30px 15px;cursor:pointer;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.boxShadow='0 10px 30px rgba(255,215,0,0.4)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">`;
    html += `<div style="font-size:42px;margin-bottom:12px;filter:drop-shadow(0 0 10px #FFD700);">💰</div>`;
    html += `<div style="color:#FFD700;font-size:18px;font-weight:950;letter-spacing:1px;margin-bottom:8px;">BET MATCH</div>`;
    html += `<div style="color:#BFA76A;font-size:12px;line-height:1.4;font-weight:bold;">WAGER CASH<br><span style="color:#FFD700;">WINNER TAKES ALL</span></div>`;
    html += `<div class="status-badge" style="position:absolute;top:10px;right:10px;background:linear-gradient(45deg,#FFD700,#FF8C00);color:#000;font-size:9px;">CASH</div>`;
    html += `</button>`;

    // Friendly Match Card
    html += `<button id="mp-1v1-friendly-btn" class="shimmer-effect neon-glow-green" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #39FF14;border-radius:16px;padding:30px 15px;cursor:pointer;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.boxShadow='0 10px 30px rgba(57,255,20,0.4)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">`;
    html += `<div style="font-size:42px;margin-bottom:12px;filter:drop-shadow(0 0 10px #39FF14);">🤝</div>`;
    html += `<div style="color:#39FF14;font-size:18px;font-weight:950;letter-spacing:1px;margin-bottom:8px;">FRIENDLY</div>`;
    html += `<div style="color:#7ABF7A;font-size:12px;line-height:1.4;font-weight:bold;">JUST FOR FUN<br><span style="color:#39FF14;">NO STAKES</span></div>`;
    html += `<div class="status-badge" style="position:absolute;top:10px;right:10px;background:#39FF14;color:#000;font-size:9px;">FREE</div>`;
    html += `</button>`;

    html += `</div>`;

    // Wallet display
    html += `<div style="background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 25px;margin-bottom:25px;display:inline-flex;align-items:center;gap:10px;box-shadow:inset 0 0 10px rgba(0,0,0,0.5);"><span style="color:#888;font-size:11px;letter-spacing:2px;font-weight:900;">WALLET:</span> <span style="color:#39FF14;font-weight:950;font-size:16px;letter-spacing:1.5px;text-shadow:0 0 10px rgba(57,255,20,0.4);">$${playerMoney}</span></div>`;

    // Cancel button
    html += `<div><button onclick="let m=document.getElementById('mp-1v1-type-modal');if(m)m.remove();window.playSound('beep');" class="shimmer-effect" style="background:transparent;color:#888;border:1px solid #444;padding:12px 40px;font-weight:900;border-radius:10px;cursor:pointer;font-size:14px;transition:all 0.2s;letter-spacing:1px;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF';this.style.borderColor='#FF3333'" onmouseout="this.style.background='transparent';this.style.color='#888';this.style.borderColor='#444'">BACK</button></div>`;
    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Friendly Match handler
    document.getElementById('mp-1v1-friendly-btn').addEventListener('click', () => {
        modal.remove();
        window.send1v1Challenge(friend, 'friendly', 0);
    });

    // Bet Match handler
    document.getElementById('mp-1v1-bet-btn').addEventListener('click', () => {
        modal.remove();
        window.show1v1BetSelection(friend);
    });
};

// ---- 1v1 BET AMOUNT SELECTION ----
window.show1v1BetSelection = function (friend) {
    window.playSound('beep');

    let modal = document.createElement('div'); modal.id = 'mp-1v1-bet-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let betAmounts = [50, 100, 200, 500, 700, 1000];

    let html = `<div id="mp-bet-card" class="lobby-glass lobby-float" style="border:2px solid #FFD700;border-radius:24px;padding:35px;text-align:center;max-width:500px;width:90%;box-shadow:0 0 60px rgba(255,215,0,0.4);animation:badgeSlideUp 0.4s ease-out;position:relative;overflow:hidden;">`;

    // Flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 100% 100%, rgba(255,215,0,0.2) 0%, transparent 60%); pointer-events:none;"></div>`;

    html += `<div style="font-size:48px;margin-bottom:12px;filter:drop-shadow(0 0 15px #FFD700);">💰</div>`;
    html += `<h2 style="color:#FFD700;margin:0 0 5px;font-size:24px;letter-spacing:3px;font-weight:900;">HIGH STAKES MATCH</h2>`;
    html += `<p style="color:#BFA76A;font-size:13px;margin:0 0 5px;font-weight:bold;">vs <span style="color:#FFF;">${friend.name.toUpperCase()}</span></p>`;
    html += `<p style="color:#888;font-size:11px;margin:0 0 25px;letter-spacing:1px;font-weight:bold;">ENTRY FEE: <span style="color:#FFD700;">50% OF BET</span> | WINNER TAKES ALL!</p>`;

    // Wallet display
    html += `<div style="background:rgba(0,0,0,0.5);border:1px solid #FFD70040;border-radius:12px;padding:12px 25px;margin-bottom:25px;display:inline-flex;align-items:center;gap:10px;box-shadow:inset 0 0 15px rgba(0,0,0,0.5);"><span style="color:#888;font-size:11px;letter-spacing:2px;font-weight:900;">YOUR BALANCE:</span> <span style="color:#39FF14;font-weight:950;font-size:18px;letter-spacing:1px;text-shadow:0 0 10px rgba(57,255,20,0.4);">$${playerMoney}</span></div>`;

    // Decorative line
    html += `<div style="width:70%;height:2px;background:linear-gradient(90deg,transparent,#FFD700,transparent);margin:0 auto 25px;"></div>`;

    html += `<div style="color:#FFD700;font-size:13px;font-weight:950;letter-spacing:2px;margin-bottom:15px;text-transform:uppercase;">💵 CHOOSE THE POT</div>`;

    // Bet amount grid
    html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:25px;">`;
    betAmounts.forEach(amt => {
        let halfAmt = amt / 2;
        let canAfford = playerMoney >= halfAmt;
        let glowClass = canAfford ? 'shimmer-effect neon-glow-gold' : '';
        let bgStyle = canAfford ? 'background:rgba(0,0,0,0.4);border:2px solid #FFD70080;cursor:pointer;' : 'background:rgba(255,255,255,0.02);border:2px solid #333;cursor:not-allowed;opacity:0.4;';
        let textColor = canAfford ? '#FFD700' : '#555';
        let hoverAttr = canAfford ? `onmouseover="this.style.transform='scale(1.08) translateY(-3px)';this.style.borderColor='#FFD700';this.style.boxShadow='0 8px 20px rgba(255,215,0,0.4)'" onmouseout="this.style.transform='scale(1)';this.style.borderColor='#FFD70080';this.style.boxShadow='none'"` : '';

        html += `<button class="mp-bet-amt-btn ${glowClass}" data-amount="${amt}" ${canAfford ? '' : 'disabled'} style="${bgStyle} border-radius:14px;padding:18px 10px;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);text-align:center;position:relative;overflow:hidden;" ${hoverAttr}>`;
        html += `<div style="color:${textColor};font-size:24px;font-weight:950;letter-spacing:1px;">$${amt}</div>`;
        html += `<div style="color:${canAfford ? '#BFA76A' : '#444'};font-size:9px;margin-top:5px;font-weight:900;text-transform:uppercase;">FEE: $${halfAmt}</div>`;
        html += `</button>`;
    });
    html += `</div>`;

    // Error message area
    html += `<div id="mp-bet-error" style="display:none;color:#FFF;font-size:12px;font-weight:bold;margin-bottom:15px;padding:12px;background:rgba(255,50,50,0.3);border:2px solid #FF3333;border-radius:10px;box-shadow:0 0 15px rgba(255,51,51,0.3);letter-spacing:0.5px;"></div>`;

    // Cancel button
    html += `<div><button onclick="let m=document.getElementById('mp-1v1-bet-modal');if(m)m.remove();window.playSound('beep');" class="shimmer-effect" style="background:transparent;color:#888;border:1px solid #444;padding:13px 40px;font-weight:950;border-radius:12px;cursor:pointer;font-size:14px;transition:all 0.2s;letter-spacing:2px;text-transform:uppercase;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF';this.style.borderColor='#FF3333'" onmouseout="this.style.background='transparent';this.style.color='#888';this.style.borderColor='#444'">SCRATCH MATCH</button></div>`;
    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);


    // Attach bet amount handlers
    document.querySelectorAll('.mp-bet-amt-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            let amt = parseInt(this.getAttribute('data-amount'));
            let halfAmt = amt / 2;

            // Double check wallet
            if (playerMoney < halfAmt) {
                let errEl = document.getElementById('mp-bet-error');
                if (errEl) {
                    errEl.style.display = 'block';
                    errEl.innerHTML = `❌ INSUFFICIENT FUNDS! You need $${halfAmt} but only have $${playerMoney}`;
                    // Shake animation
                    let card = document.getElementById('mp-bet-card');
                    if (card) {
                        card.style.animation = 'none';
                        setTimeout(() => { card.style.animation = 'shake 0.4s ease-in-out'; }, 10);
                    }
                }
                window.playSound('foul');
                return;
            }

            // Deduct half from player's wallet
            playerMoney -= halfAmt;
            localStorage.setItem('playerMoney', playerMoney);
            updateTopBar();
            window.playSound('claim');

            // Close bet modal
            let betModal = document.getElementById('mp-1v1-bet-modal');
            if (betModal) betModal.remove();

            // Send challenge with bet info
            window.send1v1Challenge(friend, 'bet', amt);
        });
    });
};

// ---- SEND 1v1 CHALLENGE (Friendly or Bet) ----
window.send1v1Challenge = function (friend, matchType, betAmount) {
    window.playSound('beep');

    // Show "Challenge Sent" waiting modal
    let modal = document.createElement('div'); modal.id = 'mp-1v1-wait-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let isBet = matchType === 'bet';
    let halfAmt = betAmount / 2;
    let borderColor = isBet ? '#FFD700' : '#39FF14';
    let typeLabel = isBet ? `💰 BET MATCH — $${betAmount}` : '🤝 FRIENDLY MATCH';
    let typeLabelColor = isBet ? '#FFD700' : '#39FF14';

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid ${borderColor};border-radius:24px;padding:35px;text-align:center;max-width:450px;width:90%;box-shadow:0 0 60px ${borderColor}40;animation:badgeSlideUp 0.4s ease-out;position:relative;overflow:hidden;">`;

    // Background flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% 120%, ${borderColor}20 0%, transparent 60%); pointer-events:none;"></div>`;

    html += `<div style="font-size:55px;margin-bottom:12px;filter:drop-shadow(0 0 10px rgba(255,255,255,0.3));">${friend.avatar}</div>`;
    html += `<h2 style="color:#FFF;margin:0 0 5px;font-size:24px;letter-spacing:3px;font-weight:950;text-transform:uppercase;">CHALLENGE SENT!</h2>`;
    html += `<div style="display:inline-block;background:${isBet ? 'linear-gradient(135deg,#FFD700,#FF8C00)' : 'linear-gradient(135deg,#39FF14,#008000)'};color:#000;font-size:12px;padding:6px 20px;border-radius:30px;font-weight:950;margin-bottom:20px;letter-spacing:1px;box-shadow:0 4px 15px ${borderColor}40;">${typeLabel}</div>`;

    if (isBet) {
        html += `<div style="background:rgba(0,0,0,0.6);border:1px solid ${borderColor}40;border-radius:16px;padding:20px;margin-bottom:25px;box-shadow:inset 0 0 20px rgba(0,0,0,0.5);">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;">`;
        html += `<div style="text-align:center;flex:1;"><div style="color:#888;font-size:10px;letter-spacing:2px;font-weight:900;margin-bottom:2px;">WAGERING</div><div style="color:#FFF;font-size:20px;font-weight:950;">$${halfAmt}</div></div>`;
        html += `<div style="color:${borderColor};font-size:20px;font-weight:950;animation:ping 1.5s infinite;">⚔️</div>`;
        html += `<div style="text-align:center;flex:1;"><div style="color:#888;font-size:10px;letter-spacing:2px;font-weight:900;margin-bottom:2px;">STAKING</div><div style="color:#FFF;font-size:20px;font-weight:950;">$${halfAmt}</div></div>`;
        html += `</div>`;
        html += `<div style="color:#39FF14;font-size:13px;margin-top:12px;font-weight:950;letter-spacing:1px;text-transform:uppercase;text-shadow:0 0 10px rgba(57,255,20,0.4);">🏆 WINNER TAKES $${betAmount}</div>`;
        html += `</div>`;
    }

    html += `<div id="mp-lobby-waiting" style="color:#FFD700;font-size:14px;margin-bottom:25px;font-weight:950;letter-spacing:1px;text-transform:uppercase;"><span style="display:inline-block;animation:pulse 1s infinite;vertical-align:middle;margin-right:8px;">⏳</span> Waiting for ${friend.name}...</div>`;
    html += `<button id="mp-1v1-wait-cancel" onclick="window.cancel1v1Challenge(${isBet ? halfAmt : 0})" class="shimmer-effect" style="background:rgba(255,51,51,0.2);color:#FF3333;border:2px solid #FF3333;padding:12px 35px;font-weight:950;border-radius:12px;cursor:pointer;font-size:13px;text-transform:uppercase;letter-spacing:2px;transition:0.2s;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF'" onmouseout="this.style.background='rgba(255,51,51,0.2)';this.style.color='#FF3333'">RECALL CHALLENGE</button>`;
    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);


    // Simulate friend accepting after 2-3.5 seconds
    window.mpLobbyTimerId = setTimeout(() => {
        let waitModal = document.getElementById('mp-1v1-wait-modal');
        if (!waitModal) return;

        // 85% chance they accept
        if (Math.random() < 0.85) {
            window.playSound('claim');
            waitModal.remove();

            // Show accepted + PLAY/REJECT confirmation
            let selMode = window.mpSelectedMode || 'CLASSIC';
            let modeColors = { 'CLASSIC': '#FFD700', 'FREESTYLE': '#00FFFF', 'DISC POOL': '#FF1493' };
            let modeIcons = { 'CLASSIC': '🎯', 'FREESTYLE': '🎨', 'DISC POOL': '🎱' };
            let mColor = modeColors[selMode] || '#FFD700';
            let mIcon = modeIcons[selMode] || '🎯';

            let confirmModal = document.createElement('div'); confirmModal.id = 'mp-invite-confirm';
            confirmModal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

            let cHtml = `<div class="lobby-glass lobby-float" style="border:2px solid #39FF14;border-radius:24px;padding:35px;text-align:center;max-width:500px;width:95%;box-shadow:0 0 70px rgba(57,255,20,0.4);animation:badgeSlideUp 0.4s ease-out;position:relative;overflow:hidden;">`;

            // flare
            cHtml += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% 10%, rgba(57,255,20,0.2) 0%, transparent 60%); pointer-events:none;"></div>`;

            cHtml += `<div style="font-size:60px;margin-bottom:12px;filter:drop-shadow(0 0 15px rgba(255,255,255,0.4));">${friend.avatar}</div>`;
            cHtml += `<h2 style="color:#FFF;margin:0 0 5px;font-size:26px;letter-spacing:3px;font-weight:950;text-transform:uppercase;">${friend.name.toUpperCase()}</h2>`;
            cHtml += `<p style="color:#39FF14;font-size:13px;margin:0 0 20px;letter-spacing:2px;font-weight:950;text-transform:uppercase;">CHALLENGE ACCEPTED!</p>`;

            // Match type badge
            cHtml += `<div style="display:inline-block;background:${isBet ? 'linear-gradient(135deg,#FFD700,#FF8C00)' : 'linear-gradient(135deg,#39FF14,#008000)'};color:#000;font-size:12px;padding:6px 20px;border-radius:30px;font-weight:950;margin-bottom:25px;letter-spacing:1px;box-shadow:0 4px 15px rgba(0,0,0,0.3);">${typeLabel}</div>`;

            if (isBet) {
                cHtml += `<div style="background:rgba(0,0,0,0.6);border:1px solid ${borderColor}40;border-radius:16px;padding:15px;margin-bottom:25px;box-shadow:inset 0 0 20px rgba(0,0,0,0.5);">`;
                cHtml += `<div style="color:#39FF14;font-size:14px;font-weight:950;letter-spacing:1px;text-transform:uppercase;">🏆 POT VALUE: $${betAmount}</div>`;
                cHtml += `</div>`;
            }

            // Mode display
            cHtml += `<div style="background:rgba(255,255,255,0.02);border:1px solid ${mColor}80;border-radius:16px;padding:20px;margin-bottom:25px;box-shadow:0 0 30px ${mColor}20;position:relative;">`;
            cHtml += `<div style="color:#888;font-size:10px;letter-spacing:3px;margin-bottom:6px;font-weight:950;text-transform:uppercase;">GAME MODE</div>`;
            cHtml += `<div style="font-size:32px;margin-bottom:4px;">${mIcon}</div>`;
            cHtml += `<div style="color:${mColor};font-size:20px;font-weight:950;letter-spacing:4px;text-transform:uppercase;text-shadow:0 0 10px ${mColor}80;">${selMode}</div>`;
            cHtml += `</div>`;

            // Player vs Player
            cHtml += `<div style="display:flex;justify-content:center;align-items:center;gap:25px;margin-bottom:30px;">`;
            cHtml += `<div style="text-align:center;"><div style="font-size:36px;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5));">👤</div><div style="color:#FFF;font-size:12px;font-weight:950;margin-top:8px;letter-spacing:1px;">YOU</div></div>`;
            cHtml += `<div style="color:${mColor};font-size:28px;font-weight:950;text-shadow:0 0 15px ${mColor};animation:ping 1.5s infinite;">⚔️</div>`;
            cHtml += `<div style="text-align:center;"><div style="font-size:36px;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5));">${friend.avatar}</div><div style="color:#FFF;font-size:12px;font-weight:950;margin-top:8px;letter-spacing:1px;">${friend.name.toUpperCase()}</div></div>`;
            cHtml += `</div>`;

            // PLAY and REJECT buttons
            cHtml += `<div style="display:flex;gap:15px;justify-content:center;">`;
            cHtml += `<button id="mp-1v1-confirm-play" class="shimmer-effect neon-glow-green" style="flex:1;padding:16px;background:linear-gradient(135deg,#39FF14,#008000);color:#000;border:none;border-radius:12px;font-weight:950;font-size:16px;cursor:pointer;letter-spacing:2px;transition:0.3s;text-transform:uppercase;">ENTER ARENA</button>`;
            cHtml += `<button id="mp-1v1-confirm-reject" class="shimmer-effect" style="flex:1;padding:16px;background:rgba(255,51,51,0.2);color:#FF3333;border:2px solid #FF3333;border-radius:12px;font-weight:950;font-size:16px;cursor:pointer;letter-spacing:2px;transition:0.3s;text-transform:uppercase;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF'" onmouseout="this.style.background='rgba(255,51,51,0.2)';this.style.color='#FF3333'">DECLINE</button>`;
            cHtml += `</div></div>`;

            confirmModal.innerHTML = cHtml;
            document.body.appendChild(confirmModal);


            document.getElementById('mp-1v1-confirm-play').addEventListener('click', () => {
                confirmModal.remove();
                // Set the bet for the match
                window.currentBet = isBet ? betAmount : 0;
                window.mp1v1BetAmount = isBet ? betAmount : 0;
                window.startMultiplayerMatch(friend.name);
            });

            document.getElementById('mp-1v1-confirm-reject').addEventListener('click', () => {
                confirmModal.remove();
                window.playSound('foul');
                // Refund bet if it was a bet match
                if (isBet) {
                    playerMoney += halfAmt;
                    localStorage.setItem('playerMoney', playerMoney);
                    updateTopBar();
                }
                let notif = document.createElement('div');
                notif.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:2px solid #FF3333;border-radius:8px;padding:12px 25px;z-index:9999;box-shadow:0 0 15px rgba(255,50,50,0.3);text-align:center;`;
                notif.innerHTML = `<div style="color:#FF3333;font-weight:bold;font-size:12px;">Match with ${friend.name} cancelled${isBet ? ' — $' + halfAmt + ' refunded' : ''}</div>`;
                document.body.appendChild(notif);
                setTimeout(() => { notif.remove(); }, 2500);
            });
        } else {
            // Friend declined
            window.playSound('foul');
            waitModal.remove();

            // Refund bet if it was a bet match
            if (isBet) {
                playerMoney += halfAmt;
                localStorage.setItem('playerMoney', playerMoney);
                updateTopBar();
            }

            let notif = document.createElement('div');
            notif.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:2px solid #FF3333;border-radius:8px;padding:15px 30px;z-index:9999;box-shadow:0 0 20px rgba(255,50,50,0.3);text-align:center;animation:badgeSlideUp 0.3s ease-out;`;
            notif.innerHTML = `<div style="color:#FF3333;font-weight:bold;font-size:13px;">${friend.avatar} ${friend.name} is busy right now</div><div style="color:#888;font-size:11px;margin-top:5px;">${isBet ? 'Your $' + halfAmt + ' has been refunded' : 'Try again later!'}</div>`;
            document.body.appendChild(notif);
            setTimeout(() => { notif.remove(); }, 3000);
        }
    }, 2000 + Math.random() * 1500);
};

// ---- CANCEL 1v1 CHALLENGE (refund bet) ----
window.cancel1v1Challenge = function (refundAmount) {
    if (window.mpLobbyTimerId) { clearTimeout(window.mpLobbyTimerId); window.mpLobbyTimerId = null; }
    let m = document.getElementById('mp-1v1-wait-modal');
    if (m) m.remove();
    window.playSound('beep');

    // Refund if bet match was cancelled
    if (refundAmount > 0) {
        playerMoney += refundAmount;
        localStorage.setItem('playerMoney', playerMoney);
        updateTopBar();

        let notif = document.createElement('div');
        notif.style.cssText = `position:fixed;top:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border:2px solid #39FF14;border-radius:12px;padding:15px 30px;z-index:99999;box-shadow:0 0 30px rgba(57,255,20,0.4);text-align:center;animation:badgeSlideUp 0.3s ease-out;font-family:'Outfit',sans-serif;`;
        notif.innerHTML = `<div style="color:#FFF;font-weight:950;font-size:14px;letter-spacing:1px;text-transform:uppercase;">CHALLENGE ABORTED</div><div style="color:#39FF14;font-size:12px;margin-top:4px;font-weight:900;">$${refundAmount} CREDITED TO WALLET</div>`;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transform = 'translateX(-50%) translateY(-20px)';
            notif.style.transition = '0.4s';
            setTimeout(() => notif.remove(), 400);
        }, 3000);
    }
};


// ---- 1v1 RANDOM MATCH ----
window.random1v1Match = function () {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    window.playSound('beep');

    let chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    window.mpRoomCode = '';
    for (let i = 0; i < 5; i++) window.mpRoomCode += chars[Math.floor(Math.random() * chars.length)];

    let modal = document.createElement('div'); modal.id = 'mp-lobby-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #FF4500;border-radius:24px;padding:40px;text-align:center;max-width:480px;width:90%;box-shadow:0 0 60px rgba(255,69,0,0.4);animation:badgeSlideUp 0.4s ease-out;position:relative;overflow:hidden;">`;

    // Background flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% 120%, rgba(255,69,0,0.25) 0%, transparent 60%); pointer-events:none;"></div>`;

    html += `<div style="font-size:55px;margin-bottom:12px;filter:drop-shadow(0 0 15px #FF4500);"><span style="display:inline-block;animation:pulse 1s infinite;">🎲</span></div>`;
    html += `<h2 style="color:#FFF;margin:0 0 5px;font-size:24px;letter-spacing:3px;font-weight:950;text-transform:uppercase;">FINDING MATCH</h2>`;
    html += `<div style="display:inline-block;background:linear-gradient(135deg,#FF4500,#FF8C00);color:#000;font-size:12px;padding:6px 20px;border-radius:30px;font-weight:950;margin-bottom:25px;letter-spacing:1px;box-shadow:0 4px 15px rgba(255,69,0,0.3);">1 vs 1 • QUICK MATCH</div>`;

    html += `<div style="background:rgba(0,0,0,0.5);border:1px solid #334;border-radius:12px;padding:12px 25px;margin-bottom:25px;display:inline-block;box-shadow:inset 0 0 10px rgba(0,0,0,0.5);"><span style="color:#888;font-size:11px;letter-spacing:2px;font-weight:900;">MODE:</span> <span style="color:#FFD700;font-weight:950;font-size:16px;letter-spacing:1px;">${window.mpSelectedMode.toUpperCase()}</span></div>`;

    html += `<div style="color:#FFF;font-size:15px;margin-bottom:25px;font-weight:900;letter-spacing:1px;">👤 ${playerName.toUpperCase()} <span style="color:#39FF14;margin-left:8px;text-shadow:0 0 8px rgba(57,255,20,0.5);">● READY</span></div>`;

    // Loading bar
    html += `<div style="margin:0 auto 30px;width:70%;height:4px;background:rgba(255,255,255,0.05);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);"><div style="height:100%;background:linear-gradient(90deg,#FF4500,#FFD700);box-shadow:0 0 10px #FF4500;animation:loaderFill 3.5s linear forwards;"></div></div>`;

    html += `<div id="mp-lobby-waiting" style="color:#FFD700;font-size:15px;margin-bottom:30px;font-weight:950;letter-spacing:1px;text-transform:uppercase;"><span style="display:inline-block;animation:ping 1s infinite;vertical-align:middle;margin-right:8px;">📡</span> Initializing Link...</div>`;
    html += `<button id="mp-lobby-cancel" onclick="window.cancelMultiplayerLobby()" class="shimmer-effect" style="background:rgba(255,51,51,0.2);color:#FF3333;border:2px solid #FF3333;padding:15px 40px;font-weight:950;border-radius:12px;cursor:pointer;font-size:14px;text-transform:uppercase;letter-spacing:2px;transition:0.2s;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF'" onmouseout="this.style.background='rgba(255,51,51,0.2)';this.style.color='#FF3333'">ABORT</button>`;
    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Simulate finding a random player after 2.5-4 seconds
    let joinDelay = 2500 + Math.random() * 1500;
    window.mpLobbyTimerId = setTimeout(() => {
        let waitEl = document.getElementById('mp-lobby-waiting');
        let cancelBtn = document.getElementById('mp-lobby-cancel');
        if (!waitEl) return;

        let opponents = ['STRIKER_KING', 'CARROM_PRO99', 'BOARD_MASTER', 'NEON_STRIKER', 'xX_LEGEND_Xx', 'PRO_PLAYER42', 'POCKET_SNIPER', 'NEON_GOD'];
        let oppName = opponents[Math.floor(Math.random() * opponents.length)];
        let oppAvatars = ['🥷', '🤖', '👑', '👽', '🐯', '🦅', '😎', '🎯'];
        let oppAvatar = oppAvatars[Math.floor(Math.random() * oppAvatars.length)];

        window.playSound('claim');
        waitEl.innerHTML = `<span style="color:#39FF14;font-weight:950;text-shadow:0 0 10px rgba(57,255,20,0.4);border:1px solid #39FF14;padding:8px 20px;border-radius:20px;background:rgba(57,255,20,0.1);">✅ ENEMY SPOTTED: ${oppName}</span>`;
        if (cancelBtn) {
            cancelBtn.textContent = 'DEPLOYING...';
            cancelBtn.disabled = true;
            cancelBtn.style.background = 'rgba(255,255,255,0.05)';
            cancelBtn.style.color = 'rgba(255,255,255,0.2)';
            cancelBtn.style.borderColor = 'rgba(255,255,255,0.1)';
        }

        setTimeout(() => {
            let m = document.getElementById('mp-lobby-modal');
            if (m) m.remove();
            window.startMultiplayerMatch(oppName);
        }, 1500);
    }, joinDelay);
};

// ---- 2v2 ROOM LOBBY (Unified) ----
window.mp2v2Slots = [
    { type: 'human', name: playerName || 'YOU', avatar: '👤', ready: true }, // Slot 0 - You
    null, // Slot 1 - Teammate
    null, // Slot 2 - Opponent 1
    null  // Slot 3 - Opponent 2
];
window.mp2v2OpponentType = 'random'; // 'random', 'friend', 'code'
window.mpRoomCode = '';

window.createRoom2v2 = function () {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    window.playSound('beep');

    // Choose mode
    window.show2v2OpponentTypeChoice();
};

window.show2v2OpponentTypeChoice = function () {
    let modal = document.createElement('div'); modal.id = 'mp-2v2-choice-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #1E90FF;border-radius:24px;padding:40px;text-align:center;max-width:520px;width:95%;box-shadow:0 0 60px rgba(30,144,255,0.4);animation:badgeSlideUp 0.4s ease-out;position:relative;overflow:hidden;">`;

    // Flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% -20%, rgba(30,144,255,0.25) 0%, transparent 60%); pointer-events:none;"></div>`;

    html += `<div style="font-size:55px;margin-bottom:12px;filter:drop-shadow(0 0 15px #1E90FF);">👥⚔️👥</div>`;
    html += `<h2 style="color:#FFF;margin:0 0 5px;font-size:26px;letter-spacing:4px;font-weight:950;text-transform:uppercase;">DUO ARENA</h2>`;
    html += `<p style="color:#87CEFA;font-size:13px;margin:0 0 30px;letter-spacing:2px;font-weight:950;text-transform:uppercase;opacity:0.8;">SELECT 2v2 MATCHMAKING</p>`;

    // Decorative line
    html += `<div style="width:70%;height:2px;background:linear-gradient(90deg,transparent,#1E90FF,transparent);margin:0 auto 30px;"></div>`;

    // Three choice cards
    html += `<div style="display:flex;gap:15px;justify-content:center;margin-bottom:30px;">`;

    // Friend Card
    html += `<button id="mp-2v2-invite" class="shimmer-effect neon-glow-purple" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #8A2BE2;border-radius:18px;padding:30px 10px;cursor:pointer;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.boxShadow='0 10px 30px rgba(138,43,226,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">`;
    html += `<div style="font-size:36px;margin-bottom:12px;">👥</div>`;
    html += `<div style="color:#FFF;font-size:14px;font-weight:950;letter-spacing:1px;margin-bottom:8px;line-height:1.2;">PRIVATE<br>SQUAD</div>`;
    html += `<div style="color:#D8BFD8;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;opacity:0.7;">WITH FRIENDS</div>`;
    html += `</button>`;


    // Random Player Card
    html += `<button id="mp-2v2-random" class="shimmer-effect neon-glow-green" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #39FF14;border-radius:18px;padding:30px 10px;cursor:pointer;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.boxShadow='0 10px 30px rgba(57,255,20,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">`;
    html += `<div style="font-size:36px;margin-bottom:12px;">🎲</div>`;
    html += `<div style="color:#FFF;font-size:14px;font-weight:950;letter-spacing:1px;margin-bottom:8px;line-height:1.2;">QUICK<br>MATCH</div>`;
    html += `<div style="color:#7ABF7A;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;opacity:0.7;">RANDOM TEAMS</div>`;
    html += `</button>`;

    // Generate Code Card
    html += `<button id="mp-2v2-code" class="shimmer-effect neon-glow-blue" style="flex:1;background:rgba(0,0,0,0.4);border:2px solid #1E90FF;border-radius:18px;padding:30px 10px;cursor:pointer;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);position:relative;overflow:hidden;" onmouseover="this.style.transform='scale(1.08) translateY(-5px)';this.style.boxShadow='0 10px 30px rgba(30,144,255,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">`;
    html += `<div style="font-size:36px;margin-bottom:12px;">🔑</div>`;
    html += `<div style="color:#FFF;font-size:14px;font-weight:950;letter-spacing:1px;margin-bottom:8px;line-height:1.2;">PRIVATE<br>ARENA</div>`;
    html += `<div style="color:#87CEFA;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;opacity:0.7;">HOST MATCH</div>`;
    html += `</button>`;

    html += `</div>`;

    // Mode display
    html += `<div style="background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 25px;margin-bottom:25px;display:inline-block;box-shadow:inset 0 0 10px rgba(0,0,0,0.5);"><span style="color:#888;font-size:11px;letter-spacing:2px;font-weight:900;">MODE:</span> <span style="color:#FFD700;font-weight:950;font-size:16px;letter-spacing:1px;">${window.mpSelectedMode.toUpperCase()}</span></div>`;

    // Cancel button
    html += `<div><button onclick="let m=document.getElementById('mp-2v2-choice-modal');if(m)m.remove();window.playSound('beep');" class="shimmer-effect" style="background:transparent;color:#888;border:1px solid #444;padding:12px 40px;font-weight:900;border-radius:12px;cursor:pointer;font-size:14px;transition:all 0.2s;letter-spacing:2px;text-transform:uppercase;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF';this.style.borderColor='#FF3333'" onmouseout="this.style.background='transparent';this.style.color='#888';this.style.borderColor='#444'">BACK</button></div>`;
    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    document.getElementById('mp-2v2-invite').addEventListener('click', () => { modal.remove(); window.init2v2Lobby('friend'); });
    document.getElementById('mp-2v2-random').addEventListener('click', () => { modal.remove(); window.init2v2Lobby('random'); });
    document.getElementById('mp-2v2-code').addEventListener('click', () => { modal.remove(); window.init2v2Lobby('code'); });
};


window.init2v2Lobby = function (type) {
    window.mp2v2OpponentType = type;

    // Auto generate Room ID
    let roomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    window.mpRoomCode = '';
    for (let i = 0; i < 6; i++) window.mpRoomCode += roomChars[Math.floor(Math.random() * roomChars.length)];

    // Auto generate Password if not random
    window.mpRoomPass = '';
    if (type !== 'random') {
        let passChars = '0123456789';
        for (let i = 0; i < 4; i++) window.mpRoomPass += passChars[Math.floor(Math.random() * passChars.length)];
    }

    // Reset slots
    window.mp2v2Slots = [
        { type: 'human', name: playerName || 'YOU', avatar: '👤', ready: true }, // Slot 0
        null, // Slot 1 - Teammate
        null, // Slot 2 - Opponent 1
        null  // Slot 3 - Opponent 2
    ];

    window.render2v2Lobby();
};

window.render2v2Lobby = function () {
    let modal = document.getElementById('mp-lobby-modal') || document.createElement('div');
    modal.id = 'mp-lobby-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Outfit', 'Segoe UI', sans-serif;overflow:hidden;`;

    // The main lobby container
    let html = `<div id="lobby-container" class="lobby-glass lobby-float" style="width: 100%; height: 100%; max-width: 550px; max-height: 850px; border-radius: 24px; display: flex; flex-direction: column; position: relative; overflow: hidden; border: 2px solid rgba(255,215,0,0.3) !important;">`;

    // Animated Background Noise/Overlay
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% 50%, rgba(138,43,226,0.15) 0%, transparent 70%); pointer-events:none; z-index:0;"></div>`;
    html += `<div class="intro-scanlines" style="opacity: 0.1;"></div>`;

    // Exit Button
    html += `<button onclick="window.cancelMultiplayerLobby()" class="shimmer-effect" style="position:absolute; top:20px; left:20px; background:rgba(255,50,50,0.2); color:#FFF; border:2px solid #FF3333; width:40px; height:40px; border-radius:12px; font-size:20px; cursor:pointer; z-index:10; font-weight:bold; display:flex; justify-content:center; align-items:center; transition:0.2s;" onmouseover="this.style.background='#FF3333'" onmouseout="this.style.background='rgba(255,50,50,0.2)'">✕</button>`;

    // Room Info at Top
    html += `<div style="padding: 30px 20px 0; text-align: center; position:relative; z-index:1;">`;
    html += `<div style="display:inline-block; background:rgba(0,0,0,0.4); padding:5px 20px; border-radius:30px; border:1px solid rgba(255,215,0,0.5); box-shadow: 0 0 15px rgba(255,215,0,0.2);">`;
    html += `<span style="color: #FFD700; font-size: 14px; font-weight: 900; letter-spacing: 3px;">ROOM ID: ${window.mpRoomCode}</span>`;
    html += `</div>`;
    if (window.mp2v2OpponentType !== 'random' && window.mpRoomPass) {
        html += `<div style="color: #FF5555; font-size: 12px; font-weight: bold; margin-top: 8px; letter-spacing:1px;">PASSCODE: <span style="background:#FF5555; color:#000; padding:2px 8px; border-radius:4px;">${window.mpRoomPass}</span></div>`;
    }
    html += `</div>`;

    // Main Content Area (3 columns)
    html += `<div style="flex: 1; display: flex; justify-content: center; align-items: center; padding: 20px; position:relative; z-index:1;">`;

    // Reusable Slot Renderer
    const renderSlot = (slotObj, isOpponent, title, index) => {
        let accentColor = isOpponent ? '#00FFFF' : '#39FF14';
        let glowClass = isOpponent ? 'neon-glow-blue' : 'neon-glow-green';
        let entranceAnim = isOpponent ? 'teamEntranceRight' : 'teamEntranceLeft';

        // Slot Container
        let sHtml = `<div class="player-card-2v2" style="display: flex; flex-direction: column; align-items: center; width: 130px; animation: ${entranceAnim} 0.5s ease-out both;">`;

        // Slot Title
        sHtml += `<div style="color: ${accentColor}; font-size: 10px; font-weight: 900; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px ${accentColor}40;">${title}</div>`;

        // Profile Card
        sHtml += `<div class="shimmer-effect ${glowClass}" style="width: 120px; height: 120px; background: rgba(0,0,0,0.5); border: 2px solid ${accentColor}; border-radius: 20px; padding: 8px; box-sizing: border-box; position: relative;">`;

        if (slotObj) {
            // Avatar Inner
            sHtml += `<div style="width: 100%; height: 100%; background: linear-gradient(180deg, ${accentColor}20 0%, ${accentColor}40 100%); border-radius: 14px; overflow: hidden; display: flex; justify-content: center; align-items: center; position: relative;">`;
            if (slotObj.avatar) {
                sHtml += `<span style="font-size: 60px; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));">${slotObj.avatar}</span>`;
            } else {
                sHtml += `<span style="font-size: 60px; color: rgba(255,255,255,0.1);">?</span>`;
            }

            // Status Badge
            let statusClass = slotObj.ready ? 'status-ready' : 'status-waiting';
            let statusText = slotObj.ready ? 'READY' : 'WAITING';
            sHtml += `<div class="status-badge ${statusClass}" style="position:absolute; bottom:-5px; left:50%; transform:translateX(-50%); white-space:nowrap;">${statusText}</div>`;

            sHtml += `</div>`; // End Avatar Inner
        } else {
            // Empty Slot (+)
            let onClick = (index === 1) ? `onclick="window.show2v2InviteFriends(${index})"` : '';
            sHtml += `<div ${onClick} style="width: 100%; height: 100%; background: rgba(255,255,255,0.05); border: 2px dashed ${accentColor}60; border-radius: 14px; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: 0.3s;" onmouseover="this.style.background='${accentColor}10';this.style.borderColor='${accentColor}'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='${accentColor}60'">`;
            sHtml += `<span style="color: ${accentColor}; font-size: 44px; font-weight: bold; opacity:0.6;">+</span>`;
            sHtml += `</div>`;
        }

        sHtml += `</div>`; // End Profile Card

        // Name
        let nameText = slotObj ? slotObj.name : (index === 1 ? 'INVITE FRIEND' : 'OPEN SLOT');
        let nameColor = slotObj ? '#FFF' : 'rgba(255,255,255,0.4)';
        sHtml += `<div style="color: ${nameColor}; font-size: 14px; font-weight: 900; margin-top: 15px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center; letter-spacing:0.5px;">${nameText.toUpperCase()}</div>`;

        sHtml += `</div>`;
        return sHtml;
    };

    // Column 1: YOUR TEAM
    html += `<div style="display: flex; flex-direction: column; gap: 40px; align-items: center;">`;
    // Teammate slot (Top)
    html += renderSlot(window.mp2v2Slots[1], false, 'PARTNER', 1);

    // Middle Buttons
    html += `<div style="display: flex; flex-direction: column; gap: 10px; margin: 10px 0;">`;
    // Invite Button
    html += `<button onclick="window.show2v2InviteFriends(1)" class="shimmer-effect" style="background: linear-gradient(180deg, #39FF14 0%, #008000 100%); border: none; border-radius: 10px; padding: 10px 35px; color: #000; font-weight: 950; font-size: 13px; cursor: pointer; box-shadow: 0 4px 15px rgba(57,255,20,0.3); text-transform:uppercase; letter-spacing:1px; transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">INVITE</button>`;
    // Share Button
    html += `<button onclick="window.shareRoomCode()" class="shimmer-effect" style="background: linear-gradient(180deg, #FFD700 0%, #B8860B 100%); border: none; border-radius: 10px; padding: 10px 35px; color: #000; font-weight: 950; font-size: 13px; cursor: pointer; box-shadow: 0 4px 15px rgba(255,215,0,0.3); text-transform:uppercase; letter-spacing:1px; display: flex; align-items: center; justify-content: center; gap: 6px; transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">SHARE 🔗</button>`;
    html += `</div>`;

    // Your slot (Bottom)
    html += renderSlot(window.mp2v2Slots[0], false, 'YOU', 0);
    html += `</div>`;

    // Column 2: VS
    html += `<div style="margin: 0 40px; position:relative;">`;
    html += `<div class="vs-logo-anim" style="font-size: 70px; font-weight: 950; font-style: italic; background: linear-gradient(180deg, #FFF 0%, #FFD700 40%, #B8860B 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.5)); transform: skewX(-5deg);">VS</div>`;
    // Decorative Pulse Ring
    html += `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:120px; height:120px; border:2px solid rgba(255,215,0,0.2); border-radius:50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`;
    html += `</div>`;

    // Column 3: OPPONENT TEAM
    html += `<div style="display: flex; flex-direction: column; gap: 70px; align-items: center;">`;
    html += renderSlot(window.mp2v2Slots[2], true, 'OPPONENT 1', 2);
    html += renderSlot(window.mp2v2Slots[3], true, 'OPPONENT 2', 3);
    html += `</div>`;

    html += `</div>`; // End Main Content Area

    // Bottom Action Bar
    let allReady = window.mp2v2Slots.every(s => s !== null && s.ready);
    html += `<div style="padding: 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); position:relative; z-index:1;">`;
    if (allReady) {
        html += `<button id="mp-lobby-launch" class="shimmer-effect" style="background: linear-gradient(180deg, #39FF14 0%, #008000 100%); color: #000; border: none; padding: 18px 80px; font-weight: 950; border-radius: 16px; cursor: pointer; font-size: 20px; box-shadow: 0 8px 30px rgba(57, 255, 20, 0.5); text-transform: uppercase; letter-spacing: 4px; transition: 0.3s;" onclick="window.launch2v2Match()" onmouseover="this.style.transform='scale(1.05) translateY(-2px)';this.style.boxShadow='0 12px 40px rgba(57, 255, 20, 0.7)'" onmouseout="this.style.transform='scale(1) translateY(0)';this.style.boxShadow='0 8px 30px rgba(57, 255, 20, 0.5)'">START BATTLE</button>`;
    } else {
        html += `<div style="display:inline-block; position:relative;">`;
        html += `<button disabled style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.1); padding: 18px 80px; font-weight: 950; border-radius: 16px; cursor: not-allowed; font-size: 20px; text-transform: uppercase; letter-spacing: 4px;">WAITING...</button>`;
        html += `<div style="margin-top:10px; color:rgba(255,255,255,0.4); font-size:11px; letter-spacing:1px; font-weight:bold;">PENDING PLAYER READINESS</div>`;
        html += `</div>`;
    }
    html += `</div>`;

    html += `</div>`; // End Lobby Container

    modal.innerHTML = html;
    if (!document.getElementById('mp-lobby-modal')) document.body.appendChild(modal);

    // AI simulation logic
    if (!allReady && window.mp2v2OpponentType === 'random') {
        clearTimeout(window.mpLobbySimTimerId);
        window.mpLobbySimTimerId = setTimeout(() => {
            let emptyIdx = window.mp2v2Slots.findIndex((s, i) => s === null && i >= 1);
            if (emptyIdx !== -1) {
                let oppNames = ['STRIKER_KING', 'CARROM_PRO99', 'BOARD_MASTER', 'NEON_STRIKER', 'xX_LEGEND_Xx', 'PRO_PLAYER42', 'SHADOW_SHOT', 'POCKET_SNIPER'];
                let oppAvatars = ['🥷', '🤖', '👑', '👽', '🐯', '🦅', '😎', '🎯'];
                window.mp2v2Slots[emptyIdx] = { type: 'human', name: oppNames[Math.floor(Math.random() * oppNames.length)], avatar: oppAvatars[Math.floor(Math.random() * oppAvatars.length)], ready: true };
                window.playSound('claim');
                window.render2v2Lobby();
            }
        }, 1200 + Math.random() * 1000);
    }
};

window.shareRoomCode = function () {
    window.playSound('beep');
    let text = `Join my 2v2 Carrom match! Room Code: ${window.mpRoomCode}`;
    if (window.mpRoomPass) text += ` Password: ${window.mpRoomPass}`;

    if (navigator.share) {
        navigator.share({
            title: 'Carrom 2v2 Match',
            text: text,
            url: window.location.href
        }).catch(err => console.log('Share failed', err));
    } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(text);
        let notif = document.createElement('div');
        notif.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:2px solid #FFD700;border-radius:8px;padding:12px 25px;z-index:10001;box-shadow:0 0 20px rgba(255,215,0,0.3);text-align:center;color:#FFD700;font-weight:bold;`;
        notif.textContent = 'Room Info Copied to Clipboard!';
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);
    }
};

window.show2v2InviteFriends = function (slotIndex) {
    let modal = document.createElement('div'); modal.id = 'mp-2v2-friend-modal';
    modal.dataset.slotIndex = slotIndex; // Store for refresh logic
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10000;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #8A2BE2;border-radius:24px;padding:35px;width:420px;text-align:center;box-shadow:0 0 60px rgba(138,43,226,0.4);max-height:85vh;display:flex;flex-direction:column;position:relative;overflow:hidden;">`;

    // Background flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% 10%, rgba(138,43,226,0.2) 0%, transparent 60%); pointer-events:none;"></div>`;

    html += `<div style="font-size:42px;margin-bottom:12px;filter:drop-shadow(0 0 10px #8A2BE2);">👥</div>`;
    html += `<div style="display:flex; justify-content:center; align-items:center; position:relative; margin-bottom:15px; width:100%;">`;
    html += `<h3 style="color:#FFF;margin:0;font-size:24px;font-weight:950;letter-spacing:3px;text-transform:uppercase;">RECRUIT TEAM</h3>`;
    html += `<button onclick="window.refreshRecruits()" class="shimmer-effect" style="position:absolute; right:0; background:#4285F4; border:none; color:#FFF; border-radius:6px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.3s; z-index:10; box-shadow:0 0 15px rgba(66,133,244,0.3); font-size:18px;" onmouseover="this.style.transform='scale(1.1)';" onmouseout="this.style.transform='scale(1)';">🔄</button>`;
    html += `</div>`;
    html += `<p style="color:#D8BFD8;font-size:12px;margin-bottom:25px;font-weight:bold;letter-spacing:1px;opacity:0.8;">ENLIST YOUR ALLIES</p>`;

    if (window.mpFriends.length === 0) {
        html += `<div style="color:#888;padding:40px;font-size:14px;background:rgba(255,255,255,0.03);border-radius:16px;border:1px solid rgba(255,255,255,0.1);font-weight:bold;letter-spacing:0.5px;">NO RECRUITS AVAILABLE</div>`;
    } else {
        html += `<div style="overflow-y:auto;flex:1;margin-bottom:25px;padding-right:5px;">`;
        window.mpFriends.forEach((friend, i) => {
            html += `<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.03);padding:15px;border-radius:16px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.1);transition:0.3s;" onmouseover="this.style.background='rgba(138,43,226,0.1)';this.style.borderColor='#8A2BE2';this.style.transform='scale(1.02)'" onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.1)';this.style.transform='scale(1)'">`;
            html += `<div style="display:flex;align-items:center;"><span style="font-size:28px;margin-right:15px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${friend.avatar}</span><span style="color:#FFF;font-size:15px;font-weight:950;letter-spacing:1px;">${friend.name.toUpperCase()}</span></div>`;
            html += `<button onclick="window.invite2v2Friend(${i}, ${slotIndex})" class="shimmer-effect" style="background:linear-gradient(135deg,#8A2BE2,#FF1493);color:#FFF;border:none;padding:10px 18px;border-radius:10px;font-weight:950;font-size:20px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;box-shadow:0 4px 10px rgba(138,43,226,0.3);line-height:1;">+</button>`;
            html += `</div>`;
        });
        html += `</div>`;
    }

    html += `<button onclick="document.getElementById('mp-2v2-friend-modal').remove()" class="shimmer-effect" style="background:transparent;color:#888;border:1px solid #444;padding:13px 40px;font-weight:950;border-radius:12px;cursor:pointer;font-size:14px;transition:all 0.2s;letter-spacing:2px;text-transform:uppercase;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF';this.style.borderColor='#FF3333'" onmouseout="this.style.background='transparent';this.style.color='#888';this.style.borderColor='#444'">EXIT</button>`;
    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
};


window.invite2v2Friend = function (friendIndex, slotIndex) {
    let friend = window.mpFriends[friendIndex];
    if (!friend) return;

    let modal = document.getElementById('mp-2v2-friend-modal');
    if (modal) modal.remove();

    window.playSound('beep');

    let notif = document.createElement('div');
    notif.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a0a2e;border:2px solid #FFD700;border-radius:8px;padding:12px 25px;z-index:10001;box-shadow:0 0 20px rgba(255,215,0,0.3);text-align:center;animation:badgeSlideUp 0.3s ease-out;`;
    notif.innerHTML = `<div style="color:#FFD700;font-weight:bold;font-size:13px;">Inviting ${friend.name}... <span style="animation:pulse 1s infinite;display:inline-block;">⏳</span></div>`;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.remove();
        if (Math.random() < 0.95) {
            window.mp2v2Slots[slotIndex] = { type: 'human', name: friend.name, avatar: friend.avatar, ready: true };
            window.playSound('claim');
            window.render2v2Lobby();
        } else {
            let err = document.createElement('div');
            err.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a0a2e;border:2px solid #FF3333;border-radius:8px;padding:12px 25px;z-index:10001;box-shadow:0 0 20px rgba(255,51,51,0.3);text-align:center;animation:badgeSlideUp 0.3s ease-out;`;
            err.innerHTML = `<div style="color:#FF3333;font-weight:bold;font-size:13px;">${friend.name} is busy! ❌</div>`;
            document.body.appendChild(err);
            setTimeout(() => err.remove(), 2000);
        }
    }, 1500 + Math.random() * 1000);
};

window.cancelMultiplayerLobby = function () {
    let m = document.getElementById('mp-lobby-modal');
    if (m) m.remove();
    clearTimeout(window.mpLobbyTimerId);
    clearTimeout(window.mpLobbySimTimerId);
    window.is2v2 = false;
    window.is1v1MP = false;
    window.roomIdMP = null;
    window.mpRoomId = null;
    window.playSound('beep');
};

window.launch2v2Match = function () {
    // Start game matching exactly old signature mapping
    window.start2v2Match(window.mp2v2Slots[1], window.mp2v2Slots[2], window.mp2v2Slots[3]);
};

// ---- 2v2 IN-ROOM COUNTDOWN & MATCH START ----
window.start2v2Match = function (teammate, opp1, opp2) {
    let selMode = window.mpSelectedMode || 'CLASSIC';
    let modeColors = { 'CLASSIC': '#FFD700', 'FREESTYLE': '#00FFFF', 'DISC POOL': '#FF1493', 'ZOMBIE': '#8B0000', 'INFECTION': '#39FF14', 'GUN GAME': '#FF4500' };
    let modeIcons = { 'CLASSIC': '🎯', 'FREESTYLE': '🎨', 'DISC POOL': '🎱', 'ZOMBIE': '🧟', 'INFECTION': '☣️', 'GUN GAME': '🔫' };
    let mColor = modeColors[selMode] || '#FFD700';
    let mIcon = modeIcons[selMode] || '🎯';

    // Use the unified in-room countdown system
    window.runInRoomLobbyTransition('lobby-container', selMode, () => {
        // Transition to board after countdown completes
        let lobbyModal = document.getElementById('mp-lobby-modal');
        if (lobbyModal) {
            lobbyModal.style.transition = 'opacity 0.4s cubic-bezier(0.8, 0, 0.2, 1), transform 0.4s';
            lobbyModal.style.opacity = '0';
            lobbyModal.style.transform = 'scale(1.2)';
            setTimeout(() => lobbyModal.remove(), 400);
        }

        // Cinematic flash effect
        let flash = document.createElement('div');
        flash.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:#FFF;z-index:20000;opacity:0;transition:opacity 0.3s ease-in;pointer-events:none;`;
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '1'; }, 10);

        setTimeout(() => {
            flash.style.transition = 'opacity 0.8s cubic-bezier(0.1, 0.9, 0.2, 1)';
            flash.style.opacity = '0';

            // Initialize game state & board
            initGame();
            window.is2v2 = true;
            window.teamPoints = { team1: 0, team2: 0 };
            gameMode = selMode;
            const aiToggle = document.getElementById('ai-toggle');
            const aiDiff = document.getElementById('ai-difficulty');
            if (aiToggle) aiToggle.checked = true;
            if (aiDiff) aiDiff.value = 'hard';
            window.currentBet = 0;
            window.mpOpponentName = opp1.name + ' & ' + opp2.name;

            // Close lobby UI and show carrom board interface
            currentShopView = 'menu';
            renderSidebarShop();

            startCountdown(); // Core in-game countdown
            currentMessage = `👥 TEAM: ${playerName || 'YOU'} & ${teammate.name} vs ${opp1.name} & ${opp2.name} • ${gameMode}`;
            messageDisplayTime = Date.now() + 4000;

            setTimeout(() => flash.remove(), 800);
        }, 600);
    });
};

window.joinMultiplayerRoom = async function () {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    let codeInput = document.getElementById('mp-join-code');
    let code = codeInput ? codeInput.value.trim().toUpperCase() : '';
    if (code.length !== 5) { await window.customAlert('Please enter a valid 5-character room code!', "JOIN ERROR"); window.playSound('foul'); return; }

    window.playSound('beep');

    // Show connecting modal
    let modal = document.createElement('div'); modal.id = 'mp-lobby-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;justify-content:center;align-items:center;z-index:9999;`;
    let html = `<div style="background:linear-gradient(135deg,#0a1628,#162840);border:2px solid #1E90FF;border-radius:12px;padding:35px 40px;text-align:center;max-width:420px;width:90%;box-shadow:0 0 40px rgba(30,144,255,0.3);">`;
    html += `<div style="font-size:40px;margin-bottom:15px;"><span style="display:inline-block;animation:pulse 1s infinite;">🔍</span></div>`;
    html += `<h2 style="color:#FFF;margin:0 0 5px;font-size:18px;">JOINING ROOM</h2>`;
    html += `<div style="color:#1E90FF;font-size:28px;font-weight:900;letter-spacing:8px;margin:10px 0 15px;font-family:monospace;">${code}</div>`;
    html += `<div id="mp-join-status" style="color:#FFD700;font-size:13px;"><span style="display:inline-block;animation:pulse 1s infinite;">⏳</span> Connecting to room...</div>`;
    html += `<button onclick="window.cancelMultiplayerLobby()" style="background:#FF3333;color:#FFF;border:none;padding:10px 25px;font-weight:bold;border-radius:6px;cursor:pointer;font-size:12px;margin-top:15px;">CANCEL</button>`;
    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Simulate connecting and joining
    window.mpLobbyTimerId = setTimeout(() => {
        let statusEl = document.getElementById('mp-join-status');
        if (!statusEl) return;
        let opponents = ['ROOM_HOST_1', 'xX_PRO_Xx', 'CARROM_CHAMP', 'BOARD_KING'];
        let oppName = opponents[Math.floor(Math.random() * opponents.length)];
        statusEl.innerHTML = `<span style="color:#39FF14;font-weight:bold;">✅ Connected! Host: ${oppName}</span>`;
        window.playSound('claim');

        setTimeout(() => {
            let m = document.getElementById('mp-lobby-modal');
            if (m) m.remove();
            window.startMultiplayerMatch(oppName);
        }, 1500);
    }, 2000 + Math.random() * 1000);
};

window.cancelMultiplayerLobby = function () {
    if (window.mpLobbyTimerId) { clearTimeout(window.mpLobbyTimerId); window.mpLobbyTimerId = null; }
    let m = document.getElementById('mp-lobby-modal');
    if (m) m.remove();
    window.playSound('beep');
};

window.inviteFriend = function (index) {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    let friend = window.mpFriends[index];
    if (!friend || friend.status !== 'online' || friend.invited) return;

    friend.invited = true;
    window.playSound('beep');
    renderSidebarShop();

    // Simulate friend accepting after 2-4 seconds
    let acceptDelay = 2000 + Math.random() * 2000;
    setTimeout(() => {
        friend.invited = false;

        // 85% chance they accept
        if (Math.random() < 0.85) {
            window.playSound('claim');

            // Get mode info for display
            let modeColors = { 'CLASSIC': '#FFD700', 'FREESTYLE': '#00FFFF', 'DISC POOL': '#FF1493', 'ZOMBIE': '#8B0000', 'INFECTION': '#39FF14', 'GUN GAME': '#FF4500' };
            let modeIcons = { 'CLASSIC': '🎯', 'FREESTYLE': '🎨', 'DISC POOL': '🎱', 'ZOMBIE': '🧟', 'INFECTION': '☣️', 'GUN GAME': '🔫' };
            let selMode = window.mpSelectedMode || 'CLASSIC';
            let mColor = modeColors[selMode] || '#FFD700';
            let mIcon = modeIcons[selMode] || '🎯';

            // Show confirmation modal with PLAY / REJECT
            let modal = document.createElement('div'); modal.id = 'mp-invite-confirm';
            modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;justify-content:center;align-items:center;z-index:9999;`;
            let html = `<div style="background:linear-gradient(135deg,#0a1628,#162840);border:2px solid #39FF14;border-radius:12px;padding:30px 40px;text-align:center;max-width:420px;width:90%;box-shadow:0 0 40px rgba(57,255,20,0.3);animation:badgeSlideUp 0.4s ease-out;">`;
            html += `<div style="font-size:50px;margin-bottom:10px;">${friend.avatar}</div>`;
            html += `<h2 style="color:#39FF14;margin:0 0 5px;font-size:20px;letter-spacing:1px;">${friend.name}</h2>`;
            html += `<p style="color:#87CEFA;font-size:13px;margin:0 0 20px;">Accepted your match request!</p>`;

            // Mode display card
            html += `<div style="background:#0a0f1a;border:2px solid ${mColor};border-radius:8px;padding:15px;margin-bottom:20px;box-shadow:0 0 15px ${mColor}30;">`;
            html += `<div style="color:#888;font-size:10px;letter-spacing:2px;margin-bottom:6px;font-weight:600;">GAME MODE</div>`;
            html += `<div style="font-size:32px;margin-bottom:4px;">${mIcon}</div>`;
            html += `<div style="color:${mColor};font-size:22px;font-weight:900;letter-spacing:3px;text-shadow:0 0 15px ${mColor}60;">${selMode}</div>`;
            html += `</div>`;

            // Player vs Player display
            html += `<div style="display:flex;justify-content:center;align-items:center;gap:15px;margin-bottom:25px;">`;
            html += `<div style="text-align:center;"><div style="font-size:24px;">👤</div><div style="color:#FFF;font-size:11px;font-weight:bold;margin-top:2px;">${playerName || 'YOU'}</div></div>`;
            html += `<div style="color:${mColor};font-size:22px;font-weight:900;text-shadow:0 0 10px ${mColor};">⚔️</div>`;
            html += `<div style="text-align:center;"><div style="font-size:24px;">${friend.avatar}</div><div style="color:#FFF;font-size:11px;font-weight:bold;margin-top:2px;">${friend.name}</div></div>`;
            html += `</div>`;

            // PLAY and REJECT buttons
            html += `<div style="display:flex;gap:12px;justify-content:center;">`;
            html += `<button id="mp-confirm-play" style="flex:1;padding:14px;background:linear-gradient(45deg,#39FF14,#228B22);color:#000;border:none;border-radius:8px;font-weight:900;font-size:16px;cursor:pointer;box-shadow:0 0 15px rgba(57,255,20,0.4);letter-spacing:1px;transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">▶ PLAY</button>`;
            html += `<button id="mp-confirm-reject" style="flex:1;padding:14px;background:linear-gradient(45deg,#FF3333,#8B0000);color:#FFF;border:none;border-radius:8px;font-weight:900;font-size:16px;cursor:pointer;box-shadow:0 0 15px rgba(255,50,50,0.3);letter-spacing:1px;transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">✕ REJECT</button>`;
            html += `</div>`;
            html += `</div>`; modal.innerHTML = html; document.body.appendChild(modal); window.playSound('claim');
            document.getElementById('mp-confirm-play').onclick = () => { modal.remove(); window.startMultiplayerMatch(friend.name, selMode); };
            document.getElementById('mp-confirm-reject').onclick = () => { modal.remove(); friend.invited = false; window.playSound('beep'); };
        } else {
            // They declined
            window.playSound('foul');
            currentMessage = `❌ ${friend.name} is busy right now.`;
            messageDisplayTime = Date.now() + 3000;
        }
    }, acceptDelay);
};

window.spectateFriend = async function (index) {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') {
        await window.customAlert("You must be in the main menu to spectate.", "SPECTATE ERROR");
        return;
    }
    let friend = window.mpFriends[index];
    if (!friend || friend.status !== 'in_match') return;

    window.playSound('beep');

    currentMessage = `📩 Asking ${friend.name} to spectate...`;
    messageDisplayTime = Date.now() + 2000;
    renderSidebarShop();

    // Simulation logic
    setTimeout(async () => {
        // "YOUR FRIEND WANT TO SPECTATE YOU"
        await window.customAlert(`MESSAGE SENT TO ${friend.name}: "YOUR FRIEND WANT TO SPECTATE YOU"`, "SPECTATE REQUEST");

        setTimeout(async () => {
            if (Math.random() < 0.95) { // 95% chance to accept
                window.playSound('claim');
                currentMessage = `✅ ${friend.name} accepted!`;
                messageDisplayTime = Date.now() + 3000;

                setTimeout(async () => {
                    await window.customAlert(`${friend.name} SAYS: "accept you to spectate"`, "SPECTATE ACCEPTED");
                    window.enterSpectateMode(friend);
                }, 800);
            } else {
                window.playSound('foul');
                currentMessage = `❌ ${friend.name} declined spectate request.`;
                messageDisplayTime = Date.now() + 3000;
            }
        }, 1500);
    }, 1000);
};

window.enterSpectateMode = function (friend) {
    window.isSpectating = true;
    window.spectatingName = friend.name;

    // Show exit button
    const exitBtn = document.getElementById('exit-spectate-btn');
    if (exitBtn) exitBtn.style.display = 'block';

    // Force AI vs AI
    const aiToggle = document.getElementById('ai-toggle');
    if (aiToggle) aiToggle.checked = true;

    if (friend.savedMatchState) {
        let state = friend.savedMatchState;
        // Restore coins (need to revive Coin objects)
        coins = state.coins.map(c => {
            let coin = new Coin(c.x, c.y, c.radius, c.type, c.color, c.mass);
            coin.vx = c.vx;
            coin.vy = c.vy;
            coin.active = c.active;
            coin.effect = c.effect;
            return coin;
        });
        p1Coins = state.p1Coins;
        p2Coins = state.p2Coins;
        p1Points = state.p1Points;
        p2Points = state.p2Points;
        currentPlayer = state.currentPlayer;
        isQueenPocketed = state.isQueenPocketed;
        queenPendingCover = state.queenPendingCover;
        playerCoveringQueen = state.playerCoveringQueen;
        gameMode = state.gameMode;

        gameState = 'PLACING';
        setupStriker();
        updateUI();
        currentMessage = `👁️ CONTINUING SPECTATING: ${friend.name}`;
    } else {
        gameMode = 'CLASSIC';
        initGame();
        startCountdown();
        currentMessage = `👁️ SPECTATING: ${friend.name}`;
    }

    messageDisplayTime = Date.now() + 4000;
};

window.exitSpectateMode = function () {
    window.playSound('beep');
    if (window.isSpectating && window.spectatingName) {
        let friend = window.mpFriends.find(f => f.name === window.spectatingName);
        if (friend) {
            friend.savedMatchState = {
                coins: JSON.parse(JSON.stringify(coins)),
                p1Coins: p1Coins,
                p2Coins: p2Coins,
                p1Points: p1Points,
                p2Points: p2Points,
                currentPlayer: currentPlayer,
                isQueenPocketed: isQueenPocketed,
                queenPendingCover: queenPendingCover,
                playerCoveringQueen: playerCoveringQueen,
                gameMode: gameMode
            };
        }
    }
    window.resetGame();
};

window.showFriendProfile = function (index) {
    let friend = window.mpFriends[index];
    if (!friend) return;
    window.playSound('reveal');

    let modal = document.createElement('div');
    modal.id = 'friend-options-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:20000;font-family:'Outfit',sans-serif;`;

    let html = `
        <div class="lobby-glass lobby-float" style="border:2px solid #00FFFF; border-radius:24px; padding:30px; width:340px; text-align:center;">
            <div style="font-size:50px; margin-bottom:10px;">${friend.avatar}</div>
            <h3 style="color:#FFF; margin-bottom:25px; font-weight:950; letter-spacing:1px; text-transform:uppercase;">${friend.name}</h3>
            
            <button onclick="window.viewPlayerStats(${index})" class="shimmer-effect" style="width:100%; background:linear-gradient(135deg,#1E90FF,#0055CC); color:#FFF; border:none; padding:14px; border-radius:12px; font-weight:950; margin-bottom:12px; cursor:pointer; font-size:12px; letter-spacing:2px; text-transform:uppercase;">1. VIEW PROFILE</button>
            <button onclick="window.viewLikesPage(${index})" class="shimmer-effect" style="width:100%; background:linear-gradient(135deg,#FF1493,#FF69B4); color:#FFF; border:none; padding:14px; border-radius:12px; font-weight:950; margin-bottom:12px; cursor:pointer; font-size:12px; letter-spacing:2px; text-transform:uppercase;">2. LIKES COUNT</button>
            <button onclick="window.showReportMenu(${index})" class="shimmer-effect" style="width:100%; background:linear-gradient(135deg,#FF3333,#8B0000); color:#FFF; border:none; padding:14px; border-radius:12px; font-weight:950; margin-bottom:25px; cursor:pointer; font-size:12px; letter-spacing:2px; text-transform:uppercase;">3. REPORT</button>
            
            <button onclick="document.getElementById('friend-options-modal').remove()" style="background:transparent; color:#888; border:none; font-weight:950; cursor:pointer; font-size:12px; letter-spacing:1px;">← CLOSE</button>
        </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.viewPlayerStats = function (index) {
    let friend = window.mpFriends[index];
    let modal = document.getElementById('friend-options-modal');
    if (modal) modal.remove();

    window.playSound('claim');
    let sModal = document.createElement('div');
    sModal.id = 'player-stats-modal';
    sModal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:20001;font-family:'Outfit',sans-serif;`;

    let html = `
        <div class="lobby-glass lobby-float" style="border:2px solid #00FFFF; border-radius:30px; padding:40px; width:400px; text-align:center; box-shadow:0 0 50px rgba(0,255,255,0.2);">
            <div style="font-size:80px; margin-bottom:10px;">${friend.avatar}</div>
            <h2 style="color:#FFF; font-weight:950; letter-spacing:2px; margin-bottom:30px;">${friend.name} PROFLIE</h2>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; text-align:left; margin-bottom:30px;">
                <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="color:#888; font-size:10px; font-weight:900; letter-spacing:1px;">WINS</div>
                    <div style="color:#39FF14; font-size:22px; font-weight:950;">${friend.wins}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="color:#888; font-size:10px; font-weight:900; letter-spacing:1px;">LOSSES</div>
                    <div style="color:#FF3333; font-size:22px; font-weight:950;">${friend.losses}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="color:#888; font-size:10px; font-weight:900; letter-spacing:1px;">QUEEN CAPTURED</div>
                    <div style="color:#FFD700; font-size:22px; font-weight:950;">${friend.queenStats}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="color:#888; font-size:10px; font-weight:900; letter-spacing:1px;">PACKETED COINS</div>
                    <div style="color:#00FFFF; font-size:22px; font-weight:950;">${friend.coins}</div>
                </div>
                <div style="background:rgba(0,255,255,0.05); grid-column:span 2; padding:15px; border-radius:12px; border:1px solid #00FFFF; text-align:center;">
                    <div style="color:#00FFFF; font-size:10px; font-weight:900; letter-spacing:2px;">WALLET BALANCE</div>
                    <div style="color:#FFF; font-size:28px; font-weight:950;">$${friend.wallet}</div>
                </div>
            </div>
            
            <button onclick="document.getElementById('player-stats-modal').remove()" style="background:transparent; border:1px solid #444; color:#888; padding:12px 40px; border-radius:12px; font-weight:950; cursor:pointer;" onmouseover="this.style.color='#FFF'; this.style.borderColor='#00FFFF';">BACK</button>
        </div>
    `;
    sModal.innerHTML = html;
    document.body.appendChild(sModal);
};

window.viewLikesPage = function (index) {
    let friend = window.mpFriends[index];
    let modal = document.getElementById('friend-options-modal');
    if (modal) modal.remove();

    window.playSound('reveal');
    let lModal = document.createElement('div');
    lModal.id = 'player-likes-modal';
    lModal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;justify-content:center;align-items:center;z-index:20001;font-family:'Outfit',sans-serif;`;

    let html = `
        <div class="lobby-glass lobby-float" style="border:2px solid #FF1493; border-radius:30px; padding:40px; width:380px; text-align:center; box-shadow:0 0 50px rgba(255,20,147,0.3);">
            <div style="color:#FF1493; font-size:14px; font-weight:900; letter-spacing:3px; margin-bottom:20px;">SOCIAL APPRECIATION</div>
            <div id="friend-likes-count" style="color:#FFF; font-size:70px; font-weight:950; text-shadow:0 0 20px rgba(255,20,147,0.5);">${friend.likes}</div>
            <div style="color:#888; font-size:12px; font-weight:900; letter-spacing:2px; margin-bottom:30px;">TOTAL LIKES RECEIVED</div>
            
            <button id="like-btn-big" onclick="window.handleLikeClick(${index})" class="shimmer-effect" style="background:#FF1493; color:#FFF; border:none; width:80px; height:80px; border-radius:50%; font-size:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; margin:0 auto; box-shadow:0 10px 25px rgba(255,20,147,0.4);">❤️</button>
            <div style="color:#555; font-size:10px; margin-top:15px; font-weight:bold; letter-spacing:1px;">ONE LIKE EVERY 24 HOURS</div>
            
            <button onclick="document.getElementById('player-likes-modal').remove()" style="background:transparent; border:none; color:#777; padding:12px; border-radius:12px; font-weight:950; cursor:pointer; margin-top:20px;" onmouseover="this.style.color='#FF1493';">BACK</button>
        </div>
    `;
    lModal.innerHTML = html;
    document.body.appendChild(lModal);
};

window.handleLikeClick = async function (index) {
    let friend = window.mpFriends[index];
    let now = Date.now();
    let lastLike = localStorage.getItem(`lastLike_${friend.name}`) || 0;

    if (now - lastLike < 24 * 60 * 60 * 1000) {
        await window.customAlert("YOU HAVE ALREADY LIKED TODAY. REFRESHES TOMORROW!", "SOCIAL");
        window.playSound('foul');
        return;
    }

    friend.likes++;
    localStorage.setItem(`lastLike_${friend.name}`, now);
    window.playSound('claim');

    let countEl = document.getElementById('friend-likes-count');
    if (countEl) {
        countEl.innerText = friend.likes;
        countEl.style.animation = 'mpCountPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    }

    // Floating heart effect
    let h = document.createElement('div'); h.innerHTML = '❤️'; h.style.cssText = `position:fixed; left:50%; top:50%; pointer-events:none; font-size:40px; z-index:20002; animation: floatUpAndFade 1.2s ease-out forwards;`;
    document.body.appendChild(h); setTimeout(() => h.remove(), 1200);
    renderSidebarShop();
};

window.showReportMenu = function (index) {
    let friend = window.mpFriends[index];
    let modal = document.getElementById('friend-options-modal');
    if (modal) modal.remove();

    window.playSound('foul');
    let rModal = document.createElement('div');
    rModal.id = 'player-report-modal';
    rModal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(20,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:20001;font-family:'Outfit',sans-serif;`;

    let html = `
        <div class="lobby-glass" style="border:2px solid #FF3333; border-radius:24px; padding:35px; width:340px; text-align:center; box-shadow:0 0 50px rgba(255,51,51,0.2);">
            <div style="font-size:40px; margin-bottom:10px;">⚠️</div>
            <h3 style="color:#FFF; margin-bottom:25px; font-weight:950; letter-spacing:1px;">REPORT ${friend.name}</h3>
            
            <button onclick="window.submitReportAction('CHEAT')" class="shimmer-effect" style="width:100%; background:#222; color:#FF3333; border:1px solid #FF3333; padding:12px; border-radius:8px; font-weight:900; margin-bottom:10px; cursor:pointer;" onmouseover="this.style.background='#FF3333'; this.style.color='#FFF';">1. CHEAT</button>
            <button onclick="window.submitReportAction('UNWANTED WORDS')" class="shimmer-effect" style="width:100%; background:#222; color:#FF3333; border:1px solid #FF3333; padding:12px; border-radius:8px; font-weight:900; margin-bottom:10px; cursor:pointer;" onmouseover="this.style.background='#FF3333'; this.style.color='#FFF';">2. UNWANTED WORDS</button>
            <button onclick="window.submitReportAction('HACKER')" class="shimmer-effect" style="width:100%; background:#222; color:#FF3333; border:1px solid #FF3333; padding:12px; border-radius:8px; font-weight:900; margin-bottom:20px; cursor:pointer;" onmouseover="this.style.background='#FF3333'; this.style.color='#FFF';">3. HACKER</button>
            
            <button onclick="document.getElementById('player-report-modal').remove()" style="background:transparent; color:#888; border:none; font-weight:950; cursor:pointer;">BACK</button>
        </div>
    `;
    rModal.innerHTML = html;
    document.body.appendChild(rModal);
};

window.submitReportAction = async function (type) {
    await window.customAlert("REPORTED SUCCESSFULLY", "REPORT SYSTEM");
    window.playSound('beep');
    let modal = document.getElementById('player-report-modal');
    if (modal) modal.remove();
};

// Simulated Global Database of un-added players
window.globalPlayerDatabase = [
    'MASTER_PRO', 'CARROM_QUEEN', 'ULTRA_STRIKER', 'NINJA_BOY',
    'GHOST_PLAYER', 'ALPHA_ZERO', 'LEGENDARY', 'POCKET_CRUSH',
    'STRIKER_FORCE', 'CARROM_CHAMP', 'PRO_POCKET', 'ACE_COMMANDER'
];

window.searchFriendAction = function () {
    let input = document.getElementById('friend-search-input');
    if (!input) return;
    let val = input.value.trim().toUpperCase();
    if (!val) return;

    window.playSound('beep');
    let resultsArea = document.getElementById('search-results-area');
    resultsArea.style.display = 'block';
    resultsArea.innerHTML = `<div style="color: #888; font-size: 12px; text-align: center;">🔍 Searching for <b>"${val}"</b>...</div>`;

    setTimeout(() => {
        // 1. Check if already a friend
        let friendIndex = window.mpFriends.findIndex(f => f.name.toUpperCase() === val);
        if (friendIndex !== -1) {
            let friend = window.mpFriends[friendIndex];
            let statusColor = friend.status === 'online' ? '#39FF14' : (friend.status === 'in_match' ? '#FFD700' : '#666');
            let statusText = friend.status === 'in_match' ? 'IN MATCH' : friend.status.toUpperCase();

            resultsArea.innerHTML = `
                <div style="color: #FFD700; font-size: 11px; text-align: center; font-weight: 900; margin-bottom: 8px; letter-spacing:1px;">FOUND IN YOUR FRIENDS</div>
                <div style="display:flex; justify-content: space-between; align-items: center; border: 1px solid #FFD700; padding: 10px; border-radius: 8px; background: rgba(255,215,0,0.05);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="font-size:24px;">${friend.avatar}</div>
                        <div>
                            <div style="color:#FFF; font-weight:900; font-size:13px;">${friend.name}</div>
                            <div style="color:${statusColor}; font-size:9px; font-weight:bold;">● ${statusText}</div>
                        </div>
                    </div>
                    <div style="color:#FFD700; font-size:10px; font-weight:bold;">FRIEND ✓</div>
                </div>
            `;
            return;
        }

        // 2. Check global database
        let inGlobal = window.globalPlayerDatabase.includes(val);
        if (inGlobal) {
            resultsArea.innerHTML = `
                <div style="color: #39FF14; font-size: 11px; text-align: center; font-weight: 900; margin-bottom: 8px; letter-spacing:1px;">NEW PLAYER FOUND</div>
                <div style="display:flex; justify-content: space-between; align-items: center; border: 1px solid #39FF14; padding: 10px; border-radius: 8px; background: rgba(57,255,20,0.05);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:32px; height:32px; background:#222; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid #1E90FF; font-size:16px;">👤</div>
                        <div>
                            <div style="color:#FFF; font-weight:900; font-size:13px;">${val}</div>
                            <div style="color:#39FF14; font-size:9px; font-weight:bold;">● AVAILABLE</div>
                        </div>
                    </div>
                    <button onclick="window.performAddFriend('${val}')" style="background:#39FF14; color:#000; border:none; padding:6px 12px; border-radius:4px; font-weight:900; font-size:11px; cursor:pointer; box-shadow: 0 0 10px rgba(57,255,20,0.3);">ADD</button>
                </div>
            `;
        } else {
            // 3. Not found anywhere
            window.playSound('foul');
            resultsArea.innerHTML = `
                <div style="text-align: center; padding: 10px;">
                    <div style="font-size: 24px; margin-bottom: 5px;">🚫</div>
                    <div style="color: #FF3333; font-size: 13px; font-weight: 900; letter-spacing: 1px;">NAME WAS UNAVAILABLE</div>
                    <div style="color: #666; font-size: 10px; margin-top: 4px;">Player "${val}" could not be found.</div>
                </div>
            `;

            setTimeout(() => {
                resultsArea.style.display = 'none';
            }, 3000);
        }
    }, 800);
};

window.performAddFriend = function (name) {
    window.playSound('claim');
    window.mpFriends.unshift({
        name: name.toUpperCase(),
        avatar: '👤',
        status: 'online',
        invited: false
    });

    let resultsArea = document.getElementById('search-results-area');
    resultsArea.innerHTML = `<div style="color: #39FF14; font-size: 13px; text-align: center; font-weight: 900;">✅ ADDED ${name.toUpperCase()}!</div>`;

    setTimeout(() => {
        resultsArea.style.display = 'none';
        renderSidebarShop(); // Refresh the list
    }, 1200);
};

window.deleteFriendAction = async function (index) {
    let friend = window.mpFriends[index];
    if (!friend) return;

    if (await window.customConfirm(`REMOVE ${friend.name} FROM FRIENDS?`, "MANAGE FRIENDS")) {
        window.playSound('foul');
        window.mpFriends.splice(index, 1);
        renderSidebarShop();
    }
};

window.bookFriend = async function (index) {
    let friend = window.mpFriends[index];
    if (!friend) return;
    window.playSound('beep');

    if (friend.status === 'offline') {
        await window.customAlert("BOOKING SENT", "SOCIAL BOOKING");
        window.playSound('claim');
        friend.isBooked = true;

        // Simulate coming online after 10 seconds
        setTimeout(() => {
            friend.status = 'online';
            friend.isBooked = false;
            window.handleBookingNotification(friend);
            renderSidebarShop();
        }, 10000);
    } else {
        // Simulate booking process for in-match players
        let accepted = Math.random() > 0.3; // 70% chance of acceptance
        if (accepted) {
            await window.customAlert("BOOKING ACCEPTED", "SOCIAL BOOKING");
            window.playSound('claim');
            friend.isBooked = true;

            // Simulate match completion after 12 seconds
            setTimeout(() => {
                friend.status = 'online';
                friend.isBooked = false;
                window.handleBookingNotification(friend);
                renderSidebarShop();
            }, 12000);
        } else {
            await window.customAlert("BOOKING BLOCKED", "SOCIAL BOOKING");
            window.playSound('foul');
        }
    }
    renderSidebarShop();
};

window.handleBookingNotification = function (friend) {
    window.playSound('reveal');
    let notify = document.createElement('div');
    notify.id = 'booking-notification';
    notify.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.95);border:2px solid #FFD700;border-radius:16px;padding:25px;z-index:30000;text-align:center;width:320px;box-shadow:0 0 40px rgba(255,215,0,0.4);animation:mpVsAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;`;

    notify.innerHTML = `
        <div style="font-size:40px;margin-bottom:10px;">👑</div>
        <h3 style="color:#FFF;margin-bottom:15px;font-weight:950;letter-spacing:1px;text-transform:uppercase;">${friend.name} WAS NOW ONLINE<br>CHALLENGE NOW</h3>
        <div style="display:flex;gap:10px;justify-content:center;">
            <button id="book-challenge-btn" style="background:#39FF14;color:#000;border:none;padding:10px 20px;border-radius:8px;font-weight:950;cursor:pointer;flex:1;">1. CHALLENGE</button>
            <button id="book-reject-btn" style="background:#FF3333;color:#FFF;border:none;padding:10px 20px;border-radius:8px;font-weight:950;cursor:pointer;flex:1;">2. REJECT</button>
        </div>
    `;
    document.body.appendChild(notify);

    document.getElementById('book-challenge-btn').onclick = function () {
        window.playSound('claim');
        notify.remove();
        // Suddenly leave current match and join friend match
        window.resetGame();
        setTimeout(() => {
            window.startMultiplayerMatch(friend.name);
        }, 500);
    };

    document.getElementById('book-reject-btn').onclick = function () {
        window.playSound('beep');
        notify.remove();
        // Just continue same match (do nothing)
    };
};



window.quickMatchMultiplayer = function () {
    if (gameState !== 'MENU' && gameState !== 'GAMEOVER') return;
    window.playSound('beep');

    let modal = document.createElement('div'); modal.id = 'mp-lobby-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;justify-content:center;align-items:center;z-index:9999;`;
    let html = `<div style="background:linear-gradient(135deg,#0a1628,#162840);border:2px solid #39FF14;border-radius:12px;padding:35px 40px;text-align:center;max-width:420px;width:90%;box-shadow:0 0 40px rgba(57,255,20,0.3);">`;
    html += `<div style="font-size:40px;margin-bottom:10px;"><span style="display:inline-block;animation:pulse 1s infinite;">⚡</span></div>`;
    html += `<h2 style="color:#39FF14;margin:0 0 15px;font-size:18px;letter-spacing:2px;">QUICK MATCH</h2>`;
    html += `<div id="mp-quick-status" style="color:#FFF;font-size:13px;"><span style="display:inline-block;animation:pulse 1s infinite;">🔍</span> Searching for opponent...</div>`;
    html += `<div style="margin:15px auto;width:200px;height:3px;background:#222;border-radius:3px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#39FF14,#1E90FF);animation:loaderFill 3s ease-in-out forwards;"></div></div>`;
    html += `<button onclick="window.cancelMultiplayerLobby()" style="background:#FF3333;color:#FFF;border:none;padding:10px 25px;font-weight:bold;border-radius:6px;cursor:pointer;font-size:12px;margin-top:10px;">CANCEL</button>`;
    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    window.mpLobbyTimerId = setTimeout(() => {
        let statusEl = document.getElementById('mp-quick-status');
        if (!statusEl) return;
        let opponents = ['STRIKER_KING', 'CARROM_PRO99', 'xX_LEGEND_Xx', 'BOARD_MASTER', 'POCKET_SNIPER', 'PRO_PLAYER42', 'NEON_GOD'];
        let oppName = opponents[Math.floor(Math.random() * opponents.length)];
        statusEl.innerHTML = `<span style="color:#39FF14;font-weight:bold;">✅ MATCHED! vs ${oppName}</span>`;
        window.playSound('claim');

        setTimeout(() => {
            let m = document.getElementById('mp-lobby-modal');
            if (m) m.remove();
            window.startMultiplayerMatch(oppName);
        }, 1500);
    }, 2500 + Math.random() * 1500);
};

window.startMultiplayerMatch = function (opponentName) {
    let selMode = window.mpSelectedMode || 'CLASSIC';
    let modeColors = { 'CLASSIC': '#FFD700', 'FREESTYLE': '#00FFFF', 'DISC POOL': '#FF1493', 'ZOMBIE': '#8B0000', 'INFECTION': '#39FF14', 'GUN GAME': '#FF4500' };
    let modeIcons = { 'CLASSIC': '🎯', 'FREESTYLE': '🎨', 'DISC POOL': '🎱', 'ZOMBIE': '🧟', 'INFECTION': '☣️', 'GUN GAME': '🔫' };
    let mColor = modeColors[selMode] || '#FFD700';
    let mIcon = modeIcons[selMode] || '🎯';

    // Inject transition animation styles
    let transStyle = document.getElementById('mp-trans-style');
    if (!transStyle) {
        transStyle = document.createElement('style'); transStyle.id = 'mp-trans-style';
        document.head.appendChild(transStyle);
    }
    transStyle.innerHTML = `
        @keyframes mpSlideFromLeft { 0% { transform: translateX(-120%) scale(0.6); opacity: 0; } 60% { transform: translateX(10%) scale(1.05); opacity: 1; } 100% { transform: translateX(0) scale(1); opacity: 1; } }
        @keyframes mpSlideFromRight { 0% { transform: translateX(120%) scale(0.6); opacity: 0; } 60% { transform: translateX(-10%) scale(1.05); opacity: 1; } 100% { transform: translateX(0) scale(1); opacity: 1; } }
        @keyframes mpVsAppear { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 50% { transform: scale(1.3) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes mpVsPulse { 0%, 100% { text-shadow: 0 0 20px ${mColor}, 0 0 40px ${mColor}60, 0 0 80px ${mColor}30; transform: scale(1); } 50% { text-shadow: 0 0 40px ${mColor}, 0 0 80px ${mColor}80, 0 0 120px ${mColor}50; transform: scale(1.08); } }
        @keyframes mpModeBadgeIn { 0% { transform: translateY(20px) scale(0.5); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes mpCountPop { 0% { transform: scale(2); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 80% { transform: scale(1); opacity: 1; } 100% { transform: scale(0.8); opacity: 0; } }
        @keyframes mpLineExpand { 0% { width: 0; } 100% { width: 100%; } }
        @keyframes mpBgPulse { 0%, 100% { background: rgba(0,0,0,0.95); } 50% { background: rgba(${selMode === 'ZOMBIE' ? '40,0,0' : '0,10,30'},0.95); } }
    `;

    // Create VS transition screen
    let vs = document.createElement('div'); vs.id = 'mp-vs-screen';
    vs.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;display:flex;flex-direction:column;justify-content:center;align-items:center;animation:mpBgPulse 2s ease-in-out infinite;background:rgba(0,0,0,0.95);`;

    let html = '';

    // Decorative top/bottom lines
    html += `<div style="position:absolute;top:0;left:0;width:100%;height:3px;background:linear-gradient(90deg,transparent,${mColor},transparent);animation:mpLineExpand 0.8s ease-out forwards;"></div>`;
    html += `<div style="position:absolute;bottom:0;left:0;width:100%;height:3px;background:linear-gradient(90deg,transparent,${mColor},transparent);animation:mpLineExpand 0.8s ease-out forwards;"></div>`;

    // Player cards container
    html += `<div style="display:flex;justify-content:center;align-items:center;gap:30px;margin-bottom:10px;">`;

    // Player 1 card (slides from left)
    html += `<div style="text-align:center;animation:mpSlideFromLeft 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both;">`;
    html += `<div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#1a2a4a,#0a1628);border:3px solid #1E90FF;display:flex;justify-content:center;align-items:center;font-size:40px;margin:0 auto 8px;box-shadow:0 0 20px rgba(30,144,255,0.4);">👤</div>`;
    html += `<div style="color:#FFF;font-weight:900;font-size:15px;letter-spacing:1px;">${playerName || 'PLAYER 1'}</div>`;
    html += `<div style="color:#1E90FF;font-size:10px;letter-spacing:2px;margin-top:3px;">CHALLENGER</div>`;
    html += `</div>`;

    // VS text
    html += `<div style="animation:mpVsAppear 0.5s cubic-bezier(0.16,1,0.3,1) 0.6s both;">`;
    html += `<div style="font-size:55px;font-weight:900;color:${mColor};letter-spacing:6px;animation:mpVsPulse 1.5s ease-in-out infinite;font-family:'Segoe UI',sans-serif;">VS</div>`;
    html += `</div>`;

    // Player 2 card (slides from right)
    html += `<div style="text-align:center;animation:mpSlideFromRight 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both;">`;
    html += `<div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#2a1a1a,#1a0a0a);border:3px solid #FF3333;display:flex;justify-content:center;align-items:center;font-size:40px;margin:0 auto 8px;box-shadow:0 0 20px rgba(255,50,50,0.4);">🎮</div>`;
    html += `<div style="color:#FFF;font-weight:900;font-size:15px;letter-spacing:1px;">${opponentName}</div>`;
    html += `<div style="color:#FF3333;font-size:10px;letter-spacing:2px;margin-top:3px;">OPPONENT</div>`;
    html += `</div>`;
    html += `</div>`;

    // Mode badge
    html += `<div style="animation:mpModeBadgeIn 0.5s ease-out 0.9s both;margin-top:15px;">`;
    html += `<div style="background:#0a0f1a;border:2px solid ${mColor};border-radius:30px;padding:8px 25px;display:inline-flex;align-items:center;gap:8px;box-shadow:0 0 20px ${mColor}30;">`;
    html += `<span style="font-size:18px;">${mIcon}</span>`;
    html += `<span style="color:${mColor};font-weight:900;font-size:14px;letter-spacing:3px;">${selMode}</span>`;
    html += `</div></div>`;

    // Countdown area
    html += `<div id="mp-vs-countdown" style="margin-top:25px;font-size:70px;font-weight:900;color:#FFF;min-height:90px;display:flex;justify-content:center;align-items:center;"></div>`;

    vs.innerHTML = html;
    document.body.appendChild(vs);

    window.playSound('reveal');

    // Run 3-2-1-GO countdown
    let countdownEl = null;
    setTimeout(() => { countdownEl = document.getElementById('mp-vs-countdown'); }, 100);

    let counts = [
        { time: 1500, text: '3', color: '#FF3333' },
        { time: 2300, text: '2', color: '#FFD700' },
        { time: 3100, text: '1', color: '#39FF14' },
        { time: 3900, text: 'GO!', color: mColor }
    ];

    counts.forEach(c => {
        setTimeout(() => {
            let el = document.getElementById('mp-vs-countdown');
            if (!el) return;
            el.innerHTML = `<span style="color:${c.color};animation:mpCountPop 0.7s ease-out forwards;display:inline-block;text-shadow:0 0 30px ${c.color};">${c.text}</span>`;
            window.playSound('beep');
        }, c.time);
    });

    // Flash and start match
    setTimeout(() => {
        // White flash
        let flash = document.createElement('div');
        flash.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:#FFF;z-index:10001;opacity:0;transition:opacity 0.1s ease-in;pointer-events:none;`;
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '1'; }, 30);

        setTimeout(() => {
            flash.style.transition = 'opacity 0.5s ease-out';
            flash.style.opacity = '0';
            let vsScreen = document.getElementById('mp-vs-screen');
            if (vsScreen) vsScreen.remove();

            initGame();
            // Actually start the match
            gameMode = selMode;
            const aiToggle = document.getElementById('ai-toggle');
            const aiDiff = document.getElementById('ai-difficulty');
            if (aiToggle) aiToggle.checked = true;
            if (aiDiff) aiDiff.value = 'hard';
            window.currentBet = 0;
            window.mpOpponentName = opponentName;

            // Show the carrom board
            window.is1v1MP = true;
            currentShopView = 'menu';
            renderSidebarShop();

            startCountdown();
            currentMessage = `⚔️ VS ${opponentName} • ${gameMode}`; messageDisplayTime = Date.now() + 3000;

            setTimeout(() => { flash.remove(); }, 500);
        }, 200);
    }, 4500);

    window.playSound('claim');
};

window.showCollectionItemOptions = function (type, itemId, itemName) {
    window.playSound('beep');
    let modal = document.createElement('div');
    modal.id = 'collection-options-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:20000; backdrop-filter: blur(8px);`;

    let html = `<div style="background: linear-gradient(135deg, #111, #050505); border: 2px solid #39FF14; border-radius: 24px; padding: 40px; width: 320px; text-align: center; box-shadow: 0 0 50px rgba(57,255,20,0.3); color: #fff; animation: badgeSlideUp 0.3s ease-out; position: relative;">`;

    // Header
    html += `<div style="font-size: 50px; margin-bottom: 20px; filter: drop-shadow(0 0 10px #39FF14);">🎒</div>`;
    html += `<h2 style="color: #39FF14; margin: 0 0 10px; font-size: 24px; font-weight: 950; letter-spacing: 2px; text-transform: uppercase;">${itemName}</h2>`;
    html += `<div style="color: #888; font-size: 11px; font-weight: 900; margin-bottom: 30px; letter-spacing: 2px; text-transform: uppercase;">Manage Collection</div>`;

    // Options
    html += `<div style="display: flex; flex-direction: column; gap: 15px;">`;

    const btnStyle = `width: 100%; padding: 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #FFF; font-weight: 900; font-size: 14px; letter-spacing: 2px; cursor: pointer; transition: 0.3s; text-transform: uppercase;`;

    html += `<button onclick="window.equipCollectionItem('${type}', '${itemId}'); document.getElementById('collection-options-modal').remove();" style="${btnStyle}" onmouseover="this.style.background='linear-gradient(90deg, #39FF14, #00CC00)'; this.style.color='#000'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#FFF'; this.style.transform='translateY(0)';">EQUIP</button>`;

    html += `<button onclick="window.unequipCollectionItem('${type}', '${itemId}'); document.getElementById('collection-options-modal').remove();" style="${btnStyle}" onmouseover="this.style.background='linear-gradient(90deg, #FF3333, #CC0000)'; this.style.color='#FFF'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#FFF'; this.style.transform='translateY(0)';">UNEQUIP</button>`;

    html += `<button onclick="document.getElementById('collection-options-modal').remove()" style="margin-top: 10px; background: transparent; border: none; color: #555; font-weight: 950; cursor: pointer; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;" onmouseover="this.style.color='#AAA'" onmouseout="this.style.color='#555'">CANCEL</button>`;

    html += `</div></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.equipCollectionItem = function (type, id) {
    if (type === 'Strikers') window.buyOrEquipStriker(parseInt(id));
    else if (type === 'Coins') window.buyOrEquipCoin(parseInt(id));
    else if (type === 'Boards') window.buyOrEquipBoard(parseInt(id));
    else if (type === 'Effects') window.buyOrEquipPocket(parseInt(id));
    else if (type === 'Sounds') window.buyOrEquipSound(parseInt(id));
    else if (type === 'Avatars') window.buyOrEquipAvatar(parseInt(id));
    else if (type === 'Titles') window.buyOrEquipTitle(parseInt(id));
    else if (type === 'Pets') window.buyOrEquipPet(parseInt(id));
    else if (type === 'Emotes') {
        window.customAlert("Emotes are always active!", "INFO");
    }
    else if (type === 'Special') {
        if (id === 'VictoryFireworks') {
            hasVictoryEffect = true;
            localStorage.setItem('hasVictoryEffect', 'true');
        } else if (id === 'MegaFireworks') {
            hasMegaFireworks = true;
            localStorage.setItem('hasMegaFireworks', 'true');
        } else if (id === 'FemaleVoice') {
            hasFemaleVoice = true;
            localStorage.setItem('hasFemaleVoice', 'true');
        }
    }
    renderSidebarShop();
};

window.unequipCollectionItem = function (type, id) {
    window.playSound('foul');
    if (type === 'Strikers') { equippedStrikerId = 0; localStorage.setItem('equippedStrikerId', 0); }
    else if (type === 'Coins') { equippedCoinId = 0; localStorage.setItem('equippedCoinId', 0); applyEquippedCoins(); }
    else if (type === 'Boards') { equippedBoardId = 0; localStorage.setItem('equippedBoardId', 0); }
    else if (type === 'Effects') { equippedPocketEffectId = 0; localStorage.setItem('equippedPocketEffectId', 0); }
    else if (type === 'Sounds') { equippedSoundId = 0; localStorage.setItem('equippedSoundId', 0); }
    else if (type === 'Avatars') { equippedAvatarId = 0; localStorage.setItem('equippedAvatarId', 0); }
    else if (type === 'Titles') { equippedTitleId = 0; localStorage.setItem('equippedTitleId', 0); }
    else if (type === 'Pets') { equippedPetId = 0; localStorage.setItem('equippedPetId', 0); }
    else if (type === 'Special') {
        if (id === 'VictoryFireworks') {
            hasVictoryEffect = false;
            localStorage.setItem('hasVictoryEffect', 'false');
        } else if (id === 'MegaFireworks') {
            hasMegaFireworks = false;
            localStorage.setItem('hasMegaFireworks', 'false');
        } else if (id === 'FemaleVoice') {
            hasFemaleVoice = false;
            localStorage.setItem('hasFemaleVoice', 'false');
        }
    }

    renderSidebarShop();
    updateTopBar();
};

function renderSidebarShop() {
    let shopDiv = document.getElementById('shop-container'); if (!shopDiv) return;

    let rightSidebar = document.getElementById('right-sidebar');
    let leftSidebar = document.getElementById('left-sidebar');
    let centerArea = document.getElementById('center-area');

    if (rightSidebar) {
        if (currentShopView === 'pass') {
            rightSidebar.style.position = 'relative';
            rightSidebar.classList.add('pass-sidebar-bg');
        } else {
            rightSidebar.classList.remove('pass-sidebar-bg');
        }

        if (currentShopView === 'multiplayer') {
            if (leftSidebar) leftSidebar.style.display = 'none';
            if (centerArea) centerArea.style.display = 'none';
            rightSidebar.style.width = '800px';
            rightSidebar.style.overflow = 'hidden'; // Reverted to hidden as requested
            document.body.style.overflow = 'hidden';
            rightSidebar.classList.add('multiplayer-hub-bg');
        } else {
            if (leftSidebar) leftSidebar.style.display = 'block';
            if (centerArea) centerArea.style.display = 'flex';
            rightSidebar.style.width = '320px';
            rightSidebar.classList.remove('multiplayer-hub-bg');

            if (window.is2v2 || window.is1v1MP) {
                rightSidebar.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
            } else {
                rightSidebar.style.overflow = 'auto';
                document.body.style.overflow = 'auto';
            }
        }
    }

    if (window.passParticleSystem) {
        window.passParticleSystem.stop();
        window.passParticleSystem = null;
    }

    let shopDisabled = (gameState !== 'MENU' && gameState !== 'GAMEOVER'); let disAttr = shopDisabled ? 'disabled' : ''; let disStyle = shopDisabled ? 'opacity: 0.4; cursor: not-allowed;' : 'cursor: pointer;';
    let html = '';

    window.checkPassCooldown();

    if (currentShopView === 'menu') {
        if ((window.is2v2 || window.is1v1MP) && gameState !== 'MENU' && gameState !== 'GAMEOVER') {
            let spectators = window.mpSpectators || [];
            let is1v1MP = window.is1v1MP;

            let feed = window.eventFeeds[window.currentFeedIndex];
            html += `
                <div style="height: 100%; min-height: 520px; width: 100%; background: #000; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #333; box-shadow: 0 0 15px rgba(0,0,0,0.8);">
                    <!-- Upper Half: Match Participants Profile -->
                    <div id="lobby-participants-container" style="flex: 1.5; position: relative; background: linear-gradient(135deg, #050505 0%, #111 100%); display: flex; flex-direction: column; overflow: hidden; border-bottom: 3px solid #1a1a1a; padding: 20px;">
                        <div style="position: absolute; inset: 0; opacity: 0.1; background-image: radial-gradient(#333 1px, transparent 1px); background-size: 20px 20px;"></div>
                        
                        <div style="z-index: 2; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 8px; height: 8px; background: #FFD700; border-radius: 50%; box-shadow: 0 0 10px #FFD700;"></div>
                                <div style="color: #fff; font-size: 11px; font-weight: 950; letter-spacing: 2px; text-transform: uppercase;">Match Participants</div>
                            </div>
                            <div style="background: rgba(255, 255, 255, 0.05); color: #888; font-size: 9px; padding: 4px 10px; border-radius: 4px; font-weight: 900; letter-spacing: 1px;">${is1v1MP ? '1 VS 1' : '2 VS 2'} SESSION</div>
                        </div>

                        <div style="z-index: 2; flex: 1; display: flex; flex-direction: column; gap: 10px;">
                            ${(window.mpPlayers || []).map((p, idx) => {
                if (!p) return '';
                let teamColor = '';
                let teamName = '';

                if (is1v1MP) {
                    teamColor = (idx === 0) ? '#0099FF' : '#FF3333';
                    teamName = (idx === 0) ? 'PLAYER 1' : 'PLAYER 2';
                } else {
                    let isTeam1 = (idx === 0 || idx === 2);
                    teamColor = isTeam1 ? '#0099FF' : '#FF3333';
                    teamName = isTeam1 ? 'TEAM BLUE' : 'TEAM RED';
                }

                // Map idx to currentPlayer: 0->1, 1->2, 2->3, 3->4
                let isMyTurn = ((window.is2v2 || is1v1MP) && currentPlayer === (idx + 1));
                let isPlaying = (gameState !== 'MENU' && gameState !== 'GAMEOVER');
                let statusText = isPlaying ? (isMyTurn ? '● PLAYING' : 'WAITING') : 'READY';
                let statusColor = isPlaying ? (isMyTurn ? '#FFD700' : '#888') : '#39FF14';
                let highlightStyle = isMyTurn ? `border: 2px solid #FFD700; box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); background: rgba(255, 215, 0, 0.08); transform: scale(1.02);` : `background: rgba(255,255,255,0.03); border: 1px solid ${teamColor}33;`;

                return `
                                    <div style="display: flex; align-items: center; gap: 12px; ${highlightStyle} padding: 10px; border-radius: 10px; transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; overflow: hidden;">
                                        <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: ${isMyTurn ? '#FFD700' : teamColor}; ${isMyTurn ? 'box-shadow: 0 0 10px #FFD700;' : ''}"></div>
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #000; border: 1px solid ${isMyTurn ? '#FFD700' : teamColor}; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 10px ${isMyTurn ? 'rgba(255,215,0,0.3)' : teamColor + '33'};">
                                            ${p.avatar || '👤'}
                                        </div>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="color: #FFF; font-weight: 950; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.5px;">${p.name.toUpperCase()} ${p.isMe ? '<span style="color:#FFD700; font-size:9px;">(YOU)</span>' : ''}</span>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
                                                <span style="color: ${teamColor}; font-size: 8px; font-weight: 900; letter-spacing: 1px;">${teamName}</span>
                                                <span style="width: 4px; height: 4px; background: #333; border-radius: 50%;"></span>
                                                <span style="color: ${statusColor}; font-size: 8px; font-weight: 950; ${isMyTurn ? 'animation: pulse 1.5s infinite;' : ''}">[ ${statusText} ]</span>
                                            </div>
                                        </div>
                                        <div style="text-align: right; opacity: ${isMyTurn ? '1' : '0.3'};">
                                            <div style="font-size: 14px;">${isMyTurn ? '⭐️' : '📶'}</div>
                                        </div>
                                    </div>
                                `;
            }).join('')}
                        </div>
                        
                        <!-- Vignette -->
                        <div style="position: absolute; inset: 0; box-shadow: inset 0 0 40px rgba(0,0,0,0.5); pointer-events: none;"></div>
                    </div>

                    <!-- Lower Half: Realistic Spectator Monitoring -->
                    <div style="flex: 1; padding: 25px 20px; background: linear-gradient(180deg, #0a0a0a 0%, #000 100%); display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="color: #FFD700; font-size: 16px;">👥</div>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="color: #FFF; font-weight: 950; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase;">Spectators</span>
                                    <span style="color: #555; font-size: 9px; font-weight: 700;">REAL-TIME MONITORING</span>
                                </div>
                            </div>
                            <div style="background: rgba(255, 215, 0, 0.05); border: 1px solid rgba(255, 215, 0, 0.3); color: #FFD700; font-size: 9px; padding: 5px 12px; border-radius: 20px; font-weight: 900;">${spectators.length} WATCHING</div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 18px; flex: 1; overflow-y: auto; padding-right: 5px;" class="custom-scrollbar">
            `;

            if (spectators.length === 0) {
                html += `
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                        <div style="text-align: center; border: 1px dashed #333; padding: 30px; border-radius: 16px; width: 100%;">
                            <div style="font-size: 30px; margin-bottom: 10px; opacity: 0.3;">👁️‍🗨️</div>
                            <div style="color: #444; font-size: 11px; font-weight: 950; letter-spacing: 2px; text-transform: uppercase;">no spectator available</div>
                        </div>
                    </div>
                `;
            } else {
                spectators.forEach((s, idx) => {
                    html += `
                        <div style="display: flex; align-items: center; gap: 15px; animation: mpVsAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s both;">
                            <div style="position: relative;">
                                <div style="width: 42px; height: 42px; background: #151515; border: 1px solid #333; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                                    ${s.avatar}
                                </div>
                                <div style="position: absolute; top: -1px; right: -1px; background: #39FF14; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #000;"></div>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="color: #fff; font-size: 12px; font-weight: 900; letter-spacing: 0.5px;">${s.name.toUpperCase()}</span>
                                    <span style="background: rgba(255,215,0,0.1); color: #FFD700; font-size: 8px; padding: 1px 5px; border-radius: 4px; font-weight: 900;">LVL ${s.level}</span>
                                </div>
                                <div style="color: #555; font-size: 9px; font-weight: 700; letter-spacing: 1px; margin-top: 3px;">STATUS: <span style="color: #00FFFF;">${s.status}</span></div>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #333; font-size: 9px; font-weight: 900;">ID#${Math.floor(1000 + Math.random() * 9000)}</div>
                            </div>
                        </div>
                    `;
                });
            }

            html += `
                        </div>
                        <div style="margin-top: auto; padding-top: 20px; text-align: center;">
                            <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 6px 15px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="width: 5px; height: 5px; background: #39FF14; border-radius: 50%;"></div>
                                <div style="color: #444; font-size: 8px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase;">System Terminal Active</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            shopDiv.innerHTML = html;
            return;
        }
        let unclaimed = checkUnclaimedRewards(); let passNotification = unclaimed > 0 ? `<span style="position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; background: #FF0000; border: 2px solid #FFF; border-radius: 50%; animation: pulse 1s infinite;"></span>` : '';
        
        // Add rotating advertisement
        let adFeed = window.eventFeeds[window.currentFeedIndex];

        html += `
            <style>
                @keyframes adContentSlideIn {
                    0% { opacity: 0; transform: translateX(-15px); filter: blur(3px); }
                    100% { opacity: 1; transform: translateX(0); filter: blur(0); }
                }
            </style>
            <div style="margin-bottom: 20px; padding: 15px; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; text-align: left; position: relative; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                <div style="color: #666; font-size: 10px; font-weight: 950; letter-spacing: 2px; margin-bottom: 12px;">UPCOMING EVENT / ADVERTISEMENT</div>
                <div style="display: flex; gap: 15px; align-items: center; border-left: 3px solid ${adFeed.color}; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 6px; cursor: default; animation: adContentSlideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
                    <div style="font-size: 32px; filter: drop-shadow(0 0 10px ${adFeed.color});">${adFeed.icon}</div>
                    <div style="flex: 1;">
                        <div style="color: ${adFeed.color}; font-size: 10px; font-weight: 950; letter-spacing: 1.5px; margin-bottom: 3px; text-transform: uppercase;">${adFeed.type}</div>
                        <div style="color: #FFF; font-size: 13px; font-weight: 900; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${adFeed.title}</div>
                        <div style="color: #AAA; font-size: 10px; line-height: 1.4; font-weight: 600;">${adFeed.desc}</div>
                    </div>
                </div>
                <div style="position: absolute; right: 10px; top: 10px; width: 6px; height: 6px; border-radius: 50%; background: ${adFeed.color}; box-shadow: 0 0 10px ${adFeed.color}; animation: pulse 2s infinite;"></div>
            </div>

            <div class="shop-section-title" style="text-align: center; padding: 10px; border-radius: 6px; border: 1px solid #333; background: #000; color: #fff; font-size: 18px; margin-bottom: 20px; font-weight: 900; letter-spacing: 2px;">MAIN MENU</div>
            
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold; box-shadow: none;" onclick="switchShopView('quests')">📜 QUESTS & BOUNTIES</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold; box-shadow: none;" onclick="switchShopView('collection')">🎒 MY COLLECTION</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold; box-shadow: none;" onclick="switchShopView('friends')">👥 FRIENDS BAR</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: 900; box-shadow: none;" onclick="openLuckySpin()">🎰 LUCKY SPIN DAILY</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: 900; box-shadow: none;" onclick="switchShopView('multiplayer')">🌐 PLAY ONLINE</button>

            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: 900; box-shadow: none;" onclick="switchShopView('replays')">🎥 MATCH REPLAYS</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: 900; box-shadow: none;" onclick="enterTournament()">🏆 ENTER TOURNAMENT ($500)</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: 900; position:relative; box-shadow: none;" onclick="switchShopView('pass')">🏆 CARROM PASS (Round ${currentPassRound}) ${passNotification}</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #000; border: 1px solid #444; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold; box-shadow: none;" onclick="switchShopView('purchasing_place')">🛒 PURCHASING PLACE</button>
            
            <div style="margin-top: 25px; border-top: 2px dashed #444; padding-top: 20px;"><div style="text-align: left; color: #fff; margin-bottom: 8px; font-size: 14px; font-weight: bold; letter-spacing: 1px;">GAME SETTINGS</div>
        `;
        let modeColor = gameMode === 'FREESTYLE' ? '#00FFFF' : (gameMode === 'DISC POOL' ? '#FF1493' : (gameMode === 'ZOMBIE' ? '#8B0000' : (gameMode === 'INFECTION' ? '#39FF14' : (gameMode === 'GUN GAME' ? '#FF4500' : '#FFD700'))));
        let modeTextColor = (gameMode === 'DISC POOL' || gameMode === 'ZOMBIE' || gameMode === 'GUN GAME') ? '#FFF' : '#000';
        html += `<button class="shop-btn" ${disAttr} style="width: 100%; text-align: left; margin-bottom: 10px; padding: 15px; font-size: 16px; background: #000; color: #FFF; border: 1px solid #444; border-radius: 6px; font-weight: 900; ${disStyle} box-shadow: none;" onclick="toggleGameMode()">${gameMode} MODE ⟳</button>`;
        if (gameMode === 'FREESTYLE') { html += `<button class="shop-btn" ${disAttr} style="width: 100%; margin-bottom: 10px; text-align: left; padding: 12px 15px; font-size: 14px; background: #000; color: #FFF; border: 1px solid #333; border-radius: 6px; font-weight: bold; ${disStyle}" onclick="toggleTargetScore()">TARGET POINTS: ${freestyleTargetScore} ⟳</button>`; }
        html += `<div style="background: #000; border: 1px solid #444; border-radius: 6px; margin-bottom: 10px;">
            <button class="shop-btn" ${disAttr} style="width: 100%; text-align: center; padding: 15px; font-size: 16px; background: transparent; color: #FFF; border: none; font-weight: 900; ${disStyle} box-shadow: none;" onclick="switchShopView('more_games')">🎮 PLAY MORE GAMES ⟱</button>
        </div>`;

        html += `</div>`;

    }
    else if (currentShopView === 'more_games') {
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #222; padding: 10px; border-radius: 6px; border-bottom: 2px solid #1E90FF;"><button onclick="switchShopView('menu')" ${disAttr} style="background: #444; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; ${disStyle}">&larr; BACK</button><div style="color: #1E90FF; font-weight: 900; font-size: 16px; letter-spacing: 1px;">MORE GAMES</div></div>`;
        html += `<div style="display:flex; flex-direction:column; gap: 15px; padding: 10px 0;">`;
        html += `<button class="shop-btn" ${disAttr} style="width: 100%; padding: 25px; font-size: 18px; background: #111; color: #FFF; border: 2px solid #333; border-radius: 8px; font-weight: 900; ${disStyle} transition: 0.3s;" onmouseover="this.style.borderColor='#39FF14'" onmouseout="this.style.borderColor='#333'" onclick="window.location.href='chess_transition.html';">♟️ CHESS</button>`;
        html += `<button class="shop-btn" ${disAttr} style="width: 100%; padding: 25px; font-size: 18px; background: #111; color: #FFF; border: 2px solid #333; border-radius: 8px; font-weight: 900; ${disStyle} transition: 0.3s;" onmouseover="this.style.borderColor='#FFD700'" onmouseout="this.style.borderColor='#333'" onclick="window.location.href='ludo_login.html';">🎲 LUDO</button>`;
        html += `<button class="shop-btn" ${disAttr} style="width: 100%; padding: 25px; font-size: 18px; background: #111; color: #FFF; border: 2px solid #333; border-radius: 8px; font-weight: 900; ${disStyle} transition: 0.3s;" onmouseover="this.style.borderColor='#00f2ff'" onmouseout="this.style.borderColor='#333'" onclick="window.location.href='snake_intro.html';">🐍 SNAKE REALM</button>`;
        html += `<button class="shop-btn" ${disAttr} style="width: 100%; padding: 25px; font-size: 18px; background: #111; color: #FFF; border: 2px solid #333; border-radius: 8px; font-weight: 900; ${disStyle} transition: 0.3s;" onmouseover="this.style.borderColor='#FF4500'" onmouseout="this.style.borderColor='#333'" onclick="window.customAlert('Tic Tac Toe coming soon!', 'MORE GAMES');">❌ TIC TAC TOE</button>`;
        html += `<button class="shop-btn" ${disAttr} style="width: 100%; padding: 25px; font-size: 18px; background: #111; color: #FFF; border: 2px solid #333; border-radius: 8px; font-weight: 900; ${disStyle} transition: 0.3s;" onmouseover="this.style.borderColor='#ADFF2F'" onmouseout="this.style.borderColor='#333'" onclick="window.location.href='hand_cricket_transition.html';">🏏 HAND CRICKET</button>`;
        html += `<button class="shop-btn" ${disAttr} style="width: 100%; padding: 25px; font-size: 18px; background: #111; color: #FF3E3E; border: 2px solid #333; border-radius: 8px; font-weight: 900; ${disStyle} transition: 0.3s;" onmouseover="this.style.borderColor='#FF3E3E'; this.style.boxShadow='0 0 15px rgba(255, 62, 62, 0.3)';" onmouseout="this.style.borderColor='#333'; this.style.boxShadow='none';" onclick="window.switchToHorrorGame();">📱 PHONE MESSAGE HORROR</button>`;
        html += `</div>`;
    }
    else if (currentShopView === 'quests') {
        let refreshCost = window.questRefreshes === 0 ? "FREE" : "$100";
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #222; padding: 10px; border-radius: 6px; border-bottom: 2px solid #FFD700;"><button onclick="switchShopView('menu')" ${disAttr} style="background: #444; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; ${disStyle}">&larr; BACK</button><div style="color: #FFD700; font-weight: 900; font-size: 16px; letter-spacing: 1px;">DAILY QUESTS</div></div>`;
        html += `<button onclick="refreshQuests()" style="background:#8A2BE2; color:#FFF; font-weight:bold; padding: 10px; border-radius:6px; border:none; width: 100%; margin-bottom:10px; cursor:pointer; box-shadow: 0 0 10px #8A2BE2;">🔄 REFRESH QUESTS (${refreshCost})</button>`;
        dailyQuests.forEach((q, i) => {
            let isComplete = q.progress >= q.target;
            let btnHtml = q.claimed ? `<button disabled style="background:#444; color:#888; border:none; padding:8px; border-radius:4px; font-weight:bold;">CLAIMED</button>` :
                (isComplete ? `<button onclick="claimQuest(${i})" style="background:#39FF14; color:#000; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer; box-shadow: 0 0 10px #39FF14;">CLAIM $${q.reward}</button>` : `<div style="color:#FFD700; font-weight:bold; font-size:14px;">$${q.reward}</div>`);
            html += `<div style="background: #1a1a1a; border: 1px solid #444; border-radius: 6px; padding: 15px; margin-bottom: 10px; display:flex; justify-content: space-between; align-items: center;"><div><div style="color: #FFF; font-weight: bold; font-size: 14px; margin-bottom: 5px;">${q.desc}</div><div style="color: #00FFFF; font-size: 12px;">Progress: ${q.progress} / ${q.target}</div></div>${btnHtml}</div>`;
        });
    }
    else if (currentShopView === 'collection') {
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #222; padding: 10px; border-radius: 6px; border-bottom: 2px solid #39FF14;"><button onclick="switchShopView('menu')" ${disAttr} style="background: #444; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; ${disStyle}">&larr; BACK</button><div style="color: #39FF14; font-weight: 900; font-size: 16px; letter-spacing: 1px;">MY COLLECTION</div></div>`;

        function renderGroup(title, arr, icon) {
            let owned = arr.filter(i => i.owned); if (owned.length === 0) return '';
            let out = `<div style="color:#fff; font-weight:bold; margin-top:15px; border-bottom:1px dashed #444; padding-bottom:5px;">${icon} ${title}</div><div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:5px;">`;
            owned.forEach(i => {
                let name = i.name || i.text || i.reward || i.emote || i;
                let safeName = (typeof name === 'string') ? name.replace(/'/g, "\\'") : 'Item';
                let itemId = i.id !== undefined ? i.id : 0;
                out += `<div onclick="window.showCollectionItemOptions('${title}', ${itemId}, '${safeName}')" style="background:#111; border:1px solid #555; padding:6px 10px; border-radius:4px; font-size:12px; color:#ccc; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#222'; this.style.borderColor='#39FF14';" onmouseout="this.style.background='#111'; this.style.borderColor='#555';">${name}</div>`;
            });
            return out + `</div>`;
        }
        html += `<div style="overflow-y:auto; max-height: 400px; padding-right:5px;">`;
        html += renderGroup('Strikers', shopItems, '🎯'); html += renderGroup('Coins', coinShopItems, '🪙'); html += renderGroup('Boards', boardShopItems, '🔲');
        html += renderGroup('Effects', pocketEffects, '✨'); html += renderGroup('Sounds', soundShopItems, '🔊'); html += renderGroup('Avatars', avatarItems, '👤');
        html += renderGroup('Titles', titleItems, '🏷️'); html += renderGroup('Pets', petShopItems.filter(p => p.id !== 0), '🐶');
        let emoteArr = unlockedEmotes.map(e => ({ name: e, owned: true })); html += renderGroup('Emotes', emoteArr, '😀');
        if (hasVictoryEffect) html += `<div onclick="window.showCollectionItemOptions('Special', 'VictoryFireworks', 'Victory Fireworks')" style="background:#111; border:1px solid #555; padding:6px 10px; border-radius:4px; font-size:12px; color:#FFD700; margin-top:10px; display:inline-block; cursor:pointer;" onmouseover="this.style.borderColor='#39FF14'" onmouseout="this.style.borderColor='#555'">🎇 Victory Fireworks</div> `;
        if (hasMegaFireworks) html += `<div onclick="window.showCollectionItemOptions('Special', 'MegaFireworks', 'Mega Fireworks')" style="background:#111; border:1px solid #555; padding:6px 10px; border-radius:4px; font-size:12px; color:#FF1493; margin-top:10px; display:inline-block; cursor:pointer;" onmouseover="this.style.borderColor='#39FF14'" onmouseout="this.style.borderColor='#555'">🎇 Mega Fireworks</div> `;
        if (hasFemaleVoice) html += `<div onclick="window.showCollectionItemOptions('Special', 'FemaleVoice', 'Female Voice FX')" style="background:#111; border:1px solid #555; padding:6px 10px; border-radius:4px; font-size:12px; color:#00FFFF; margin-top:10px; display:inline-block; cursor:pointer;" onmouseover="this.style.borderColor='#39FF14'" onmouseout="this.style.borderColor='#555'">🎙️ Female Voice FX</div>`;
        html += `</div>`;
    }
    else if (currentShopView === 'friends') {
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: rgba(0,0,0,0.6); padding: 10px; border-radius: 10px; border-bottom: 2px solid #1E90FF; backdrop-filter: blur(8px);">`;
        html += `<button onclick="switchShopView('menu')" ${disAttr} style="background: #222; color: #fff; border: 1px solid #444; padding: 6px 12px; border-radius: 6px; font-weight: 900; font-size: 10px; cursor: pointer; letter-spacing: 1px; transition: 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.3); ${disStyle}" onmouseover="if(!this.disabled){this.style.background='#333'; this.style.borderColor='#1E90FF';}" onmouseout="if(!this.disabled){this.style.background='#222'; this.style.borderColor='#444';}">← BACK</button>`;
        html += `<div style="color: #1E90FF; font-weight: 950; font-size: 16px; letter-spacing: 1px; text-shadow: 0 0 10px rgba(30,144,255,0.4);">FRIENDS BAR</div></div>`;

        // Search Bar Implementation
        html += `
            <div style="margin-bottom: 15px; background: #000; padding: 6px; border-radius: 8px; border: 1px solid #333; display: flex; gap: 8px;">
                <input type="text" id="friend-search-input" onkeyup="if(event.key==='Enter') window.searchFriendAction()" placeholder="FIND FRIENDS..." style="flex: 1; min-width: 0; background: #000; border: none; padding: 8px 12px; color: #FFF; font-size: 14px; outline: none; font-weight: bold; letter-spacing: 1px;">
                <button onclick="window.searchFriendAction()" style="background: #1E90FF; color: #FFF; border: none; padding: 0 15px; border-radius: 6px; font-weight: 900; cursor: pointer; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase;">SEARCH</button>
            </div>
            <div id="search-results-area" style="display: none; margin-bottom: 15px; padding: 12px; border-radius: 10px; background: rgba(30,144,255,0.08); border: 2px dashed #1E90FF; animation: badgeSlideUp 0.3s ease-out;"></div>
        `;

        html += `<div style="overflow-y:auto; overflow-x:hidden; max-height: 440px; padding-right:4px;">`;
        if (window.mpFriends && window.mpFriends.length > 0) {
            window.mpFriends.forEach((friend, i) => {
                let isOnline = friend.status === 'online';
                let statusColor = isOnline ? '#39FF14' : (friend.status === 'in_match' ? '#FFD700' : '#666');
                let statusText = friend.status === 'in_match' ? 'IN MATCH' : friend.status.toUpperCase();

                let actionHtml = '';
                if (isOnline) {
                    let inviteBtnStr = friend.invited ? "INVITED" : "CHALLENGE";
                    let btnStyle = friend.invited ? "background:#333;color:#666;cursor:not-allowed;" : "background:linear-gradient(135deg,#1E90FF,#0055CC);color:#FFF;cursor:pointer;box-shadow:0 0 15px rgba(30,144,255,0.5);";
                    let disAttrF = friend.invited ? "disabled" : "";
                    actionHtml = `<button ${disAttrF} onclick="window.inviteFriend(${i})" style="${btnStyle} border:none;padding:8px 16px;border-radius:6px;font-weight:900;font-size:11px;letter-spacing:1px;text-transform:uppercase;transition:0.2s;" onmouseover="if(!this.disabled) this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';">${inviteBtnStr}</button>`;
                } else if (friend.status === 'in_match') {
                    let bookIcon = friend.isBooked ? "✅" : "🤩";
                    let bookBtnStyle = friend.isBooked ? "background:rgba(255,255,255,0.1);color:#666;cursor:not-allowed;" : "background:linear-gradient(135deg,#FFD700,#FFA500);cursor:pointer;box-shadow:0 0 10px rgba(255,215,0,0.3);";
                    let bookDis = friend.isBooked ? "disabled" : "";

                    actionHtml = `
                        <div style="display:flex;gap:8px;align-items:center;">
                            <button onclick="window.spectateFriend(${i})" style="background:rgba(0,0,0,0.6); border:2px solid #FFD700; color:#FFF; padding:0; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:18px; transition:0.3s;" onmouseover="this.style.transform='scale(1.1)';" onmouseout="this.style.transform='scale(1)';">👁️</button>
                            <button ${bookDis} onclick="window.bookFriend(${i})" title="BOOKING OPTION" style="${bookBtnStyle} border:none;padding:0;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;transition:0.2s;" onmouseover="if(!this.disabled) this.style.transform='scale(1.1)';" onmouseout="this.style.transform='scale(1)';">${bookIcon}</button>
                        </div>
                    `;
                } else {
                    // Offline or other status
                    let bookIcon = friend.isBooked ? "✅" : "🤩";
                    let bookBtnStyle = friend.isBooked ? "background:rgba(255,255,255,0.1);color:#666;cursor:not-allowed;" : "background:linear-gradient(135deg,#FFD700,#FFA500);cursor:pointer;box-shadow:0 0 10px rgba(255,215,0,0.3);";
                    let bookDis = friend.isBooked ? "disabled" : "";
                    actionHtml = `<button ${bookDis} onclick="window.bookFriend(${i})" title="BOOKING OPTION" style="${bookBtnStyle} border:none;padding:0;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;transition:0.2s;" onmouseover="if(!this.disabled) this.style.transform='scale(1.1)';" onmouseout="this.style.transform='scale(1)';">${bookIcon}</button>`;
                }

                html += `<div style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg, #181818, #111);border:1px solid #222;padding:12px;border-radius:10px;margin-bottom:10px;box-shadow: 0 4px 10px rgba(0,0,0,0.4); transition: 0.3s; overflow:hidden;" onmouseover="this.style.borderColor='#1E90FF';" onmouseout="this.style.borderColor='#222';">`;
                html += `<div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;">`;
                html += `<div onclick="window.showFriendProfile(${i})" style="font-size:28px; flex-shrink:0; cursor:pointer; transition:0.2s;" onmouseover="this.style.transform='scale(1.15)';" onmouseout="this.style.transform='scale(1)';">${friend.avatar}</div>`;
                html += `<div style="min-width:0; flex:1;">`;
                html += `<div onclick="window.showFriendProfile(${i})" style="color:#FFF;font-weight:900;font-size:14px;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;" onmouseover="this.style.color='#00FFFF'" onmouseout="this.style.color='#FFF'">${friend.name}</div>`;
                html += `<div style="color:${statusColor};font-size:9px;font-weight:900;display:flex;align-items:center;gap:5px;margin-top:2px;">`;
                html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};box-shadow: 0 0 6px ${statusColor}; flex-shrink:0;"></span> ${statusText}</div>`;
                html += `</div></div>`;
                html += `<div style="flex-shrink:0; margin-left:10px; display:flex; align-items:center; gap:8px;">`;
                html += actionHtml;
                html += `<button onclick="window.deleteFriendAction(${i})" style="background:rgba(255,50,50,0.1); border:1px solid rgba(255,50,50,0.3); color:#FF3333; width:30px; height:30px; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; transition:0.2s;" onmouseover="this.style.background='rgba(255,50,50,0.2)'; this.style.borderColor='#FF3333';" onmouseout="this.style.background='rgba(255,50,50,0.1)'; this.style.borderColor='rgba(255,50,50,0.3)';">🗑️</button>`;
                html += `</div>`;
                html += `</div>`;
            });
        } else {
            html += `<div style="text-align: center; color: #555; margin-top: 50px; font-weight: 900; font-size:14px; letter-spacing:2px; text-transform:uppercase;">Offline</div>`;
        }
        html += `</div>`;
    }
    else if (currentShopView === 'purchasing_place') {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #222; padding: 10px; border-radius: 6px; border-bottom: 2px solid #FF1493;"><button onclick="switchShopView('menu')" ${disAttr} style="background: #444; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; ${disStyle}">&larr; BACK</button><div style="color: #FF1493; font-weight: 900; font-size: 16px; letter-spacing: 1px;">SHOPS</div></div>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #222; border: 2px solid #FFD700; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold;" onclick="switchShopView('strikers')">STRIKER SHOP</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #222; border: 2px solid #39FF14; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold;" onclick="switchShopView('coins')">COIN SHOP</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #222; border: 2px solid #00FFFF; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold;" onclick="switchShopView('pockets')">EFFECT SHOP</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #222; border: 2px solid #FF4500; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold;" onclick="switchShopView('boards')">BOARD SHOP</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #222; border: 2px solid #FF8C00; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold;" onclick="switchShopView('sounds')">SOUND SHOP</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #222; border: 2px solid #FF1493; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold; box-shadow: 0 0 10px #FF1493;" onclick="switchShopView('pets')">🐶 PET SHOP</button>
            <button class="shop-btn btn-buy" ${disAttr} style="width: 100%; margin-bottom: 12px; padding: 15px; font-size: 16px; background: #222; border: 2px solid #8A2BE2; color: #FFF; ${disStyle} border-radius: 6px; font-weight: bold;" onclick="switchShopView('customize')">🎨 AVATAR & TITLE SHOP</button>
        `;
    }
    else if (currentShopView === 'customize') {
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #222; padding: 10px; border-radius: 6px; border-bottom: 2px solid #FF1493;"><button onclick="switchShopView('purchasing_place')" ${disAttr} style="background: #444; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; ${disStyle}">&larr; BACK</button><div style="color: #FF1493; font-weight: 900; font-size: 16px; letter-spacing: 1px;">AVATAR & TITLE</div></div>`;
        html += `<div style="color: #FFF; font-weight: bold; margin-bottom: 10px; border-bottom: 1px dashed #444; padding-bottom: 5px; font-size: 14px;">PLAYER AVATARS</div>`;
        avatarItems.forEach(item => { let isEquipped = equippedAvatarId === item.id; let isBossItem = item.price === 99999; let btnClass = isEquipped ? 'btn-equipped' : (item.owned ? 'btn-equip' : 'btn-buy'); let btnText = isEquipped ? 'EQUIPPED' : (item.owned ? 'EQUIP' : (isBossItem ? 'DEFEAT BOSSES' : `$${item.price}`)); let borderStyle = isEquipped ? `border: 1px solid #FF1493;` : 'border: 1px solid transparent;'; let disBtn = disAttr || (isBossItem && !item.owned) ? 'disabled' : ''; let btnStyleStr = (isBossItem && !item.owned) ? 'background:#444; color:#888; border:none;' : ''; html += `<div class="striker-card" style="${borderStyle}"><div class="striker-info"><div class="striker-name" style="font-size: 20px;">${item.icon} <span style="font-size: 14px; vertical-align: middle;">${item.name}</span></div></div><button class="shop-btn ${btnClass}" ${disBtn} style="${btnStyleStr}" onclick="buyOrEquipAvatar(${item.id})">${btnText}</button></div>`; });
        html += `<div style="color: #FFF; font-weight: bold; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px dashed #444; padding-bottom: 5px; font-size: 14px;">PLAYER TITLES</div>`;
        titleItems.forEach(item => { let isEquipped = equippedTitleId === item.id; let isBossItem = item.price === 99999; let btnClass = isEquipped ? 'btn-equipped' : (item.owned ? 'btn-equip' : 'btn-buy'); let btnText = isEquipped ? 'EQUIPPED' : (item.owned ? 'EQUIP' : (isBossItem ? 'DEFEAT BOSSES' : `$${item.price}`)); let borderStyle = isEquipped ? `border: 1px solid #00FFFF;` : 'border: 1px solid transparent;'; let disBtn = disAttr || (isBossItem && !item.owned) ? 'disabled' : ''; let btnStyleStr = (isBossItem && !item.owned) ? 'background:#444; color:#888; border:none;' : ''; html += `<div class="striker-card" style="${borderStyle}"><div class="striker-info"><div class="striker-name" style="color: #00FFFF;">${item.text}</div></div><button class="shop-btn ${btnClass}" ${disBtn} style="${btnStyleStr}" onclick="buyOrEquipTitle(${item.id})">${btnText}</button></div>`; });
    }
    else if (currentShopView === 'pass') {
        html += `<canvas id="pass-particles" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; border-radius: 8px;"></canvas>`;
        html += `<div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: rgba(34,34,34,0.8); padding: 10px; border-radius: 6px; border-bottom: 2px solid #FFD700;"><button onclick="switchShopView('menu')" ${disAttr} style="background: #444; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; ${disStyle}">&larr; BACK</button><div style="color: #FFD700; font-weight: 900; font-size: 16px; letter-spacing: 1px;">CARROM PASS (Round ${currentPassRound})</div></div>`;

        if (passCooldownEndTime > Date.now()) {
            html += `<div style="position: relative; z-index: 1; text-align: center; margin-top: 50px; background: #111; padding: 30px; border-radius: 10px; border: 2px dashed #00FFFF;"><div style="color: #00FFFF; font-size: 24px; font-weight: bold; margin-bottom: 15px;">PASS COMPLETED! 🎉</div><div style="color: #bbb; font-size: 14px; margin-bottom: 5px;">NEXT ROUND STARTS IN:</div><div id="pass-timer" style="font-size: 40px; color: #39FF14; font-weight: 900; text-shadow: 0 0 10px #39FF14;">02:00</div></div>`;
        } else {
            html += `<div style="position: relative; z-index: 1; text-align: center; margin-bottom: 10px; padding: 8px; background: #111; border-radius: 6px; border: 1px solid #444; color: #FFF;"><strong>MATCHES PLAYED: <span style="color:#00FFFF; font-size:16px;">${passMatchesPlayed}</span></strong></div>`;
            html += `<button onclick="buyPremiumPass()" class="shop-btn" ${hasPremiumPass || shopDisabled ? 'disabled' : ''} style="position: relative; z-index: 1; width:100%; margin-bottom: 15px; background: ${hasPremiumPass ? '#222' : 'linear-gradient(45deg, #FF1493, #8A2BE2)'}; color: ${hasPremiumPass ? '#FFD700' : '#FFF'}; font-weight: bold; font-size: 16px; padding: 15px; border: ${hasPremiumPass ? '2px solid #FFD700' : 'none'}; border-radius: 6px; cursor: ${hasPremiumPass || shopDisabled ? 'not-allowed' : 'pointer'}; box-shadow: ${hasPremiumPass ? 'none' : '0 0 10px #8A2BE2'};">${hasPremiumPass ? '👑 PREMIUM PASS UNLOCKED 👑' : '💎 BUY PREMIUM PASS ($90)'}</button>`;

            let fTierArr = freePassRounds[currentPassRound] || freePassRounds[1];
            for (let i = 0; i < 5; i++) {
                let fTier = fTierArr[i]; let pTier = premiumPassTiers[i]; let fClaimed = freePassClaims[i]; let fCanClaim = passMatchesPlayed >= fTier.req && !fClaimed; let pClaimed = premiumPassClaims[i]; let pCanClaim = passMatchesPlayed >= pTier.req && !pClaimed && hasPremiumPass;
                let fBtnText = fClaimed ? "CLAIMED" : (fCanClaim ? "CLAIM FREE" : `Req: ${fTier.req} Matches`); let pBtnText = pClaimed ? "CLAIMED" : (!hasPremiumPass ? "LOCKED" : (pCanClaim ? "CLAIM PREMIUM" : `Req: ${pTier.req} Matches`));
                let fBtnStyle = fCanClaim ? "background:#39FF14; color:#000; font-weight:bold; box-shadow:0 0 8px #39FF14;" : (fClaimed ? "background:#444; color:#888;" : "background:#222; color:#888;"); let pBtnStyle = pCanClaim ? "background:#FFD700; color:#000; font-weight:bold; box-shadow:0 0 8px #FFD700;" : (pClaimed ? "background:#444; color:#888;" : "background:#222; color:#888;");
                html += `<div style="position: relative; z-index: 1; background: #1a1a1a; border: 1px solid #444; border-radius: 6px; margin-bottom: 10px; overflow: hidden;"><div style="text-align: center; background: #333; color: #FFF; font-size: 14px; padding: 6px; font-weight: bold;">TIER ${i + 1} (Req: ${fTier.req} Matches)</div><div style="display: flex;"><div style="flex: 1; padding: 10px; border-right: 1px solid #444; text-align: center; background: #111;"><div style="color: #00FFFF; font-size: 14px; margin-bottom: 6px; font-weight:bold; letter-spacing:1px;">FREE PASS</div><div style="color: #FFF; font-size: 13px; margin-bottom: 10px; height: 30px;">${fTier.reward}</div><button class="shop-btn" ${fCanClaim && !shopDisabled ? '' : 'disabled'} style="width: 100%; padding: 8px; border-radius: 4px; font-size: 12px; cursor: ${fCanClaim && !shopDisabled ? 'pointer' : 'not-allowed'}; border: none; ${fBtnStyle}" onclick="claimReward('free', ${i})">${fBtnText}</button></div><div style="flex: 1; padding: 10px; text-align: center; background: #1a0f2e;"><div style="color: #FFD700; font-size: 14px; margin-bottom: 6px; font-weight:bold; letter-spacing:1px;">PREMIUM</div><div style="color: #FFF; font-size: 13px; margin-bottom: 10px; height: 30px;">${pTier.reward}</div><button class="shop-btn" ${(pCanClaim || (!hasPremiumPass && !pClaimed)) && !shopDisabled ? '' : 'disabled'} style="width: 100%; padding: 8px; border-radius: 4px; font-size: 12px; cursor: ${pCanClaim && !shopDisabled ? 'pointer' : 'not-allowed'}; border: none; ${pBtnStyle}" onclick="claimReward('premium', ${i})">${pBtnText}</button></div></div></div>`;
            }
        }
    }
    else if (currentShopView === 'replays') {
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #222; padding: 10px; border-radius: 6px; border-bottom: 2px solid #00FFFF;"><button onclick="switchShopView('menu')" ${disAttr} style="background: #444; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; ${disStyle}">&larr; BACK</button><div style="color: #00FFFF; font-weight: 900; font-size: 16px; letter-spacing: 1px;">MATCH REPLAYS</div></div>`;
        if (recordedMatches.length === 0) {
            html += `<div style="text-align: center; margin-top: 50px; color: #888; font-size: 14px;"><div style="font-size: 40px; margin-bottom: 15px;">🎥</div>No recorded matches yet.<br>Play a match and it will be recorded automatically!</div>`;
        } else {
            recordedMatches.forEach((match, i) => {
                html += `<div style="background: #1a1a1a; border: 1px solid #444; border-radius: 6px; padding: 12px; margin-bottom: 10px; display:flex; justify-content: space-between; align-items: center;">`;
                html += `<div><div style="color: #FFF; font-weight: bold; font-size: 13px; margin-bottom: 4px;">${match.name}</div><div style="color: #888; font-size: 11px;">${match.time}</div></div>`;
                html += `<div style="display:flex; gap:5px;"><button onclick="window.playReplayVideo('${match.url}')" style="background: #00FFFF; color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; cursor: pointer;">▶ PLAY</button>`;
                html += `<button onclick="recordedMatches.splice(${i}, 1); renderSidebarShop();" style="background: #FF3333; color: #FFF; border: none; padding: 6px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; cursor: pointer;">✕</button></div></div>`;
            });
        }
    }
    else if (currentShopView === 'multiplayer') {
        let isLobby = (window.mpState === 'lobby_2v2' || window.mpState === 'lobby_1v1' || window.mpState === 'quick_join_search' || window.mpState === 'quick_join_select');
        let isMeHost = window.mpPlayers && window.mpPlayers[0] && window.mpPlayers[0].isMe;
        let lobbyBtnText = isMeHost ? "✕ CLOSE ROOM" : "✕ EXIT ROOM";

        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: linear-gradient(135deg, #0a1628, #1a2a4a); padding: 12px; border-radius: 6px; border-bottom: 2px solid #1E90FF;">`;
        html += `<div style="display: flex; gap: 8px;">`;
        html += `<button onclick="window.leaveMultiplayerLobby(); window.switchShopView('menu');" ${disAttr} style="background: #000; color: #fff; border: 1px solid #444; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; cursor: pointer; ${disStyle}" onmouseover="this.style.background='#FFF'; this.style.color='#000';" onmouseout="this.style.background='#000'; this.style.color='#FFF';">&larr; BACK</button>`;
        if (isLobby) {
            html += `<button onclick="window.leaveMultiplayerLobby()" ${disAttr} style="background: #000; color: #FFF; border: 1px solid #FF3333; padding: 5px 12px; border-radius: 4px; font-weight: 950; font-size: 10px; cursor: pointer; letter-spacing: 0.5px; ${disStyle}" onmouseover="this.style.background='#FF3333'; this.style.color='#FFF';" onmouseout="this.style.background='#000'; this.style.color='#FFF';">${lobbyBtnText}</button>`;
        }
        html += `</div>`;

        let highestPing = 0;
        let slowPlayerName = "";
        let isConnected = (socket && socket.connected && navigator.onLine);
        let hasPingData = false;

        if (window.mpPlayers) {
            window.mpPlayers.forEach(p => {
                if (p && p.ping !== undefined) {
                    hasPingData = true;
                    if (p.ping > highestPing) {
                        highestPing = p.ping;
                        if (p.ping > 300) slowPlayerName = p.name;
                    }
                }
            });
        }

        let wifiColor = highestPing > 500 ? '#FF3333' : (highestPing > 200 ? '#FFD700' : '#39FF14');
        if (!navigator.onLine) {
            wifiColor = '#FF3333';
        } else if (!socket || !socket.connected || !hasPingData) {
            wifiColor = '#39FF14'; // Default to green if internet is up but ping not ready
        }

        // Calculate number of bars (1-4) based on ping
        let numBars = 0;
        if (!navigator.onLine) {
            numBars = 0;
        } else if (!socket || !socket.connected || !hasPingData) {
            numBars = 4; // Fake 4 green bars because their physical internet is perfectly fine
        } else {
            if (highestPing <= 120) numBars = 4;
            else if (highestPing <= 250) numBars = 3;
            else if (highestPing <= 500) numBars = 2;
            else numBars = 1;
        }

        html += `<div style="display: flex; align-items: center; gap: 12px;">`;
        let meterBorder = !navigator.onLine ? 'border: 1px solid #FF3333;' : 'border: 1px solid rgba(255,255,255,0.1);';
        let meterShadow = !navigator.onLine ? 'box-shadow: 0 0 10px rgba(255,51,51,0.5);' : '';
        html += `<div id="mp-network-meter" onclick="window.showPingDetails()" style="cursor: pointer; position: relative; background: rgba(0,0,0,0.5); padding: 4px 6px; border-radius: 6px; ${meterBorder} ${meterShadow} display: flex; align-items: flex-end; gap: 2px; height: 22px; width: 34px; box-sizing: border-box;">`;

        // Render 4 signal bars
        for (let i = 1; i <= 4; i++) {
            let active = i <= numBars && numBars > 0;
            let barHeight = 4 + (i * 3); // 7px, 10px, 13px, 16px
            let bColor = active ? wifiColor : 'rgba(255,255,255,0.15)';
            // Use staggered transitions instead of animations to prevent looping on re-render
            let delay = active ? (i * 0.08) : 0;
            let currentHeight = active ? barHeight : 2;
            html += `<div style="width: 4px; height: ${currentHeight}px; background: ${bColor}; border-radius: 1px; transition: height 0.3s ease-out ${delay}s, background 0.3s, box-shadow 0.3s; box-shadow: ${active ? '0 0 5px ' + bColor : 'none'};"></div>`;
        }

        if (!navigator.onLine) {
            html += `<div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); background: #111; color: #FF3333; font-size: 8px; font-weight: 950; padding: 2px 8px; border-radius: 4px; white-space: nowrap; border: 1px solid #FF3333; letter-spacing: 0.5px; animation: blink 1s infinite;">NO INTERNET</div>`;
        } else if (!socket || !socket.connected) {
            html += `<div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); background: #111; color: #FFD700; font-size: 8px; font-weight: 950; padding: 2px 8px; border-radius: 4px; white-space: nowrap; border: 1px solid #FFD700; letter-spacing: 0.5px; animation: blink 1s infinite;">CONNECTING...</div>`;
        } else if (!hasPingData) {
            html += `<div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); background: #222; color: #888; font-size: 8px; font-weight: 950; padding: 2px 8px; border-radius: 4px; white-space: nowrap; border: 1px solid #444; letter-spacing: 0.5px;">SEARCHING...</div>`;
        } else if (slowPlayerName) {
            html += `<div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); background: #FF3333; color: #FFF; font-size: 8px; font-weight: 950; padding: 2px 8px; border-radius: 4px; white-space: nowrap; animation: blink 1s infinite; letter-spacing: 0.5px; border: 1px solid #FFF;">SLOW: ${slowPlayerName.toUpperCase()}</div>`;
        }
        html += `</div>`;
        
        let pingDisplayStr = (!navigator.onLine || !socket || !socket.connected || !hasPingData) ? '-- ms' : highestPing + ' ms';
        html += `<div style="color: ${wifiColor}; font-size: 12px; font-weight: 950; letter-spacing: 1px; min-width: 45px; text-align: right; text-shadow: 0 0 5px ${wifiColor};">${pingDisplayStr}</div>`;
        
        html += `<div style="color: #FFF; font-weight: 900; font-size: 16px; letter-spacing: 2px; text-shadow: none;">🌐 MULTIPLAYER HUB</div></div></div>`;

        if (!window.pingSyncStarted) {
            window.pingSyncStarted = true;

            // CSS Animation for bars
            let style = document.getElementById('net-bar-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'net-bar-style';
                style.innerHTML = `@keyframes netBarGrow { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }`;
                document.head.appendChild(style);
            }

            // Immediate UI update if browser goes offline/online
            window.addEventListener('offline', () => { renderSidebarShop(); });
            window.addEventListener('online', () => { renderSidebarShop(); window.doInitialPing(); });

            window.doInitialPing = function () {
                if ((window.roomIdMP || window.mpRoomId) && socket && socket.connected && navigator.onLine) {
                    let start = Date.now();
                    socket.emit('ping_local', () => {
                        let currentPing = Date.now() - start;
                        if (currentPing === 0) currentPing = 1;

                        // Force local update immediately for instant feedback
                        if (window.mpPlayers) {
                            let me = window.mpPlayers.find(pl => pl && pl.isMe);
                            if (me) {
                                me.ping = currentPing;
                                const focused = document.activeElement;
                                if (!focused || (focused.tagName !== 'SELECT' && focused.tagName !== 'INPUT')) {
                                    renderSidebarShop();
                                }
                            }
                        }

                        socket.emit('sync_ping', { roomId: window.roomIdMP || window.mpRoomId, ping: currentPing });
                    });
                }
            };

            // Call immediately (much faster now)
            setTimeout(window.doInitialPing, 100);

            // Sync every 1s for fast reaction
            setInterval(window.doInitialPing, 1000);
        }

        window.showPingDetails = function () {
            let status = "NETWORK STATUS REFRESHED\n\n";
            if (!window.mpPlayers || window.mpPlayers.every(p => !p)) {
                status += "• STABLE CONNECTION (LOCAL)";
            } else {
                window.mpPlayers.forEach(p => {
                    if (p) {
                        let ping = p.ping !== undefined ? p.ping + "ms" : "Calculating...";
                        let qual = p.ping > 500 ? "CRITICAL 🔴" : (p.ping > 200 ? "POOR 🟡" : "EXCELLENT 🟢");
                        if (p.isMe) status += `• ${p.name.toUpperCase()} (YOU): ${ping} [${qual}]\n`;
                        else status += `• ${p.name.toUpperCase()}: ${ping} [${qual}]\n`;
                    }
                });
            }
            if (slowPlayerName) {
                status += `\n⚠️ CAUTION: ${slowPlayerName.toUpperCase()}'S NET IS TOO SLOW. PLEASE CHECK YOUR CONNECTION!`;
            }
            window.customAlert(status, "NETWORK ANALYSIS");
        };

        window.mpState = window.mpState || 'select';

        if (window.mpState === 'select') {
            // Background animation container
            html += `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow:hidden;">`;
            for (let i = 0; i < 8; i++) {
                html += `<div class="mp-hub-data-stream" style="left: ${10 + i * 12}%; animation-delay: ${i * 0.6}s;"></div>`;
            }
            html += `</div>`;

            html += `<div style="text-align:center; margin-bottom:20px; color:#FFF; font-weight:bold; font-size: 14px; position:relative; z-index:1;">SELECT PLAY MODE</div>`;
            html += `<div style="display: flex; gap: 15px; margin-bottom: 20px; position: relative; z-index: 1;">`;
            html += `<button onclick="window.click1V1(true)" style="flex:1; padding: 30px 10px; background: #000; border: 1px solid #444; border-radius: 8px; font-size: 24px; font-weight: 900; color: #FFF; cursor: pointer; box-shadow: none;">CREATE 1V1</button>`;
            html += `<button onclick="window.click2VS2(true)" style="flex:1; padding: 30px 10px; background: #000; border: 1px solid #444; border-radius: 8px; font-size: 24px; font-weight: 900; color: #FFF; cursor: pointer; box-shadow: none;">CREATE 2V2</button>`;
            html += `</div>`;
            html += `<div style="text-align:center; margin-bottom:10px; color:#FFF; font-weight:bold; font-size: 14px; position:relative; z-index:1;">OR JOIN MATCH</div>`;
            html += `<div style="display: flex; gap: 15px; margin-bottom: 20px; position: relative; z-index: 1;">`;
            html += `<button onclick="window.click1V1(false)" style="flex:1; padding: 15px; background: #000; border: 1px solid #333; border-radius: 8px; font-size: 14px; font-weight: 900; color: #FFF; cursor: pointer;">JOIN 1V1</button>`;
            html += `<button onclick="window.click2VS2(false)" style="flex:1; padding: 15px; background: #000; border: 1px solid #333; border-radius: 8px; font-size: 14px; font-weight: 900; color: #FFF; cursor: pointer;">JOIN 2V2</button>`;
            html += `</div>`;

            html += `<button onclick="window.showQuickJoinSelect()" style="width: 100%; padding: 20px; background: #000; border: 1px solid #555; border-radius: 12px; font-size: 20px; font-weight: 950; color: #FFF; cursor: pointer; box-shadow: none; position: relative; z-index: 1; letter-spacing: 2px; text-transform: uppercase; transition: 0.3s;" onmouseover="this.style.background='#111';" onmouseout="this.style.background='#000';">⚡ QUICK JOIN</button>`;
        } else if (window.mpState === 'join_selection') {
            html += `
                <div style="text-align:center; padding: 40px 20px; position:relative; z-index:1;">
                    <div style="font-size: 50px; margin-bottom: 20px;">🔑</div>
                    <div style="color: #FFF; font-size: 20px; font-weight: 900; margin-bottom: 10px; letter-spacing: 2px;">JOIN PRIVATE ROOM</div>
                    <div style="color: #888; font-size: 13px; margin-bottom: 30px;">Enter the Room ID provided by the host to join their session.</div>
                    
                    <div style="background: #000; border: 1px solid #444; border-radius: 12px; padding: 25px; box-shadow: none;">
                        <input type="text" id="room-id-input" maxlength="6" oninput="this.value = this.value.replace(/[^0-9]/g, '');" placeholder="ENTER 6-DIGIT ROOM ID" style="width: 100%; border: 1px solid #333; background: #000; color: #FFF; font-family: monospace; font-size: 24px; padding: 15px; text-align: center; border-radius: 8px; font-weight: bold; outline: none; margin-bottom: 20px; letter-spacing: 2px;">
                        <button onclick="window.joinRoomMP()" style="width: 100%; padding: 20px; background: #FFF; border: none; border-radius: 8px; color: #000; font-weight: 950; font-size: 18px; cursor: pointer; letter-spacing: 2px; transition: 0.3s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">CONNECT TO ROOM</button>
                        <button onclick="window.startQrScannerMP()" style="width: 100%; margin-top: 15px; padding: 15px; background: #000; border: 1px solid #444; border-radius: 8px; color: #FFF; font-weight: 950; font-size: 14px; cursor: pointer; letter-spacing: 2px; transition: 0.3s;" onmouseover="this.style.background='#111'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='#000'; this.style.transform='translateY(0)';">📷 SCAN QR</button>
                    </div>
                    
                    <button onclick="window.mpState='select'; renderSidebarShop();" style="margin-top: 30px; background: transparent; border: none; color: #555; font-weight: bold; cursor: pointer; text-decoration: underline;">GO BACK</button>
                </div>
            `;
        } else if (window.mpState === 'quick_join_select') {
            html += `<div style="text-align:center; margin: 40px 0 30px; color:#FFF; font-weight:950; font-size: 22px; letter-spacing: 2px; text-transform: uppercase;">SELECT MODE FOR QUICK JOIN</div>`;
            html += `<div style="display: flex; flex-direction: column; gap: 20px; padding: 0 50px;">`;
            html += `<button onclick="window.startQuickJoinSearch('1 VS 1')" style="padding: 25px; background: #000; border: 1px solid #444; border-radius: 12px; font-size: 20px; font-weight: 900; color: #FFF; cursor: pointer; box-shadow: none; transition: 0.3s;" onmouseover="this.style.background='#111';" onmouseout="this.style.background='#000';">1 VS 1</button>`;
            html += `<button onclick="window.startQuickJoinSearch('2 VS 2')" style="padding: 25px; background: #000; border: 1px solid #444; border-radius: 12px; font-size: 20px; font-weight: 900; color: #FFF; cursor: pointer; box-shadow: none; transition: 0.3s;" onmouseover="this.style.background='#111';" onmouseout="this.style.background='#000';">2 VS 2</button>`;
            html += `<button onclick="window.mpState='select'; renderSidebarShop();" style="margin-top: 20px; background: transparent; border: 1px solid #444; color: #666; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer;">CANCEL</button>`;
            html += `</div>`;
        } else if (window.mpState === 'quick_join_search') {
            let mode = window.quickJoinMode || 'MATCH';
            let timeLeft = window.quickJoinTimeLeft || 15;
            let isNoMatch = window.quickJoinNoMatch;

            html += `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; position: relative;">
                    <!-- Data Stream Animation -->
                    <div style="position: absolute; inset: 0; opacity: 0.1; overflow: hidden; pointer-events: none;">
                        <div class="mp-hub-data-stream" style="left: 20%; animation-duration: 2s;"></div>
                        <div class="mp-hub-data-stream" style="left: 50%; animation-duration: 3s; animation-delay: 1s;"></div>
                        <div class="mp-hub-data-stream" style="left: 80%; animation-duration: 2.5s; animation-delay: 0.5s;"></div>
                    </div>

                    <div style="z-index: 1; text-align: center; width: 100%;">
                        <div style="font-size: 40px; margin-bottom: 20px; animation: ${isNoMatch ? 'none' : 'mpHubPulse 2s infinite'};">${isNoMatch ? '⚠️' : '🔍'}</div>
                        <h2 style="color: #FFF; font-size: 24px; font-weight: 950; letter-spacing: 3px; margin: 0 0 10px; text-transform: uppercase;">${isNoMatch ? 'NO MATCH FOUND' : 'SEARCHING FOR ' + mode}</h2>
                        <p style="color: ${isNoMatch ? '#FF3333' : '#1E90FF'}; font-size: 11px; font-weight: 900; letter-spacing: 2px; margin-bottom: 40px; text-transform: uppercase;">${isNoMatch ? 'THERE IS NO MATCH CURRENT NOW' : 'Connecting to Global Matchmaking...'}</p>
                        
                        <!-- Circular Countdown -->
                        <div style="position: relative; width: 140px; height: 140px; margin: 0 auto 50px;">
                            <svg style="transform: rotate(-90deg); width: 140px; height: 140px;">
                                <circle cx="70" cy="70" r="65" stroke="#111" stroke-width="8" fill="transparent" />
                                <circle cx="70" cy="70" r="65" stroke="${isNoMatch ? '#FF3333' : '#39FF14'}" stroke-width="8" fill="transparent" stroke-dasharray="408.4" stroke-dashoffset="${isNoMatch ? 408.4 : 408.4 * (1 - timeLeft / 15)}" style="transition: stroke-dashoffset 1s linear; filter: drop-shadow(0 0 5px ${isNoMatch ? '#FF3333' : '#39FF14'});" />
                            </svg>
                            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #FFF; font-size: 42px; font-weight: 950; letter-spacing: -1px;">${isNoMatch ? '❌' : timeLeft}</div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
                            <div style="color: #555; font-size: 9px; font-weight: 900; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
                                <div style="width: 6px; height: 6px; background: ${isNoMatch ? '#FF3333' : '#39FF14'}; border-radius: 50%; ${isNoMatch ? '' : 'animation: blink 1s infinite;'}"></div>
                                ${isNoMatch ? 'ALL SERVERS BUSY' : 'ESTIMATED WAIT: < 20S'}
                            </div>
                            <button onclick="window.cancelQuickJoin()" style="background: rgba(255,51,51,0.1); border: 2px solid #FF3333; color: #FF3333; padding: 12px 30px; width: 220px; border-radius: 30px; font-weight: 950; font-size: 12px; letter-spacing: 2px; cursor: pointer; transition: 0.3s; text-transform: uppercase;" onmouseover="this.style.background='#FF3333'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(255,51,51,0.1)'; this.style.color='#FF3333';">CANCEL SEARCH</button>
                            <button onclick="window.startQuickJoinSearch('${mode}')" style="background: rgba(57,255,20,0.1); border: 2px solid #39FF14; color: #39FF14; padding: 12px 30px; width: 220px; border-radius: 30px; font-weight: 950; font-size: 12px; letter-spacing: 2px; cursor: pointer; transition: 0.3s; text-transform: uppercase;" onmouseover="this.style.background='#39FF14'; this.style.color='#000';" onmouseout="this.style.background='rgba(57,255,20,0.1)'; this.style.color='#39FF14';">⚡ REFRESH</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (window.mpState === 'lobby_2v2' || window.mpState === 'lobby_1v1') {
            let is1v1 = window.mpState === 'lobby_1v1';
            let isMeHost = window.mpPlayers && window.mpPlayers[0] && window.mpPlayers[0].isMe;
            let isFull = is1v1 ? (window.mpPlayers && window.mpPlayers[1]) : (window.mpPlayers && window.mpPlayers[0] && window.mpPlayers[1] && window.mpPlayers[2] && window.mpPlayers[3]);

            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`;
            html += `<div style="display: flex; gap: 10px; align-items: center;">`;
            html += `<div style="background: #000; color: #39FF14; padding: 10px 15px; border: 1px solid #39FF14; border-radius: 4px; font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 2px; box-shadow: 0 0 10px rgba(57,255,20,0.3);">ROOM ID: ${window.mpRoomId || '0000'}</div>`;

            // Mode Selector
            html += `<div style="background: #111; border: 1px solid #1E90FF; border-radius: 4px; padding: 5px 10px; display: flex; align-items: center; gap: 8px; opacity: ${isMeHost ? 1 : 0.6};">`;
            html += `<span style="color: #1E90FF; font-size: 10px; font-weight: bold; letter-spacing: 1px;">MODE:</span>`;
            html += `<select ${!isMeHost ? 'disabled' : ''} onchange="window.syncLobbySettingsMP({ selectedMode: this.value }); window.playSound('beep');" style="background: transparent; border: none; color: #FFF; font-weight: bold; font-size: 13px; outline: none; cursor: ${isMeHost ? 'pointer' : 'default'};">`;
            let mpModes = ['CLASSIC', 'DISC POOL', 'FREESTYLE'];
            window.mpSelectedMode = window.mpSelectedMode || 'CLASSIC';
            mpModes.forEach(m => {
                let sel = window.mpSelectedMode === m ? 'selected' : '';
                html += `<option value="${m}" ${sel} style="background: #111; color: #FFF;">${m}</option>`;
            });
            html += `</select>`;
            html += `</div>`;

            // Pets Allowed Selector
            html += `<div style="background: #111; border: 1px solid #FF1493; border-radius: 4px; padding: 5px 10px; display: flex; align-items: center; gap: 8px; opacity: ${isMeHost ? 1 : 0.6};">`;
            html += `<span style="color: #FF1493; font-size: 10px; font-weight: bold; letter-spacing: 1px;">PETS:</span>`;
            html += `<select ${!isMeHost ? 'disabled' : ''} onchange="window.syncLobbySettingsMP({ petsAllowed: this.value === 'YES' }); window.playSound('beep');" style="background: transparent; border: none; color: #FFF; font-weight: bold; font-size: 13px; outline: none; cursor: ${isMeHost ? 'pointer' : 'default'};">`;
            if (window.mpPetsAllowed === undefined) window.mpPetsAllowed = true;
            html += `<option value="YES" ${window.mpPetsAllowed ? 'selected' : ''} style="background: #111; color: #FFF;">ALLOWED</option>`;
            html += `<option value="NO" ${!window.mpPetsAllowed ? 'selected' : ''} style="background: #111; color: #FFF;">BANNED</option>`;
            html += `</select>`;
            html += `</div>`;

            if (window.mpSelectedMode === 'FREESTYLE') {
                html += `<div style="background: #111; border: 1px solid #FF4500; border-radius: 4px; padding: 5px 10px; display: flex; align-items: center; gap: 8px; opacity: ${isMeHost ? 1 : 0.6};">`;
                html += `<span style="color: #FF4500; font-size: 10px; font-weight: bold; letter-spacing: 1px;">POINTS:</span>`;
                html += `<select ${!isMeHost ? 'disabled' : ''} onchange="window.syncLobbySettingsMP({ targetScore: parseInt(this.value) }); window.playSound('beep');" style="background: transparent; border: none; color: #FFF; font-weight: bold; font-size: 13px; outline: none; cursor: ${isMeHost ? 'pointer' : 'default'};">`;
                let fsPoints = [120, 140, 160];
                window.freestyleTargetScore = window.freestyleTargetScore || 160;
                fsPoints.forEach(p => {
                    let sel = window.freestyleTargetScore === p ? 'selected' : '';
                    html += `<option value="${p}" ${sel} style="background: #111; color: #FFF;">${p}</option>`;
                });
                html += `</select>`;
                html += `</div>`;
            }

            html += `</div>`;

            if (window.mpPlayers && window.mpPlayers[0] && window.mpPlayers[0].isMe) {
                html += `<div style="display: flex; gap: 10px; margin-top: 10px; margin-bottom: 15px;">`;
                html += `<button onclick="window.kickPlayer()" style="background: #000; border: 1px solid #FF3333; color: #FFF; padding: 10px 15px; border-radius: 8px; cursor: pointer; width: 100%; font-size: 11px; font-weight: 950; letter-spacing: 1px; text-transform: uppercase; transition: 0.2s;" onmouseover="this.style.background='#FF3333'; this.style.color='#FFF';" onmouseout="this.style.background='#000'; this.style.color='#FFF';">👤 KICK PLAYER</button>`;
                html += `</div>`;
            }
            html += `</div>`;

            html += `<div style="margin-bottom: 10px; background: #1a1a1a; padding: 10px; border-radius: 8px; border: 1px solid #444; opacity: ${isMeHost ? 1 : 0.6};">`;
            let passLabel = window.mpPassword ? "ROOM PASSWORD (PRIVATE)" : "ROOM PASSWORD (Public Room)";
            html += `<div style="color: #FFF; font-size: 12px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">${passLabel}</div>`;
            html += `<div style="display: flex; gap: 10px; align-items: center; justify-content: center;">`;
            html += `<input readonly type="text" id="lobby-password-input" placeholder="Public Room" value="${window.mpPassword || ''}" style="width: 150px; padding: 10px; box-sizing: border-box; background: #000; border: 1px solid #444; color: #FFF; border-radius: 4px; font-weight: bold; font-size: 14px; outline: none; cursor: default; text-align: center;">`;

            if (isMeHost) {
                let disAttr = isConnected ? "" : "disabled";
                let disStyle = isConnected ? "cursor: pointer;" : "cursor: not-allowed; opacity: 0.4;";
                
                if (!window.mpPassword) {
                    html += `<button ${disAttr} onclick="window.generateAndApplyPasswordMP()" style="width: 140px; height: 38px; background: #000; border: 1px solid #FFF; color: #FFF; font-weight: 950; padding: 0 10px; border-radius: 4px; ${disStyle} font-size: 10px; white-space: nowrap; text-transform: uppercase;" onmouseover="if(!this.disabled) {this.style.background='#FFF'; this.style.color='#000';}" onmouseout="if(!this.disabled) {this.style.background='#000'; this.style.color='#FFF';}">GENERATE PASSWORD</button>`;
                } else {
                    html += `<button ${disAttr} onclick="window.generateAndApplyPasswordMP(true)" style="width: 140px; height: 38px; background: #000; border: 1px solid #FF3333; color: #FFF; font-weight: 950; padding: 0 10px; border-radius: 4px; ${disStyle} font-size: 10px; white-space: nowrap; text-transform: uppercase;" onmouseover="if(!this.disabled) {this.style.background='#FF3333'; this.style.color='#FFF';}" onmouseout="if(!this.disabled) {this.style.background='#000'; this.style.color='#FFF';}">CLEAR</button>`;
                }
                // Add QR Code button next to it
                html += `<button ${disAttr} onclick="window.showRoomQrCodeMP()" style="width: 80px; height: 38px; background: #000; border: 1px solid #00FFFF; color: #FFF; font-weight: 950; padding: 0 10px; border-radius: 4px; ${disStyle} font-size: 10px; white-space: nowrap; text-transform: uppercase; transition: 0.2s;" onmouseover="if(!this.disabled) {this.style.background='#00FFFF'; this.style.color='#000';}" onmouseout="if(!this.disabled) {this.style.background='#000'; this.style.color='#FFF';}">QR CODE</button>`;
            }
            
            // Add Misc button next to it
            let disAttrMisc = isConnected ? "" : "disabled";
            let disStyleMisc = isConnected ? "cursor: pointer;" : "cursor: not-allowed; opacity: 0.4;";
            let micIcon = window.voiceChatEnabled ? '🎙️' : '🎙️❌';
            html += `<button ${disAttrMisc} id="lobby-mic-btn" onclick="window.voiceChatEnabled = !window.voiceChatEnabled; this.innerHTML = window.voiceChatEnabled ? '🎙️' : '🎙️❌';" style="width: 38px; height: 38px; background: #000; border: 1px solid #FF1493; color: #FFF; display: flex; align-items: center; justify-content: center; border-radius: 4px; ${disStyleMisc} font-size: 13px; white-space: nowrap; transition: 0.2s; box-shadow: 0 0 5px rgba(255,20,147,0.3);" onmouseover="if(!this.disabled) {this.style.background='#FF1493'; this.style.color='#000'; this.style.boxShadow='0 0 15px rgba(255,20,147,0.6)';}" onmouseout="if(!this.disabled) {this.style.background='#000'; this.style.color='#FFF'; this.style.boxShadow='0 0 5px rgba(255,20,147,0.3)';}" title="Toggle Voice Chat">${micIcon}</button>`;

            html += `</div>`;
            html += `</div>`;

            html += `<div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 10px; position: relative;">`;

            // TEAM 1 (Left)
            html += `<div style="flex: 1; display: flex; flex-direction: column; gap: 15px;">`;
            let team1Slots = is1v1 ? [0] : [0, 2];
            for (let i of team1Slots) {
                let p = window.mpPlayers ? window.mpPlayers[i] : null;
                if (p) {
                    html += `<div style="background: rgba(57,255,20,0.1); border: 2px solid #39FF14; border-radius: 12px; padding: 12px; text-align: center; box-shadow: 0 0 15px rgba(57,255,20,0.2); transition:0.2s;">`;
                    html += `<div onclick="window.showPlayerOptions(${i})" style="cursor:pointer;">`;
                    html += `<div style="font-size: 30px; margin-bottom: 5px;">${p.avatar || '👤'}</div>`;
                    html += `<div style="color: #39FF14; font-weight: 900; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name.toUpperCase()}</div>`;
                    if (p.isMe) html += `<div style="font-size: 9px; color: #FFD700; margin-top: 3px; font-weight:900; letter-spacing:1px;">(YOU)</div>`;

                    let pPing = p.ping !== undefined ? p.ping + "ms" : "---";
                    let pPingColor = (!p.ping || p.ping > 500) ? "#FF3333" : (p.ping > 200 ? "#FFD700" : "#39FF14");
                    html += `<div style="font-size: 10px; color: ${pPingColor}; margin-top: 4px; font-weight:bold; letter-spacing:1px;">📶 ${pPing}</div>`;

                    if (i !== 0) {
                        let readyStatusColor = "#39FF14";
                        if (!p.isReady) readyStatusColor = "#666";
                        html += `<div style="color: ${readyStatusColor}; font-size: 8px; font-weight: 900; margin-top: 5px; letter-spacing: 1px;">[ ${p.isReady ? 'READY' : 'NOT READY'} ]</div>`;
                    }
                    html += `</div>`;
                    html += `</div>`;
                } else {
                    html += `<div style="background: rgba(255,255,255,0.03); border: 2px dashed #444; border-radius: 12px; padding: 12px; text-align: center; min-height: 80px; display: flex; align-items: center; justify-content: center;">`;
                    html += `<div style="color: #666; font-size: 10px; font-weight: bold; letter-spacing: 1px;">WAITING...</div>`;
                    html += `</div>`;
                }
            }
            html += `</div>`;

            // VS MIDDLE
            html += `<div style="display: flex; align-items: center; justify-content: center; position: relative;">`;
            html += `<div style="font-size: 40px; font-weight: 900; font-style: italic; color: #FFD700; text-shadow: 0 0 20px rgba(255,215,0,0.5); transform: skewX(-10deg);">VS</div>`;
            html += `<div style="position: absolute; width: 1px; height: 150%; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent); left: 50%; top: -25%; z-index: -1;"></div>`;
            html += `</div>`;

            // TEAM 2 (Right)
            html += `<div style="flex: 1; display: flex; flex-direction: column; gap: 15px;">`;
            let team2Slots = is1v1 ? [1] : [1, 3];
            for (let i of team2Slots) {
                let p = window.mpPlayers ? window.mpPlayers[i] : null;
                if (p) {
                    html += `<div style="background: rgba(255,20,147,0.1); border: 2px solid #FF1493; border-radius: 12px; padding: 12px; text-align: center; box-shadow: 0 0 15px rgba(255,20,147,0.2); transition:0.2s;">`;
                    html += `<div onclick="window.showPlayerOptions(${i})" style="cursor:pointer;">`;
                    html += `<div style="font-size: 30px; margin-bottom: 5px;">${p.avatar || '🤖'}</div>`;
                    html += `<div style="color: #FF1493; font-weight: 900; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name.toUpperCase()}</div>`;
                    if (p.isMe) html += `<div style="font-size: 9px; color: #FFD700; margin-top: 3px; font-weight:900; letter-spacing:1px;">(YOU)</div>`;

                    let pPing = p.ping !== undefined ? p.ping + "ms" : "---";
                    let pPingColor = (!p.ping || p.ping > 500) ? "#FF3333" : (p.ping > 200 ? "#FFD700" : "#39FF14");
                    html += `<div style="font-size: 10px; color: ${pPingColor}; margin-top: 4px; font-weight:bold; letter-spacing:1px;">📶 ${pPing}</div>`;

                    if (i !== 0) {
                        let readyStatusColor = "#39FF14";
                        if (!p.isReady) readyStatusColor = "#666";
                        html += `<div style="color: ${readyStatusColor}; font-size: 8px; font-weight: 900; margin-top: 5px; letter-spacing: 1px;">[ ${p.isReady ? 'READY' : 'NOT READY'} ]</div>`;
                    }
                    html += `</div>`;
                    html += `</div>`;
                } else {
                    html += `<div style="background: rgba(255,255,255,0.03); border: 2px dashed #444; border-radius: 12px; padding: 12px; text-align: center; min-height: 80px; display: flex; align-items: center; justify-content: center;">`;
                    html += `<div style="color: #666; font-size: 10px; font-weight: bold; letter-spacing: 1px;">WAITING...</div>`;
                    html += `</div>`;
                }
            }
            html += `</div>`;

            html += `</div>`;


            html += `</div>`;

            html += `<div style="display: flex; gap: 15px; align-items: stretch;">`;

            isMeHost = window.mpPlayers && window.mpPlayers[0] && window.mpPlayers[0].isMe;
            let isRoomFull = window.mpPlayers && window.mpPlayers.every(p => p !== null);
            let allOthersReady = window.mpPlayers.slice(1).every(p => !p || p.isReady);

            // NETWORK STABILITY CHECK
            let allNetStable = true;
            let netIssue = "";
            if (window.mpPlayers && isRoomFull) {
                for (let p of window.mpPlayers) {
                    if (p) {
                        // We ONLY block the launch if a player EXPLICITLY has a slow network (> 300ms)
                        // If ping is undefined/0, we assume it's stable to avoid "Syncing" hangups
                        if (p.ping > 300) {
                            allNetStable = false;
                            netIssue = "SLOW NET: " + p.name.toUpperCase();
                            break;
                        }
                    }
                }
            }

            let launchBtnText = isMeHost ?
                (!navigator.onLine ? "NO INTERNET" : (!socket || !socket.connected ? "CONNECTING..." : (!isRoomFull ? "WAITING FOR PLAYERS..." : (!allNetStable ? netIssue : (allOthersReady ? "LAUNCH GAME" : "WAITING FOR READY..."))))) :
                "WAITING FOR HOST...";

            let launchDisabled = !isMeHost || !isRoomFull || !allOthersReady || !allNetStable || !isConnected;
            let launchBg = launchDisabled ? '#222' : '#000';
            let launchColor = launchDisabled ? '#555' : '#FFF';
            let launchShadow = launchDisabled ? 'none' : '0 0 15px rgba(255,255,255,0.2)';
            let launchBorder = launchDisabled ? '1px solid #333' : '1px solid #FFF';

            let me = window.mpPlayers ? window.mpPlayers.find(p => p && p.isMe) : null;
            let amIReady = me && me.isReady;
            let myPlayerIndex = window.mpPlayers ? window.mpPlayers.indexOf(me) : -1;

            if (!isMeHost) {
                // Unified Action Bar for Non-Host (ONLY Ready & Reminder)
                let readyDisabled = false;
                let readyBtnStyle = amIReady ?
                    "background: #39FF14; color: #000; box-shadow: 0 0 20px rgba(57,255,20,0.5);" :
                    "background: rgba(255,255,255,0.05); color: #39FF14; border: 2px solid #39FF14;";

                html += `<button ${readyDisabled ? 'disabled' : ''} onclick="window.toggleReadyMP(${myPlayerIndex})" style="${readyBtnStyle} flex: 1; padding: 12px; border-radius: 12px; font-weight: 950; font-size: 13px; cursor: pointer; letter-spacing: 1.5px; text-transform: uppercase; transition: 0.3s;" onmouseover="if(!this.disabled) this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">${amIReady ? '✓ YOU ARE READY' : 'CLICK TO READY'}</button>`;

                if (window.isQuickJoinMode) {
                    html += `<button onclick="let hasEmpty = window.mpPlayers && window.mpPlayers.some((p, idx) => idx > 0 && !p); if(hasEmpty) { window.showOldLobbyInviteFriends(); } else { window.customAlert('Room is already full!', 'LOBBY'); }" style="flex: 0 0 130px; padding: 12px; border: 2px dashed #8A2BE2; border-radius: 12px; font-size: 10px; font-weight: bold; cursor: pointer; background: rgba(138,43,226,0.1); color: #FFF; transition: 0.3s; text-transform: uppercase;" onmouseover="this.style.background='rgba(138,43,226,0.3)';this.style.transform='scale(1.02)';" onmouseout="this.style.background='rgba(138,43,226,0.1)';this.style.transform='scale(1)';">➕ INVITE FRIEND</button>`;
                }

                let remindDisabled = window.isRemindingHost;
                let remindBg = remindDisabled ? '#222' : 'linear-gradient(135deg, #FFD700, #FFA500)';
                let remindColor = remindDisabled ? '#555' : '#000';
                let remindShadow = remindDisabled ? 'none' : '0 0 20px rgba(255,165,0,0.4)';

                let allOthersJoined = is1v1 ? (window.mpPlayers && window.mpPlayers[1]) : (window.mpPlayers && window.mpPlayers[1] && window.mpPlayers[2] && window.mpPlayers[3]);
                let anyParticipantNotReady = false;
                if (allOthersJoined) {
                    let slotsToCheck = is1v1 ? [1] : [1, 2, 3];
                    for (let i of slotsToCheck) {
                        if (window.mpPlayers[i] && !window.mpPlayers[i].isReady) anyParticipantNotReady = true;
                    }
                }
                let remindLabel = anyParticipantNotReady ? '🔔 READY REMINDER' : (window.isRemindingHost ? '🔔 STARTING...' : '🔔 START REMINDER');

                html += `<button ${remindDisabled ? 'disabled' : ''} onclick="window.remindHostMP()" style="flex: 1; padding: 12px; border: none; border-radius: 12px; font-size: 13px; font-weight: 950; cursor: ${remindDisabled ? 'not-allowed' : 'pointer'}; background: ${remindBg}; color: ${remindColor}; box-shadow: ${remindShadow}; transition: 0.3s; letter-spacing: 1.5px; text-transform: uppercase;" onmouseover="if(!this.disabled) this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">${remindLabel}</button>`;
            } else {
                // Host Side (Invite Friend + Launch Game + Ready Reminder)
                html += `<button onclick="let hasEmpty = window.mpPlayers && window.mpPlayers.some((p, idx) => idx > 0 && !p); if(hasEmpty) { window.showOldLobbyInviteFriends(); } else { window.customAlert('Room is already full!', 'LOBBY'); }" style="flex: 0 0 130px; padding: 12px; border: 2px dashed #8A2BE2; border-radius: 12px; font-size: 10px; font-weight: bold; cursor: pointer; background: rgba(138,43,226,0.1); color: #FFF; transition: 0.3s; text-transform: uppercase;" onmouseover="this.style.background='rgba(138,43,226,0.3)';this.style.transform='scale(1.02)';" onmouseout="this.style.background='rgba(138,43,226,0.1)';this.style.transform='scale(1)';">➕ INVITE FRIEND</button>`;

                let anyNotReady = window.mpPlayers && window.mpPlayers.some((p, i) => i > 0 && p && !p.isReady);
                if (anyNotReady) {
                    html += `<button onclick="window.remindHostMP()" style="flex: 0 0 130px; padding: 12px; border: none; border-radius: 12px; font-size: 10px; font-weight: 950; cursor: pointer; background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; box-shadow: 0 0 15px rgba(255,165,0,0.3); transition: 0.3s; letter-spacing: 1px; text-transform: uppercase;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">🔔 REMINDER</button>`;
                }

                html += `<button ${launchDisabled ? 'disabled' : ''} onclick="window.requestLaunchGameMP()" style="flex: 1; padding: 12px; border: ${launchBorder}; border-radius: 12px; font-size: 13px; font-weight: 900; cursor: ${launchDisabled ? 'not-allowed' : 'pointer'}; background: ${launchBg}; color: ${launchColor}; box-shadow: ${launchShadow}; transition: 0.3s; letter-spacing: 2px;">${launchBtnText}</button>`;
            }

            html += `</div>`;


            // SPECTATOR BAR
            html += `
                <div onclick="window.showSpectatorList()" style="margin-top: 10px; background: linear-gradient(90deg, rgba(30,144,255,0.1), transparent); border: 1px solid rgba(30,144,255,0.3); border-radius: 12px; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: inset 0 0 20px rgba(0,0,0,0.5); position: relative; overflow: hidden; cursor: pointer; transition: 0.3s;" onmouseover="this.style.background='linear-gradient(90deg, rgba(30,144,255,0.2), rgba(30,144,255,0.05))';" onmouseout="this.style.background='linear-gradient(90deg, rgba(30,144,255,0.1), transparent)';">
                    <div style="position: absolute; left: 0; top: 0; height: 100%; width: 4px; background: #1E90FF; box-shadow: 0 0 10px #1E90FF;"></div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="position: relative;">
                            <div style="background: rgba(0,0,0,0.6); color: #1E90FF; width: 40px; height: 40px; border-radius: 50%; border: 1px solid #1E90FF; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 15px rgba(30,144,255,0.3);">👁️</div>
                            <div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; background: #39FF14; border: 2px solid #000; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="color: #1E90FF; font-weight: 950; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase;">Observation Lounge</div>
                                <div style="background: #FF3333; color: #FFF; font-size: 8px; font-weight: 950; padding: 2px 6px; border-radius: 4px; animation: blink 1s infinite; letter-spacing: 1px;">LIVE</div>
                            </div>
                            <div style="color: #888; font-size: 10px; font-weight: bold; margin-top: 3px;">Real-time spectators currently in room</div>
                        </div>
                    </div>
                    <div id="mp-spectator-avatars" style="display: flex; gap: -8px; direction: rtl; align-items: center;">
                        ${(window.mpSpectators && window.mpSpectators.length > 0) ?
                    window.mpSpectators.map((s, idx) => `
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #222; border: 2px solid #333; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-left: -5px; box-shadow: -4px 0 10px rgba(0,0,0,0.5); z-index: ${idx + 1};" title="${s.name}">${s.avatar}</div>
                            `).join('') :
                    `<div style="background: rgba(255,255,255,0.05); color: #888; border: 1px solid rgba(255,255,255,0.1); padding: 8px 15px; border-radius: 8px; font-size: 10px; font-weight: 950; letter-spacing: 2px; text-transform: uppercase; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">NO SPECTATORS</div>`
                }
                    </div>
                </div>
            `;
        }
    }
    else if (['strikers', 'coins', 'pockets', 'boards', 'sounds', 'pets'].includes(currentShopView)) {
        let titleColor, titleText, arrayToUse, equipVar, buyFunc;
        if (currentShopView === 'strikers') { titleColor = '#FFD700'; titleText = 'STRIKER SHOP'; arrayToUse = shopItems; equipVar = equippedStrikerId; buyFunc = 'buyOrEquipStriker'; }
        else if (currentShopView === 'coins') { titleColor = '#39FF14'; titleText = 'COIN SHOP'; arrayToUse = coinShopItems; equipVar = equippedCoinId; buyFunc = 'buyOrEquipCoin'; }
        else if (currentShopView === 'pockets') { titleColor = '#00FFFF'; titleText = 'EFFECT SHOP'; arrayToUse = pocketEffects; equipVar = equippedPocketEffectId; buyFunc = 'buyOrEquipPocket'; }
        else if (currentShopView === 'boards') { titleColor = '#FF4500'; titleText = 'BOARD SHOP'; arrayToUse = boardShopItems; equipVar = equippedBoardId; buyFunc = 'buyOrEquipBoard'; }
        else if (currentShopView === 'sounds') { titleColor = '#FF8C00'; titleText = 'SOUND SHOP'; arrayToUse = soundShopItems; equipVar = equippedSoundId; buyFunc = 'buyOrEquipSound'; }
        else if (currentShopView === 'pets') { titleColor = '#FF1493'; titleText = 'PET SHOP'; arrayToUse = petShopItems; equipVar = equippedPetId; buyFunc = 'buyOrEquipPet'; }

        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #222; padding: 10px; border-radius: 6px; border-bottom: 2px solid ${titleColor};"><button onclick="switchShopView('purchasing_place')" ${disAttr} style="background: #444; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; ${disStyle}">&larr; BACK</button><div style="color: ${titleColor}; font-weight: 900; font-size: 16px; letter-spacing: 1px;">${titleText}</div></div>`;

        arrayToUse.forEach(item => {
            let isEquipped = equipVar === item.id; let isPassItem = item.price === 9999; let isSpinItem = item.price === 88888;
            let btnClass = isEquipped ? 'btn-equipped' : (item.owned ? 'btn-equip' : 'btn-buy');
            let btnText = isEquipped ? 'EQUIPPED' : (item.owned ? 'EQUIP' : (isPassItem ? 'CARROM PASS ONLY' : (isSpinItem ? 'SPIN TO UNLOCK' : `$${item.price}`)));
            let borderStyle = isEquipped ? `border: 1px solid ${titleColor};` : 'border: 1px solid transparent;';

            let statsHtml = '';
            if (currentShopView === 'strikers') statsHtml = `<div class="striker-stats">Pwr: x${item.power.toFixed(1)} | Mass: ${item.mass.toFixed(1)}</div>`;
            if (currentShopView === 'pets' && item.id !== 0) statsHtml = `<div class="striker-stats" style="color:#aaa;">${item.desc}</div>`;

            let disBtn = disAttr || (isPassItem && !item.owned) || (isSpinItem && !item.owned) ? 'disabled' : ''; let btnStyleStr = (isPassItem && !item.owned) || (isSpinItem && !item.owned) ? 'background:#444; color:#888; border:none;' : '';
            html += `<div class="striker-card" style="${borderStyle} ${shopDisabled ? 'opacity:0.6;' : ''}"><div class="striker-info"><div class="striker-name" style="color:${isPassItem ? '#FF1493' : (isSpinItem ? '#8A2BE2' : titleColor)};">${item.name}</div>${statsHtml}</div><button class="shop-btn ${btnClass}" ${disBtn} style="${disStyle} ${btnStyleStr}" onclick="${buyFunc}(${item.id})">${btnText}</button></div>`;
        });
    }
    shopDiv.innerHTML = html;

    if (currentShopView === 'pass') {
        setTimeout(() => {
            window.passParticleSystem = window.startFallingCoins('pass-particles', 30);
        }, 50);
    }
}

window.generateAndApplyPasswordMP = function (clear = false) {
    if (clear) {
        window.mpPassword = "";
        window.mpPasswordExpiry = 0;
    } else {
        // Generate 4-digit number
        window.mpPassword = Math.floor(1000 + Math.random() * 9000).toString();
    }

    if (window.mpRoomId) {
        socket.emit('update_password', { roomId: window.mpRoomId, password: window.mpPassword });
        window.playSound(clear ? 'foul' : 'claim');
        renderSidebarShop(); // Refresh UI to show the new password instantly
    }
};

window.buyOrEquipAvatar = async function (id) {
    let item = avatarItems.find(i => i.id === id);
    if (!item.owned) {
        if (playerMoney >= item.price) {
            playerMoney -= item.price;
            localStorage.setItem('playerMoney', playerMoney);
            item.owned = true;
            localStorage.setItem(`a_${id}`, 'true');
            equippedAvatarId = id;
            localStorage.setItem('equippedAvatarId', id);
            window.playSound('beep');
        } else {
            await window.customAlert("Not enough money!", "SHOP ERROR");
            window.playSound('foul');
            return;
        }
    } else {
        equippedAvatarId = id;
        localStorage.setItem('equippedAvatarId', id);
        window.playSound('hit');
    }
    renderSidebarShop();
    updateTopBar();
};

window.buyOrEquipTitle = async function (id) {
    let item = titleItems.find(i => i.id === id);
    if (!item.owned) {
        if (playerMoney >= item.price) {
            playerMoney -= item.price;
            localStorage.setItem('playerMoney', playerMoney);
            item.owned = true;
            localStorage.setItem(`t_${id}`, 'true');
            equippedTitleId = id;
            localStorage.setItem('equippedTitleId', id);
            window.playSound('beep');
        } else {
            await window.customAlert("Not enough money!", "SHOP ERROR");
            window.playSound('foul');
            return;
        }
    } else {
        equippedTitleId = id;
        localStorage.setItem('equippedTitleId', id);
        window.playSound('hit');
    }
    renderSidebarShop();
    updateTopBar();
};

window.buyOrEquipStriker = async function (id) {
    let item = shopItems.find(i => i.id === id);
    if (item.price === 9999 || item.price === 88888) return;
    if (!item.owned) {
        if (playerMoney >= item.price) {
            playerMoney -= item.price;
            localStorage.setItem('playerMoney', playerMoney);
            item.owned = true;
            localStorage.setItem(`s_${id}`, 'true');
            equippedStrikerId = id;
            localStorage.setItem('equippedStrikerId', id);
            window.playSound('beep');
        } else {
            await window.customAlert("Not enough money!", "SHOP ERROR");
            window.playSound('foul');
            return;
        }
    } else {
        equippedStrikerId = id;
        localStorage.setItem('equippedStrikerId', id);
        window.playSound('hit');
    }
    renderSidebarShop();
    updateTopBar();
};

window.buyOrEquipCoin = async function (id) {
    let item = coinShopItems.find(i => i.id === id);
    if (item.price === 9999) return;
    if (!item.owned) {
        if (playerMoney >= item.price) {
            playerMoney -= item.price;
            localStorage.setItem('playerMoney', playerMoney);
            item.owned = true;
            localStorage.setItem(`c_${id}`, 'true');
            equippedCoinId = id;
            localStorage.setItem('equippedCoinId', id);
            window.playSound('beep');
            applyEquippedCoins();
        } else {
            await window.customAlert("Not enough money!", "SHOP ERROR");
            window.playSound('foul');
            return;
        }
    } else {
        equippedCoinId = id;
        localStorage.setItem('equippedCoinId', id);
        window.playSound('hit');
        applyEquippedCoins();
    }
    renderSidebarShop();
    updateTopBar();
};

window.buyOrEquipPocket = async function (id) {
    let item = pocketEffects.find(i => i.id === id);
    if (!item.owned) {
        if (playerMoney >= item.price) {
            playerMoney -= item.price;
            localStorage.setItem('playerMoney', playerMoney);
            item.owned = true;
            localStorage.setItem(`p_${id}`, 'true');
            equippedPocketEffectId = id;
            localStorage.setItem('equippedPocketEffectId', id);
            window.playSound('beep');
        } else {
            await window.customAlert("Not enough money!", "SHOP ERROR");
            window.playSound('foul');
            return;
        }
    } else {
        equippedPocketEffectId = id;
        localStorage.setItem('equippedPocketEffectId', id);
        window.playSound('hit');
    }
    renderSidebarShop();
    updateTopBar();
};

window.buyOrEquipBoard = async function (id) {
    let item = boardShopItems.find(i => i.id === id);
    if (item.price === 9999) return;
    if (!item.owned) {
        if (playerMoney >= item.price) {
            playerMoney -= item.price;
            localStorage.setItem('playerMoney', playerMoney);
            item.owned = true;
            localStorage.setItem(`b_${id}`, 'true');
            equippedBoardId = id;
            localStorage.setItem('equippedBoardId', id);
            window.playSound('beep');
        } else {
            await window.customAlert("Not enough money!", "SHOP ERROR");
            window.playSound('foul');
            return;
        }
    } else {
        equippedBoardId = id;
        localStorage.setItem('equippedBoardId', id);
        window.playSound('hit');
    }
    renderSidebarShop();
    updateTopBar();
};

window.buyOrEquipSound = async function (id) {
    let item = soundShopItems.find(i => i.id === id);
    if (item.price === 9999) return;
    if (!item.owned) {
        if (playerMoney >= item.price) {
            playerMoney -= item.price;
            localStorage.setItem('playerMoney', playerMoney);
            item.owned = true;
            localStorage.setItem(`so_${id}`, 'true');
            equippedSoundId = id;
            localStorage.setItem('equippedSoundId', id);
            window.playSound('pocket');
        } else {
            await window.customAlert("Not enough money!", "SHOP ERROR");
            window.playSound('foul');
            return;
        }
    } else {
        equippedSoundId = id;
        localStorage.setItem('equippedSoundId', id);
        window.playSound('pocket');
    }
    renderSidebarShop();
    updateTopBar();
};

window.buyOrEquipPet = async function (id) {
    let item = petShopItems.find(i => i.id === id);
    if (!item.owned) {
        if (playerMoney >= item.price) {
            playerMoney -= item.price;
            localStorage.setItem('playerMoney', playerMoney);
            item.owned = true;
            localStorage.setItem(`pet_${id}`, 'true');
            equippedPetId = id;
            localStorage.setItem('equippedPetId', id);
            window.playSound('beep');
        } else {
            await window.customAlert("Not enough money!", "SHOP ERROR");
            window.playSound('foul');
            return;
        }
    } else {
        equippedPetId = id;
        localStorage.setItem('equippedPetId', id);
        window.playSound('hit');
    }
    renderSidebarShop();
    updateTopBar();
    if (gameState === 'PLACING' || gameState === 'AIMING') window.calculatePetTarget();
    updateUI();
};

window.showQuickJoinSelect = function () {
    window.playSound('beep');
    window.mpState = 'quick_join_select';
    renderSidebarShop();
};

window.startQuickJoinSearch = function (mode) {
    window.playSound('reveal');
    window.mpState = 'quick_join_search';
    window.quickJoinMode = mode;
    window.quickJoinTimeLeft = 15;
    window.quickJoinNoMatch = false;
    window.isQuickJoinMode = true;
    renderSidebarShop();

    if (window.quickJoinTimer) clearInterval(window.quickJoinTimer);

    window.quickJoinTimer = setInterval(() => {
        window.quickJoinTimeLeft--;
        if (window.quickJoinTimeLeft <= 0) {
            clearInterval(window.quickJoinTimer);
            window.quickJoinTimer = null;

            // Simulated matching result (60% success chance)
            let found = Math.random() > 0.4;

            if (found) {
                if (window.quickJoinMode === '1 VS 1') {
                    window.mpState = 'select';
                    window.customAlert("1 VS 1 Opponent Found! (Simulated)", "MATCH FOUND").then(() => {
                        window.startCountdown();
                    });
                } else {
                    window.click2VS2(false); // Join the 2v2 lobby as NON-HOST
                }
            } else {
                window.quickJoinNoMatch = true;
                window.playSound('foul');
            }
        }
        renderSidebarShop();
    }, 1000);
};

window.remindHostMP = function () {
    if (window.isRemindingHost) return;

    // Validation & Simulation Logic
    if (window.mpPlayers) {
        let notReadyIdxs = [];
        for (let i = 1; i < 4; i++) {
            let p = window.mpPlayers[i];
            if (p && !p.isReady) {
                notReadyIdxs.push(i);
            }
        }

        if (notReadyIdxs.length > 0) {
            let names = notReadyIdxs.map(idx => window.mpPlayers[idx].isMe ? "YOU" : window.mpPlayers[idx].name.toUpperCase());
            updateStatus("SENDING READY REMINDER TO: " + names.join(", "));
            window.playSound('beep');

            // Logic: after 5-7 seconds, force them to be ready
            let delay = 5000 + Math.random() * 2000;
            setTimeout(() => {
                notReadyIdxs.forEach(idx => {
                    if (window.mpPlayers[idx]) {
                        window.mpPlayers[idx].isReady = true;
                    }
                });
                updateStatus("ALL PLAYERS ARE NOW READY!");
                window.playSound('reveal');
                renderSidebarShop();
            }, delay);
            return;
        }
    }

    window.isRemindingHost = true;
    window.playSound('reveal');

    let countdown = 10;
    const tick = () => {
        if (countdown > 0) {
            updateStatus(`MATCH STARTING IN... ${countdown}S`);
            countdown--;
            setTimeout(tick, 1000);
        } else {
            updateStatus("STARTING MATCH NOW...");
            window.isRemindingHost = false;
            window.actuallyLaunchGameMP();
        }
        renderSidebarShop();
    };
    tick();
    renderSidebarShop();
};

window.toggleReadyMP = function (idx) {
    if (window.mpPlayers && window.mpPlayers[idx]) {
        window.mpPlayers[idx].isReady = !window.mpPlayers[idx].isReady;
        window.playSound(window.mpPlayers[idx].isReady ? 'beep' : 'foul');
        renderSidebarShop();
    }
};

window.cancelQuickJoin = function () {
    window.playSound('foul');
    if (window.quickJoinTimer) {
        clearInterval(window.quickJoinTimer);
        window.quickJoinTimer = null;
    }
    window.mpState = 'select';
    renderSidebarShop();
};

// Security: Sanitization helper to prevent XSS
window.safeHtml = function (str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

window.leaveMultiplayerLobby = function () {
    window.playSound('foul');

    // Notify server before clearing local state
    if (socket && window.roomIdMP) {
        socket.emit('leave_room', { roomId: window.roomIdMP });
    }

    if (window.randomPlayerTimer) {
        clearTimeout(window.randomPlayerTimer);
        window.randomPlayerTimer = null;
    }

    // Clear any active lobby timers
    if (window.mpLobbyTimer) { clearInterval(window.mpLobbyTimer); window.mpLobbyTimer = null; }

    window.resetMpFriends();

    window.mpRoomId = null;
    window.roomIdMP = null;
    window.mpPassword = "";
    window.mpHostJoinedPasswordProtected = false;
    window.is2v2 = false;
    window.is1v1MP = false;
    window.isMyTurnMP = true;
    window.mpPlayers = [null, null, null, null];
    window.mpState = 'select';

    // Return to Main Menu - Fixes "leakage" where it might stay on MP select or lobby visuals
    currentShopView = 'menu';
    initGame(); // Reset board state

    // Clear ALL possible leftover MP UI elements/modals
    ['mp-lobby-modal', 'mp-1v1-wait-modal', 'mp-invite-confirm', 'mp-2v2-choice-modal', 'mp-2v2-friend-modal', 'kick-player-modal', 'player-options-modal', 'qr-modal', 'qr-scanner-modal'].forEach(id => {
        let el = document.getElementById(id); if (el) el.remove();
    });

    renderSidebarShop();
    updateUI();
};

window.syncLobbySettingsMP = function (settings) {
    if (settings.selectedMode !== undefined) window.mpSelectedMode = settings.selectedMode;
    if (settings.petsAllowed !== undefined) window.mpPetsAllowed = settings.petsAllowed;
    if (settings.targetScore !== undefined) window.freestyleTargetScore = settings.targetScore;

    if (socket && window.roomIdMP) {
        socket.emit('update_lobby_settings', { roomId: window.roomIdMP, settings: settings });
    }
    renderSidebarShop();
};

window.click2VS2 = function (amIHost) {
    if (amIHost) { window.createRoomMP('lobby_2v2'); } else { window.mpState = 'join_selection'; renderSidebarShop(); }
};

window.click1V1 = function (amIHost) {
    if (amIHost) { window.createRoomMP('lobby_1v1'); } else { window.mpState = 'join_selection'; renderSidebarShop(); }
};

window.startRandomPlayerConnectTimer = function () {
    if (window.randomPlayerTimer) clearTimeout(window.randomPlayerTimer);
    window.randomPlayerTimer = setTimeout(() => {
        // Only trigger if we are in a lobby, no password is set, and we are the host
        if (!window.mpPlayers || !window.roomIdMP) return;
        if (window.mpPassword) return; // STRICT PRIVACY: No random joins if password exists
        if (window.myPlayerIndexMP !== 1) return;
        if (gameState !== 'MENU') return; // Only in lobby/menu state

        const randomNames = ["Sniper_Elite", "CarromKing", "Pro_Shot", "MasterStriker", "Ghost_Player", "Bullet_Hit", "AceCarrom", "BoardBlasta", "LuckyStriker", "Street_Fighter", "Shadow_Ninja"];
        const avatars = ["👤", "😎", "🔥", "👑", "🎯", "⚡", "👻", "🤖", "🥷"];

        // Fill ALL empty slots immediately after the 7-second delay
        for (let i = 1; i < window.mpPlayers.length; i++) {
            if (!window.mpPlayers[i]) {
                let name = randomNames[Math.floor(Math.random() * randomNames.length)];
                let avatar = avatars[Math.floor(Math.random() * avatars.length)];

                socket.emit('add_bot', {
                    roomId: window.roomIdMP,
                    botData: { name: name, avatar: avatar }
                });
            }
        }
    }, 7000); // 7 Seconds wait for random players to fill the room
};

window.kickPlayer = async function () {
    let hasPlayers = window.mpPlayers && (window.mpPlayers[1] || window.mpPlayers[2] || window.mpPlayers[3]);
    if (window.mpState === 'lobby_2v2' && hasPlayers) {
        if (!window.mpPlayers[0].isMe) {
            window.customAlert("Only the room creator has permission to kick players.", "HOST PRIVILEGE");
            return;
        }

        let modal = document.createElement('div');
        modal.id = 'kick-player-modal';
        modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10005;backdrop-filter:blur(10px);`;

        let html = `<div style="background:#000;border:1px solid #333;border-radius:4px;padding:35px;width:380px;box-shadow:0 0 40px rgba(0,0,0,0.5);color:#fff;text-align:center;font-family:sans-serif;animation:modalEntrance 0.4s ease-out;">`;
        html += `<h2 style="color:#FFF;margin:0 0 10px;font-size:20px;font-weight:900;letter-spacing:3px;text-transform:uppercase;">KICK PLAYER</h2>`;
        html += `<p style="color:#666;margin-bottom:25px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Select a player to dismiss:</p>`;

        html += `<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:25px;">`;
        for (let i = 1; i < 4; i++) {
            if (window.mpPlayers[i]) {
                html += `<button onclick="window.confirmKick(${i})" style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:2px;padding:15px;color:#FFF;font-size:13px;font-weight:bold;cursor:pointer;transition:0.2s;text-transform:uppercase;letter-spacing:1px;" onmouseover="this.style.background='#FFF';this.style.color='#000'" onmouseout="this.style.background='#0a0a0a';this.style.color='#FFF'">KICK ${window.mpPlayers[i].name}</button>`;
            }
        }
        html += `</div>`;

        html += `<button onclick="document.getElementById('kick-player-modal').remove(); window.playSound('beep');" style="background:transparent;color:#444;border:none;cursor:pointer;font-weight:900;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;">CANCEL</button>`;
        html += `</div>`;

        modal.innerHTML = html;
        document.body.appendChild(modal);
        window.playSound('beep');
    } else {
        window.customAlert("There are no other players in the room to kick.", "ROOM INFO");
    }
};

window.confirmKick = function (index) {
    if (window.mpPlayers && window.mpPlayers[index]) {
        let player = window.mpPlayers[index];
        socket.emit('kick_player', { roomId: window.roomIdMP, playerIndex: index });

        // Immediate removal from local state for instant feedback
        window.mpPlayers[index] = null;
        renderSidebarShop();

        let kModal = document.getElementById('kick-player-modal');
        if (kModal) kModal.remove();

        let oModal = document.getElementById('player-options-modal');
        if (oModal) oModal.remove();

        window.playSound('hit');
    }
};

window.showPlayerOptions = function (index) {
    let player = window.mpPlayers[index];
    if (!player) return;
    if (player.isMe) {
        window.showPlayerDetails(); // Show own profile
        return;
    }

    window.playSound('beep');

    let modal = document.createElement('div');
    modal.id = 'player-options-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;justify-content:center;align-items:center;z-index:10010; backdrop-filter: blur(10px);`;

    let html = `<div style="background: #000; border: 1px solid #222; border-radius: 4px; padding: 40px; width: 360px; box-shadow: 0 0 50px rgba(0,0,0,0.5); text-align: center; color: #fff; animation: modalEntrance 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); position: relative;">`;

    // Close button
    html += `<button onclick="document.getElementById('player-options-modal').remove(); window.playSound('foul');" style="position:absolute; top:20px; right:20px; background:none; border:none; color:#444; font-size:24px; cursor:pointer; transition: 0.2s;" onmouseover="this.style.color='#FFF';" onmouseout="this.style.color='#444';">&times;</button>`;

    html += `<div style="font-size: 70px; margin-bottom: 20px;">${player.avatar || '👤'}</div>`;
    html += `<h2 style="color: #FFF; margin: 0 0 5px; font-size: 22px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">${player.name}</h2>`;
    html += `<div style="color: #444; font-size: 10px; font-weight: 900; margin-bottom: 35px; letter-spacing: 2px; text-transform: uppercase;">Player Operations</div>`;

    html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;

    const buttonStyle = `width: 100%; padding: 16px; border-radius: 2px; border: 1px solid #1a1a1a; background: #0a0a0a; color: #888; font-weight: 900; font-size: 11px; letter-spacing: 2px; cursor: pointer; transition: 0.3s; text-align: center; display: flex; align-items: center; justify-content: center; gap: 10px; text-transform: uppercase;`;

    // Only host can kick/move
    let isHost = window.mpPlayers[0] && window.mpPlayers[0].isMe;

    html += `<button onclick="window.viewOptionsProfile(${index})" style="${buttonStyle}" onmouseover="this.style.background='#FFF'; this.style.color='#000';" onmouseout="this.style.background='#0a0a0a'; this.style.color='#888';">VIEW PROFILE</button>`;
    html += `<button onclick="window.addOptionsFriend(${index})" style="${buttonStyle}" onmouseover="this.style.background='#FFF'; this.style.color='#000';" onmouseout="this.style.background='#0a0a0a'; this.style.color='#888';">ADD FRIEND</button>`;

    if (isHost) {
        html += `<button onclick="window.confirmKick(${index})" style="${buttonStyle}" onmouseover="this.style.background='#FFF'; this.style.color='#000';" onmouseout="this.style.background='#0a0a0a'; this.style.color='#888';">REMOVE FROM ROOM</button>`;
        html += `<button onclick="window.moveOptionsToSpectator(${index})" style="${buttonStyle}" onmouseover="this.style.background='#FFF'; this.style.color='#000';" onmouseout="this.style.background='#0a0a0a'; this.style.color='#888';">MOVE TO SPECTATOR</button>`;
    }

    html += `</div>`;
    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);
};


window.viewOptionsProfile = function (index) {
    let player = window.mpPlayers[index];
    if (!player) return;
    const optModal = document.getElementById('player-options-modal');
    if (optModal) optModal.remove();
    window.playSound('beep');

    // Generate random stats for other players
    let wins = 50 + Math.floor(Math.random() * 450);
    let losses = 30 + Math.floor(Math.random() * 270);
    let wallet = 500 + Math.floor(Math.random() * 9500);
    let coinsPocketed = 100 + Math.floor(Math.random() * 1900);
    let played = wins + losses + Math.floor(Math.random() * 20);

    let modal = document.createElement('div');
    modal.id = 'player-details-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10015;backdrop-filter:blur(10px);`;

    let html = `<div style="background:#000;border:1px solid #222;border-radius:4px;padding:40px;width:380px;box-shadow:0 0 50px rgba(0,0,0,0.5);color:#fff;font-family:sans-serif;animation:modalEntrance 0.4s ease-out;position:relative;">`;
    html += `<button onclick="document.getElementById('player-details-modal').remove(); window.playSound('foul');" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#444;font-size:28px;cursor:pointer;">&times;</button>`;

    html += `<div style="text-align:center;margin-bottom:30px;">`;
    html += `<div style="font-size:80px;line-height:1;margin-bottom:20px;">${player.avatar || '👤'}</div>`;
    html += `<h2 style="color:#FFF;margin:0 0 5px 0;font-size:24px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">${player.name}</h2>`;
    html += `<div style="display:inline-block;background:#111;color:#666;border:1px solid #222;border-radius:2px;padding:5px 12px;font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">Board Master</div>`;
    html += `</div>`;

    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:30px;">`;
    const makeStatBox = (label, value, color) => `<div style="background:rgba(255,255,255,0.02);border:1px solid #1a1a1a;border-radius:2px;padding:15px 10px;text-align:center;"><div style="color:#444;font-size:9px;font-weight:900;text-transform:uppercase;margin-bottom:8px;letter-spacing:1.5px;">${label}</div><div style="color:${color};font-size:18px;font-weight:900;">${value}</div></div>`;

    html += makeStatBox('Matches', played, '#FFF');
    html += makeStatBox('Win Rate', Math.round((wins / (wins + losses)) * 100) + '%', '#FFF');
    html += makeStatBox('Wins', wins, '#FFF');
    html += makeStatBox('Losses', losses, '#666');
    html += makeStatBox('Pocketed', coinsPocketed, '#FFF');
    html += makeStatBox('Wallet', '$' + wallet.toLocaleString(), '#FFF');
    html += `</div>`;

    html += `<div style="background:#0a0a0a; padding:12px; border-radius:2px; text-align:center; color:#333; font-size:9px; font-weight:900; letter-spacing:2px; border:1px solid #1a1a1a; text-transform:uppercase;">MEMBER SINCE 2024</div>`;

    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.addOptionsFriend = async function (index) {
    let player = window.mpPlayers[index];
    if (!player) return;
    if (await window.customConfirm(`Do you want to add ${player.name} as a friend?`, "FRIEND REQUEST")) {
        window.playSound('claim');
        if (!window.mpFriends.some(f => f.name.toLowerCase() === player.name.toLowerCase())) {
            window.mpFriends.push({ name: player.name, avatar: player.avatar || '👤', status: 'online', invited: false });
        }
        window.customAlert(`${player.name} has been added to your friends list!`, "SUCCESS");
        let optModal = document.getElementById('player-options-modal');
        if (optModal) optModal.remove();
    }
};

window.removeOptionsPlayer = async function (index) {
    let player = window.mpPlayers[index];
    if (!player) return;
    if (await window.customConfirm(`Are you sure you want to remove ${player.name} from the room?`, "REMOVE PLAYER")) {
        window.mpPlayers[index] = null;
        window.playSound('hit');
        let optModal = document.getElementById('player-options-modal');
        if (optModal) optModal.remove();
        renderSidebarShop();
    }
};

window.moveOptionsToSpectator = async function (index) {
    let player = window.mpPlayers[index];
    if (!player) return;
    if (await window.customConfirm(`Move ${player.name} to the spectator lounge?`, "SPECTATE")) {
        if (!window.mpSpectators) window.mpSpectators = [];
        window.mpSpectators.push({
            name: player.name,
            avatar: player.avatar || '👤',
            level: player.level || Math.floor(Math.random() * 50 + 10),
            status: "WATCHING"
        });
        window.mpPlayers[index] = null;
        window.playSound('reveal');
        let optModal = document.getElementById('player-options-modal');
        if (optModal) optModal.remove();
        renderSidebarShop();
    }
};

window.showSpectatorList = function () {
    window.playSound('beep');

    let modal = document.createElement('div');
    modal.id = 'spectator-list-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10020; backdrop-filter: blur(12px);`;

    let html = `<div style="background: #000; border: 1px solid #222; border-radius: 4px; padding: 40px; width: 400px; box-shadow: 0 0 50px rgba(0,0,0,0.5); text-align: center; color: #fff; animation: modalEntrance 0.4s ease-out; position: relative; max-height: 80vh; display: flex; flex-direction: column;">`;

    // Close button
    html += `<button onclick="document.getElementById('spectator-list-modal').remove(); window.playSound('foul');" style="position:absolute; top:20px; right:20px; background:none; border:none; color:#444; font-size:24px; cursor:pointer; transition: 0.2s;" onmouseover="this.style.color='#FFF';" onmouseout="this.style.color='#444';">&times;</button>`;

    html += `<div style="font-size: 50px; margin-bottom: 20px;">👁️</div>`;
    html += `<h2 style="color: #FFF; margin: 0 0 5px; font-size: 22px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">Observation Lounge</h2>`;
    html += `<div style="color: #333; font-size: 10px; font-weight: 900; margin-bottom: 30px; letter-spacing: 2px; text-transform: uppercase;">LIVE SPECTATORS</div>`;

    html += `<div style="overflow-y: auto; flex: 1; padding-right: 5px; display: flex; flex-direction: column; gap: 10px;">`;

    if (!window.mpSpectators || window.mpSpectators.length === 0) {
        html += `<div style="padding: 50px 20px; color: #222; font-weight: 900; letter-spacing: 2px; border: 1px dashed #1a1a1a; border-radius: 2px; font-size: 10px; text-transform: uppercase;">NO ONE IS WATCHING RIGHT NOW</div>`;
    } else {
        window.mpSpectators.forEach(s => {
            html += `<div style="display: flex; align-items: center; gap: 15px; background: #050505; border: 1px solid #111; padding: 15px 25px; border-radius: 2px; transition: 0.2s;">`;
            html += `<div style="font-size: 24px;">${s.avatar}</div>`;
            html += `<div style="color: #FFF; font-weight: 900; font-size: 15px; letter-spacing: 1px; flex: 1; text-align: left;">${s.name.toUpperCase()}</div>`;
            html += `<div style="width: 8px; height: 8px; background: #39FF14; border-radius: 50%; box-shadow: 0 0 10px #39FF14; animation: pulse 1.5s infinite;"></div>`;
            html += `</div>`;
        });
    }

    html += `</div>`;

    html += `<div style="margin-top: 25px; color: #888; font-size: 10px; font-weight: bold; letter-spacing: 1px; line-height: 1.5;">SPECTATORS CAN CHAT AND REACT IN REAL-TIME DURING THE MATCH</div>`;

    html += `</div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);
};




window.showOldLobbyInviteFriends = function () {
    let modal = document.createElement('div'); modal.id = 'mp-old-lobby-friend-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;justify-content:center;align-items:center;z-index:10000;font-family:'Outfit',sans-serif;`;

    let html = `<div class="lobby-glass lobby-float" style="border:2px solid #8A2BE2;border-radius:24px;padding:35px;width:420px;text-align:center;box-shadow:0 0 60px rgba(138,43,226,0.4);max-height:85vh;display:flex;flex-direction:column;position:relative;overflow:hidden;">`;

    // Background flare
    html += `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: radial-gradient(circle at 50% 10%, rgba(138,43,226,0.2) 0%, transparent 60%); pointer-events:none;"></div>`;

    html += `<div style="font-size:42px;margin-bottom:12px;filter:drop-shadow(0 0 10px #8A2BE2);">👥</div>`;
    html += `<div style="display:flex; justify-content:center; align-items:center; position:relative; margin-bottom:15px; width:100%;">`;
    html += `<h3 style="color:#FFF;margin:0;font-size:24px;font-weight:950;letter-spacing:3px;text-transform:uppercase;">RECRUIT TEAM</h3>`;
    html += `<button onclick="window.refreshRecruits()" class="shimmer-effect" style="position:absolute; right:0; background:#4285F4; border:none; color:#FFF; border-radius:6px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.3s; z-index:10; box-shadow:0 0 15px rgba(66,133,244,0.3); font-size:18px;" onmouseover="this.style.transform='scale(1.1)';" onmouseout="this.style.transform='scale(1)';">🔄</button>`;
    html += `</div>`;
    html += `<p style="color:#D8BFD8;font-size:12px;margin-bottom:25px;font-weight:bold;letter-spacing:1px;opacity:0.8;">ENLIST YOUR ALLIES</p>`;

    if (window.mpFriends.length === 0) {
        html += `<div style="color:#888;padding:40px;font-size:14px;background:rgba(255,255,255,0.03);border-radius:16px;border:1px solid rgba(255,255,255,0.1);font-weight:bold;letter-spacing:0.5px;">NO RECRUITS AVAILABLE</div>`;
    } else {
        html += `<div style="overflow-y:auto;flex:1;margin-bottom:25px;padding-right:5px;">`;
        window.mpFriends.forEach((friend, i) => {
            let isInvited = friend.invited || false;
            let btnBg = isInvited ? 'linear-gradient(135deg, #39FF14, #228B22)' : 'linear-gradient(135deg,#8A2BE2,#FF1493)';
            let btnShadow = isInvited ? '0 4px 15px rgba(57,255,20,0.4)' : '0 4px 10px rgba(138,43,226,0.3)';

            html += `<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.03);padding:15px;border-radius:16px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.1);transition:0.3s;" onmouseover="this.style.background='rgba(138,43,226,0.1)';this.style.borderColor='#8A2BE2';this.style.transform='scale(1.02)'" onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.1)';this.style.transform='scale(1)'">`;
            html += `<div style="display:flex;align-items:center;"><span style="font-size:28px;margin-right:15px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${friend.avatar}</span><span style="color:#FFF;font-size:15px;font-weight:950;letter-spacing:1px;">${friend.name.toUpperCase()}</span></div>`;
            html += `<button onclick="${isInvited ? '' : `window.inviteOldLobbyFriend(${i})`}" class="shimmer-effect" style="background:${btnBg};color:#FFF;border:none;padding:10px 18px;border-radius:10px;font-weight:950;font-size:${isInvited ? '12px' : '20px'};cursor:${isInvited ? 'default' : 'pointer'};letter-spacing:1px;text-transform:uppercase;box-shadow:${btnShadow};line-height:1;transition: 0.3s;">${isInvited ? '✓ SENT' : '+'}</button>`;
            html += `</div>`;
        });
        html += `</div>`;
    }

    html += `<button onclick="document.getElementById('mp-old-lobby-friend-modal').remove()" class="shimmer-effect" style="background:transparent;color:#888;border:1px solid #444;padding:13px 40px;font-weight:950;border-radius:12px;cursor:pointer;font-size:14px;transition:all 0.2s;letter-spacing:2px;text-transform:uppercase;" onmouseover="this.style.background='#FF3333';this.style.color='#FFF';this.style.borderColor='#FF3333'" onmouseout="this.style.background='transparent';this.style.color='#888';this.style.borderColor='#444'">EXIT</button>`;
    html += `</div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.refreshRecruits = function () {
    window.resetMpFriends();
    // Refresh the modal content
    let oldModal = document.getElementById('mp-old-lobby-friend-modal');
    if (oldModal) {
        oldModal.remove();
        window.showOldLobbyInviteFriends();
    }
    let v2Modal = document.getElementById('mp-2v2-friend-modal');
    if (v2Modal) {
        let slotIdx = parseInt(v2Modal.dataset.slotIndex) || 0;
        v2Modal.remove();
        window.show2v2InviteFriends(slotIdx);
    }
    window.playSound('beep');
};

window.inviteOldLobbyFriend = function (friendIndex) {
    let friend = window.mpFriends[friendIndex];
    if (!friend || friend.invited) return;

    friend.invited = true;

    // Refresh the modal to show the tick
    let oldModal = document.getElementById('mp-old-lobby-friend-modal');
    if (oldModal) {
        oldModal.remove();
        window.showOldLobbyInviteFriends();
    }

    window.playSound('beep');

    let notif = document.createElement('div');
    notif.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#0a1a0a;border:2px solid #39FF14;border-radius:12px;padding:15px 30px;z-index:10001;box-shadow:0 0 30px rgba(57,255,20,0.3);text-align:center;animation:badgeSlideUp 0.3s ease-out;`;
    notif.innerHTML = `<div style="color:#39FF14;font-weight:950;font-size:14px;letter-spacing:1px;text-transform:uppercase;">✓ INVITATION SENT TO ${friend.name.toUpperCase()}</div>`;
    document.body.appendChild(notif);

    setTimeout(async () => {
        notif.remove();
        if (Math.random() < 0.95) {
            let emptyIdx = -1;
            for (let i = 1; i < 4; i++) {
                if (!window.mpPlayers[i]) { emptyIdx = i; break; }
            }
            if (emptyIdx !== -1) {
                // IMPORTANT: Tell the server about the new simulated friend/bot
                // This fix ensures the server knows there are enough players to start the match!
                if (window.roomIdMP) {
                    socket.emit('add_bot', {
                        roomId: window.roomIdMP,
                        botData: { name: friend.name, avatar: friend.avatar }
                    });
                } else {
                    // Fallback local update (for unexpected offline scenarios)
                    window.mpPlayers[emptyIdx] = { name: friend.name, isMe: false, avatar: friend.avatar, isAI: true, ping: 1 };
                    renderSidebarShop();
                }

                window.playSound('claim');
            } else {
                await window.customAlert("Room is already full!", "LOBBY ERROR");
            }
        } else {
            let err = document.createElement('div');
            err.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a0a2e;border:2px solid #FF3333;border-radius:8px;padding:12px 25px;z-index:10001;box-shadow:0 0 20px rgba(255,51,51,0.3);text-align:center;animation:badgeSlideUp 0.3s ease-out;`;
            err.innerHTML = `<div style="color:#FF3333;font-weight:bold;font-size:13px;">${friend.name} is busy! ❌</div>`;
            document.body.appendChild(err);
            setTimeout(() => err.remove(), 2000);
        }
    }, 1500 + Math.random() * 1000);
};

window.requestLaunchGameMP = function () {
    if (window.mpPlayers && window.mpPlayers[0] && window.mpPlayers[0].isMe) {
        let modal = document.createElement('div');
        modal.id = 'launch-confirm-modal';
        modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;justify-content:center;align-items:center;z-index:10010;`;

        let html = `<div style="background:#111;border:2px solid #39FF14;border-radius:15px;padding:30px;width:380px;text-align:center;box-shadow:0 0 40px rgba(57,255,20,0.3);color:#fff;animation:badgeSlideUp 0.4s ease-out;">`;
        html += `<div style="font-size:50px;margin-bottom:15px;">🚀</div>`;
        html += `<h2 style="color:#FFF;margin-bottom:10px;font-weight:900;letter-spacing:1px;">LAUNCH GAME?</h2>`;
        html += `<p style="color:#aaa;font-size:14px;margin-bottom:25px;">Are you sure you want to start the match with these players?</p>`;

        html += `<div style="display:flex;gap:15px;justify-content:center;">`;
        html += `<button onclick="window.actuallyLaunchGameMP()" style="flex:1;background:linear-gradient(45deg,#39FF14,#228B22);color:#000;border:none;padding:12px;border-radius:8px;font-weight:900;cursor:pointer;font-size:16px;">START</button>`;
        html += `<button onclick="document.getElementById('launch-confirm-modal').remove(); window.playSound('beep');" style="flex:1;background:#333;color:#888;border:none;padding:12px;border-radius:8px;font-weight:900;cursor:pointer;font-size:16px;">CANCEL</button>`;
        html += `</div>`;

        html += `</div>`;
        modal.innerHTML = html;
        document.body.appendChild(modal);
        window.playSound('beep');
    }
};

window.actuallyLaunchGameMP = async function () {
    console.log("actuallyLaunchGameMP called. Room ID:", window.roomIdMP);
    let modal = document.getElementById('launch-confirm-modal');
    if (modal) modal.remove();
    if (window.roomIdMP) {
        console.log("Emitting player_ready for room:", window.roomIdMP);
        socket.emit('player_ready', { roomId: window.roomIdMP });
    } else {
        console.error("Cannot launch match: window.roomIdMP is null!");
        await window.customAlert("Error: Room ID is missing. Please try creating the room again.", "LAUNCH ERROR");
    }
};

window.applyPassword = async function () {
    let inp = document.getElementById('lobby-password-input');
    if (inp) {
        window.mpPassword = inp.value;
        socket.emit('update_password', { roomId: window.roomIdMP, password: window.mpPassword });

        if (window.mpPassword.trim() === '') {
            updateStatus("ROOM IS NOW OPEN. SEARCHING FOR RANDOM PLAYERS...");
            window.playSound('reveal');
            window.startRandomPlayerConnectTimer(); // Start timer immediately
        } else {
            await window.customAlert("Password applied: " + window.mpPassword, "ROOM SECURITY");
            if (window.randomPlayerTimer) {
                clearTimeout(window.randomPlayerTimer);
                window.randomPlayerTimer = null;
            }
            // Ensure room is empty when password is set (kick existing bots)
            if (window.mpPlayers) {
                window.mpPlayers.forEach((p, idx) => {
                    if (p && p.isAI) {
                        socket.emit('kick_player', { roomId: window.roomIdMP, playerIndex: idx });
                    }
                });
            }
        }
    }
};

function applyEquippedCoins() { let activeCoin = coinShopItems.find(item => item.id === equippedCoinId); if (!activeCoin) return; coins.forEach(c => { if (c.type === 'white') c.color = activeCoin.colorW; if (c.type === 'black') c.color = activeCoin.colorB; }); updateUI(); }

function setControlsDisabled(disabled) {
    const aiToggle = document.getElementById('ai-toggle'); const aiDiff = document.getElementById('ai-difficulty');
    if (aiToggle) aiToggle.disabled = disabled; if (aiDiff) aiDiff.disabled = disabled || (aiToggle && !aiToggle.checked);
}

// ZOMBIE SPAWNER LOGIC
window.spawnZombie = function () {
    let edge = Math.floor(Math.random() * 4); let zx, zy; let margin = 40;
    if (edge === 0) { zx = Math.random() * (SIZE - 100) + 50; zy = margin; } else if (edge === 1) { zx = Math.random() * (SIZE - 100) + 50; zy = SIZE - margin; } else if (edge === 2) { zx = margin; zy = Math.random() * (SIZE - 100) + 50; } else { zx = SIZE - margin; zy = Math.random() * (SIZE - 100) + 50; }
    let activeCoin = coinShopItems.find(item => item.id === equippedCoinId); let color = activeCoin ? activeCoin.colorB : '#333';
    coins.push(new Coin(zx, zy, COIN_R, 'black', color, 1));
};

// ==========================================
// 8. PHYSICS CLASSES
// ==========================================
class Particle {
    constructor(x, y, color) { this.x = x; this.y = y; this.vx = (Math.random() - 0.5) * 8; this.vy = (Math.random() - 0.5) * 8; this.alpha = 1; this.color = color; }
    update() { this.x += this.vx * window.timeScale; this.y += this.vy * window.timeScale; this.alpha -= 0.03 * window.timeScale; }
    draw() { ctx.save(); ctx.globalAlpha = Math.max(0, this.alpha); ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
}

class Coin {
    constructor(x, y, radius, type, color, mass = 1) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.radius = radius; this.type = type; this.color = color; this.mass = mass; this.active = true; this.effect = 'none'; this.rotation = 0; }
    draw() {
        if (!this.active) return;
        const ctxSave = () => ctx.save();
        const ctxRestore = () => ctx.restore();

        if (this.type === 'striker' && window.inBossRush && window.bossRushStage === 3 && currentPlayer === 2 && (Math.abs(this.vx) > 0.5 || Math.abs(this.vy) > 0.5)) {
            ctx.globalAlpha = 0.05;
        }

        if (this.type === 'queen' && !isQueenPocketed && !queenPendingCover && (gameState === 'PLACING' || gameState === 'AIMING' || gameState === 'MOVING')) {
            ctx.save();
            ctx.shadowColor = '#FF0000';
            ctx.shadowBlur = 5 + Math.sin(Date.now() / 200) * 3;
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#FFaaaa';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (this.type === 'striker') {
            if (this.effect === 'alien') {
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#39FF14'; ctx.stroke();
                ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Date.now() / 800); ctx.beginPath(); ctx.moveTo(-this.radius * 0.6, -this.radius * 0.6); ctx.lineTo(this.radius * 0.6, -this.radius * 0.6); ctx.lineTo(-this.radius * 0.6, this.radius * 0.6); ctx.lineTo(this.radius * 0.6, this.radius * 0.6); ctx.closePath(); ctx.fillStyle = '#39FF14'; ctx.fill(); ctx.restore();
                return;
            } else if (this.effect === 'monster') {
                ctx.save(); ctx.translate(this.x, this.y); let spin = (Math.abs(this.vx) + Math.abs(this.vy)) > 0.5 ? (Date.now() / 200) : 0; ctx.rotate(spin); ctx.beginPath(); ctx.arc(0, 0, this.radius, Math.PI, 0); ctx.fillStyle = '#FF0000'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(-this.radius, -1.5, this.radius * 2, 3); ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2); ctx.fillStyle = '#FFF'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
                return;
            } else if (this.effect === 'web') {
                ctx.save(); ctx.translate(this.x, this.y); ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fillStyle = '#FF0000'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke(); for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * Math.PI / 4) * this.radius, Math.sin(i * Math.PI / 4) * this.radius); ctx.stroke(); } let lookAng = (Math.abs(this.vx) + Math.abs(this.vy)) > 0.5 ? Math.atan2(this.vy, this.vx) : -Math.PI / 2; ctx.rotate(lookAng); ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.ellipse(6, -6, 5, 2.5, Math.PI / 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(6, 6, 5, 2.5, -Math.PI / 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
                return;
            } else if (this.effect === 'shield') {
                ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Date.now() / 400); ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fillStyle = '#FF0000'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.75, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2); ctx.fillStyle = '#FF0000'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2); ctx.fillStyle = '#0000FF'; ctx.fill(); ctx.fillStyle = '#FFF'; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * this.radius * 0.3, -Math.sin((18 + i * 72) * Math.PI / 180) * this.radius * 0.3); ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * this.radius * 0.12, -Math.sin((54 + i * 72) * Math.PI / 180) * this.radius * 0.12); } ctx.closePath(); ctx.fill(); ctx.restore();
                return;
            }
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.type === 'white' ? '#ccc' : (this.type === 'queen' ? '#800' : '#222');
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = this.type === 'white' ? '#ddd' : (this.type === 'queen' ? '#a00' : '#444');
        ctx.stroke();

        // Cartoon Coin Faces (Animated!)
        if (this.type !== 'striker' && this.type !== 'queen' && window.cachedIsCartoon) {
            let t = Date.now();
            let seed = Math.round(this.x * 7 + this.y * 13) % 6;
            let speed = Math.abs(this.vx) + Math.abs(this.vy);
            let r = this.radius;
            let cid = equippedCoinId;

            if (speed > 0.5) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(Math.sin(t / 60) * 0.12);
                ctx.translate(-this.x, -this.y);
            }

            if (cid === 8) {
                ctx.fillStyle = this.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(this.x - r * 0.6, this.y - r * 0.7, r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(this.x + r * 0.6, this.y - r * 0.7, r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                let innerC = this.type === 'white' ? '#F5A9A9' : '#8B6914';
                ctx.fillStyle = innerC;
                ctx.beginPath(); ctx.arc(this.x - r * 0.6, this.y - r * 0.7, r * 0.18, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(this.x + r * 0.6, this.y - r * 0.7, r * 0.18, 0, Math.PI * 2); ctx.fill();
            }

            let blinkPhase = ((t + seed * 500) % 3000);
            let isBlinking = blinkPhase > 2850;

            // Eye tracking optimized via global striker pos
            let lookX = 0, lookY = 0;
            if (striker && striker.active) {
                let dx = striker.x - this.x, dy = striker.y - this.y;
                let d = Math.sqrt(dx * dx + dy * dy);
                if (d > 0) { lookX = (dx / d) * 1.5; lookY = (dy / d) * 1.5; }
            }

            if (cid === 9) {
                if (!isBlinking) {
                    ctx.fillStyle = '#FF1493';
                    [-1, 1].forEach(side => {
                        let ex = this.x + side * r * 0.28 + lookX, ey = this.y - r * 0.25 + lookY;
                        ctx.beginPath(); ctx.moveTo(ex, ey + r * 0.06);
                        ctx.bezierCurveTo(ex - r * 0.12, ey - r * 0.12, ex - r * 0.2, ey + r * 0.06, ex, ey + r * 0.15);
                        ctx.bezierCurveTo(ex + r * 0.2, ey + r * 0.06, ex + r * 0.12, ey - r * 0.12, ex, ey + r * 0.06); ctx.fill();
                    });
                } else {
                    ctx.strokeStyle = '#FF1493'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(this.x - r * 0.4, this.y - r * 0.25); ctx.lineTo(this.x - r * 0.15, this.y - r * 0.25); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(this.x + r * 0.15, this.y - r * 0.25); ctx.lineTo(this.x + r * 0.4, this.y - r * 0.25); ctx.stroke();
                }
            } else if (cid === 10) {
                if (!isBlinking) {
                    [-1, 1].forEach(side => {
                        let ex = this.x + side * r * 0.28 + lookX, ey = this.y - r * 0.25 + lookY, starR = r * 0.14;
                        ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.6;
                        ctx.beginPath(); for (let i = 0; i < 5; i++) { let a1 = (i * 72 - 90) * (Math.PI / 180), a2 = ((i * 72) + 36 - 90) * (Math.PI / 180); ctx.lineTo(ex + Math.cos(a1) * starR, ey + Math.sin(a1) * starR); ctx.lineTo(ex + Math.cos(a2) * starR * 0.45, ey + Math.sin(a2) * starR * 0.45); }
                        ctx.closePath(); ctx.fill(); ctx.stroke();
                    });
                } else {
                    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(this.x - r * 0.4, this.y - r * 0.25); ctx.lineTo(this.x - r * 0.15, this.y - r * 0.25); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(this.x + r * 0.15, this.y - r * 0.25); ctx.lineTo(this.x + r * 0.4, this.y - r * 0.25); ctx.stroke();
                }
            } else if (cid === 11) {
                if (!isBlinking) {
                    ctx.fillStyle = '#39FF14';
                    [-1, 1].forEach(side => {
                        let ex = this.x + side * r * 0.28, ey = this.y - r * 0.25;
                        ctx.beginPath(); ctx.moveTo(ex, ey - r * 0.15); ctx.lineTo(ex - r * 0.12, ey + r * 0.08); ctx.lineTo(ex + r * 0.12, ey + r * 0.08); ctx.closePath(); ctx.fill();
                    });
                } else {
                    ctx.strokeStyle = '#39FF14'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(this.x - r * 0.4, this.y - r * 0.25); ctx.lineTo(this.x - r * 0.15, this.y - r * 0.25); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(this.x + r * 0.15, this.y - r * 0.25); ctx.lineTo(this.x + r * 0.4, this.y - r * 0.25); ctx.stroke();
                }
            } else {
                ctx.fillStyle = '#FFF';
                ctx.beginPath(); ctx.ellipse(this.x - r * 0.28, this.y - r * 0.25, r * 0.2, isBlinking ? r * 0.04 : r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8; ctx.stroke();
                ctx.beginPath(); ctx.ellipse(this.x + r * 0.28, this.y - r * 0.25, r * 0.2, isBlinking ? r * 0.04 : r * 0.18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                if (!isBlinking) {
                    ctx.fillStyle = '#000';
                    ctx.beginPath(); ctx.arc(this.x - r * 0.28 + lookX, this.y - r * 0.25 + lookY, r * 0.09, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(this.x + r * 0.28 + lookX, this.y - r * 0.25 + lookY, r * 0.09, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#FFF';
                    ctx.beginPath(); ctx.arc(this.x - r * 0.28 + lookX - 0.5, this.y - r * 0.25 + lookY - 0.8, r * 0.04, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(this.x + r * 0.28 + lookX - 0.5, this.y - r * 0.25 + lookY - 0.8, r * 0.04, 0, Math.PI * 2); ctx.fill();
                }
            }

            if (cid === 8) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(this.x, this.y + r * 0.05, r * 0.12, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); }
            if (speed > 3 && cid !== 11) {
                ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(this.x - r * 0.45, this.y - r * 0.5); ctx.lineTo(this.x - r * 0.1, this.y - r * 0.55); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(this.x + r * 0.45, this.y - r * 0.5); ctx.lineTo(this.x + r * 0.1, this.y - r * 0.55); ctx.stroke();
            }

            let mouthType = seed % 3;
            ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
            if (cid === 11) {
                ctx.fillStyle = '#39FF14'; ctx.beginPath(); ctx.moveTo(this.x - r * 0.4, this.y + r * 0.15); let teeth = 5; for (let i = 0; i <= teeth; i++) { let px = this.x - r * 0.4 + (r * 0.8 / teeth) * i, py = (i % 2 === 0) ? this.y + r * 0.15 : this.y + r * 0.35; ctx.lineTo(px, py); } ctx.closePath(); ctx.fill();
            } else if (cid === 9) {
                ctx.strokeStyle = '#C71585'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(this.x - r * 0.2, this.y + r * 0.2); ctx.quadraticCurveTo(this.x, this.y + r * 0.35 + Math.sin(t / 300) * r * 0.05, this.x + r * 0.2, this.y + r * 0.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(this.x, this.y + r * 0.27); ctx.lineTo(this.x, this.y + r * 0.15); ctx.stroke();
            } else if (speed > 5) {
                ctx.beginPath(); ctx.ellipse(this.x, this.y + r * 0.25, r * 0.15, r * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#600'; ctx.fill(); ctx.stroke();
            } else if (mouthType === 0) {
                let smileW = r * 0.35 + Math.sin(t / 400) * r * 0.05; ctx.beginPath(); ctx.arc(this.x, this.y + r * 0.1, smileW, 0.1, Math.PI - 0.1, false); ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke();
            } else if (mouthType === 1) {
                ctx.beginPath(); ctx.arc(this.x, this.y + r * 0.1, r * 0.3, 0.1, Math.PI - 0.1, false); ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#FF6B6B'; ctx.beginPath(); ctx.ellipse(this.x, this.y + r * 0.35, r * 0.12, r * 0.08 + Math.sin(t / 200) * r * 0.03, 0, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(this.x, this.y + r * 0.12, r * 0.28, 0, Math.PI, false); ctx.fillStyle = '#600'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#FFF'; ctx.fillRect(this.x - r * 0.12, this.y + r * 0.12, r * 0.1, r * 0.1); ctx.fillRect(this.x + r * 0.02, this.y + r * 0.12, r * 0.1, r * 0.1);
            }

            if (cid === 9) {
                ctx.strokeStyle = 'rgba(255,105,180,0.4)'; ctx.lineWidth = 1;[-1, 1].forEach(side => { let cx2 = this.x + side * r * 0.5, cy2 = this.y + r * 0.05; ctx.beginPath(); for (let a = 0; a < Math.PI * 3; a += 0.2) { let sr = a * r * 0.015; ctx.lineTo(cx2 + Math.cos(a + t / 500) * sr, cy2 + Math.sin(a + t / 500) * sr); } ctx.stroke(); });
            } else if (cid === 10) {
                ctx.fillStyle = `hsl(${(t / 10) % 360}, 100%, 70%)`; ctx.beginPath(); ctx.arc(this.x - r * 0.55, this.y - r * 0.1, r * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `hsl(${((t / 10) + 120) % 360}, 100%, 70%)`; ctx.beginPath(); ctx.arc(this.x + r * 0.55, this.y - r * 0.1, r * 0.06, 0, Math.PI * 2); ctx.fill();
            } else if (cid !== 11) {
                ctx.fillStyle = 'rgba(255, 100, 100, 0.2)'; ctx.beginPath(); ctx.ellipse(this.x - r * 0.5, this.y + r * 0.05, r * 0.15, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(this.x + r * 0.5, this.y + r * 0.05, r * 0.15, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
            }

            if (speed > 0.5) { ctx.restore(); }
        }
    }
    update() {
        if (!this.active) return;

        if (gameMode === 'ZOMBIE' && this.type === 'black' && gameState !== 'GAMEOVER') {
            let q = coins.find(c => c.active && c.type === 'queen');
            if (q) { let angle = Math.atan2(q.y - this.y, q.x - this.x); this.vx += Math.cos(angle) * 0.05 * window.timeScale; this.vy += Math.sin(angle) * 0.05 * window.timeScale; }
        }

        this.x += this.vx * window.timeScale; this.y += this.vy * window.timeScale;
        this.rotation += (Math.abs(this.vx) + Math.abs(this.vy)) * 0.1 * window.timeScale;
        if (this.type === 'striker') this.rotation += 0.05 * window.timeScale;
        let effectiveFriction = 1 - ((1 - FRICTION) * window.timeScale);
        if (this.type === 'striker') effectiveFriction *= (1 - (0.005 * window.timeScale)); // Extra friction for striker
        this.vx *= effectiveFriction; this.vy *= effectiveFriction;
        if (Math.abs(this.vx) < 0.05) this.vx = 0; if (Math.abs(this.vy) < 0.05) this.vy = 0;
        if (this.type === 'striker' && (Math.abs(this.vx) > 0.5 || Math.abs(this.vy) > 0.5)) { if (this.effect !== 'none') createStrikerTrail(this.x, this.y, this.effect); }

        const pockets = [{ x: 25, y: 25 }, { x: SIZE - 25, y: 25 }, { x: 25, y: SIZE - 25 }, { x: SIZE - 25, y: SIZE - 25 }];
        const pocketRPlus = (POCKET_RADIUS + 5) * (POCKET_RADIUS + 5);
        for (let p of pockets) {
            let dx = this.x - p.x; let dy = this.y - p.y;
            if ((dx * dx + dy * dy) < pocketRPlus) {
                this.pocket(p.x, p.y); return;
            }
        }
        const cornerGap = 80;
        const limitMin = 25 + this.radius;
        const limitMax = SIZE - 25 - this.radius;
        const res = -RESTITUTION;

        if (this.y > cornerGap && this.y < SIZE - cornerGap) {
            if (this.x < limitMin) { this.x = limitMin; this.vx *= res; }
            else if (this.x > limitMax) { this.x = limitMax; this.vx *= res; }
        }
        if (this.x > cornerGap && this.x < SIZE - cornerGap) {
            if (this.y < limitMin) { this.y = limitMin; this.vy *= res; }
            else if (this.y > limitMax) { this.y = limitMax; this.vy *= res; }
        }
        if (this.x < this.radius) { this.x = this.radius; this.vx *= res; }
        else if (this.x > SIZE - this.radius) { this.x = SIZE - this.radius; this.vx *= res; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= res; }
        else if (this.y > SIZE - this.radius) { this.y = SIZE - this.radius; this.vy *= res; }
    }
    pocket(pocketX, pocketY) {
        if (gameMode === 'INFECTION' && this.type !== 'striker') {
            this.vx = 0; this.vy = 0; window.playSound('pocket'); createPocketEffect(pocketX, pocketY, this.color); setTimeout(() => respawnCoinCenter(this.type), 100); return;
        }

        if (this.type === 'striker') {
            let diffElem = document.getElementById('ai-difficulty'); let aiToggle = document.getElementById('ai-toggle');
            let isExtremeBot = aiToggle && aiToggle.checked && diffElem && diffElem.value === 'extreme' && currentPlayer === 2;
            let activePet = petShopItems.find(p => p.id === equippedPetId);
            let isPetShot = window.lastShotByPet && activePet && activePet.price >= 1500;

            if (isExtremeBot || isPetShot) {
                this.x = SIZE / 2; this.y = SIZE / 2; this.vx *= -1; this.vy *= -1;
                createPocketEffect(pocketX, pocketY, '#FF0000'); window.playSound('hit');
                return;
            }
        }

        this.active = false; this.vx = 0; this.vy = 0;
        if (this.type === 'striker') window.playSound('foul'); else { window.playSound('pocket'); if (currentPlayer === 1) { window.totalCoinsPocketed = (parseInt(window.totalCoinsPocketed) || 0) + 1; localStorage.setItem('totalCoinsPocketed', window.totalCoinsPocketed); } }
        createPocketEffect(pocketX, pocketY, this.color);
        if (this.type === 'white') coinsPocketedThisTurn.white++; if (this.type === 'black') coinsPocketedThisTurn.black++; if (this.type === 'queen') coinsPocketedThisTurn.queen++; if (this.type === 'striker') coinsPocketedThisTurn.strikerFoul = true;

        if (gameMode === 'ZOMBIE' && this.type === 'queen') { endGame("QUEEN INFECTED!"); return; }

        if (!window.isCinematic && this.type !== 'striker') {
            let isWin = false; let triggerCine = false; let myType = currentPlayer === 1 ? 'white' : 'black'; let remaining = coins.filter(c => c.active && c.type === myType).length;
            if (gameMode === 'FREESTYLE') {
                let pts1 = p1Points, pts2 = p2Points; let ptsGain = (this.type === 'black' ? 10 : (this.type === 'white' ? 20 : 50));
                if (currentPlayer === 1) pts1 += ptsGain; else pts2 += ptsGain;
                if (pts1 >= freestyleTargetScore || pts2 >= freestyleTargetScore) triggerCine = true;
                let remainingAll = coins.filter(c => c.active && c.type !== 'striker').length; if (remainingAll <= 3) triggerCine = true; if (remainingAll === 1) isWin = true;
            } else if (gameMode === 'DISC POOL' || gameMode === 'GUN GAME') {
                if (remaining <= 3 && this.type === myType) triggerCine = true; if (remaining === 1 && this.type === myType) isWin = true;
            } else if (gameMode === 'CLASSIC') {
                if (remaining <= 3 && this.type === myType) triggerCine = true; if (this.type === 'queen') triggerCine = true;
                if (isQueenPocketed || queenPendingCover || this.type === 'queen') { if (remaining === 1 && this.type === myType && (isQueenPocketed || this.type === 'queen')) isWin = true; if (remaining === 0 && this.type === myType) isWin = true; }
            }
            if (isWin || triggerCine) { window.triggerCinematic(pocketX, pocketY); }
        }
    }
}

// ==========================================
// 9. GAME CONTROL & RULES
// ==========================================
window.calculatePetTarget = function () {
    if (equippedPetId === 0 || currentPlayer !== 1 || window.mpPetsAllowed === false) { window.petTargetCoin = null; return; }
    let targets = [];
    let queen = coins.find(c => c.active && c.type === 'queen');

    if (gameMode === 'ZOMBIE') { targets = coins.filter(c => c.active && c.type === 'black'); }
    else if (gameMode === 'INFECTION') { targets = coins.filter(c => c.active && c.type === 'black'); }
    else {
        targets = coins.filter(c => c.active && (gameMode === 'FREESTYLE' ? (c.type === 'white' || c.type === 'black') : c.type === 'white'));
        if (queenPendingCover && playerCoveringQueen === 1) targets = coins.filter(c => c.active && c.type === 'white');
        else if (gameMode !== 'DISC POOL' && gameMode !== 'GUN GAME' && queen) targets.push(queen);
    }

    if (targets.length === 0) return;
    let bestCoin = targets[0]; let bestDist = Infinity;
    const pockets = [{ x: 25, y: 25 }, { x: SIZE - 25, y: 25 }, { x: 25, y: SIZE - 25 }, { x: SIZE - 25, y: SIZE - 25 }];
    targets.forEach(c => { pockets.forEach(p => { let d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bestDist) { bestDist = d; bestCoin = c; } }); });
    window.petTargetCoin = bestCoin;
};

function initGame() {
    clearTimeout(botTimeoutId); clearTimeout(window.cinematicTimeoutId); if (window.infectionTimerId) clearInterval(window.infectionTimerId);

    // OFFLINE BUG FIX: Only reset MP states if we are NOT currently in a multiplayer room
    if (!window.roomIdMP && !window.mpRoomId) {
        window.roomIdMP = null;
        window.mpRoomId = null;
        window.myPlayerIndexMP = 1;
        window.is2v2 = false;
        window.is1v1MP = false;
        if (window.mpLobbyTimer) { clearInterval(window.mpLobbyTimer); window.mpLobbyTimer = null; }
        window.mpPetsAllowed = true;
    }

    coins = []; particles = []; p1Coins = 0; p2Coins = 0; p1Points = 0; p2Points = 0;
    window.teamPoints = { team1: 0, team2: 0 };
    isQueenPocketed = false; queenPendingCover = false; playerCoveringQueen = null; currentPlayer = 1; winnerName = ""; striker = null; window.petTargetCoin = null;
    gameOverTime = 0; foulMessageTime = 0; foulReason = ""; queenCoverMessageTime = 0; goodMessageTime = 0; setControlsDisabled(false);
    window.isCinematic = false; window.timeScale = 1.0; window.camera.x = SIZE / 2; window.camera.y = SIZE / 2; window.camera.scale = 1.0; window.camera.rotation = 0; window.cameraTarget.x = SIZE / 2; window.cameraTarget.y = SIZE / 2; window.cameraTarget.scale = 1.0; window.cameraTarget.rotation = 0;
    gameState = 'MENU'; window.lastShotByPet = false;

    let activeCoin = coinShopItems.find(item => item.id === equippedCoinId); let colorW = activeCoin ? activeCoin.colorW : '#fff9e6'; let colorB = activeCoin ? activeCoin.colorB : '#333';

    if (gameMode === 'ZOMBIE') { coins.push(new Coin(SIZE / 2, SIZE / 2, COIN_R, 'queen', '#ff3333', 5)); window.zombieScore = 0; window.lastZombieSpawnTime = Date.now() + 3000; for (let i = 0; i < 4; i++) window.spawnZombie(); }
    else {
        // Standard setup: 1 Queen + 6 Inner + 12 Outer = 19 coins
        if (gameMode !== 'DISC POOL' && gameMode !== 'GUN GAME') {
            coins.push(new Coin(SIZE / 2, SIZE / 2, COIN_R, 'queen', '#ff3333'));
        }
        for (let i = 0; i < 6; i++) {
            let angle = i * Math.PI / 3;
            let type = i % 2 === 0 ? 'white' : 'black';
            let color = type === 'white' ? colorW : colorB;
            coins.push(new Coin(SIZE / 2 + Math.cos(angle) * COIN_R * 2, SIZE / 2 + Math.sin(angle) * COIN_R * 2, COIN_R, type, color));
        }
        for (let i = 0; i < 12; i++) {
            let angle = i * Math.PI / 6;
            let type = i % 2 !== 0 ? 'white' : 'black';
            let color = type === 'white' ? colorW : colorB;
            coins.push(new Coin(SIZE / 2 + Math.cos(angle) * COIN_R * 4, SIZE / 2 + Math.sin(angle) * COIN_R * 4, COIN_R, type, color));
        }
    }

    if (gameMode === 'INFECTION') {
        window.infectionTimeLeft = 120;
        if (!window.roomIdMP || window.myPlayerIndexMP === 1) { // Only local or Host manages timer
            window.infectionTimerId = setInterval(() => {
                if (gameState !== 'GAMEOVER' && gameState !== 'MENU' && gameState !== 'COUNTDOWN' && gameState !== 'SPINNING') {
                    window.infectionTimeLeft--;
                    if (window.roomIdMP) {
                        socket.emit('sync_timer', { roomId: window.roomIdMP, time: window.infectionTimeLeft });
                    }
                    updateUI();
                    if (window.infectionTimeLeft <= 0) {
                        clearInterval(window.infectionTimerId);
                        let w = coins.filter(c => c.active && c.type === 'white').length;
                        let b = coins.filter(c => c.active && c.type === 'black').length;
                        let aiEnabled = document.getElementById('ai-toggle') && document.getElementById('ai-toggle').checked;
                        if (w > b) endGame(aiEnabled ? "YOU WON" : "PLAYER 1 WINS");
                        else if (b > w) endGame(aiEnabled ? "YOU LOSE" : "PLAYER 2 WINS");
                        else endGame("TIE GAME");
                    }
                }
            }, 1000);
        }
    }

    if (gameMode === 'GUN GAME') { window.gunGameLevel = 0; window.gunGameLevelAI = 0; }
    resetTimeEffects(); updateUI(); updateTopBar(); renderSidebarShop(); if (window.renderEmoteBar) window.renderEmoteBar();
}

window.runInRoomLobbyTransition = function (containerId, mode, callback) {
    let container = document.getElementById(containerId);
    if (!container) { if (callback) callback(); return; }

    const colors = { 'CLASSIC': '#FFD700', 'FREESTYLE': '#00FFFF', 'DISC POOL': '#FF1493', 'ZOMBIE': '#8B0000', 'INFECTION': '#39FF14', 'GUN GAME': '#FF4500' };
    const icons = { 'CLASSIC': '🎯', 'FREESTYLE': '🎨', 'DISC POOL': '🎱', 'ZOMBIE': '🧟', 'INFECTION': '☣️', 'GUN GAME': '🔫' };
    let mColor = colors[mode] || '#FFD700';
    let mIcon = icons[mode] || '🎯';

    // Inject styles
    let transStyle = document.getElementById('mp-trans-style') || document.createElement('style');
    transStyle.id = 'mp-trans-style';
    transStyle.innerHTML = `
        @keyframes mpCountPop { 0% { transform: scale(2); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 80% { transform: scale(1); opacity: 1; } 100% { transform: scale(0.8); opacity: 0; } }
        @keyframes countdownOverlayFadeIn { from { background: rgba(0,0,0,0); backdrop-filter: blur(0); } to { background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); } }
    `;
    if (!document.getElementById('mp-trans-style')) document.head.appendChild(transStyle);

    let overlay = document.createElement('div');
    overlay.id = 'mp-room-countdown-overlay';
    overlay.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1000; border-radius: 12px; animation: countdownOverlayFadeIn 0.3s forwards; pointer-events: all;`;

    overlay.innerHTML = `
        <div style="font-size: 10px; color: ${mColor}; font-weight: 950; letter-spacing: 4px; margin-bottom: 20px; text-transform: uppercase; border: 1px solid ${mColor}; padding: 8px 30px; border-radius: 40px; background: ${mColor}15;">READY FOR BATTLE</div>
        <div id="room-countdown-text" style="font-size: 120px; font-weight: 950; color: #FFF; text-shadow: 0 0 50px rgba(255,255,255,0.4); font-family: 'Outfit', sans-serif; min-height: 140px; display: flex; align-items: center; justify-content: center; user-select: none;"></div>
        <div style="margin-top: 30px; color: #FFF; font-weight: 950; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; opacity: 0.8;">
           <span style="font-size: 18px;">${mIcon}</span> <span>${mode} MODE</span>
        </div>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
    window.playSound('reveal');

    let cSequence = [
        { t: 600, v: '3', c: '#FF3333' },
        { t: 1400, v: '2', c: '#FFD700' },
        { t: 2200, v: '1', c: '#39FF14' },
        { t: 3000, v: 'GO!', c: mColor }
    ];

    cSequence.forEach(cs => {
        setTimeout(() => {
            let txt = document.getElementById('room-countdown-text');
            if (txt) {
                txt.textContent = cs.v;
                txt.style.color = cs.c;
                txt.style.textShadow = `0 0 60px ${cs.c}`;
                txt.style.animation = 'none';
                void txt.offsetWidth;
                txt.style.animation = 'mpCountPop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
                window.playSound('beep');
            }
        }, cs.t);
    });

    setTimeout(() => {
        overlay.style.transition = 'opacity 0.4s ease-out, transform 0.4s';
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(1.1)';
        setTimeout(() => { overlay.remove(); if (callback) callback(); }, 400);
    }, 4000);
};

function startCountdown() {
    // Show the game UI and hide any splash screens
    let intro = document.getElementById('intro-screen'); if (intro) intro.style.display = 'none';
    let login = document.getElementById('login-screen'); if (login) login.style.display = 'none';
    let main = document.getElementById('main-game'); if (main) { main.style.display = 'flex'; main.style.opacity = '1'; }

    let l = document.getElementById('left-sidebar'); if (l) l.style.display = 'block';
    let c = document.getElementById('center-area'); if (c) c.style.display = 'flex';
    let r = document.getElementById('right-sidebar'); if (r) r.style.width = '320px';

    // Pause music when match starts for focus
    if (window.bgMusic) window.bgMusic.pause();

    setControlsDisabled(true);

    // Skip the "VS" transition screen entirely as requested
    window.playSound('beep');
    gameState = 'COUNTDOWN';
    countdownStartTime = Date.now();
    countdownValue = 3;
    lastBeepValue = 3;
    renderSidebarShop();
    if (window.renderEmoteBar) window.renderEmoteBar();
}

function setupStriker() {
    clearTimeout(botTimeoutId);
    let aiToggle = document.getElementById('ai-toggle');
    let aiEnabled = aiToggle && aiToggle.checked;
    // perspectivePlayer allows pet shots to pretend they are Player 1
    let perspectivePlayer = window.lastShotByPet ? 1 : currentPlayer;

    // Default to Center (fallback)
    let x = SIZE / 2;
    let y = SIZE / 2;

    if (!window.is2v2) {
        // Standard 1v1/Solo positioning
        x = SIZE / 2;
        y = (perspectivePlayer === 1) ? SIZE - 115 : 115;
    } else {
        // 2v2 positioning: 1:B, 2:R, 3:T, 4:L
        if (perspectivePlayer === 1) { // Bottom
            x = SIZE / 2; y = SIZE - 115;
        } else if (perspectivePlayer === 2) { // Right
            x = SIZE - 115; y = SIZE / 2;
        } else if (perspectivePlayer === 3) { // Top
            x = SIZE / 2; y = 115;
        } else if (perspectivePlayer === 4) { // Left
            x = 115; y = SIZE / 2;
        }
    }

    let activeItem = shopItems.find(item => item.id === equippedStrikerId);
    if (gameMode === 'GUN GAME') {
        let ggId = (perspectivePlayer === 1) ? window.gunGameLevel : window.gunGameLevelAI;
        activeItem = shopItems.find(item => item.id === ggId) || shopItems[0];
    }
    else {
        let isActuallyBot = false;
        if (window.roomIdMP && window.mpPlayers) {
            let pData = window.mpPlayers[perspectivePlayer - 1];
            if (pData && pData.isAI) isActuallyBot = true;
        } else if (!window.roomIdMP && perspectivePlayer > 1 && aiEnabled) {
            isActuallyBot = true;
        }

        // BOT ALWAYS GETS DEFAULT ROOKIE STRIKER (Unless Boss Rush Giant)
        if (isActuallyBot && (!window.inBossRush || window.bossRushStage !== 1)) {
            activeItem = shopItems[0];
        }
    }

    striker = new Coin(x, y, STRIKER_R, 'striker', '#e0e0e0', activeItem ? activeItem.mass : 1.5);
    striker.effect = activeItem ? activeItem.effect : 'none';
    if (window.inBossRush && perspectivePlayer === 2 && window.bossRushStage === 1) { striker.radius = STRIKER_R * 3; striker.mass = 4.0; }

    coinsPocketedThisTurn = { white: 0, black: 0, queen: 0, strikerFoul: false };

    window.isCinematic = false;
    window.timeScale = 1.0;
    window.cameraTarget.x = SIZE / 2;
    window.cameraTarget.y = SIZE / 2;
    window.cameraTarget.scale = 1.0;

    // Handle camera rotation for the active player's perspective
    if (gameMode === 'ZOMBIE') {
        window.cameraTarget.rotation = 0;
    } else if (window.roomIdMP) {
        // MULTIPLAYER: My seat is always at the bottom!
        let targetRot = 0;
        if (window.myPlayerIndexMP === 2) targetRot = Math.PI / 2;
        else if (window.myPlayerIndexMP === 3) targetRot = Math.PI;
        else if (window.myPlayerIndexMP === 4) targetRot = -Math.PI / 2;

        window.cameraTarget.rotation = targetRot;
    } else {
        if (!window.is2v2) {
            window.cameraTarget.rotation = (perspectivePlayer === 1) ? 0 : Math.PI; // Face Opponent in 1v1
        } else {
            if (perspectivePlayer === 1) window.cameraTarget.rotation = 0;
            else if (perspectivePlayer === 2) window.cameraTarget.rotation = Math.PI / 2;
            else if (perspectivePlayer === 3) window.cameraTarget.rotation = Math.PI;
            else if (perspectivePlayer === 4) window.cameraTarget.rotation = -Math.PI / 2;
        }
    }

    if (!window.roomIdMP && !aiEnabled && gameMode !== 'ZOMBIE' && Math.abs(window.cameraTarget.rotation - window.camera.rotation) > 0.5) {
        gameState = 'SPINNING';
        currentMessage = `PLAYER ${perspectivePlayer} GET READY!`;
        messageDisplayTime = Date.now() + 3000; window.playSound('reveal');
        setTimeout(() => { if (gameState === 'SPINNING') { gameState = 'PLACING'; turnStartTime = Date.now(); let timeLeftElem = document.getElementById('time-left'); if (timeLeftElem) timeLeftElem.innerText = "15"; resetTimeEffects(); updateUI(); window.calculatePetTarget(); } }, 1500);
    } else {
        gameState = 'PLACING'; turnStartTime = Date.now(); let timeLeftElem = document.getElementById('time-left'); if (timeLeftElem) timeLeftElem.innerText = "15"; resetTimeEffects();

        let isAIRoles = false;
        if (window.roomIdMP && window.mpPlayers) {
            let pData = window.mpPlayers[currentPlayer - 1];
            if (pData && pData.isAI) isAIRoles = true;
        }

        if (gameMode !== 'ZOMBIE' && (perspectivePlayer !== 1 || window.isSpectating) && (aiEnabled || (window.roomIdMP && isAIRoles && window.myPlayerIndexMP === 1))) {
            botTimeoutId = setTimeout(() => playSmartAI(false), 1000);
        }
    }
    updateUI(); if (window.renderEmoteBar) window.renderEmoteBar(); window.calculatePetTarget();
    if (window.is2v2) renderSidebarShop();
}

function resetTimeEffects() { let timeLeftElem = document.getElementById('time-left'); if (timeLeftElem) { timeLeftElem.style.color = ''; timeLeftElem.style.textShadow = ''; } }

function handleTimeout() {
    if (gameState === 'GAMEOVER') return;
    if (gameMode === 'ZOMBIE') { updateStatus("Hurry up! Time's up!"); setupStriker(); return; }
    if (queenPendingCover && playerCoveringQueen === currentPlayer) { queenPendingCover = false; playerCoveringQueen = null; respawnCoin('queen'); updateStatus("Time's up! Failed to cover Queen. Turn passes."); } else { updateStatus("Time's up! Turn passes."); }

    const lastPlayer = currentPlayer;
    if (window.is2v2) {
        if (currentPlayer === 1) currentPlayer = 2;
        else if (currentPlayer === 2) currentPlayer = 3;
        else if (currentPlayer === 3) currentPlayer = 4;
        else currentPlayer = 1;
    } else {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
    }

    // Multiplayer: Only trigger if I am the active player OR Host handles AI
    if (window.roomIdMP) {
        let finishedWasAI = window.mpPlayers && window.mpPlayers[lastPlayer - 1] && window.mpPlayers[lastPlayer - 1].isAI;
        if (window.isMyTurnMP || (window.myPlayerIndexMP === 1 && finishedWasAI)) {
            socket.emit('next_turn', { roomId: window.roomIdMP, nextPlayerIndex: currentPlayer });
        }
    }

    setupStriker();
}

function resolveCollisions() {
    // Avoid creating new arrays every frame to reduce GC overhead
    const coinsLen = coins.length;
    for (let i = 0; i < coinsLen + 1; i++) {
        let c1 = (i < coinsLen) ? coins[i] : striker;
        if (!c1 || !c1.active) continue;

        for (let j = i + 1; j < coinsLen + 1; j++) {
            let c2 = (j < coinsLen) ? coins[j] : striker;
            if (!c2 || !c2.active || c1 === c2) continue;

            let dx = c2.x - c1.x;
            let dy = c2.y - c1.y;
            let distSq = dx * dx + dy * dy;
            let minDist = c1.radius + c2.radius;
            let minDistSq = minDist * minDist;

            if (distSq < minDistSq) {
                let dist = Math.sqrt(distSq);
                if (gameMode === 'ZOMBIE' && gameState !== 'GAMEOVER') {
                    if ((c1.type === 'queen' && c2.type === 'black') || (c1.type === 'black' && c2.type === 'queen')) endGame("QUEEN INFECTED!");
                }
                if (gameMode === 'INFECTION') {
                    if ((c1.type === 'white' && c2.type === 'black') || (c1.type === 'black' && c2.type === 'white')) {
                        let speed1 = Math.hypot(c1.vx, c1.vy);
                        let speed2 = Math.hypot(c2.vx, c2.vy);
                        let activeCoin = coinShopItems.find(item => item.id === equippedCoinId) || coinShopItems[0];
                        if (speed1 > speed2 + 0.5) { c2.type = c1.type; c2.color = c1.type === 'white' ? activeCoin.colorW : activeCoin.colorB; } else if (speed2 > speed1 + 0.5) { c1.type = c2.type; c1.color = c2.type === 'white' ? activeCoin.colorW : activeCoin.colorB; }
                    }
                }
                if (dist === 0) { dx = Math.random() * 0.1 - 0.05; dy = Math.random() * 0.1 - 0.05; dist = Math.sqrt(dx * dx + dy * dy); }
                let overlap = minDist - dist;
                let nx = dx / dist;
                let ny = dy / dist;
                c1.x -= nx * (overlap / 2); c1.y -= ny * (overlap / 2);
                c2.x += nx * (overlap / 2); c2.y += ny * (overlap / 2);
                let kx = (c1.vx - c2.vx); let ky = (c1.vy - c2.vy);
                let p = 2 * (nx * kx + ny * ky) / (c1.mass + c2.mass);
                c1.vx -= p * c2.mass * nx; c1.vy -= p * c2.mass * ny;
                c2.vx += p * c1.mass * nx; c2.vy += p * c1.mass * ny;
                if (Math.abs(c1.vx) > 1 || Math.abs(c2.vx) > 1) window.playSound('hit');
            }
        }
    }
}

function evaluateTurn() {
    if (gameState === 'GAMEOVER') return; let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
    const lastPlayer = currentPlayer;
    const perspectivePlayer = window.perspectivePlayerOverride || currentPlayer;


    let activePet = petShopItems.find(p => p.id === equippedPetId);
    let anyCoinPocketed = (coinsPocketedThisTurn.black > 0 || coinsPocketedThisTurn.white > 0 || coinsPocketedThisTurn.queen > 0);

    if (currentPlayer === 1 && coinsPocketedThisTurn.white >= 3) { window.updateQuest('pocket_white_turn', 3); }

    let myType = currentPlayer === 1 ? 'white' : 'black';
    let pocketedMyCoin = gameMode === 'FREESTYLE' ? (coinsPocketedThisTurn.black > 0 || coinsPocketedThisTurn.white > 0) : coinsPocketedThisTurn[myType] > 0;

    // Pet Reactions
    if (currentPlayer === 1 && window.lastShotByPet && activePet && activePet.price >= 1500) {
        if (!pocketedMyCoin && !coinsPocketedThisTurn.queen) {
            currentMessage = `${activePet.name.split(' ')[0]} SORRY 😔`;
            messageDisplayTime = Date.now() + 2500; window.playSound('beep');
        }
    } else if (currentPlayer === 1 && anyCoinPocketed && activePet && activePet.level >= 3 && !coinsPocketedThisTurn.strikerFoul) {
        let msgs = ["Great Shot!", "Wow!", "Amazing!", "Good Hit!", "Excellent!"];
        currentMessage = `${activePet.name.split(' ')[0]}: ${msgs[Math.floor(Math.random() * msgs.length)]}`;
        messageDisplayTime = Date.now() + 2500; window.playSound('beep');
    }

    window.lastShotByPet = false; // Reset pet shot flag

    if (window.is2v2) {
        let team = (currentPlayer === 1 || currentPlayer === 3) ? "team1" : "team2";
        let isTeam1 = (team === "team1");
        let extraTurn = false;

        if (gameMode === 'FREESTYLE') {
            // Freestyle: Black=10, White=20, Queen=50. 
            let pointsGained = (coinsPocketedThisTurn.black * 10) + (coinsPocketedThisTurn.white * 20);

            if (coinsPocketedThisTurn.strikerFoul) {
                foulMessageTime = Date.now(); foulReason = "FOUL!";
                // FOUL RULE: Own coins respawn, Opponent gets the points for what was hit!
                let opponentTeam = isTeam1 ? "team2" : "team1";
                window.teamPoints[opponentTeam] += pointsGained;
                if (coinsPocketedThisTurn.queen > 0) respawnCoinCenter('queen');
                for (let i = 0; i < coinsPocketedThisTurn.white; i++) respawnCoinCenter('white');
                for (let i = 0; i < coinsPocketedThisTurn.black; i++) respawnCoinCenter('black');

                window.teamPoints[team] = Math.max(0, window.teamPoints[team] - 10);
                updateStatus("Striker Pocketed! Penalty: -10 Pts. Opponent gains points.");
            } else {
                let queenPocketedJustNow = (coinsPocketedThisTurn.queen > 0);
                let coveredSuccessfully = false;
                let failedToCover = false;

                // Follow Rule: If queen was pending, did we hit any coin (black or white) now?
                if (queenPendingCover && !queenPocketedJustNow && playerCoveringQueen === currentPlayer) {
                    if (anyCoinPocketed) coveredSuccessfully = true;
                    else failedToCover = true;
                }
                // Pocketed queen and follow in same shot?
                if (queenPocketedJustNow && anyCoinPocketed) {
                    coveredSuccessfully = true;
                    queenPocketedJustNow = false;
                }

                if (coveredSuccessfully) {
                    isQueenPocketed = true; queenPendingCover = false; playerCoveringQueen = null;
                    window.teamPoints[team] += 50; // Award 50 points now
                    goodMessageTime = Date.now();
                } else if (failedToCover) {
                    queenPendingCover = false; playerCoveringQueen = null; respawnCoinCenter('queen');
                }
                if (queenPocketedJustNow) {
                    queenPendingCover = true; playerCoveringQueen = currentPlayer; queenCoverMessageTime = Date.now();
                }

                window.teamPoints[team] += pointsGained;
            }
            extraTurn = anyCoinPocketed && !coinsPocketedThisTurn.strikerFoul;

            let target = window.freestyleTargetScore || 160;
            if (window.teamPoints.team1 >= target) { endGame("TEAM BLUE WINS!"); return; }
            if (window.teamPoints.team2 >= target) { endGame("TEAM RED WINS!"); return; }
        } else {
            // Classic or Disc Pool
            if (coinsPocketedThisTurn.strikerFoul) {
                foulMessageTime = Date.now(); foulReason = "FOUL!";
                if (queenPendingCover && playerCoveringQueen === currentPlayer) { queenPendingCover = false; playerCoveringQueen = null; respawnCoinCenter('queen'); } else if (coinsPocketedThisTurn.queen > 0) { respawnCoinCenter('queen'); }

                // FOUL RULE: Player's assigned coins respawn. Opponent's coins stay pocketed for them.
                if (isTeam1) { // Fouler is White
                    for (let i = 0; i < coinsPocketedThisTurn.white; i++) respawnCoinCenter('white');
                    p2Coins += coinsPocketedThisTurn.black; // Opponent (Black) keeps their coins
                    if (p1Coins > 0) { p1Coins--; respawnCoinCenter('white'); }
                } else { // Fouler is Black
                    for (let i = 0; i < coinsPocketedThisTurn.black; i++) respawnCoinCenter('black');
                    p1Coins += coinsPocketedThisTurn.white; // Opponent (White) keeps their coins
                    if (p2Coins > 0) { p2Coins--; respawnCoinCenter('black'); }
                }
                updateStatus("Foul! Your coins respawn. Opponent keeps theirs.");
            } else {
                let queenPocketedJustNow = (coinsPocketedThisTurn.queen > 0);
                let coveredSuccessfully = false;
                let failedToCover = false;

                if (gameMode !== 'DISC POOL') {
                    if (queenPendingCover && !queenPocketedJustNow && playerCoveringQueen === currentPlayer) {
                        // COMPULSORY COLOR: Team 1 (Blue) must hit WHITE. Team 2 (Red) must hit BLACK.
                        if (isTeam1 && coinsPocketedThisTurn.white > 0) coveredSuccessfully = true;
                        else if (!isTeam1 && coinsPocketedThisTurn.black > 0) coveredSuccessfully = true;
                        else failedToCover = true; // Includes hitting nothing OR hitting the wrong color
                    }
                    if (queenPocketedJustNow && ((isTeam1 && coinsPocketedThisTurn.white > 0) || (!isTeam1 && coinsPocketedThisTurn.black > 0))) {
                        coveredSuccessfully = true;
                        queenPocketedJustNow = false;
                    }

                    if (coveredSuccessfully) {
                        isQueenPocketed = true; queenPendingCover = false; playerCoveringQueen = null; goodMessageTime = Date.now();
                    } else if (failedToCover) {
                        queenPendingCover = false; playerCoveringQueen = null; respawnCoinCenter('queen');
                        updateStatus("Follow Failed! Queen Respawned.");
                    }
                    if (queenPocketedJustNow) {
                        queenPendingCover = true; playerCoveringQueen = currentPlayer; queenCoverMessageTime = Date.now();
                    }
                }

                p1Coins += coinsPocketedThisTurn.white;
                p2Coins += coinsPocketedThisTurn.black;
            }

            // Win Condition Checks
            let remainingWhite = coins.filter(c => c.active && c.type === 'white').length;
            let remainingBlack = coins.filter(c => c.active && c.type === 'black').length;

            if (gameMode === 'DISC POOL') {
                if (remainingWhite === 0) { endGame("TEAM BLUE WINS!"); return; }
                if (remainingBlack === 0) { endGame("TEAM RED WINS!"); return; }
            } else { // Classic
                // Win if your team finishes coins and queen is covered
                if (remainingWhite === 0 && (isQueenPocketed || queenPendingCover)) { endGame("TEAM BLUE WINS!"); return; }
                if (remainingBlack === 0 && (isQueenPocketed || queenPendingCover)) { endGame("TEAM RED WINS!"); return; }
            }

            extraTurn = ((isTeam1 && coinsPocketedThisTurn.white > 0) || (!isTeam1 && coinsPocketedThisTurn.black > 0) || (coinsPocketedThisTurn.queen > 0 && !coinsPocketedThisTurn.strikerFoul)) && !coinsPocketedThisTurn.strikerFoul;
        }

        let remActive = coins.filter(c => c.active && c.type !== 'queen').length;
        if (remActive === 0) {
            if (gameMode === 'FREESTYLE') {
                if (window.teamPoints.team1 > window.teamPoints.team2) endGame("TEAM BLUE WINS!");
                else if (window.teamPoints.team2 > window.teamPoints.team1) endGame("TEAM RED WINS!");
                else endGame("TIE GAME");
            } else {
                if (p1Coins > p2Coins) endGame("TEAM BLUE WINS!");
                else if (p2Coins > p1Coins) endGame("TEAM RED WINS!");
                else endGame("TIE GAME");
            }
            return;
        }

        if (!extraTurn) {
            // Standard Turn order: 1 -> 2 -> 3 -> 4
            if (currentPlayer === 1) currentPlayer = 2;
            else if (currentPlayer === 2) currentPlayer = 3;
            else if (currentPlayer === 3) currentPlayer = 4;
            else currentPlayer = 1;
        }

        if (window.roomIdMP) {
            let finishedWasAI = window.mpPlayers && window.mpPlayers[lastPlayer - 1] && window.mpPlayers[lastPlayer - 1].isAI;
            if (window.isMyTurnMP || (window.myPlayerIndexMP === 1 && finishedWasAI)) {
                socket.emit('next_turn', { roomId: window.roomIdMP, nextPlayerIndex: currentPlayer });
            }
        } else if (aiEnabled && currentPlayer > 1) {
            botTimeoutId = setTimeout(() => {
                if (gameState === 'PLACING' || gameState === 'AIMING') window.playSmartAI();
            }, 1500 + Math.random() * 1000);
        }
        if (gameState !== 'GAMEOVER') setupStriker();
        return;
    }

    if (gameMode === 'ZOMBIE') {
        if (coinsPocketedThisTurn.strikerFoul) { foulMessageTime = Date.now(); foulReason = "FOUL!"; }
        if (coinsPocketedThisTurn.black > 0) { window.zombieScore += coinsPocketedThisTurn.black * 10; }
        if (coinsPocketedThisTurn.queen > 0) { endGame("QUEEN INFECTED!"); return; }
        currentPlayer = 1; if (gameState !== 'GAMEOVER') setupStriker();
    } else if (gameMode === 'INFECTION') {
        if (coinsPocketedThisTurn.strikerFoul) { foulMessageTime = Date.now(); foulReason = "FOUL!"; currentPlayer = currentPlayer === 1 ? 2 : 1; setupStriker(); return; }
        currentPlayer = currentPlayer === 1 ? 2 : 1; if (gameState !== 'GAMEOVER') setupStriker();

    } else if (gameMode === 'FREESTYLE') {
        let pointsGained = (coinsPocketedThisTurn.black * 10) + (coinsPocketedThisTurn.white * 20);
        if (coinsPocketedThisTurn.strikerFoul) {
            foulMessageTime = Date.now(); foulReason = "FOUL!";
            if (queenPendingCover && playerCoveringQueen === currentPlayer) { queenPendingCover = false; playerCoveringQueen = null; respawnCoinCenter('queen'); } else if (coinsPocketedThisTurn.queen > 0) { respawnCoinCenter('queen'); }
            for (let i = 0; i < coinsPocketedThisTurn.white; i++) respawnCoinCenter('white'); for (let i = 0; i < coinsPocketedThisTurn.black; i++) respawnCoinCenter('black');
            updateStatus("Striker Pocketed! Penalty: -10 Points."); if (currentPlayer === 1) p1Points = Math.max(0, p1Points - 10); else p2Points = Math.max(0, p2Points - 10); currentPlayer = currentPlayer === 1 ? 2 : 1; setupStriker(); return;
        }
        let queenPocketedJustNow = (coinsPocketedThisTurn.queen > 0); let coveredSuccessfully = false; let failedToCover = false;
        if (queenPendingCover && !queenPocketedJustNow && playerCoveringQueen === currentPlayer) { if (anyCoinPocketed) coveredSuccessfully = true; else failedToCover = true; }
        if (queenPocketedJustNow && anyCoinPocketed) { coveredSuccessfully = true; queenPocketedJustNow = false; }
        if (coveredSuccessfully) { isQueenPocketed = true; queenPendingCover = false; if (playerCoveringQueen === 1 || currentPlayer === 1) { window.queenCaptures = (parseInt(window.queenCaptures) || 0) + 1; localStorage.setItem('queenCaptures', window.queenCaptures); window.updateQuest('pocket_queen', 1); } playerCoveringQueen = null; if (!(currentPlayer === 2 && aiEnabled)) goodMessageTime = Date.now(); } else if (failedToCover) { queenPendingCover = false; playerCoveringQueen = null; respawnCoinCenter('queen'); }
        if (queenPocketedJustNow) { queenPendingCover = true; playerCoveringQueen = currentPlayer; if (!(currentPlayer === 2 && aiEnabled)) queenCoverMessageTime = Date.now(); }
        if (currentPlayer === 1) p1Points += pointsGained; else p2Points += pointsGained;
        let target = window.freestyleTargetScore || freestyleTargetScore || 160;
        if (p1Points >= target || p2Points >= target) { if (p1Points > p2Points) endGame(aiEnabled ? "YOU WON" : "PLAYER 1 WINS"); else if (p2Points > p1Points) endGame(aiEnabled ? "YOU LOSE" : "PLAYER 2 WINS"); else endGame("TIE GAME"); return; }
        let remAll = coins.filter(c => c.active).length; if (remAll === 0) { if (p1Points > p2Points) endGame(aiEnabled ? "YOU WON" : "PLAYER 1 WINS"); else if (p2Points > p1Points) endGame(aiEnabled ? "YOU LOSE" : "PLAYER 2 WINS"); else endGame("TIE GAME"); return; }
        let extraTurn = (queenPocketedJustNow || anyCoinPocketed) && !failedToCover;
        if (!extraTurn) {
            currentPlayer = currentPlayer === 1 ? 2 : 1;
        }
        if (window.roomIdMP) {
            let wasAI = window.mpPlayers && window.mpPlayers[lastPlayer - 1] && window.mpPlayers[lastPlayer - 1].isAI;
            if (window.isMyTurnMP || (window.myPlayerIndexMP === 1 && wasAI)) {
                socket.emit('next_turn', { roomId: window.roomIdMP, nextPlayerIndex: currentPlayer });
            }
        }
        if (gameState !== 'GAMEOVER') setupStriker();

    } else if (gameMode === 'DISC POOL' || gameMode === 'GUN GAME') {
        if (coinsPocketedThisTurn.strikerFoul) {
            foulMessageTime = Date.now(); foulReason = "FOUL!";
            for (let i = 0; i < coinsPocketedThisTurn.white; i++) respawnCoinCenter('white'); for (let i = 0; i < coinsPocketedThisTurn.black; i++) respawnCoinCenter('black');
            if (currentPlayer === 1 && p1Coins > 0) { p1Coins--; respawnCoinCenter('white'); if (gameMode === 'GUN GAME') window.gunGameLevel = Math.max(0, window.gunGameLevel - 1); }
            if (currentPlayer === 2 && p2Coins > 0) { p2Coins--; respawnCoinCenter('black'); if (gameMode === 'GUN GAME') window.gunGameLevelAI = Math.max(0, window.gunGameLevelAI - 1); }
            currentPlayer = currentPlayer === 1 ? 2 : 1; setupStriker(); return;
        }
        if (gameMode === 'GUN GAME') {
            if (currentPlayer === 1 && coinsPocketedThisTurn.white > 0) { window.gunGameLevel = Math.min(7, window.gunGameLevel + coinsPocketedThisTurn.white); p1Coins += coinsPocketedThisTurn.white; }
            if (currentPlayer === 2 && coinsPocketedThisTurn.black > 0) { window.gunGameLevelAI = Math.min(7, window.gunGameLevelAI + coinsPocketedThisTurn.black); p2Coins += coinsPocketedThisTurn.black; }
            if (window.gunGameLevel >= 7 && currentPlayer === 1) { endGame("YOU WON!"); return; }
            if (window.gunGameLevelAI >= 7 && currentPlayer === 2) { endGame("AI WINS!"); return; }
        } else {
            if (currentPlayer === 1) { p1Coins += coinsPocketedThisTurn.white; p2Coins += coinsPocketedThisTurn.black; } else { p2Coins += coinsPocketedThisTurn.black; p1Coins += coinsPocketedThisTurn.white; }
        }
        let remainingBlack = coins.filter(c => c.active && c.type === 'black').length; let remainingWhite = coins.filter(c => c.active && c.type === 'white').length;
        if (currentPlayer === 2 && remainingBlack === 0) { endGame(aiEnabled ? "YOU LOSE" : "PLAYER 2 WINS"); return; } if (currentPlayer === 1 && remainingWhite === 0) { endGame(aiEnabled ? "YOU WON" : "PLAYER 1 WINS"); return; }
        let extraTurn = (currentPlayer === 1 && coinsPocketedThisTurn.white > 0) || (currentPlayer === 2 && coinsPocketedThisTurn.black > 0);
        if (!extraTurn) {
            currentPlayer = currentPlayer === 1 ? 2 : 1;
        }
        if (window.roomIdMP) {
            let wasAI = window.mpPlayers && window.mpPlayers[lastPlayer - 1] && window.mpPlayers[lastPlayer - 1].isAI;
            if (window.isMyTurnMP || (window.myPlayerIndexMP === 1 && wasAI)) {
                socket.emit('next_turn', { roomId: window.roomIdMP, nextPlayerIndex: currentPlayer });
            }
        }
        if (gameState !== 'GAMEOVER') setupStriker();

    } else { // CLASSIC 
        let isTeam1 = window.is2v2 ? (currentPlayer === 1 || currentPlayer === 3) : (currentPlayer === 1);

        if (coinsPocketedThisTurn.strikerFoul) {
            foulMessageTime = Date.now(); foulReason = "FOUL!";
            if (queenPendingCover && playerCoveringQueen === currentPlayer) { queenPendingCover = false; playerCoveringQueen = null; respawnCoinCenter('queen'); } else if (coinsPocketedThisTurn.queen > 0) { respawnCoinCenter('queen'); }
            for (let i = 0; i < coinsPocketedThisTurn.white; i++) respawnCoinCenter('white'); for (let i = 0; i < coinsPocketedThisTurn.black; i++) respawnCoinCenter('black');
            if (isTeam1 && p1Coins > 0) { p1Coins--; respawnCoinCenter('white'); } if (!isTeam1 && p2Coins > 0) { p2Coins--; respawnCoinCenter('black'); }

            if (window.is2v2) {
                if (currentPlayer === 1) currentPlayer = 2;
                else if (currentPlayer === 2) currentPlayer = 3;
                else if (currentPlayer === 3) currentPlayer = 4;
                else currentPlayer = 1;
            } else {
                currentPlayer = currentPlayer === 1 ? 2 : 1;
            }
            let lastPlayer = window.is2v2 ? (currentPlayer === 1 ? 4 : currentPlayer - 1) : (currentPlayer === 1 ? 2 : 1);
            let wasAI = window.mpPlayers && window.mpPlayers[lastPlayer - 1] && window.mpPlayers[lastPlayer - 1].isAI;
            if (window.roomIdMP && (window.isMyTurnMP || (window.myPlayerIndexMP === 1 && wasAI))) {
                socket.emit('next_turn', { roomId: window.roomIdMP, nextPlayerIndex: currentPlayer });
            }

            setupStriker(); return;
        }

        let queenPocketedJustNow = (coinsPocketedThisTurn.queen > 0); let coveredSuccessfully = false; let failedToCover = false;
        if (queenPendingCover && !queenPocketedJustNow && playerCoveringQueen === currentPlayer) { if ((isTeam1 && coinsPocketedThisTurn.white > 0) || (!isTeam1 && coinsPocketedThisTurn.black > 0)) coveredSuccessfully = true; else failedToCover = true; }
        if (queenPocketedJustNow && ((isTeam1 && coinsPocketedThisTurn.white > 0) || (!isTeam1 && coinsPocketedThisTurn.black > 0))) { coveredSuccessfully = true; queenPocketedJustNow = false; }

        if (coveredSuccessfully) { isQueenPocketed = true; queenPendingCover = false; if (playerCoveringQueen === 1 || currentPlayer === 1) { window.queenCaptures = (parseInt(window.queenCaptures) || 0) + 1; localStorage.setItem('queenCaptures', window.queenCaptures); window.updateQuest('pocket_queen', 1); } playerCoveringQueen = null; if (!(!isTeam1 && aiEnabled)) goodMessageTime = Date.now(); } else if (failedToCover) { queenPendingCover = false; playerCoveringQueen = null; respawnCoinCenter('queen'); }
        if (queenPocketedJustNow) { queenPendingCover = true; playerCoveringQueen = currentPlayer; if (!(!isTeam1 && aiEnabled)) queenCoverMessageTime = Date.now(); }

        if (isTeam1) { p1Coins += coinsPocketedThisTurn.white; p2Coins += coinsPocketedThisTurn.black; } else { p2Coins += coinsPocketedThisTurn.black; p1Coins += coinsPocketedThisTurn.white; }

        let remainingBlack = coins.filter(c => c.active && c.type === 'black').length; let remainingWhite = coins.filter(c => c.active && c.type === 'white').length;

        if (remainingWhite === 0) {
            if (isQueenPocketed || queenPendingCover) { endGame(aiEnabled ? "YOU WON" : (window.is2v2 ? "TEAM 1 WINS" : "PLAYER 1 WINS")); return; }
            else { endGame(aiEnabled ? "YOU LOSE" : (window.is2v2 ? "TEAM 2 WINS" : "PLAYER 2 WINS")); return; }
        }
        if (remainingBlack === 0) {
            if (isQueenPocketed || queenPendingCover) { endGame(aiEnabled ? "YOU LOSE" : (window.is2v2 ? "TEAM 2 WINS" : "PLAYER 2 WINS")); return; }
            else { endGame(aiEnabled ? "YOU WON" : (window.is2v2 ? "TEAM 1 WINS" : "PLAYER 1 WINS")); return; }
        }

        let extraTurn = (queenPocketedJustNow || (isTeam1 && coinsPocketedThisTurn.white > 0) || (!isTeam1 && coinsPocketedThisTurn.black > 0)) && !failedToCover;
        if (!extraTurn) {
            if (window.is2v2) {
                if (currentPlayer === 1) currentPlayer = 2;
                else if (currentPlayer === 2) currentPlayer = 3;
                else if (currentPlayer === 3) currentPlayer = 4;
                else currentPlayer = 1;
            } else {
                currentPlayer = currentPlayer === 1 ? 2 : 1;
            }
        }

        if (window.roomIdMP) {
            let wasAI = window.mpPlayers && window.mpPlayers[lastPlayer - 1] && window.mpPlayers[lastPlayer - 1].isAI;
            if (window.isMyTurnMP || (window.myPlayerIndexMP === 1 && wasAI)) {
                socket.emit('next_turn', { roomId: window.roomIdMP, nextPlayerIndex: currentPlayer });
            }
        }
        if (gameState !== 'GAMEOVER') setupStriker();
    }
}

function respawnCoinCenter(type) {
    let activeCoin = (typeof coinShopItems !== 'undefined') ? coinShopItems.find(item => item.id === equippedCoinId) : null;
    let colorW = (activeCoin && activeCoin.colorW) ? activeCoin.colorW : '#fff9e6';
    let colorB = (activeCoin && activeCoin.colorB) ? activeCoin.colorB : '#333';
    let color = type === 'white' ? colorW : (type === 'queen' ? '#ff3333' : colorB);

    let centerX = SIZE / 2;
    let centerY = SIZE / 2;

    // Collision avoidance: If center is occupied, shift slightly in a spiral
    let foundSpot = false;
    let attempts = 0;
    while (!foundSpot && attempts < 50) {
        let isOccupied = false;
        for (let c of coins) {
            if (c.active && Math.hypot(c.x - centerX, c.y - centerY) < (COIN_R * 2)) {
                isOccupied = true;
                break;
            }
        }
        if (!isOccupied) {
            foundSpot = true;
        } else {
            // Spiral out: use attempts as angle and radius
            let dist = (attempts + 1) * 3;
            let angle = attempts * 1.5;
            centerX = (SIZE / 2) + Math.cos(angle) * dist;
            centerY = (SIZE / 2) + Math.sin(angle) * dist;
            attempts++;
        }
    }

    let coinToRespawn = coins.find(c => !c.active && c.type === type);
    if (coinToRespawn) {
        coinToRespawn.x = centerX;
        coinToRespawn.y = centerY;
        coinToRespawn.vx = 0;
        coinToRespawn.vy = 0;
        coinToRespawn.active = true;
    } else {
        let newC = new Coin(centerX, centerY, COIN_R, type, color);
        newC.vx = 0; newC.vy = 0;
        coins.push(newC);
    }
}
function respawnCoin(type) { respawnCoinCenter(type); }

async function endGame(winMessage) {
    gameState = 'GAMEOVER'; gameOverTime = Date.now(); clearTimeout(botTimeoutId); if (window.infectionTimerId) clearInterval(window.infectionTimerId);
    matchesPlayed = (parseInt(matchesPlayed) || 0) + 1; localStorage.setItem('matchesPlayed', matchesPlayed);
    if (passCooldownEndTime === 0) { passMatchesPlayed = (parseInt(passMatchesPlayed) || 0) + 1; localStorage.setItem('passMatchesPlayed', passMatchesPlayed); }
    window.stopMatchRecording(winMessage);

    let playerWon = (winMessage === "PLAYER WINS" || winMessage === "PLAYER 1 WINS" || winMessage === "YOU WON");
    let playerLost = (winMessage === "YOU LOSE" || winMessage === "PLAYER 2 WINS" || winMessage === "QUEEN INFECTED!");

    window.updateQuest('play_matches', 1);
    if (playerWon && gameMode === 'ZOMBIE') window.updateQuest('win_zombie', 1);
    if (playerWon && gameMode === 'FREESTYLE') window.updateQuest('win_freestyle', 1);
    if (playerWon && window.isPinkSlip) window.updateQuest('play_pink_slip', 1);

    if (playerWon) { window.totalWins = (parseInt(window.totalWins) || 0) + 1; } else if (playerLost) { window.totalLosses = (parseInt(window.totalLosses) || 0) + 1; }
    localStorage.setItem('totalWins', window.totalWins); localStorage.setItem('totalLosses', window.totalLosses);

    if (checkUnclaimedRewards() > 0) { passNotifyTime = Date.now(); window.playSound('claim'); }

    if (window.isPinkSlip) {
        if (playerWon) {
            playerMoney += 10000;
            localStorage.setItem('playerMoney', playerMoney);
            await window.customAlert("🏆 LEGEND! You beat the Hustler and won $10,000!", "PINK SLIP VICTORY");
        }
        else if (playerLost) {
            let lostItem = shopItems.find(i => i.id === equippedStrikerId);
            if (lostItem && lostItem.id !== 0) {
                lostItem.owned = false;
                equippedStrikerId = 0;
                if (lostItem.id === 7) localStorage.setItem('hasJackpotStriker', 'false');
                await window.customAlert(`💀 YOU LOST! The Hustler took your ${lostItem.name}...`, "PINK SLIP DEFEAT");
            }
        }
        window.isPinkSlip = false; updateTopBar();
    }
    else if (!window.inTournament && !window.inBossRush) {
        let payout = 0; let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
        if (gameMode === 'ZOMBIE') { payout = Math.floor(window.zombieScore / 10); }
        else if (playerWon && aiEnabled) {
            let diffElem = document.getElementById('ai-difficulty'); let diff = diffElem ? diffElem.value : 'medium';
            if (window.currentBet > 0) { payout = window.currentBet * 2; }
            else { if (diff === 'easy') payout = 10; else if (diff === 'medium') payout = 15; else if (diff === 'hard') payout = 20; else if (diff === 'extreme') payout = 40; }
        } else if (playerWon) { if (window.currentBet > 0) payout = window.currentBet * 2; else payout = 5; } else if (winMessage === "TIE GAME") { payout = window.currentBet; }
        playerMoney += payout; localStorage.setItem('playerMoney', playerMoney); window.currentBet = 0; updateTopBar();
    }

    if (striker) striker.active = false; setControlsDisabled(false); winnerName = winMessage; if (winnerName !== "YOU LOSE" && winnerName !== "QUEEN INFECTED!" && hasPremiumEmote) winnerName += " 😎🔥👑";

    // Resume background music when match ends
    if (window.bgMusic && window.isMusicEnabled) {
        window.bgMusic.play().catch(e => { });
    }

    updateUI(); renderSidebarShop(); if (window.renderEmoteBar) window.renderEmoteBar();
    if (!playerLost && winMessage !== "TIE GAME") { let loops = hasMegaFireworks ? 80 : (hasVictoryEffect ? 30 : 15); for (let i = 0; i < loops; i++) setTimeout(() => { if (gameState === 'GAMEOVER') { createCrackers(Math.random() * SIZE, Math.random() * SIZE, getRandomColor(), hasVictoryEffect || hasMegaFireworks); window.playSound('hit'); } }, i * (hasMegaFireworks ? 50 : (hasVictoryEffect ? 100 : 150))); } else window.playSound('cry');

    // Automatically return to lobby after 5 seconds
    if (window.is2v2 || window.is1v1MP) {
        let is1v1MP = window.is1v1MP;
        setTimeout(() => {
            if (gameState === 'GAMEOVER') {
                window.is2v2 = false;
                window.is1v1MP = false;

                // Keep the same room, but remove the previous players for the OLD lobby
                if (window.mpPlayers && window.mpPlayers[0]) {
                    window.mpPlayers = [window.mpPlayers[0], null, null, null];
                    if (is1v1MP) window.mpPlayers = [window.mpPlayers[0], null];
                }

                // Reset invitation status for fresh lobby
                if (window.mpFriends) window.mpFriends.forEach(f => f.invited = false);

                // Open the old lobby
                window.mpState = is1v1MP ? 'lobby_1v1' : 'lobby_2v2';
                currentShopView = 'multiplayer';
                renderSidebarShop();
                window.startRandomPlayerConnectTimer();
            }
        }, 5000);
    }
}

function getRandomColor() { const colors = ['#FF1493', '#00FF00', '#1E90FF', '#FFD700', '#FF4500', '#00FFFF', '#FFF']; return colors[Math.floor(Math.random() * colors.length)]; }
// --- Particle Pooling System ---
const PARTICLE_POOL_SIZE = 500;
const particlePool = [];
for (let i = 0; i < PARTICLE_POOL_SIZE; i++) particlePool.push({ active: false });

function getParticleFromPool() {
    for (let p of particlePool) {
        if (!p.active) {
            p.active = true;
            return p;
        }
    }
    // Fallback if pool is empty
    return { active: true };
}

function createCrackers(x, y, color, isMega = false) {
    if (window.particleLevel === 'OFF') return;
    let count = isMega ? 150 : 80;
    if (window.particleLevel === 'LOW') count = Math.floor(count / 3);
    let speed = isMega ? 25 : 15;
    for (let i = 0; i < count; i++) {
        let p = getParticleFromPool();
        p.x = x; p.y = y;
        p.vx = (Math.random() - 0.5) * speed;
        p.vy = (Math.random() - 0.5) * speed;
        p.life = 80 + Math.random() * 60;
        p.maxLife = 140;
        p.color = color;
        p.size = (Math.random() * 4 + 2) * (isMega ? 1.5 : 1);
        particles.push(p);
    }
}

function createPocketEffect(x, y, baseColor) {
    if (window.particleLevel === 'OFF') return;
    let activeEffect = pocketEffects.find(e => e.id === equippedPocketEffectId);
    let colorsToUse = activeEffect ? activeEffect.colors : ['#FFD700', '#00FFFF', '#FF1493', '#39FF14'];
    let particleCount = activeEffect ? activeEffect.count : 40;
    if (window.particleLevel === 'LOW') particleCount = Math.floor(particleCount / 3);
    for (let i = 0; i < particleCount; i++) {
        let pColor = Math.random() < 0.3 ? baseColor : colorsToUse[Math.floor(Math.random() * colorsToUse.length)];
        let p = new Particle(x, y, pColor); // Class based particles still use new for now but splice out
        particles.push(p);
    }
}

function createStrikerTrail(x, y, effect) {
    if (window.particleLevel === 'OFF') return;
    if (window.particleLevel === 'LOW' && Math.random() > 0.3) return;
    let p = null;
    if (effect === 'wind') p = new Particle(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, '#A8E6CF');
    else if (effect === 'fire') p = new Particle(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, Math.random() > 0.4 ? '#FF4500' : '#FFD700');
    else if (effect === 'lightning' && Math.random() > 0.3) p = new Particle(x + (Math.random() - 0.5) * 25, y + (Math.random() - 0.5) * 25, '#00FFFF');
    else if (effect === 'void') { p = new Particle(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, '#8A2BE2'); if (Math.random() > 0.5) particles.push(new Particle(x, y, '#000000')); }
    else if (effect === 'quantum') p = new Particle(x, y, '#39FF14');
    else if (effect === 'alien') p = new Particle(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, Math.random() > 0.5 ? '#39FF14' : '#111111');
    else if (effect === 'monster') p = new Particle(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, Math.random() > 0.5 ? '#FF0000' : '#FFFFFF');
    else if (effect === 'web') p = new Particle(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, '#FFFFFF');
    else if (effect === 'shield') p = new Particle(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, Math.random() > 0.5 ? '#FF0000' : '#0000FF');

    if (p) particles.push(p);
}

function drawUpdateParticles() {
    if (particles.length === 0) return;
    const colorGroups = {};
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (p.life !== undefined) {
            p.x += p.vx; p.y += p.vy;
            if (p.color !== '#000000') p.vy += 0.15;
            p.life--;
            if (p.life <= 0) {
                p.active = false; // Return to pool
                particles.splice(i, 1);
                continue;
            }
            const alpha = Math.max(0, p.life / p.maxLife);
            if (!colorGroups[p.color]) colorGroups[p.color] = [];
            colorGroups[p.color].push({ x: p.x, y: p.y, size: p.size, alpha: alpha });
        } else {
            p.update(); p.draw();
            if (p.alpha <= 0) particles.splice(i, 1);
        }
    }
    for (const color in colorGroups) {
        ctx.fillStyle = color;
        for (const item of colorGroups[color]) {
            ctx.globalAlpha = item.alpha;
            ctx.beginPath(); ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0;
}
function isPathClear(startX, startY, endX, endY, radius, ignoreCoin) { let dx = endX - startX, dy = endY - startY; let dist = Math.hypot(dx, dy); let nx = dx / dist, ny = dy / dist; for (let c of coins) { if (!c.active || c === ignoreCoin) continue; let cx = c.x - startX, cy = c.y - startY; let projectedDist = cx * nx + cy * ny; if (projectedDist > 0 && projectedDist < dist) { let clX = startX + nx * projectedDist, clY = startY + ny * projectedDist; if (Math.hypot(c.x - clX, c.y - clY) < radius + c.radius + 3) return false; } } return true; }

window.playSmartAI = function (isPet = false) {
    if (gameState !== 'PLACING' && gameState !== 'AIMING') return;
    let diffElem = document.getElementById('ai-difficulty');
    let diff = diffElem ? diffElem.value : (localStorage.getItem('ai-difficulty') || 'medium');

    // Improve Pet Knowledge Based on Price
    if (isPet) {
        window.lastShotByPet = true;
        let activePet = petShopItems.find(p => p.id === equippedPetId);
        if (activePet) {
            if (activePet.price <= 1000) diff = 'hard';
            else if (activePet.price <= 1250) diff = 'very_hard';
            else diff = 'extreme';
        } else { diff = 'extreme'; }
    }

    if (window.inBossRush && window.bossRushStage === 2) diff = 'extreme';
    const isExtreme = diff === 'extreme';
    const isVeryHard = diff === 'very_hard';

    let perspectivePlayer = isPet ? 1 : currentPlayer;
    let strikerX = SIZE / 2;
    let strikerY = SIZE / 2;

    if (!window.is2v2) {
        strikerX = SIZE / 2;
        strikerY = (perspectivePlayer === 1) ? SIZE - 120 : 120;
    } else {
        if (perspectivePlayer === 1) { strikerX = SIZE / 2; strikerY = SIZE - 120; }
        else if (perspectivePlayer === 2) { strikerX = SIZE - 120; strikerY = SIZE / 2; }
        else if (perspectivePlayer === 3) { strikerX = SIZE / 2; strikerY = 120; }
        else if (perspectivePlayer === 4) { strikerX = 120; strikerY = SIZE / 2; }
    }

    let targets = []; let queen = coins.find(c => c.active && c.type === 'queen');
    let myCoins = coins.filter(c => c.active && (gameMode === 'FREESTYLE' || window.is2v2 ? (c.type === 'white' || c.type === 'black') : (perspectivePlayer === 1 ? c.type === 'white' : c.type === 'black')));
    if (gameMode === 'ZOMBIE') myCoins = coins.filter(c => c.active && c.type === 'black');
    if (gameMode === 'INFECTION') myCoins = coins.filter(c => c.active && (perspectivePlayer === 1 ? c.type === 'black' : c.type === 'white'));

    if (queenPendingCover && playerCoveringQueen === perspectivePlayer) targets = myCoins;
    else if (gameMode !== 'DISC POOL' && gameMode !== 'GUN GAME' && queen) { if (myCoins.length === 1) targets = [queen]; else { targets.push(queen); targets.push(...myCoins); } }
    else targets = myCoins;

    if (targets.length === 0) { if (striker) { striker.vx = (Math.random() - 0.5) * 10; striker.vy = perspectivePlayer === 1 ? -15 : 15; gameState = 'MOVING'; updateUI(); } return; }

    const pockets = [{ x: 25, y: 25 }, { x: SIZE - 25, y: 25 }, { x: 25, y: SIZE - 25 }, { x: SIZE - 25, y: SIZE - 25 }];
    let bestTarget = null, bestStrikerPos = SIZE / 2, bestPower = 20, bestAimAngle = 0, bestScore = Infinity;
    let aiStrikerRadius = (window.inBossRush && window.bossRushStage === 1 && !isPet) ? STRIKER_R * 3 : STRIKER_R;

    if (diff === 'easy') {
        let isVertical = window.is2v2 && (perspectivePlayer === 2 || perspectivePlayer === 4);
        bestTarget = targets[Math.floor(Math.random() * targets.length)]; let targetPocket = pockets[Math.floor(Math.random() * pockets.length)]; bestStrikerPos = Math.max(140, Math.min(460, SIZE / 2 + (Math.random() - 0.5) * 150)); let tX = isVertical ? strikerX : bestStrikerPos; let tY = isVertical ? bestStrikerPos : strikerY; bestAimAngle = Math.atan2(targetPocket.y - tY, targetPocket.x - tX) + (Math.random() - 0.5) * 0.3; bestPower = 12 + Math.random() * 8;
    } else {
        const step = isExtreme ? 0.5 : (isVeryHard ? 1.0 : (diff === 'hard' ? 2.0 : 8));
        const tol = isExtreme ? 0.01 : (isVeryHard ? 0.05 : (diff === 'hard' ? 0.1 : 1.1));
        targets.forEach(coin => {
            let mult = 1; if (diff === 'hard' || isExtreme || isVeryHard) { if (coin.type === 'queen') mult = 0.01; else if (gameMode === 'FREESTYLE' && coin.type === 'white') mult = 0.5; }
            pockets.forEach(pocket => {
                let angP = Math.atan2(pocket.y - coin.y, pocket.x - coin.x); let imX = coin.x - Math.cos(angP) * (COIN_R + aiStrikerRadius), imY = coin.y - Math.sin(angP) * (COIN_R + aiStrikerRadius);
                let isVertical = window.is2v2 && (perspectivePlayer === 2 || perspectivePlayer === 4);
                for (let testPos = 140; testPos <= 460; testPos += step) {
                    let tX = isVertical ? strikerX : testPos; let tY = isVertical ? testPos : strikerY;
                    let aimA = Math.atan2(imY - tY, imX - tX); let cutA = Math.abs(aimA - angP); if (cutA > Math.PI) cutA = 2 * Math.PI - cutA; if (cutA > tol) continue;
                    if (isPathClear(coin.x, coin.y, pocket.x, pocket.y, COIN_R, coin) && isPathClear(tX, tY, imX, imY, aiStrikerRadius, coin)) {
                        let cutPenalty = isExtreme ? 1000000 : (isVeryHard ? 500000 : (diff === 'hard' ? 100000 : 5000));
                        let score = ((Math.hypot(coin.x - pocket.x, coin.y - pocket.y) * 1.2) + Math.hypot(tX - imX, tY - imY) + (Math.pow(cutA, 2) * cutPenalty)) * mult;
                        if (score < bestScore) {
                            bestScore = score; bestTarget = coin; bestStrikerPos = testPos; bestAimAngle = aimA;
                            let baseP = 12 + (Math.hypot(tX - imX, tY - imY) * 0.02) + (Math.hypot(coin.x - pocket.x, coin.y - pocket.y) * 0.025);
                            bestPower = isExtreme ? Math.min(48, baseP / Math.max(0.6, Math.cos(cutA))) * 1.15 : (isVeryHard ? Math.min(45, baseP / Math.max(0.4, Math.cos(cutA))) * 1.1 : Math.min(diff === 'hard' ? 42 : 32, baseP / Math.max(0.2, Math.cos(cutA))));
                        }
                    }
                }
            });
        });
        if (bestScore === Infinity) { targets.forEach(coin => { let isVertical = window.is2v2 && (perspectivePlayer === 2 || perspectivePlayer === 4); let testPos = Math.max(140, Math.min(460, isVertical ? coin.y : coin.x)); let tX = isVertical ? strikerX : testPos; let tY = isVertical ? testPos : strikerY; let d = Math.hypot(tX - coin.x, tY - coin.y); if (d < bestScore) { bestScore = d; bestTarget = coin; bestStrikerPos = testPos; bestAimAngle = Math.atan2(coin.y - tY, coin.x - tX); bestPower = isExtreme ? 48 : 22; } }); }
    }
    if (bestTarget && striker) {
        let isVertical = window.is2v2 && (perspectivePlayer === 2 || perspectivePlayer === 4);
        if (isVertical) { striker.y = Math.max(140, Math.min(460, bestStrikerPos)); striker.x = strikerX; } else { striker.x = Math.max(140, Math.min(460, bestStrikerPos)); striker.y = strikerY; }
        striker.vx = Math.cos(bestAimAngle) * bestPower; striker.vy = Math.sin(bestAimAngle) * bestPower;

        if (window.roomIdMP && window.myPlayerIndexMP === 1 && !isPet) {
            socket.emit('sync_striker_set', { roomId: window.roomIdMP, pos: { x: striker.x, y: striker.y } });
            socket.emit('send_shot', { roomId: window.roomIdMP, strikerData: { x: striker.x, y: striker.y, vx: striker.vx, vy: striker.vy } });
        }

        gameState = 'MOVING'; if (isPet) window.playSound('beep'); updateUI();
    }
};

// ==========================================
// 10. DRAWING & RENDERING
// ==========================================
function drawAnimatedFace(ctx, emote, elapsed) {
    let r = 35;
    const t = elapsed;
    const isMP = !!(window.is2v2 || window.roomIdMP);

    // 1. ADVANCED 3D SPHERE RENDERING
    const tiltX = Math.sin(t / 400) * 4;
    const tiltY = Math.cos(t / 350) * 3;
    ctx.translate(tiltX, tiltY);
    ctx.rotate(tiltX * 0.015);

    let baseCol = '#FFD700';
    let shadeCol = '#B8860B';
    let highlightCol = '#FFF9E6';

    if (['😡', '🤬', '🔥'].includes(emote)) { baseCol = '#FF3333'; shadeCol = '#8B0000'; highlightCol = '#FFCCCC'; }
    if (['😢', '😭', '💎'].includes(emote)) { baseCol = '#6495ED'; shadeCol = '#00008B'; highlightCol = '#B0C4DE'; }
    if (['🥰'].includes(emote)) { baseCol = '#FF69B4'; shadeCol = '#C71585'; highlightCol = '#FFB6C1'; }

    const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    bodyGrad.addColorStop(0, highlightCol);
    bodyGrad.addColorStop(0.2, baseCol);
    bodyGrad.addColorStop(1, shadeCol);

    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad; ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.stroke();

    // 2. DYNAMIC EYE SYSTEMS
    const draw3DEye = (side, eyeSize) => {
        const ex = side * r * 0.4;
        const ey = -r * 0.15;
        const blinkCycle = t % 4000;
        const isBlinking = blinkCycle > 3800 && blinkCycle < 3950;
        const blinkH = isBlinking ? 0.05 : 1.0;

        ctx.save();
        ctx.translate(ex, ey);

        if (emote === '🥰') {
            ctx.fillStyle = '#FF0000';
            const hs = 10 + Math.sin(t / 100) * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-hs, -hs, -hs * 1.5, hs / 2, 0, hs);
            ctx.bezierCurveTo(hs * 1.5, hs / 2, hs, -hs, 0, 0);
            ctx.fill();
        } else if (emote === '😂') {
            ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-eyeSize, 0); ctx.lineTo(eyeSize, eyeSize / 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-eyeSize, 0); ctx.lineTo(eyeSize, -eyeSize / 2); ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.ellipse(0, 0, eyeSize, eyeSize * blinkH, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#FFF';
            if (!isMP) { ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.2)'; }
            ctx.fill();
            ctx.shadowBlur = 0;

            if (!isBlinking) {
                const lookX = Math.sin(t / 500 + side) * eyeSize * 0.3;
                const lookY = Math.cos(t / 600) * eyeSize * 0.2;
                ctx.beginPath();
                ctx.arc(lookX, lookY, eyeSize * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = emote === '😎' ? '#000' : '#111';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(lookX - eyeSize * 0.2, lookY - eyeSize * 0.2, eyeSize * 0.2, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();
            }
        }
        ctx.restore();
    };

    if (emote !== '😎') {
        draw3DEye(-1, 9);
        draw3DEye(1, 9);
    } else {
        ctx.fillStyle = '#111';
        if (!isMP) { ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.5)'; }
        [-1, 1].forEach(s => {
            ctx.beginPath(); ctx.roundRect(s * 18 - 12, -18, 24, 18, [2, 2, 10, 10]); ctx.fill();
        });
        ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(10, -12); ctx.lineWidth = 4; ctx.strokeStyle = '#111'; ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-25, -15); ctx.lineTo(-10, -5); ctx.stroke();
    }

    // 3. DYNAMIC MOUTH SYSTEM
    const mouthY = r * 0.3;
    let mouthOpen = 2 + Math.abs(Math.sin(t / 180)) * 14;
    const mouthWidth = 18;
    if (emote === '😲') mouthOpen = 18;

    ctx.save();
    ctx.translate(0, mouthY);

    if (['😀', '😂', '😎', '🥰', '😲'].includes(emote)) {
        ctx.beginPath();
        ctx.ellipse(0, mouthOpen * 0.4, mouthWidth, mouthOpen, 0, 0, Math.PI * 2);
        const mGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, mouthWidth);
        mGrad.addColorStop(0, '#600000');
        mGrad.addColorStop(1, '#200000');
        ctx.fillStyle = mGrad;
        ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#F0F0F0';
        ctx.beginPath(); ctx.arc(0, 2, mouthWidth * 0.85, Math.PI, 0); ctx.lineTo(mouthWidth * 0.85, 0); ctx.lineTo(-mouthWidth * 0.85, 0); ctx.fill();
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath(); ctx.ellipse(0, mouthOpen * 0.6 + 5, mouthWidth * 0.5, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (['😡', '🤬'].includes(emote)) {
        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.roundRect(-mouthWidth, 0, mouthWidth * 2, 8, 4); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i += 0.5) { ctx.beginPath(); ctx.moveTo(i * mouthWidth * 0.8, 0); ctx.lineTo(i * mouthWidth * 0.8, 8); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-mouthWidth, 4); ctx.lineTo(mouthWidth, 4); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeRect(-mouthWidth, 0, mouthWidth * 2, 8);
    } else if (['😢', '😭'].includes(emote)) {
        const wobble = Math.sin(t / 50) * 1.5;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-mouthWidth, 8 + wobble); ctx.quadraticCurveTo(0, -2 - wobble, mouthWidth, 8 + wobble); ctx.stroke();
        if (Math.sin(t / 200) > 0) {
            ctx.fillStyle = '#00BFFF';
            const count = emote === '😭' ? 2 : 1;
            for (let i = 0; i < count; i++) {
                const tearY = 5 + ((t + i * 400) % 800) / 20;
                if (tearY < 35) { ctx.beginPath(); ctx.arc(-15, tearY, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(15, tearY, 3, 0, Math.PI * 2); ctx.fill(); }
            }
        }
    }
    ctx.restore();

    // 4. BROW DYNAMICS
    if (['😡', '🤬'].includes(emote)) {
        ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-22, -28); ctx.lineTo(-8, -20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(22, -28); ctx.lineTo(8, -20); ctx.stroke();
    } else if (['😲', '😀', '😂'].includes(emote)) {
        const lift = Math.sin(t / 200) * 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-18, -25 - lift, 8, Math.PI + 0.5, -0.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(18, -25 - lift, 8, Math.PI + 0.5, -0.5); ctx.stroke();
    }
}
function drawBoard() {
    if (window.isCinematic) { window.camera.scale += (window.cameraTarget.scale - window.camera.scale) * 0.05; window.camera.x += (window.cameraTarget.x - window.camera.x) * 0.05; window.camera.y += (window.cameraTarget.y - window.camera.y) * 0.05; window.camera.rotation += (window.cameraTarget.rotation - window.camera.rotation) * 0.05; }
    else { window.camera.scale += (1.0 - window.camera.scale) * 0.1; window.camera.x += (SIZE / 2 - window.camera.x) * 0.1; window.camera.y += (SIZE / 2 - window.camera.y) * 0.1; window.camera.rotation += (window.cameraTarget.rotation - window.camera.rotation) * 0.08; }

    ctx.clearRect(0, 0, SIZE, SIZE); ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2); ctx.scale(window.camera.scale, window.camera.scale); ctx.rotate(window.camera.rotation); ctx.translate(-window.camera.x, -window.camera.y);

    // --- Optimization: Use Offscreen Canvas for static board elements ---
    if (!window.offscreenBoard || window.lastEquippedBoardId !== equippedBoardId) {
        window.offscreenBoard = document.createElement('canvas');
        let dpr = window.devicePixelRatio || 1;
        window.offscreenBoard.width = SIZE * dpr;
        window.offscreenBoard.height = SIZE * dpr;
        let oCtx = window.offscreenBoard.getContext('2d');
        oCtx.scale(dpr, dpr);
        window.lastEquippedBoardId = equippedBoardId;

        let activeBoard = boardShopItems.find(b => b.id === equippedBoardId) || boardShopItems[0];
        let bColor = activeBoard.id === 0 ? '#d29665' : activeBoard.boardColor;
        oCtx.fillStyle = bColor; oCtx.fillRect(0, 0, SIZE, SIZE);
        oCtx.strokeStyle = activeBoard.id === 0 ? '#4a2511' : activeBoard.borderColor;
        oCtx.lineWidth = 15; oCtx.strokeRect(7.5, 7.5, SIZE - 15, SIZE - 15);

        oCtx.strokeStyle = '#5A3215'; oCtx.lineWidth = 2;
        oCtx.strokeRect(30, 30, SIZE - 60, SIZE - 60);

        oCtx.fillStyle = '#111';[{ x: 30, y: 30 }, { x: SIZE - 30, y: 30 }, { x: 30, y: SIZE - 30 }, { x: SIZE - 30, y: SIZE - 30 }].forEach(p => { oCtx.beginPath(); oCtx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2); oCtx.fill(); });

        oCtx.strokeStyle = '#5A3215'; oCtx.lineWidth = 2;
        oCtx.beginPath(); oCtx.arc(300, 300, 85, 0, Math.PI * 2); oCtx.stroke();
        oCtx.beginPath(); oCtx.arc(300, 300, 92, 0, Math.PI * 2); oCtx.stroke();

        let R = 15; let innerR = 10;
        let drawBaseline = (x1, y1, x2, y2) => {
            let angle = Math.atan2(y2 - y1, x2 - x1);
            oCtx.strokeStyle = '#5A3215'; oCtx.lineWidth = 2;
            oCtx.beginPath();
            oCtx.arc(x1, y1, R, angle + Math.PI / 2, angle + Math.PI * 1.5);
            oCtx.arc(x2, y2, R, angle - Math.PI / 2, angle + Math.PI / 2);
            oCtx.closePath();
            oCtx.stroke();

            oCtx.fillStyle = '#e58e26';
            oCtx.beginPath(); oCtx.arc(x1, y1, innerR, 0, Math.PI * 2); oCtx.fill(); oCtx.stroke();
            oCtx.beginPath(); oCtx.arc(x2, y2, innerR, 0, Math.PI * 2); oCtx.fill(); oCtx.stroke();
        };

        drawBaseline(140, 115, 460, 115);
        drawBaseline(140, 485, 460, 485);
        drawBaseline(115, 140, 115, 460);
        drawBaseline(485, 140, 485, 460);
    }

    // Draw pre-rendered board
    ctx.drawImage(window.offscreenBoard, 0, 0, SIZE, SIZE);

    coins.forEach(c => c.draw());

    // Draw Animated Canvas Pet
    drawPetSystem();

    if (striker && striker.active && gameState !== 'GAMEOVER' && gameState !== 'COUNTDOWN' && gameState !== 'SPINNING') {
        let isOverlap = false;
        if (gameState === 'PLACING' || gameState === 'AIMING') {
            for (let c of coins) {
                if (c.active && Math.hypot(striker.x - c.x, striker.y - c.y) < striker.radius + c.radius) {
                    isOverlap = true; break;
                }
            }
        }

        let originalColor = striker.color;
        if (isOverlap) { striker.color = 'rgba(255, 0, 0, 0.6)'; }

        striker.draw();

        if (isOverlap) {
            striker.color = originalColor;
            ctx.beginPath(); ctx.arc(striker.x, striker.y, striker.radius + 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#FF0000'; ctx.lineWidth = 3; ctx.stroke();
        }

        let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
        if (gameState === 'AIMING' && !isOverlap && ((currentPlayer === 1) || (currentPlayer === 2 && !aiEnabled))) {
            let simM = window.getSimMouse(mouseX, mouseY); let dx = striker.x - simM.x, dy = striker.y - simM.y; let angle = Math.atan2(dy, dx); let dist = Math.min(Math.sqrt(dx * dx + dy * dy), 200);
            let eX = striker.x + Math.cos(angle) * dist * 1.5, eY = striker.y + Math.sin(angle) * dist * 1.5;
            ctx.beginPath(); ctx.moveTo(striker.x, striker.y); ctx.lineTo(eX, eY); ctx.strokeStyle = 'rgba(76,175,80,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([10, 5]); ctx.stroke(); ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(eX, eY); ctx.lineTo(eX - 15 * Math.cos(angle - Math.PI / 6), eY - 15 * Math.sin(angle - Math.PI / 6)); ctx.lineTo(eX - 15 * Math.cos(angle + Math.PI / 6), eY - 15 * Math.sin(angle + Math.PI / 6)); ctx.closePath(); ctx.fillStyle = 'rgba(76,175,80,0.8)'; ctx.fill();
        }
    }
    drawUpdateParticles(); ctx.restore();

    // OVERLAYS
    if (gameState === 'MENU') { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, SIZE, SIZE); let scale = 1 + Math.sin(Date.now() / 200) * 0.05; ctx.save(); ctx.translate(SIZE / 2, SIZE / 2); ctx.scale(scale, scale); ctx.fillStyle = '#39FF14'; ctx.font = "bold 50px sans-serif"; ctx.textAlign = "center"; ctx.fillText("START MATCH", 0, 0); ctx.restore(); }
    else if (gameState === 'COUNTDOWN') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, SIZE, SIZE); ctx.fillStyle = '#FFD700'; ctx.font = "bold 150px sans-serif"; ctx.textAlign = "center"; ctx.fillText(countdownValue > 0 ? countdownValue : "GO!", SIZE / 2, SIZE / 2); }
    else if (gameState === 'GAMEOVER') { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, SIZE, SIZE); let scale = 1 + Math.sin(Date.now() / 200) * 0.05; ctx.save(); ctx.translate(SIZE / 2, SIZE / 2); ctx.scale(scale, scale); ctx.textAlign = "center"; if (winnerName === "YOU LOSE" || winnerName === "QUEEN INFECTED!") { ctx.font = "120px sans-serif"; ctx.fillText("😭", 0, -50); ctx.fillStyle = '#FF3333'; ctx.font = "bold 45px sans-serif"; ctx.fillText(winnerName, 0, 40); } else { ctx.fillStyle = '#FFD700'; ctx.font = "bold 50px sans-serif"; ctx.fillText(winnerName, 0, 0); } ctx.restore(); }

    if (foulMessageTime > 0 && Date.now() - foulMessageTime < 2500) { ctx.save(); ctx.translate(SIZE / 2, SIZE / 2); let p = 1 + Math.sin(Date.now() / 100) * 0.1; ctx.scale(p, p); ctx.fillStyle = '#FF0000'; ctx.font = "bold 65px sans-serif"; ctx.textAlign = "center"; ctx.fillText(foulReason || "FOUL!", 0, 0); ctx.restore(); }
    if (passNotifyTime > 0 && Date.now() - passNotifyTime < 3500) { ctx.save(); ctx.translate(SIZE / 2, 80); ctx.fillStyle = '#FFD700'; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🏆 NEW REWARD!", 0, 0); ctx.restore(); }
    if (window.questNotifyTime > 0 && Date.now() - window.questNotifyTime < 3500) { ctx.save(); ctx.translate(SIZE / 2, 120); ctx.fillStyle = '#39FF14'; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText("📜 QUEST COMPLETED!", 0, 0); ctx.restore(); }
    if (queenCoverMessageTime > 0 && Date.now() - queenCoverMessageTime < 2000) { ctx.save(); ctx.translate(SIZE / 2, SIZE / 2 - 60); ctx.fillStyle = '#FF3333'; ctx.font = "bold 32px sans-serif"; ctx.textAlign = "center"; ctx.fillText("Cover the RED!", 0, 0); ctx.restore(); }
    if (goodMessageTime > 0 && Date.now() - goodMessageTime < 2000) { ctx.save(); ctx.translate(SIZE / 2, SIZE / 2); ctx.fillStyle = '#FF1493'; ctx.font = "bold 70px sans-serif"; ctx.textAlign = "center"; ctx.fillText("GOOD ❤️", 0, 0); ctx.restore(); }
    if (window.isSpectating) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, 0, SIZE, 45);
        ctx.fillStyle = '#FFD700'; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`👁️ SPECTATOR MODE: WATCHING ${window.spectatingName || 'MATCH'}`, SIZE / 2, 30);
        ctx.restore();
    }
    if (emoteDisplayTime > 0 && Date.now() - emoteDisplayTime < 2500) {
        let elapsed = Date.now() - emoteDisplayTime;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - (elapsed / 2500));
        ctx.font = "bold 80px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let ex = 80; let ey = SIZE - 80;

        if (currentEmote === '😀') {
            ey -= Math.abs(Math.sin(elapsed / 100)) * 30;
            ctx.translate(ex, ey); ctx.rotate(Math.sin(elapsed / 60) * 0.3);
            if (Math.random() < 0.1 && elapsed < 2000) particles.push(new Particle(ex + (Math.random() - 0.5) * 40, ey + (Math.random() - 0.5) * 40, '#FFD700'));
        } else if (currentEmote === '😡') {
            ex += (Math.random() - 0.5) * 20; ey += (Math.random() - 0.5) * 20;
            let scale = 1 + (elapsed / 4000);
            ctx.translate(ex, ey); ctx.scale(scale, scale);
            ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 25;
        } else if (currentEmote === '😢') {
            ey += (elapsed / 50); let squishY = 1 - Math.min(0.2, (elapsed / 2000));
            ctx.translate(ex, ey); ctx.scale(1, squishY);
            if (Math.random() < 0.2 && elapsed < 2000) { let p = new Particle(ex + (Math.random() - 0.5) * 20, ey + 20, '#1E90FF'); p.vy = 2 + Math.random(); particles.push(p); }
        } else if (currentEmote === '👍' || currentEmote === '👎') {
            ey -= (currentEmote === '👍' ? 1 : -1) * (elapsed / 15);
            ctx.translate(ex, ey);
        } else if (currentEmote === '😎') {
            ex += (elapsed / 30);
            ctx.translate(ex, ey); ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 10;
        } else if (currentEmote === '🔥') {
            let scale = 1 + Math.sin(elapsed / 50) * 0.1; ey -= (elapsed / 40);
            ctx.translate(ex, ey); ctx.scale(scale, scale); ctx.shadowColor = '#FF4500'; ctx.shadowBlur = Math.random() * 30;
        } else if (currentEmote === '👑') {
            ey -= (elapsed / 40);
            ctx.translate(ex, ey); ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10 + Math.sin(elapsed / 100) * 20;
        } else if (currentEmote === '💎') {
            ctx.translate(ex, ey); ctx.rotate(elapsed / 200);
        } else if (currentEmote === '🚀') {
            ex += Math.pow(elapsed / 100, 2) * 0.5; ey -= Math.pow(elapsed / 100, 2) * 0.5;
            ctx.translate(ex, ey);
            if (Math.random() < 0.5) particles.push(new Particle(ex - 20, ey + 20, Math.random() > 0.5 ? '#FF4500' : '#FFD700'));
        } else {
            ey -= (elapsed / 15); ctx.translate(ex, ey);
        }
        if (['😀', '😡', '😢', '😎', '😂', '🥰', '🤬', '😭', '😲'].includes(currentEmote)) {
            drawAnimatedFace(ctx, currentEmote, elapsed);
        } else {
            ctx.fillText(currentEmote, 0, 0);
        }
        ctx.restore();
    }

    if (messageDisplayTime > 0 && Date.now() - messageDisplayTime < 3000) {
        let elapsed = Date.now() - messageDisplayTime; let floatY = (SIZE / 2) - (elapsed / 20); let alpha = Math.max(0, 1 - (elapsed / 3000));
        ctx.save(); ctx.globalAlpha = alpha;
        if (window.isCinematic) { let pulse = 1 + Math.sin(Date.now() / 100) * 0.1; ctx.translate(SIZE / 2, floatY); ctx.scale(pulse, pulse); ctx.translate(-SIZE / 2, -floatY); ctx.fillStyle = "#FFD700"; ctx.font = "bold 40px sans-serif"; ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 15; }
        else { ctx.fillStyle = "#FFF"; ctx.font = "bold 30px sans-serif"; }
        ctx.textAlign = "center"; ctx.fillText(currentMessage, SIZE / 2, floatY); ctx.restore();
    }
}

function updateUI() {
    let isMPMatch = !!(window.is2v2 || window.is1v1MP || window.roomIdMP || window.mpRoomId);
    // --- Optimization: Avoid redundant DOM work if state hasn't changed ---
    let uiStateKey = `${gameState}-${isMPMatch}-${currentPlayer}-${window.is2v2}`;
    if (window.lastUIStateKey === uiStateKey && gameState !== 'GAMEOVER') {
        if (gameState !== 'PLACING' && gameState !== 'AIMING') return;
    }
    window.lastUIStateKey = uiStateKey;

    let p1 = document.getElementById('p1-score'), p2 = document.getElementById('p2-score');
    if (window.is2v2) {
        if (gameMode === 'FREESTYLE') {
            let target = window.freestyleTargetScore || 160;
            if (p1) p1.innerText = `TEAM BLUE: ${window.teamPoints.team1}/${target}`;
            if (p2) p2.innerText = `TEAM RED: ${window.teamPoints.team2}/${target}`;
        } else {
            if (p1) p1.innerText = `TEAM BLUE: ${p1Coins}/9`;
            if (p2) p2.innerText = `TEAM RED: ${p2Coins}/9`;
        }
    } else if (gameMode === 'FREESTYLE') {
        let target = freestyleTargetScore || 160;
        if (p1) p1.innerText = `Points: ${p1Points}/${target}`;
        if (p2) p2.innerText = `Points: ${p2Points}/${target}`;
    }
    else if (gameMode === 'ZOMBIE') { if (p1) p1.innerText = `Kills: ${window.zombieScore / 10}`; if (p2) p2.innerText = `SURVIVE!`; }
    else if (gameMode === 'INFECTION') {
        let whites = coins.filter(c => c.active && c.type === 'white').length; let blacks = coins.filter(c => c.active && c.type === 'black').length;
        if (p1) p1.innerText = `Whites: ${whites} | Time: ${window.infectionTimeLeft}s`; if (p2) p2.innerText = `Blacks: ${blacks}`;
    }
    else if (gameMode === 'GUN GAME') {
        if (p1) p1.innerText = `Gun Lvl: ${window.gunGameLevel} | Left: ${9 - p1Coins}`; if (p2) p2.innerText = `Gun Lvl: ${window.gunGameLevelAI} | Left: ${9 - p2Coins}`;
    }
    else { if (p1) p1.innerText = `Pocketed: ${p1Coins}/9`; if (p2) p2.innerText = `Pocketed: ${p2Coins}/9`; }

    if (gameState !== 'GAMEOVER' && gameState !== 'MENU') {
        let turnText = `Player ${currentPlayer}'s Turn.`;
        if (window.is2v2 && window.mpPlayers && window.mpPlayers[currentPlayer - 1]) {
            turnText = `${window.mpPlayers[currentPlayer - 1].name.toUpperCase()}'S TURN.`;
        }
        if (window.inBossRush && currentPlayer === 2) {
            if (window.bossRushStage === 1) turnText = "Boss 1 (The Giant)'s Turn."; if (window.bossRushStage === 2) turnText = "Boss 2 (The Sniper)'s Turn."; if (window.bossRushStage === 3) turnText = "Boss 3 (The Illusionist)'s Turn.";
        }
        updateStatus(turnText);
    }

    let activePet = petShopItems.find(p => p.id === equippedPetId);
    let petBtn = document.getElementById('pet-play-btn');
    if (!petBtn) {
        petBtn = document.createElement('div'); petBtn.id = 'pet-play-btn';
        petBtn.style.cssText = 'position:absolute; top: 130px; left: 50%; transform: translateX(-50%); z-index: 9999; text-align: center; background: rgba(0,0,0,0.85); padding: 15px; border-radius: 10px; border: 2px solid #FF1493; box-shadow: 0 0 15px #FF1493; display: none;';
        document.body.appendChild(petBtn);
    }

    if (activePet && activePet.level >= 4 && currentPlayer === 1 && (gameState === 'PLACING' || gameState === 'AIMING') && window.mpPetsAllowed !== false) {
        petBtn.style.display = 'block';
        petBtn.innerHTML = `<div style="color:#FFF; font-weight:bold; font-size:14px; margin-bottom: 10px;">Ask ${activePet.name} to take the shot?</div><button onclick="window.playSmartAI(true); document.getElementById('pet-play-btn').style.display='none';" style="background:#39FF14; color:#000; border:none; padding:8px 20px; font-weight:bold; cursor:pointer; border-radius:4px; margin-right:10px;">YES</button><button onclick="document.getElementById('pet-play-btn').style.display='none';" style="background:#FF3333; color:#FFF; border:none; padding:8px 20px; font-weight:bold; cursor:pointer; border-radius:4px;">NO</button>`;
    } else {
        petBtn.style.display = 'none';
    }

    let aiRow = document.querySelector('.ai-row');
    let resetBtn = document.getElementById('reset-btn');
    let mpControls = document.getElementById('mp-match-controls');
    let lobbyControls = document.getElementById('mp-lobby-controls');

    if (isMPMatch) {
        if (aiRow) aiRow.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
        if (gameState !== 'MENU') {
            if (lobbyControls) lobbyControls.style.display = 'none';
            if (mpControls) mpControls.style.display = 'flex';
        } else {
            if (mpControls) mpControls.style.display = 'none';
            if (lobbyControls) lobbyControls.style.display = 'flex';
        }
    } else {
        if (aiRow) {
            aiRow.style.display = (gameState === 'MENU' ? 'flex' : 'none');
        }
        if (resetBtn) {
            resetBtn.style.display = (gameState !== 'MENU' ? 'block' : 'none');
        }
        if (mpControls) mpControls.style.display = 'none';
        if (lobbyControls) lobbyControls.style.display = 'none';
    }
}

window.exitMatchMP = async function () {
    if (await window.customConfirm("Are you sure you want to EXIT the match? The room will be closed.", "CRITICAL: EXIT MATCH")) {
        window.playSound('foul');
        if (socket && (window.roomIdMP || window.mpRoomId)) {
            socket.emit('leave_room', { roomId: window.roomIdMP || window.mpRoomId });
        }
        window.is2v2 = false;
        window.is1v1MP = false;
        window.roomIdMP = null;
        window.mpRoomId = null;
        window.mpPlayers = null;
        window.isMyTurnMP = false;
        window.mpState = 'select';

        if (window.randomPlayerTimer) clearTimeout(window.randomPlayerTimer);

        initGame();

        // Resume background music on return to menu
        if (window.bgMusic && window.isMusicEnabled) {
            window.bgMusic.play().catch(e => { });
        }

        currentShopView = 'menu';
        renderSidebarShop();
        updateUI(); // This will refresh the control buttons visibility

        currentMessage = "MATCH EXITED"; messageDisplayTime = Date.now() + 3000;
        window.playSound('beep');
    }
};

window.resignMatchMP = async function () {
    if (await window.customConfirm("Are you sure you want to RESIGN this match? This count will as a loss.", "RESIGN?")) {
        window.playSound('foul');
        if (socket && window.roomIdMP) {
            socket.emit('send_emote', { roomId: window.roomIdMP, emote: "🏳️ I Resign!", playerName: playerName });
        }
        window.exitMatchMP(); // Use the simplified clean exit logic
    }
};
function updateStatus(m) { let s = document.getElementById('status-message'); if (s) s.innerText = m; }

function gameLoop() {
    window.cachedIsCartoon = [5, 8, 9, 10, 11].includes(equippedCoinId);
    if (window.maxFps !== 'Unlimited') {
        const now = performance.now();
        const delta = now - window.lastFrameTime;
        const interval = 1000 / parseInt(window.maxFps);
        if (delta < interval) {
            window.gameLoopRafId = requestAnimationFrame(gameLoop);
            return;
        }
        window.lastFrameTime = now - (delta % interval);
    }

    if (currentShopView === 'pass' && passCooldownEndTime > 0) {
        let remain = passCooldownEndTime - Date.now();
        if (remain <= 0) { window.checkPassCooldown(); renderSidebarShop(); } else {
            let timerElem = document.getElementById('pass-timer');
            if (timerElem) { let m = Math.floor(remain / 60000); let s = Math.floor((remain % 60000) / 1000); timerElem.innerText = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`; }
        }
    }

    // Dynamic Feed Update (10 Seconds)
    if (currentShopView === 'menu') {
        if (!window.lastFeedUpdate || Date.now() - window.lastFeedUpdate > 10000) {
            window.lastFeedUpdate = Date.now();
            window.currentFeedIndex = (window.currentFeedIndex + 1) % window.eventFeeds.length;
            renderSidebarShop();
        }
    }

    if (gameState === 'COUNTDOWN') {
        let el = Date.now() - countdownStartTime; countdownValue = Math.ceil((3000 - el) / 1000);
        if (countdownValue < lastBeepValue && countdownValue > 0) { window.playSound('beep'); lastBeepValue = countdownValue; }
        if (el > 3000) { window.playSound('hit'); window.startMatchRecording(); setupStriker(); }
    }

    if (gameMode === 'ZOMBIE' && (gameState === 'PLACING' || gameState === 'AIMING' || gameState === 'MOVING')) {
        if (!window.roomIdMP || window.myPlayerIndexMP === 1) { // Only Host handles spawn logic
            let now = Date.now();
            if (now - window.lastZombieSpawnTime > 5000) {
                window.lastZombieSpawnTime = now;
                window.spawnZombie();
                window.playSound('foul');
                if (window.roomIdMP) {
                    socket.emit('sync_coins', {
                        roomId: window.roomIdMP,
                        coinsData: coins.map(c => ({
                            x: c.x, y: c.y, vx: c.vx, vy: c.vy, active: c.active,
                            type: c.type, color: c.color
                        }))
                    });
                }
            }
        }
    }

    if (gameState === 'PLACING' || gameState === 'AIMING') {
        let el = Date.now() - turnStartTime; let tl = Math.ceil((TURN_TIME_LIMIT - el) / 1000); let tElem = document.getElementById('time-left'); if (tElem) tElem.innerText = tl <= 0 ? "0" : tl; if (tl <= 0) handleTimeout();
        if (gameMode === 'ZOMBIE') { coins.forEach(c => c.update()); resolveCollisions(); }
    }

    if (gameState === 'MOVING') {
        coins.forEach(c => c.update()); if (striker) striker.update(); resolveCollisions();
        let moving = false;
        if (gameMode === 'ZOMBIE') { moving = striker && striker.active && (Math.abs(striker.vx) > 0 || Math.abs(striker.vy) > 0); } else { moving = coins.concat([striker]).some(c => c && c.active && (Math.abs(c.vx) > 0 || Math.abs(c.vy) > 0)); }
        if (!moving) {
            if (window.roomIdMP) {
                // Either I am the active human OR I am Host (keeps state in sync for bots)
                if (window.isMyTurnMP || window.myPlayerIndexMP === 1) {
                    socket.emit('sync_coins', {
                        roomId: window.roomIdMP,
                        coinsData: coins.map(c => ({
                            x: c.x, y: c.y, vx: c.vx, vy: c.vy, active: c.active,
                            type: c.type, color: c.color
                        }))
                    });
                }
            }
            evaluateTurn();
        }
    }

    drawBoard();
    window.gameLoopRafId = requestAnimationFrame(gameLoop);
}

// ==========================================
// 11. EVENT LISTENERS
// ==========================================
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect(); mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
    if (gameState === 'PLACING' && striker) {
        let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
        let canPlayLocal = !window.roomIdMP && (!aiEnabled || currentPlayer === 1);
        if (canPlayLocal || (window.roomIdMP && window.isMyTurnMP)) {
            let simM = window.getSimMouse(mouseX, mouseY);
            if (window.is2v2) {
                if (currentPlayer === 1 || currentPlayer === 3) {
                    striker.x = Math.max(140, Math.min(460, simM.x));
                } else {
                    striker.y = Math.max(140, Math.min(460, simM.y));
                }
            } else {
                striker.x = Math.max(140, Math.min(460, simM.x));
            }
            if (window.roomIdMP && window.isMyTurnMP) {
                const now = Date.now();
                if (!window.lastStrikerSync || now - window.lastStrikerSync > 33) {
                    socket.emit('sync_striker_set', { roomId: window.roomIdMP, pos: { x: striker.x, y: striker.y } });
                    window.lastStrikerSync = now;
                }
            }
        }
    }
});

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect(); let cX = e.clientX - rect.left, cY = e.clientY - rect.top;
    if (gameState === 'MENU') { if (cY > 250 && cY < 350 && Math.abs(cX - SIZE / 2) < 200) { window.playSound('beep'); window.currentBet = 0; startCountdown(); return; } }
    else if (gameState === 'GAMEOVER') {
        if (Date.now() - gameOverTime > 1500) {
            if (window.inTournament) { window.handleTournamentMatchEnd(winnerName === "PLAYER WINS" || winnerName === "PLAYER 1 WINS" || winnerName === "YOU WON"); } else if (window.inBossRush) { window.handleBossRushEnd(winnerName === "PLAYER WINS" || winnerName === "PLAYER 1 WINS" || winnerName === "YOU WON"); } else { initGame(); }
            return;
        }
    }
    else if (gameState === 'PLACING') {
        let isOverlap = false;
        if (striker) {
            for (let c of coins) {
                if (c.active && Math.hypot(striker.x - c.x, striker.y - c.y) < striker.radius + c.radius) {
                    isOverlap = true; break;
                }
            }
        }
        let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
        let canPlayLocal = !window.roomIdMP && (!aiEnabled || currentPlayer === 1);
        if (canPlayLocal || (window.roomIdMP && window.isMyTurnMP)) {
            if (isOverlap) {
                window.playSound('foul');
                // Automatically move striker slightly to resolve overlap
                for (let c of coins) {
                    if (c.active && Math.hypot(striker.x - c.x, striker.y - c.y) < striker.radius + c.radius) {
                        if (window.is2v2 && (currentPlayer === 2 || currentPlayer === 4)) {
                            let pushY = Math.sqrt(Math.max(0, Math.pow(striker.radius + c.radius + 2, 2) - Math.pow(striker.x - c.x, 2)));
                            let topY = c.y - pushY; let bottomY = c.y + pushY;
                            striker.y = Math.abs(striker.y - topY) < Math.abs(striker.y - bottomY) ? topY : bottomY;
                            striker.y = Math.max(140, Math.min(460, striker.y));
                            break;
                        } else {
                            let pushX = Math.sqrt(Math.max(0, Math.pow(striker.radius + c.radius + 2, 2) - Math.pow(striker.y - c.y, 2)));
                            let leftX = c.x - pushX; let rightX = c.x + pushX;
                            striker.x = Math.abs(striker.x - leftX) < Math.abs(striker.x - rightX) ? leftX : rightX;
                            striker.x = Math.max(140, Math.min(460, striker.x));
                            break;
                        }
                    }
                }
            } else {
                gameState = 'AIMING';
            }
        }
    }
});

canvas.addEventListener('mouseup', () => {
    if (gameState === 'AIMING') {
        let isOverlap = false;
        if (striker) {
            for (let c of coins) {
                if (c.active && Math.hypot(striker.x - c.x, striker.y - c.y) < striker.radius + c.radius) {
                    isOverlap = true; break;
                }
            }
        }
        if (isOverlap) {
            gameState = 'PLACING';
            window.playSound('foul');
            return;
        }

        let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
        let canPlayLocal = !window.roomIdMP && (!aiEnabled || currentPlayer === 1);
        if (canPlayLocal || (window.roomIdMP && window.isMyTurnMP)) {
            let activeItem = shopItems.find(i => i.id === equippedStrikerId);
            if (gameMode === 'GUN GAME') { let ggId = currentPlayer === 1 ? window.gunGameLevel : window.gunGameLevelAI; activeItem = shopItems.find(item => item.id === ggId) || shopItems[0]; }
            let simM = window.getSimMouse(mouseX, mouseY); let dx = striker.x - simM.x, dy = striker.y - simM.y; let p = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.15 * (activeItem ? activeItem.power : 1.0), 45);
            striker.vx = Math.cos(Math.atan2(dy, dx)) * p; striker.vy = Math.sin(Math.atan2(dy, dx)) * p; gameState = 'MOVING'; updateUI();
            window.playSound('hit');

            if (window.roomIdMP) {
                socket.emit('send_shot', {
                    roomId: window.roomIdMP,
                    strikerData: { x: striker.x, y: striker.y, vx: striker.vx, vy: striker.vy }
                });
            }
        }
    }
});

// --- Mobile Touch Support ---
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const cX = (touch.clientX - rect.left) * (SIZE / rect.width);
    const cY = (touch.clientY - rect.top) * (SIZE / rect.height);

    // Update global mouseX/mouseY for aiming logic
    mouseX = cX;
    mouseY = cY;

    if (gameState === 'MENU') {
        if (cY > 250 && cY < 350 && Math.abs(cX - SIZE / 2) < 200) {
            window.playSound('beep'); window.currentBet = 0; startCountdown(); return;
        }
    } else if (gameState === 'GAMEOVER') {
        if (Date.now() - gameOverTime > 1500) {
            if (window.inTournament) { window.handleTournamentMatchEnd(winnerName === "PLAYER WINS" || winnerName === "PLAYER 1 WINS" || winnerName === "YOU WON"); }
            else if (window.inBossRush) { window.handleBossRushEnd(winnerName === "PLAYER WINS" || winnerName === "PLAYER 1 WINS" || winnerName === "YOU WON"); }
            else { initGame(); }
            return;
        }
    } else if (gameState === 'PLACING') {
        let isOverlap = false;
        if (striker) {
            for (let c of coins) {
                if (c.active && Math.hypot(striker.x - c.x, striker.y - c.y) < striker.radius + c.radius) {
                    isOverlap = true; break;
                }
            }
        }
        let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
        let canPlayLocal = !window.roomIdMP && (!aiEnabled || currentPlayer === 1);
        if (canPlayLocal || (window.roomIdMP && window.isMyTurnMP)) {
            if (isOverlap) {
                window.playSound('foul');
                // Auto-resolve overlap
                for (let c of coins) {
                    if (c.active && Math.hypot(striker.x - c.x, striker.y - c.y) < striker.radius + c.radius) {
                        if (window.is2v2 && (currentPlayer === 2 || currentPlayer === 4)) {
                            let pushY = Math.sqrt(Math.max(0, Math.pow(striker.radius + c.radius + 2, 2) - Math.pow(striker.x - c.x, 2)));
                            let topY = c.y - pushY; let bottomY = c.y + pushY;
                            striker.y = Math.abs(striker.y - topY) < Math.abs(striker.y - bottomY) ? topY : bottomY;
                            striker.y = Math.max(140, Math.min(460, striker.y));
                        } else {
                            let pushX = Math.sqrt(Math.max(0, Math.pow(striker.radius + c.radius + 2, 2) - Math.pow(striker.y - c.y, 2)));
                            let leftX = c.x - pushX; let rightX = c.x + pushX;
                            striker.x = Math.abs(striker.x - leftX) < Math.abs(striker.x - rightX) ? leftX : rightX;
                            striker.x = Math.max(140, Math.min(460, striker.x));
                        }
                        break;
                    }
                }
            } else {
                gameState = 'AIMING';
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouseX = (touch.clientX - rect.left) * (SIZE / rect.width);
    mouseY = (touch.clientY - rect.top) * (SIZE / rect.height);

    if (gameState === 'PLACING' && striker) {
        let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
        let canPlayLocal = !window.roomIdMP && (!aiEnabled || currentPlayer === 1);
        if (canPlayLocal || (window.roomIdMP && window.isMyTurnMP)) {
            let simM = window.getSimMouse(mouseX, mouseY);
            if (window.is2v2) {
                if (currentPlayer === 1 || currentPlayer === 3) striker.x = Math.max(140, Math.min(460, simM.x));
                else striker.y = Math.max(140, Math.min(460, simM.y));
            } else {
                striker.x = Math.max(140, Math.min(460, simM.x));
            }
            if (window.roomIdMP && window.isMyTurnMP) {
                socket.emit('sync_striker_set', { roomId: window.roomIdMP, pos: { x: striker.x, y: striker.y } });
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameState === 'AIMING') {
        let isOverlap = false;
        if (striker) {
            for (let c of coins) {
                if (c.active && Math.hypot(striker.x - c.x, striker.y - c.y) < striker.radius + c.radius) {
                    isOverlap = true; break;
                }
            }
        }
        if (isOverlap) {
            gameState = 'PLACING';
            window.playSound('foul');
            return;
        }

        let aiToggle = document.getElementById('ai-toggle'); let aiEnabled = aiToggle && aiToggle.checked;
        let canPlayLocal = !window.roomIdMP && (!aiEnabled || currentPlayer === 1);
        if (canPlayLocal || (window.roomIdMP && window.isMyTurnMP)) {
            let activeItem = shopItems.find(i => i.id === equippedStrikerId);
            if (gameMode === 'GUN GAME') { let ggId = currentPlayer === 1 ? window.gunGameLevel : window.gunGameLevelAI; activeItem = shopItems.find(item => item.id === ggId) || shopItems[0]; }
            let simM = window.getSimMouse(mouseX, mouseY); let dx = striker.x - simM.x, dy = striker.y - simM.y; let p = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.15 * (activeItem ? activeItem.power : 1.0), 45);
            striker.vx = Math.cos(Math.atan2(dy, dx)) * p; striker.vy = Math.sin(Math.atan2(dy, dx)) * p; gameState = 'MOVING'; updateUI();
            window.playSound('hit');

            if (window.roomIdMP) {
                socket.emit('send_shot', {
                    roomId: window.roomIdMP,
                    strikerData: { x: striker.x, y: striker.y, vx: striker.vx, vy: striker.vy }
                });
            }
        }
    }
}, { passive: false });


// ==========================================
// 12. EMOTES & UI INJECTION
// ==========================================
const discoStyle = document.createElement('style');
discoStyle.innerHTML = `
    @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } } 
    @keyframes discoProfileLight { 0% { color: #FF0000; border-color: #FF0000; box-shadow: 0 0 10px #FF0000; } 25% { color: #0000FF; border-color: #0000FF; box-shadow: 0 0 10px #0000FF; } 50% { color: #00FF00; border-color: #00FF00; box-shadow: 0 0 10px #00FF00; } 75% { color: #800080; border-color: #800080; box-shadow: 0 0 10px #800080; } 100% { color: #FFFFFF; border-color: #FFFFFF; box-shadow: 0 0 10px #FFFFFF; } } 
    @keyframes arcadeEntry { 0% { opacity: 0; transform: scale(1.1) translateY(-20px); filter: blur(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); filter: none; } }
    .chat-btn { background: #333; color: #fff; border: 1px solid #555; padding: 5px 8px; margin: 2px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: 0.2s; } 
    .chat-btn:hover { background: #00FFFF; color: #000; } 
    .chat-btn:disabled { opacity: 0.4; cursor: not-allowed; }
`;
document.head.appendChild(discoStyle);

window.playEmote = function (e, p) {
    if (p && !hasPremiumPass) { window.customAlert("Unlock Premium Pass!", "PREMIUM REQUIRED"); return; }
    if (window.roomIdMP) {
        socket.emit('send_emote', { roomId: window.roomIdMP, emote: e, playerName: playerName });
    } else {
        currentEmote = e; emoteDisplayTime = Date.now();
    }

    if (e === '😀' || e === '😂' || e === '😲') window.playSound('beep');
    else if (e === '😢' || e === '😭') window.playSound('foul');
    else if (e === '😡' || e === '🤬') window.playSound('foul');
    else if (e === '🥰') window.playSound('claim');
    else if (e === '👍') window.playSound('claim');
    else if (e === '👎') window.playSound('foul');
    else if (e === '😎') window.playSound('reveal');
    else if (e === '🔥') window.playSound('hit');
    else if (e === '👑') window.playSound('claim');
    else if (e === '💎') window.playSound('reveal');
    else if (e === '🚀') window.playSound('intro');
    else window.playSound('beep');
};

function injectInteractionBar() {
    let rb = document.getElementById('reset-btn');
    if (rb) {
        rb.onclick = async function (e) { e.preventDefault(); if (await window.customConfirm("CONFIRM YOU WANT TO RESET THE GAME", "RESET GAME?")) { window.resetGame(); } };
        let eBar = document.createElement('div'); eBar.id = "emote-bar"; eBar.style.marginTop = "15px"; eBar.style.padding = "10px"; eBar.style.background = "#222"; eBar.style.borderRadius = "6px"; eBar.style.textAlign = "center";
        window.renderEmoteBar = function () {
            let can = (gameState !== 'MENU' && gameState !== 'COUNTDOWN' && gameState !== 'GAMEOVER'); let dis = can ? '' : 'disabled', ds = can ? '' : 'opacity:0.4;pointer-events:none;';
            let html = `<div style="color:${can ? '#fff' : '#555'};font-weight:bold;margin-bottom:5px;">EMOTES</div>`;

            unlockedEmotes.forEach(e => { html += `<button ${dis} onclick="playEmote('${e}',false)" style="background:none;border:none;font-size:22px;cursor:pointer;transition:0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${e}</button>`; }); html += `<br>`;
            ['😎', '🔥', '👑', '💎', '🚀', '🥰', '🤬', '😭'].forEach(e => { html += `<button ${dis} onclick="playEmote('${e}',true)" style="background:none;border:none;font-size:22px;cursor:pointer;transition:0.2s;filter:${hasPremiumPass ? 'none' : 'grayscale(1)'}" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${e}</button>`; });

            html += `<div style="margin-top:10px;color:${can ? '#00FFFF' : '#447777'};font-size:12px;font-weight:bold;">QUICK CHAT</div><div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">`;
            ["You are good", "Nice game", "Nice try", "Awesome", "Happy"].forEach(m => { html += `<button class="chat-btn" ${dis} onclick="speakMessage('${m}')">${m}</button>`; });
            html += `</div><div style="display:flex;margin-top:5px;${ds}"><input type="text" id="custom-msg-input" placeholder="Type..." style="flex:1;background:#111;color:#fff;border:1px solid #444;font-size:12px;"><button onclick="speakMessage(document.getElementById('custom-msg-input').value)" style="background:#39FF14;border:none;font-weight:bold;">SEND</button></div>`;
            eBar.innerHTML = html;
        };
        rb.parentNode.insertBefore(eBar, rb.nextSibling); window.renderEmoteBar();
    }
}

// ==========================================
// 12.5. LOGIN PARTICLE SYSTEM
// ==========================================
window.startFallingCoins = function (canvasId, numCoins = 85) {
    const pCanvas = document.getElementById(canvasId);
    if (!pCanvas) return null;
    const pCtx = pCanvas.getContext('2d');
    let loginParticles = [];
    let loginAnimId = null;
    let loginMouseX = -1000;
    let loginMouseY = -1000;

    function resizeParticleCanvas() {
        if (getComputedStyle(pCanvas).position === 'absolute') {
            pCanvas.width = pCanvas.parentElement.clientWidth;
            pCanvas.height = pCanvas.parentElement.clientHeight;
        } else {
            pCanvas.width = window.innerWidth;
            pCanvas.height = window.innerHeight;
        }
    }
    resizeParticleCanvas();
    const resizeHandler = () => resizeParticleCanvas();
    window.addEventListener('resize', resizeHandler);

    pCanvas.addEventListener('mousemove', (e) => {
        const rect = pCanvas.getBoundingClientRect();
        loginMouseX = e.clientX - rect.left;
        loginMouseY = e.clientY - rect.top;
    });

    pCanvas.addEventListener('mouseleave', () => {
        loginMouseX = -1000;
        loginMouseY = -1000;
    });

    class LoginCoin {
        constructor() {
            this.reset(true);
        }
        reset(initial = false) {
            this.x = Math.random() * pCanvas.width;
            this.y = initial ? Math.random() * pCanvas.height : -50 - Math.random() * 100;
            this.size = Math.random() * 15 + 15;
            this.speedY = Math.random() * 1.5 + 0.8;
            this.speedX = (Math.random() - 0.5) * 0.6;
            this.vx = 0;
            this.vy = 0;
            let rand = Math.random();
            this.type = rand > 0.15 ? (rand > 0.57 ? 'white' : 'black') : 'queen';
            this.pulse = Math.random() * Math.PI * 2;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.05;
        }
        update() {
            let dx = this.x - loginMouseX;
            let dy = this.y - loginMouseY;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 120) {
                let angle = Math.atan2(dy, dx);
                let force = (120 - dist) / 120;
                this.vx += Math.cos(angle) * force * 1.5;
                this.vy += Math.sin(angle) * force * 1.5;
                this.rotSpeed += (Math.random() - 0.5) * force * 0.1;
            }

            this.x += this.speedX + Math.sin(this.pulse) * 0.3 + this.vx;
            this.y += this.speedY + this.vy;

            this.vx *= 0.92;
            this.vy *= 0.92;

            this.pulse += 0.015;
            this.rotation += this.rotSpeed;
            if (this.y > pCanvas.height + 50) this.reset();
            // Prevent coins pushed out horizontally from getting stuck
            if (this.x < -100 || this.x > pCanvas.width + 100) this.reset();
        }
        draw() {
            pCtx.save();
            pCtx.translate(this.x, this.y);
            pCtx.rotate(this.rotation);
            pCtx.globalAlpha = 0.6;

            pCtx.beginPath();
            pCtx.arc(0, 0, this.size, 0, Math.PI * 2);
            pCtx.fillStyle = this.type === 'white' ? '#fff9e6' : (this.type === 'queen' ? '#ff3333' : '#333');
            pCtx.fill();
            pCtx.lineWidth = 2;
            pCtx.strokeStyle = this.type === 'white' ? '#ccc' : (this.type === 'queen' ? '#800' : '#111');
            pCtx.stroke();

            pCtx.beginPath();
            pCtx.arc(0, 0, this.size * 0.6, 0, Math.PI * 2);
            pCtx.strokeStyle = this.type === 'white' ? '#ddd' : (this.type === 'queen' ? '#a00' : '#444');
            pCtx.stroke();

            pCtx.beginPath();
            pCtx.arc(0, 0, this.size * 0.2, 0, Math.PI * 2);
            pCtx.fillStyle = this.type === 'white' ? '#ccc' : (this.type === 'queen' ? '#a00' : '#111');
            pCtx.fill();

            pCtx.restore();
        }
    }

    for (let i = 0; i < numCoins; i++) {
        loginParticles.push(new LoginCoin());
    }

    function animateLoginParticles() {
        pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
        loginParticles.forEach(p => { p.update(); p.draw(); });
        loginAnimId = requestAnimationFrame(animateLoginParticles);
    }
    animateLoginParticles();

    return {
        stop: function () {
            if (loginAnimId) { cancelAnimationFrame(loginAnimId); loginAnimId = null; }
            window.removeEventListener('resize', resizeHandler);
        }
    };
};
window.loginParticleSystem = window.startFallingCoins('login-particles', 85);
window.stopLoginParticles = function () {
    if (window.loginParticleSystem) window.loginParticleSystem.stop();
};

// ==========================================
// 12.7. INTRO PARTICLE SYSTEM
// ==========================================
(function initIntroParticles() {
    const iCanvas = document.getElementById('intro-particles');
    if (!iCanvas) return;
    const iCtx = iCanvas.getContext('2d');
    let introAnimId = null;
    let introStartTime = Date.now();
    let dpr = window.devicePixelRatio || 1;
    let mouse = { x: -1000, y: -1000 };

    let particles = [];
    const NUM_PARTICLES = 160;

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    function resizeIntroCanvas() {
        iCanvas.width = window.innerWidth * dpr;
        iCanvas.height = window.innerHeight * dpr;
        iCanvas.style.width = window.innerWidth + 'px';
        iCanvas.style.height = window.innerHeight + 'px';
        iCtx.scale(dpr, dpr);
        initParticles();
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < NUM_PARTICLES; i++) {
            particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 1.2,
                vy: (Math.random() - 0.5) * 1.2,
                size: 1 + Math.random() * 2.5,
                color: Math.random() > 0.5 ? '#00FFFF' : (Math.random() > 0.5 ? '#8A2BE2' : '#FFD700'),
                pulse: Math.random() * Math.PI
            });
        }
    }

    window.introEnergyBurst = function (x, y) {
        for (let i = 0; i < 45; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 22,
                vy: (Math.random() - 0.5) * 22,
                size: 2 + Math.random() * 5,
                color: '#FFF',
                pulse: 0,
                life: 1.2
            });
        }
    };

    resizeIntroCanvas();
    window.addEventListener('resize', resizeIntroCanvas);

    function animateIntroParticles() {
        // High-end motion blur effect
        iCtx.fillStyle = 'rgba(2, 2, 8, 0.08)';
        iCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        let elapsed = (Date.now() - introStartTime) / 1000;

        // --- Hyper-Atmospheric Nebula ---
        let nebulaX = window.innerWidth / 2 + Math.sin(elapsed * 0.5) * 200;
        let nebulaY = window.innerHeight / 2 + Math.cos(elapsed * 0.5) * 150;
        let nebulaGrad = iCtx.createRadialGradient(nebulaX, nebulaY, 0, nebulaX, nebulaY, window.innerWidth * 0.8);
        nebulaGrad.addColorStop(0, 'rgba(138, 43, 226, 0.12)');
        nebulaGrad.addColorStop(0.3, 'rgba(0, 255, 255, 0.06)');
        nebulaGrad.addColorStop(0.6, 'rgba(255, 215, 0, 0.02)');
        nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        iCtx.fillStyle = nebulaGrad;
        iCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        particles.forEach((p, index) => {
            let prevX = p.x;
            let prevY = p.y;

            p.x += p.vx;
            p.y += p.vy;
            p.pulse += 0.04;

            // Hyper-warp wrap-around
            if (p.x < -100) p.x = window.innerWidth + 100;
            if (p.x > window.innerWidth + 100) p.x = -100;
            if (p.y < -100) p.y = window.innerHeight + 100;
            if (p.y > window.innerHeight + 100) p.y = -100;

            // High-velocity mouse displacement
            let dx = mouse.x - p.x;
            let dy = mouse.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 250) {
                let force = (250 - dist) / 250;
                p.vx -= dx * force * 0.04;
                p.vy -= dy * force * 0.04;
            }

            if (p.life !== undefined) {
                p.life -= 0.015;
                if (p.life <= 0) {
                    particles.splice(index, 1);
                    return;
                }
            }

            let alpha = p.life !== undefined ? p.life : (0.4 + Math.sin(p.pulse) * 0.3);

            // Hyperstreaks / Trails
            iCtx.beginPath();
            iCtx.moveTo(prevX, prevY);
            iCtx.lineTo(p.x, p.y);
            iCtx.strokeStyle = p.color;
            iCtx.globalAlpha = alpha;
            iCtx.lineWidth = p.size * (p.life !== undefined ? 2.5 : 1);
            iCtx.lineCap = 'round';
            iCtx.stroke();

            // Core Glow
            iCtx.beginPath();
            iCtx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
            iCtx.fillStyle = '#FFF';
            iCtx.globalAlpha = Math.min(1, alpha * 2);
            iCtx.fill();

            // Cinematic Lightning Connections (Neural-styled)
            if (index % 4 === 0) {
                for (let j = index + 1; j < Math.min(index + 12, particles.length); j++) {
                    let p2 = particles[j];
                    let dx2 = p.x - p2.x;
                    let dy2 = p.y - p2.y;
                    let d2 = dx2 * dx2 + dy2 * dy2;
                    if (d2 < 16900) { // 130 * 130
                        iCtx.beginPath();
                        iCtx.moveTo(p.x, p.y);
                        iCtx.lineTo(p2.x, p2.y);
                        iCtx.strokeStyle = p.color;
                        iCtx.globalAlpha = (130 - Math.sqrt(d2)) / 130 * 0.15;
                        iCtx.lineWidth = 0.5;
                        iCtx.stroke();
                    }
                }
            }
        });
        iCtx.globalAlpha = 1.0;

        introAnimId = requestAnimationFrame(animateIntroParticles);
    }
    animateIntroParticles();

    window.stopIntroParticles = function () {
        if (introAnimId) { cancelAnimationFrame(introAnimId); introAnimId = null; }
    };
})();

// ==========================================
// 13. BOOT SEQUENCE (Login & Intro Handler)
// ==========================================
function runIntroSequence() {
    window.playSound('intro');
    let introFinished = false;

    const skipBtn = document.getElementById('intro-skip-btn');
    const introVideo = document.getElementById('main-intro-video');
    
    // Hide original intro elements to let video shine
    const scene3d = document.getElementById('intro-3d-scene');
    if (scene3d) scene3d.style.display = 'none';
    const particles = document.getElementById('intro-particles');
    if (particles) particles.style.display = 'none';
    const loader = document.getElementById('intro-loader');
    if (loader) loader.style.bottom = '40px'; // Move loader up slightly

    if (skipBtn) {
        skipBtn.style.zIndex = "10005"; // Ensure skip button is above video
        skipBtn.onclick = () => finishIntro(true);
    }

    if (introVideo) {
        introVideo.play().catch(e => console.warn("Video play failed:", e));
        introVideo.onended = () => finishIntro();
    }

    function finishIntro(isSkipped = false) {
        if (introFinished) return;
        introFinished = true;

        let flash = document.createElement('div');
        flash.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:#FFF;z-index:10001;opacity:0;transition:opacity 0.15s ease-in;pointer-events:none;`;
        document.body.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '1'; }, 10);

        setTimeout(() => {
            flash.style.transition = 'opacity 0.8s ease-out';
            flash.style.opacity = '0';
            document.getElementById('intro-screen').style.display = 'none';
            if (window.stopIntroParticles) window.stopIntroParticles();
            document.getElementById('login-screen').style.display = 'flex';
            window.playSound(isSkipped ? 'reveal' : 'beep');

            let savedName = localStorage.getItem('playerName');
            if (savedName && savedName !== "GUEST PLAYER") {
                document.getElementById('player-name-input').value = savedName;
            }

            // Initialize interactive water ripples on login screen
            if (typeof jQuery !== 'undefined' && typeof $.fn.ripples === 'function') {
                let $login = $('#login-screen');
                if (!$login.data('ripples')) {
                    $login.css({
                        'background-image': "url('login_bg.png')",
                        'background-size': 'cover',
                        'background-position': 'center',
                        'background-repeat': 'no-repeat'
                    }).ripples({
                        resolution: 512,
                        dropRadius: 20,
                        perturbance: 0.04
                    });
                }
            }

            setTimeout(() => { flash.remove(); }, 800);
        }, 200);
    }

    // Still show the loading bar progression over the video
    let percentEl = document.getElementById('intro-loader-percent');
    let fillEl = document.getElementById('intro-loader-fill');
    if (percentEl && fillEl) {
        let start = Date.now();
        let dur = 8000; // Average video length 
        let itv = setInterval(() => {
            if (introFinished) { clearInterval(itv); return; }
            let prog = Math.min((Date.now() - start) / dur, 1);
            let pct = Math.round(prog * 100);
            percentEl.textContent = pct + '%';
            fillEl.style.width = pct + '%';
            if (prog >= 1) {
                clearInterval(itv);
                setTimeout(() => finishIntro(), 500);
            }
        }, 50);
    }
}

// Registration functionality
let showRegBtn = document.getElementById('show-register-btn');
if (showRegBtn) {
    showRegBtn.addEventListener('click', () => {
        document.getElementById('register-modal').style.display = 'flex';
        window.playSound('beep');
    });
}

let closeRegBtn = document.getElementById('close-register-btn');
if (closeRegBtn) {
    closeRegBtn.addEventListener('click', () => {
        document.getElementById('register-modal').style.display = 'none';
        window.playSound('foul');
    });
}

let saveRegBtn = document.getElementById('do-register-btn');
if (saveRegBtn) {
    saveRegBtn.addEventListener('click', async () => {
        let rName = document.getElementById('reg-name').value.trim();
        let rDob = document.getElementById('reg-dob').value;
        if (rName === "" || rDob === "") {
            await window.customAlert("Please fill all details to register!", "REGISTRATION ERROR");
            window.playSound('foul');
            return;
        }
        let users = JSON.parse(localStorage.getItem('carrom_registered_users') || "[]");
        if (users.find(u => u.name.toLowerCase() === rName.toLowerCase())) {
            await window.customAlert("This name is already registered!", "REGISTRATION ERROR");
            window.playSound('foul');
            return;
        }
        let rId = '#' + Math.floor(10000 + Math.random() * 90000);
        users.push({ name: rName, dob: rDob, id: rId, freeEditUsed: false });
        localStorage.setItem('carrom_registered_users', JSON.stringify(users));

        // Reset player stats for the new account
        localStorage.setItem('totalWins', '0'); window.totalWins = 0;
        localStorage.setItem('totalLosses', '0'); window.totalLosses = 0;
        localStorage.setItem('totalCoinsPocketed', '0'); window.totalCoinsPocketed = 0;
        localStorage.setItem('queenCaptures', '0'); window.queenCaptures = 0;
        localStorage.setItem('playerMoney', '0'); playerMoney = 0;

        await window.customAlert("Register successfully!", "REGISTRATION COMPLETE");
        window.playSound('claim');
        document.getElementById('register-modal').style.display = 'none';
        document.getElementById('player-name-input').value = rName;
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-dob').value = '';
    });
}

// ---- CINEMATIC INTRO SYSTEM ----
window.playCinematicIntro = function (onComplete) {
    const intro = document.createElement('div');
    intro.id = 'cinematic-intro-overlay';
    intro.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;justify-content:center;align-items:center;font-family:'Outfit',sans-serif;overflow:hidden;`;

    // Cinematic Bars (Letterbox)
    const topBar = document.createElement('div');
    topBar.style.cssText = `position:absolute;top:0;left:0;width:100%;height:12%;background:#000;z-index:110001;box-shadow: 0 10px 40px rgba(0,0,0,0.9);`;
    const botBar = document.createElement('div');
    botBar.style.cssText = `position:absolute;bottom:0;left:0;width:100%;height:12%;background:#000;z-index:110001;box-shadow: 0 -10px 40px rgba(0,0,0,0.9);`;

    // Stage
    const stage = document.createElement('div');
    stage.style.cssText = `position:relative;z-index:110000;text-align:center;width:80%;max-width:900px;`;

    // Skip Button
    const skip = document.createElement('button');
    skip.innerText = 'SKIP INTRO ➔';
    skip.style.cssText = `position:absolute;top:5%;right:5%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);color:#888;padding:12px 30px;border-radius:40px;cursor:pointer;z-index:110005;font-weight:900;letter-spacing:2px;font-size:11px;backdrop-filter:blur(10px);transition:0.4s cubic-bezier(0.4, 0, 0.2, 1);`;
    skip.onmouseover = () => { skip.style.background = 'rgba(255,255,255,0.15)'; skip.style.borderColor = '#FFF'; skip.style.color = '#FFF'; skip.style.transform = 'scale(1.05)'; };
    skip.onmouseout = () => { skip.style.background = 'rgba(255,255,255,0.05)'; skip.style.borderColor = 'rgba(255,255,255,0.2)'; skip.style.color = '#888'; skip.style.transform = 'scale(1)'; };

    const finishIntro = () => {
        if (intro.parentNode) {
            intro.style.transition = 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1), transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
            intro.style.opacity = '0';
            intro.style.transform = 'scale(1.2)';
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            setTimeout(() => {
                if (intro.parentNode) intro.remove();
                onComplete();
            }, 1500);
        }
    };

    skip.onclick = (e) => {
        e.stopPropagation();
        finishIntro();
    };

    intro.appendChild(topBar);
    intro.appendChild(botBar);
    intro.appendChild(stage);
    intro.appendChild(skip);
    document.body.appendChild(intro);

    // Cinematic Grain Overlay
    const grain = document.createElement('div');
    grain.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:110002;opacity:0.04;background:url('https://www.transparenttextures.com/patterns/stardust.png');`;
    intro.appendChild(grain);

    // Sequence Script
    const scenes = [
        { text: "IN A WORLD OF PRECISION...", time: 500, duration: 4500, style: "font-size:20px;letter-spacing:12px;font-weight:200;color:#666;text-transform:uppercase;" },
        { text: "WHERE EVERY STRIKE COUNTS.", time: 5000, duration: 4200, style: "font-size:24px;letter-spacing:8px;font-weight:300;color:#999;text-transform:uppercase;" },
        { text: "A BATTLE OF CALCULATION.", time: 9200, duration: 4000, style: "font-size:26px;letter-spacing:6px;font-weight:400;color:#CCC;text-transform:uppercase;" },
        { text: "NO LUCK. JUST RAW SKILL.", time: 13200, duration: 4000, style: "font-size:34px;letter-spacing:18px;font-weight:900;color:#00FFFF;text-shadow:0 0 40px rgba(0,255,255,0.7);text-transform:uppercase;" },
        { text: "WELCOME TO THE ARCADE.", time: 17200, duration: 3300, style: "font-size:52px;letter-spacing:4px;font-weight:950;color:#FFF;text-shadow:0 0 60px rgba(255,255,255,1);text-transform:uppercase;" }
    ];

    scenes.forEach(s => {
        setTimeout(() => {
            if (!document.getElementById('cinematic-intro-overlay')) return;
            // PRE-TRIGGER VOICE slightly before text for perfect sync (compensated for micro-delays)
            window.speakMessage(s.text, 'male');

            const textEl = document.createElement('div');
            textEl.innerText = s.text;
            textEl.style.cssText = s.style + `position:absolute;top:50%;left:50%;transform:translate(-50%, -50%) scale(0.8);width:100%;opacity:0;transition:opacity 2s ease-in-out, transform 5s cubic-bezier(0,0,0.1,1);`;
            stage.appendChild(textEl);

            setTimeout(() => {
                textEl.style.opacity = '1';
                textEl.style.transform = 'translate(-50%, -50%) scale(1.1)';
            }, 100);

            setTimeout(() => {
                textEl.style.opacity = '0';
                setTimeout(() => textEl.remove(), 2000);
            }, s.duration - 2000);
        }, s.time);
    });

    // Final white flash before transition
    setTimeout(() => {
        const flash = document.createElement('div');
        flash.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:#FFF;z-index:110010;opacity:0;transition:opacity 2s ease-in;pointer-events:none;`;
        intro.appendChild(flash);
        setTimeout(() => { flash.style.opacity = '1'; }, 100);
    }, 18500);

    setTimeout(finishIntro, 20500);

    // Dramatic Audio Sync
    window.playSound('reveal');
    setTimeout(() => window.playSound('intro'), 3000);
    setTimeout(() => window.playSound('claim'), 17200);
};

document.getElementById('login-btn').addEventListener('click', () => {
    let inputElem = document.getElementById('player-name-input');
    let inputName = inputElem.value.trim();
    if (inputName === "") {
        inputElem.style.border = "2px solid #FF3333";
        inputElem.style.boxShadow = "0 0 15px rgba(255, 51, 51, 0.5)";
        inputElem.placeholder = "Please fill to login!";
        window.playSound('foul');
        setTimeout(() => {
            inputElem.style.border = "none";
            inputElem.style.boxShadow = "none";
            inputElem.placeholder = "Enter Player Name...";
        }, 2000);
        return;
    }

    let users = JSON.parse(localStorage.getItem('carrom_registered_users') || "[]");
    let foundUser = users.find(u => u.name.toLowerCase() === inputName.toLowerCase());

    if (!foundUser) {
        inputElem.style.border = "2px solid #FFD700";
        inputElem.style.boxShadow = "0 0 15px rgba(255, 215, 0, 0.5)";
        inputElem.value = "";
        inputElem.placeholder = "Please register first!";
        window.customAlert("Invalid name entered! Please register first.", "LOGIN ERROR");
        window.playSound('foul');
        setTimeout(() => {
            inputElem.style.border = "none";
            inputElem.style.boxShadow = "none";
            inputElem.placeholder = "Enter Player Name...";
        }, 2000);
        return;
    }

    playerName = foundUser.name;
    localStorage.setItem('playerName', playerName);

    // VOICE PRIMING & MUSIC PRIMING
    if ('speechSynthesis' in window) {
        let prime = new SpeechSynthesisUtterance("");
        prime.volume = 0;
        window.speechSynthesis.speak(prime);
    }

    window.requestFullScreen();
    triggerLoginTransition();
});

window.enteringArcade = false;

function triggerLoginTransition() {
    if (window.enteringArcadeInProgress) return;
    window.enteringArcadeInProgress = true;

    window.playCinematicIntro(() => {
        let loginScreen = document.getElementById('login-screen');
        let loginCard = document.querySelector('.login-card');
        let mainGame = document.getElementById('main-game');

        if (loginCard) {
            loginCard.style.transition = "transform 0.5s ease-in, opacity 0.5s ease-in";
            loginCard.style.transform = "scale(0)";
            loginCard.style.opacity = "0";
        }

        // Doors Animation
        let tContainer = document.createElement('div');
        tContainer.style.position = "fixed";
        tContainer.style.top = "0"; tContainer.style.left = "0"; tContainer.style.width = "100%"; tContainer.style.height = "100%";
        tContainer.style.zIndex = "10000"; tContainer.style.pointerEvents = "none"; tContainer.style.display = "flex"; tContainer.style.flexDirection = "column";

        let topHalf = document.createElement('div');
        topHalf.style.width = "100%"; topHalf.style.height = "50%"; topHalf.style.background = "#050510"; topHalf.style.transform = "translateY(-100%)"; topHalf.style.transition = "transform 0.4s cubic-bezier(0.8, 0, 0.2, 1)";
        topHalf.style.borderBottom = "4px solid #00FFFF"; topHalf.style.boxShadow = "0 0 30px #00FFFF";

        let botHalf = document.createElement('div');
        botHalf.style.width = "100%"; botHalf.style.height = "50%"; botHalf.style.background = "#050510"; botHalf.style.transform = "translateY(100%)"; botHalf.style.transition = "transform 0.4s cubic-bezier(0.8, 0, 0.2, 1)";
        botHalf.style.borderTop = "4px solid #8A2BE2"; botHalf.style.boxShadow = "0 0 30px #8A2BE2";

        tContainer.appendChild(topHalf); tContainer.appendChild(botHalf);
        document.body.appendChild(tContainer);

        let flash = document.createElement('div');
        flash.style.position = "fixed"; flash.style.top = "50%"; flash.style.left = "0"; flash.style.width = "100%"; flash.style.height = "2px"; flash.style.background = "#FFF"; flash.style.boxShadow = "0 0 80px 30px #00FFFF, 0 0 100px 40px #8A2BE2"; flash.style.transform = "scaleX(0) translateY(-50%)"; flash.style.opacity = "0"; flash.style.transition = "transform 0.3s ease-in, opacity 0.3s ease-out"; flash.style.zIndex = "10001";
        document.body.appendChild(flash);

        window.playSound('reveal');

        setTimeout(() => {
            topHalf.style.transform = "translateY(0%)";
            botHalf.style.transform = "translateY(0%)";

            setTimeout(() => {
                flash.style.opacity = "1";
                flash.style.transform = "scaleX(1) translateY(-50%)";
                window.playSound('intro');
            }, 300);
        }, 50);

        setTimeout(() => {
            if (window.ambientRipplesInterval) clearInterval(window.ambientRipplesInterval);
            if (typeof jQuery !== 'undefined' && typeof $.fn.ripples === 'function') {
                $('#login-screen').ripples('destroy');
            }

            loginScreen.style.display = 'none';
            mainGame.style.display = 'flex';
            mainGame.style.opacity = "1";

            // Start background music ONLY when intro completes (or is skipped)
            if (window.isMusicEnabled) {
                window.bgMusic.play().catch(e => { });
            }


            // Trigger advanced structural reveal
            const leftSidebar = document.getElementById('left-sidebar');
            const rightSidebar = document.getElementById('right-sidebar');
            const topBar = document.getElementById('top-bar');
            const canvasContainer = document.getElementById('canvas-container');

            if (leftSidebar) leftSidebar.style.animation = "advancedLeftSidebarIn 1.5s cubic-bezier(0.16,1,0.3,1) both";
            if (rightSidebar) rightSidebar.style.animation = "advancedRightSidebarIn 1.5s cubic-bezier(0.16,1,0.3,1) both";
            if (topBar) topBar.style.animation = "advancedTopBarDown 1s cubic-bezier(0.16,1,0.3,1) both";
            if (canvasContainer) canvasContainer.style.animation = "advancedBoardScaleIn 1.8s cubic-bezier(0.16,1,0.3,1) both";

            mainGame.style.animation = "advancedUIEnterGlow 2s ease-in-out forwards";

            topHalf.style.transform = "translateY(-100%)";
            botHalf.style.transform = "translateY(100%)";

            flash.style.transition = "transform 1s ease-out, opacity 1s ease-out";
            flash.style.transform = "scaleX(1) scaleY(600) translateY(-50%)";
            flash.style.opacity = "0";

            if (window.stopLoginParticles) window.stopLoginParticles();
            window.generateDailyQuests(); window.checkDailyLogin(); injectInteractionBar(); initGame(); updateTopBar(); renderSidebarShop();

            // Auto-join room if 'join' param exists
            if (window.autoJoinRoomId) {
                console.log("Auto-joining room: " + window.autoJoinRoomId);
                setTimeout(() => {
                    window.joinRoomMP("", window.autoJoinRoomId);
                    window.autoJoinRoomId = null; // Clear it so it doesn't regroup
                }, 1000);
            }

            if (window.gameLoopRafId) cancelAnimationFrame(window.gameLoopRafId);
            window.gameLoopRafId = requestAnimationFrame(gameLoop);
            window.playSound('claim');

            setTimeout(() => { tContainer.remove(); flash.remove(); window.enteringArcadeInProgress = false; }, 1500);
        }, 1300);
    });
}


window.showRoomQrCodeMP = function () {
    if (!window.mpRoomId) return;
    window.playSound('beep');

    let modal = document.createElement('div');
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;justify-content:center;align-items:center;z-index:20000;animation:fadeIn 0.3s ease;";

    let joinUrl = window.location.origin + window.location.pathname + "?join=" + window.mpRoomId;

    let content = `
        <div style="background:#111; border:2px solid #00FFFF; border-radius:15px; padding:30px; width:300px; text-align:center; box-shadow:0 0 40px #00FFFF;">
            <h2 style="color:#FFF; font-size:18px; margin-bottom:15px;">SCAN TO JOIN</h2>
            <div id="qrcode-canvas-container" style="background:#FFF; padding:15px; border-radius:10px; display:inline-block; margin-bottom:20px;"></div>
            <div style="color:#00FFFF; font-size:14px; font-weight:bold; margin-bottom:20px;">ROOM ID: ${window.mpRoomId}</div>
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; padding:12px; background:#FF3333; color:#FFF; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">CLOSE</button>
        </div>
    `;
    modal.innerHTML = content;
    document.body.appendChild(modal);

    new QRCode(document.getElementById("qrcode-canvas-container"), {
        text: joinUrl,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
};

// URL Parameter Parsing for Auto-Join
window.autoJoinRoomId = new URLSearchParams(window.location.search).get('join');

window.onload = function () {
    runIntroSequence();
};
