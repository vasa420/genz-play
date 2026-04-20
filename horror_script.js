const chatBody = document.getElementById('chat-body');
const choiceContainer = document.getElementById('choice-container');
const typingIndicator = document.getElementById('typing-indicator');
const contactStatus = document.getElementById('contact-status');
const notifSound = document.getElementById('notif-sound');
const glitchSound = document.getElementById('glitch-sound');

const story = {
    start: {
        text: "Hello?",
        sender: "unknown",
        choices: [
            { text: "Who is this?", next: "asking_who" },
            { text: "Wrong number, buddy.", next: "aggressive_start" }
        ]
    },
    asking_who: {
        text: "That doesn't matter. What matters is that you're home alone.",
        sender: "unknown",
        choices: [
            { text: "How do you know that?", next: "scary_detail" },
            { text: "I'm calling the police.", next: "police_threat" }
        ]
    },
    aggressive_start: {
        text: "I wouldn't be so rude if I were you. I can see you through the window.",
        sender: "unknown",
        choices: [
            { text: "Stop lying.", next: "proof_window" },
            { text: "Which window?", next: "window_detail" }
        ]
    },
    scary_detail: {
        text: "Because I'm standing right behind the blue curtains. The ones you forgot to close.",
        sender: "unknown",
        glitch: true,
        choices: [
            { text: "Look back.", next: "death_curtains" },
            { text: "Run to the door.", next: "run_away" }
        ]
    },
    police_threat: {
        text: "The lines are cut. Why don't you check the phone in the hallway?",
        sender: "unknown",
        choices: [
            { text: "Go check.", next: "hallway_event" },
            { text: "I'm hanging up.", next: "hang_up_death" }
        ]
    },
    window_detail: {
        text: "The kitchen one. You're wearing a black shirt, aren't you?",
        sender: "unknown",
        choices: [
            { text: "Yes...", next: "scary_detail" },
            { text: "No, you're wrong.", next: "stalker_angry" }
        ]
    },
    stalker_angry: {
        text: "Don't lie to me. I hate liars. I'm coming in.",
        sender: "unknown",
        glitch: true,
        death: "He didn't like being lied to. He was already inside."
    },
    death_curtains: {
        text: "Too late.",
        sender: "unknown",
        death: "You shouldn't have looked back. He was closer than you thought."
    },
    run_away: {
        text: "You're fast. But the door is locked from the outside.",
        sender: "unknown",
        choices: [
            { text: "Break the window.", next: "escape_end" },
            { text: "Hide in the closet.", next: "hide_death" }
        ]
    },
    escape_end: {
        text: "...",
        sender: "unknown",
        victory: "You broke out and ran until you saw headlights. You're safe... for now."
    },
    hide_death: {
        text: "I love hide and seek.",
        sender: "unknown",
        death: "The closet was the first place he looked."
    },
    hang_up_death: {
        text: "You can't hang up on fate.",
        sender: "unknown",
        death: "The phone kept ringing... even after you smashed it. Then he appeared."
    },
    proof_window: {
        text: "Check your messages again. I just sent you a photo.",
        sender: "unknown",
        choices: [
            { text: "What photo?", next: "photo_event" },
            { text: "I'm not looking.", next: "scary_detail" }
        ]
    },
    photo_event: {
        text: "It's a photo of your back. From five seconds ago.",
        sender: "unknown",
        glitch: true,
        death: "The flash was the last thing you saw."
    },
    hallway_event: {
        text: "Do you hear that? The floorboards in the hallway? That's not the wind.",
        sender: "unknown",
        choices: [
            { text: "Hide!", next: "hide_death" },
            { text: "Who's there?!", next: "stalker_angry" }
        ]
    }
};

let currentGameState = 'start';
let currentContact = 'unknown';

const contacts = {
    unknown: { name: "Unknown Number", avatar: "stalker_hero_selfie_1776590484686.png", status: "Online" },
    mom: { name: "Mom", avatar: "mom.png", status: "Last seen yesterday" },
    dad: { name: "Dad", avatar: "dad.png", status: "Away" },
    brother: { name: "Brother", avatar: "brother.png", status: "Online" },
    sanjay: { name: "Sanjay", avatar: "sanjay.png", status: "Online" },
    vicky: { name: "Vicky", avatar: "vicky.png", status: "Last seen 2h ago" },
    anu: { name: "Anu", avatar: "anu.png", status: "Online" }
};

const chatHistory = {
    unknown: [], mom: [], dad: [], brother: [], sanjay: [], vicky: [], anu: []
};

function switchChat(key) {
    try {
        console.log("Switching to chat:", key);
        if (!contacts[key]) {
             console.error("Contact not found:", key);
             return;
        }

        currentContact = key;
        const contact = contacts[key];
        
        // Update Header
        const nameEl = document.getElementById('contact-name');
        const avatarEl = document.getElementById('contact-avatar');
        const statusEl = document.getElementById('contact-status');

        if (nameEl) nameEl.innerText = contact.name;
        if (avatarEl) {
            avatarEl.innerText = ""; 
            avatarEl.style.background = `url('${contact.avatar}')`;
            avatarEl.style.backgroundSize = "cover";
            avatarEl.style.backgroundPosition = "center";
        }
        if (statusEl) statusEl.innerText = contact.status;
        
        // Clear and reload body
        chatBody.innerHTML = "";
        const history = chatHistory[key] || [];
        history.forEach(msg => {
            const div = document.createElement('div');
            div.className = msg.class;
            div.innerText = msg.text;
            chatBody.appendChild(div);
        });
        
        // Close the list and reveal the chat
        // closeChatList(); // Now handled by hideAllOverlays/openChat logic
        hideAllOverlays();
        document.getElementById('chat-active-overlay').style.display = 'flex';
        
        // Ensure choice container is cleared when switching chats
        if (choiceContainer) choiceContainer.innerHTML = "";

        chatBody.scrollTo(0, chatBody.scrollHeight);

        // Initial message and choices for EVERY person
        if (history.length === 0 || key !== 'unknown') {
            const initialMsgs = {
                unknown: "Hello?",
                mom: "Where are you? I've been calling for hours.",
                dad: "Did you check the security cameras like I told you?",
                brother: "I saw someone outside your place. Are you there?",
                sanjay: "Yo, you seeing the news? There's a lockdown in your sector.",
                vicky: "Pick up the phone. Stop playing around.",
                anu: "I feel like someone is watching me... are you okay?"
            };
            
            // If it's a NEW chat or we just switched back, show current suggestions
            if (history.length === 0) {
                 setTimeout(() => receiveMessage(initialMsgs[key], 'left', key === 'unknown'), 800);
            }
            
            // ALWAYS show suggestions when opening a chat
            setTimeout(() => showFamilyChoices(getSuggestionsFor(key)), 1500);
        }
    } catch (err) {
        console.error("Error in switchChat:", err);
    }
}

function getSuggestionsFor(key) {
    const input = chatHistory[key].length > 0 ? chatHistory[key][chatHistory[key].length - 1].text.toLowerCase() : "";
    
    if (key === 'mom') {
        if (input.includes("police") || input.includes("door")) {
            return [
                { text: "Hurry Mom, please!", type: "urgent" },
                { text: "I'm hiding under the bed.", type: "action" },
                { text: "Do you hear the sirens?", type: "question" }
            ];
        } else if (input.includes("traffic") || input.includes("minutes")) {
            return [
                { text: "Don't stop for anything.", type: "urgent" },
                { text: "I'm scared of the silence.", type: "emotion" }
            ];
        } else if (input.includes("love")) {
            return [
                { text: "I love you too.", type: "love" },
                { text: "Please just get here.", type: "urgent" }
            ];
        }
        // Default Mom suggestions
        return [
            { text: "Mom, I'm scared. Someone is outside.", type: "danger" },
            { text: "I'm safe, don't worry.", type: "safe" },
            { text: "Where are you right now?", type: "location" }
        ];
    }
    
    const sets = {
        unknown: [
            { text: "Who is this?", next: "asking_who" },
            { text: "Wrong number, buddy.", next: "aggressive_start" }
        ],
        dad: [
            { text: "FATHER you know the pass key for cam 5?", type: "question" },
            { text: "Checking the cameras now...", type: "action" },
            { text: "I see someone on the porch!", type: "danger" },
            { text: "Everything is quiet here.", type: "safe" }
        ],
        brother: [
            { text: "Wait, what car?", type: "question" },
            { text: "I didn't invite anyone.", type: "danger" },
            { text: "Stop trying to scare me.", type: "annoyed" }
        ],
        sanjay: [
            { text: "What lockdown?", type: "question" },
            { text: "The power just went out.", type: "danger" },
            { text: "I'm heading to yours.", type: "action" }
        ],
        vicky: [
            { text: "Something is wrong here.", type: "danger" },
            { text: "I'm just busy, leave me alone.", type: "safe" }
        ],
        anu: [
            { text: "I got that link too!", type: "danger" },
            { text: "Are you okay? Is anyone there?", type: "question" }
        ]
    };
    return sets[key] || [{ text: "Are you there?", type: "generic" }];
}

function showFamilyChoices(choices) {
    if (!choiceContainer) return;
    choiceContainer.innerHTML = '';
    choices.forEach(choice => {
        const btn = document.createElement('div');
        btn.className = 'choice-btn';
        btn.innerText = choice.text;
        btn.onclick = () => {
             // Add player message
             const text = choice.text;
             const msgDiv = document.createElement('div');
             msgDiv.className = 'msg right';
             msgDiv.innerText = text;
             chatBody.appendChild(msgDiv);
             chatBody.scrollTo(0, chatBody.scrollHeight);
             chatHistory[currentContact].push({ text, class: 'msg right' });
             
             choiceContainer.innerHTML = ''; // Hide choices
             
             // AI Response based on type
             setTimeout(() => playAIResponse(text), 1000);
        };
        choiceContainer.appendChild(btn);
    });
}

async function receiveMessage(text, side, isUnknown = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${side} ${isUnknown ? 'unknown' : ''}`;
    msgDiv.innerText = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);
    
    // Save to history
    chatHistory[currentContact].push({ text, class: msgDiv.className });
    
    // Update List Preview
    const contactElements = document.querySelectorAll('.chat-item');
    contactElements.forEach(el => {
        if (el.innerText.includes(contacts[currentContact].name)) {
            const p = el.querySelector('p');
            if (p) p.innerText = text;
        }
    });

    notifSound.play().catch(e => {});
}

async function showWarning() {
    requestFullScreen();
    const intro = document.getElementById('intro-overlay');
    const transition = document.getElementById('cinematic-transition');
    const warning = document.getElementById('headphones-warning');
    const bar = document.getElementById('loading-progress');
    const introMusic = document.getElementById('intro-music');

    transition.style.opacity = '1';
    if (introMusic) {
        let fadeAudio = setInterval(() => {
            if (introMusic.volume > 0.1) {
                introMusic.volume -= 0.1;
            } else {
                introMusic.pause();
                clearInterval(fadeAudio);
            }
        }, 200);
    }

    await new Promise(r => setTimeout(r, 2100));
    intro.style.display = 'none';
    intro.classList.remove('active');
    warning.style.display = 'flex';
    transition.style.opacity = '0';
    await new Promise(r => setTimeout(r, 1000));

    bar.style.transition = 'width 5s linear';
    setTimeout(() => { bar.style.width = '100%'; }, 100);
    setTimeout(() => { startGame(); }, 5100);
}

function startGame() {
    const headphones = document.getElementById('headphones-warning');
    if (headphones) headphones.style.display = 'none';
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic) {
        bgMusic.volume = 0.5;
        bgMusic.play().catch(e => {});
    }
    updateTime();
    setInterval(updateTime, 60000);
    
    // START ON HOME SCREEN
    openHome();
}

function openHome() {
    console.log("Opening Home Screen...");
    hideAllOverlays();
    document.getElementById('home-screen').style.display = 'block';
    
    // Pause video if playing
    const video = document.getElementById('game-video-player');
    if (video) video.pause();
}

function openPhoneApp() {
    console.log("Opening Phone App...");
    hideAllOverlays();
    document.getElementById('phone-app-overlay').style.display = 'flex';
    switchPhoneTab('recents');
}

function openChatList() {
    console.log("Opening Messages App...");
    hideAllOverlays();
    document.getElementById('chat-list-overlay').style.display = 'flex';
    document.getElementById('chat-list-overlay').style.opacity = '1';
    
    // Set unknown as active if it's the first time
    if (chatHistory['unknown'].length === 0) {
        switchChat('unknown');
    }
}

function openPhotos() {
    alert("System Error: Photos database corrupted. Unauthorized access detected.");
    document.body.classList.add('glitch-active');
    setTimeout(() => document.body.classList.remove('glitch-active'), 500);
}

function openVideos() {
    console.log("DEBUG: Attempting to open Videos App...");
    hideAllOverlays();
    const overlay = document.getElementById('video-app-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.zIndex = '9999'; // Force it to the very top
        console.log("DEBUG: Video overlay set to display flex");
    } else {
        console.error("DEBUG: video-app-overlay NOT FOUND in DOM");
    }
}

function openCamera() {
    console.log("INITIALIZING SECURITY FEED...");
    hideAllOverlays();
    document.getElementById('camera-system').style.display = 'flex';
    
    // Reset camera state
    switchCamera(1); 
}

function hideAllOverlays() {
    const overlays = [
        'home-screen', 
        'chat-list-overlay',
        'chat-active-overlay',
        'camera-system', 
        'phone-app-overlay', 
        'video-app-overlay'
    ];
    overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

let dialedNumber = "";

window.switchPhoneTab = function(tab) {
    const listContent = document.getElementById('phone-list-content');
    const keypadContent = document.getElementById('phone-keypad-content');
    const tabs = document.querySelectorAll('.phone-tab');
    
    // UI Update
    tabs.forEach(t => {
        t.classList.remove('active');
        t.style.color = "#888";
    });
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).style.color = "#fff";

    if (tab === 'keypad') {
        listContent.style.display = 'none';
        keypadContent.style.display = 'flex';
    } else {
        listContent.style.display = 'block';
        keypadContent.style.display = 'none';
        populatePhoneLists(tab);
    }
};

function populatePhoneLists(type) {
    const list = document.getElementById('phone-list-content');
    list.innerHTML = "";
    
    // Use contacts object
    Object.keys(contacts).forEach(key => {
        const contact = contacts[key];
        const item = document.createElement('div');
        item.className = type === 'recents' ? 'recent-item' : 'contact-item';
        
        const isMissed = type === 'recents' && Math.random() > 0.7 && key !== 'mom';

        item.innerHTML = `
            <div style="width: 45px; height: 45px; background: url('${contact.avatar}'); background-size: cover; border-radius: 50%; margin-right: 15px;"></div>
            <div style="flex: 1;">
                <h3 style="color: ${isMissed ? '#ff3b30' : 'white'}; font-size: 16px; font-weight: 500; margin: 0;">${contact.name}</h3>
                <p style="color: #666; font-size: 12px; margin-top: 2px;">${type === 'recents' ? (isMissed ? 'Missed' : 'Mobile') : 'mobile'}</p>
            </div>
            <div style="color: #666; font-size: 12px;">${type === 'recents' ? 'Today' : ''}</div>
        `;
        
        item.onclick = () => {
            if (key === 'unknown') {
                startCreepyCall();
            } else {
                dialedNumber = "0000"; // Placeholder
                performCall();
            }
        };
        list.appendChild(item);
    });
}

window.dialDigit = function(n) {
    if (dialedNumber.length < 11) {
        dialedNumber += n;
        document.getElementById('phone-display').innerText = dialedNumber;
        window.playBeep();
    }
};

window.deleteDialDigit = function() {
    dialedNumber = dialedNumber.slice(0, -1);
    document.getElementById('phone-display').innerText = dialedNumber;
};

window.performCall = function() {
    if (dialedNumber === "") return;
    
    console.log("Calling:", dialedNumber);
    if (dialedNumber === "911") {
        alert("Emergency Services: The call lines in your area have been cut. We cannot reach you.");
        document.body.classList.add('glitch-active');
        setTimeout(() => document.body.classList.remove('glitch-active'), 1000);
    } else if (dialedNumber === "7394") {
        document.getElementById('phone-app-overlay').style.display = 'none';
        startCreepyCall();
    } else {
        alert("User Busy: The person you are trying to reach is currently unavailable.");
    }
    
    dialedNumber = "";
    document.getElementById('phone-display').innerText = "";
    setTimeout(openHome, 1500);
};

// --- Cam 5 Passkey Logic ---
let cam5Passkey = "";
const correctPasskey = "7394"; // Narratively revealed by Dad
let isCam5Unlocked = false;

window.enterDigit = function(n) {
    if (cam5Passkey.length < 4) {
        cam5Passkey += n;
        updatePasskeyUI();
        window.playBeep();
        if (cam5Passkey.length === 4) {
            setTimeout(checkPasskey, 300);
        }
    }
};

window.resetPasskey = function() {
    cam5Passkey = "";
    updatePasskeyUI();
};

function updatePasskeyUI() {
    const dots = document.querySelectorAll('.passkey-dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('filled', 'error');
        if (i < cam5Passkey.length) dot.classList.add('filled');
    });
}

async function checkPasskey() {
    if (cam5Passkey === correctPasskey) {
        isCam5Unlocked = true;
        document.getElementById('cam5-lock-screen').style.display = 'none';
        switchCamera(5);
        document.getElementById('cam-btn-5').style.background = "#ff3b30";
        document.getElementById('active-feed').style.backgroundColor = "transparent";
    } else {
        const dots = document.querySelectorAll('.passkey-dot');
        dots.forEach(dot => dot.classList.add('error'));
        window.playSound('foul');
        setTimeout(resetPasskey, 500);
    }
}

window.playBeep = function() {
    if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = window.audioCtx.createOscillator();
    const gain = window.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, window.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, window.audioCtx.currentTime);
    osc.connect(gain); gain.connect(window.audioCtx.destination);
    osc.start(); osc.stop(window.audioCtx.currentTime + 0.05);
};
// ----------------------------

function switchCamera(id) {
    const feed = document.getElementById('active-feed');
    const glitch = document.getElementById('feed-glitch');
    const label = document.getElementById('cam-label');
    const location = document.getElementById('cam-location');
    const buttons = document.querySelectorAll('.cam-btn');
    const shadowPerson = document.getElementById('shadow-person');
    
    // UI Button Update
    buttons.forEach((btn, idx) => {
        if (idx + 1 === id) {
            btn.style.background = "#ff3e3e";
            btn.style.borderColor = "#ff3e3e";
            btn.style.boxShadow = "0 0 10px rgba(255, 62, 62, 0.5)";
        } else {
            btn.style.background = "#222";
            btn.style.borderColor = "#444";
            btn.style.boxShadow = "none";
        }
    });
    
    // Switch Effect
    glitch.style.opacity = '1';
    glitchSound.play().catch(e => {});
    
    setTimeout(() => {
        glitch.style.opacity = '0';
        label.innerText = `CAM ${id}`;
        
        const timestamp = new Date().toLocaleTimeString();
        document.querySelector('.cctv-time').innerText = timestamp;

        // Toggle shadow person specifically for Cam 1
        if (shadowPerson) {
            shadowPerson.style.display = 'none';
        }

        if (id === 1) {
            feed.src = "camera_man_at_door_1776605713116.png"; 
            location.innerText = "FRONT PORCH - LIVE";
            feed.style.filter = "none";
            feed.classList.add('breaking-active');
        } else if (id === 2) {
            feed.classList.remove('breaking-active');
            feed.src = "camera_backyard_view_1776596617682.png"; // Moving swing
            location.innerText = "BACKYARD - NIGHT VISION";
            feed.style.filter = "sepia(1) hue-rotate(90deg) brightness(0.8) contrast(1.2)"; 
        } else if (id === 3) {
            feed.classList.remove('breaking-active');
            feed.src = "camera_living_room_view_1776607107820.png"; 
            location.innerText = "LIVING ROOM - CORNER CAM";
            feed.style.filter = "none";
            feed.style.backgroundColor = "transparent";
        } else if (id === 4) {
            feed.classList.remove('breaking-active');
            feed.src = "stalker_id.png"; // RELIABLE LOCAL ASSET
            location.innerText = "MAIN HALLWAY - MOTION DETECTED";
            feed.style.filter = "grayscale(1) contrast(1.5)";
        } else if (id === 5) {
            feed.classList.remove('breaking-active');
            if (!isCam5Unlocked) {
                document.getElementById('cam5-lock-screen').style.display = 'flex';
                feed.src = ""; 
                feed.style.backgroundColor = "black";
            } else {
                document.getElementById('cam5-lock-screen').style.display = 'none';
                feed.src = "camera_garage_view_1776606229352.png";
                feed.style.backgroundColor = "transparent";
            }
            location.innerText = isCam5Unlocked ? "GARAGE - LIVE" : "GARAGE - WARNING: UNAUTHORIZED ENTRY";
            feed.style.filter = "none";
        }
    }, 300);
}

function openMusic() {
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic) {
        bgMusic.playbackRate = 0.5; // Distort the music
        setTimeout(() => {
            bgMusic.playbackRate = 1.0;
            openHome();
        }, 5000);
    }
    alert("Now Playing: Requiem for a Forgotten User");
}

function closeChatList() {
    console.log("Closing Chat List Overlay...");
    const overlay = document.getElementById('chat-list-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.opacity = '1'; // Reset for next open
        }, 300);
    }
}

// Global Listener for chat items to ensure they ALWAYS fire
document.addEventListener('click', function(e) {
    const chatItem = e.target.closest('.chat-item');
    if (chatItem) {
        const onclickAttr = chatItem.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes('switchChat')) {
            // Extracts 'mom', 'dad' etc from switchChat('mom')
            const contactKey = onclickAttr.match(/'([^']+)'/)[1];
            if (contactKey) {
                console.log("Global Click caught for contact:", contactKey);
                switchChat(contactKey);
            }
        }
    }
});

function updateTime() {
    const now = new Date();
    document.getElementById('current-time').innerText = 
        now.getHours().toString().padStart(2, '0') + ":" + 
        now.getMinutes().toString().padStart(2, '0');
}

// Global User Interaction Listener
const interactionEvents = ['mousedown', 'click', 'touchstart', 'keydown'];
interactionEvents.forEach(eventType => {
    window.addEventListener(eventType, function startHorrorMusic() {
        const bgMusic = document.getElementById('bg-music');
        const introMusic = document.getElementById('intro-music');
        const introOverlay = document.getElementById('intro-overlay');
        const isIntroActive = introOverlay && introOverlay.classList.contains('active');
        if (isIntroActive) {
            if (introMusic && introMusic.paused) introMusic.play().catch(e => {});
        } else {
            if (bgMusic && bgMusic.paused) bgMusic.play().catch(e => {});
        }
    }, { once: false });
});

async function playMessage(stateKey) {
    const node = story[stateKey];
    if (!node) return;
    typingIndicator.style.display = 'flex';
    contactStatus.innerText = "Typing...";
    const delay = Math.min(Math.max(node.text.length * 50, 1000), 3000);
    await new Promise(r => setTimeout(r, delay));
    typingIndicator.style.display = 'none';
    contactStatus.innerText = "Online";
    receiveMessage(node.text, 'left', node.sender === 'unknown');
    if (node.glitch) {
        document.body.classList.add('glitch-active');
        glitchSound.play().catch(e => {});
        setTimeout(() => document.body.classList.remove('glitch-active'), 500);
    }
    if (node.death) setTimeout(() => endGame(node.death, false), 2000);
    if (node.victory) setTimeout(() => endGame(node.victory, true), 2000);
    showChoices(node.choices);
}

function showChoices(choices) {
    choiceContainer.innerHTML = '';
    choices.forEach(choice => {
        const btn = document.createElement('div');
        btn.className = 'choice-btn';
        btn.innerText = choice.text;
        btn.onclick = () => makeChoice(choice);
        choiceContainer.appendChild(btn);
    });
}

function makeChoice(choice) {
    choiceContainer.innerHTML = '';
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg right';
    msgDiv.innerText = choice.text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);
    chatHistory[currentContact].push({ text: choice.text, class: 'msg right' });
    setTimeout(() => playMessage(choice.next), 1000);
}

function endGame(reason, isVictory) {
    const overlay = document.getElementById('game-over');
    const title = overlay.querySelector('h1');
    const desc = document.getElementById('death-reason');
    if (isVictory) {
        title.innerText = "SURVIVED";
        title.style.color = "#00ff88";
        title.classList.remove('glitch');
        desc.innerText = reason;
    } else {
        title.innerText = "SIGNAL LOST";
        title.style.color = "#ff3e3e";
        desc.innerText = reason;
    }
    overlay.style.display = 'flex';
}

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

async function handleSend() {
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = '';
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg right';
    msgDiv.innerText = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);
    chatHistory[currentContact].push({ text, class: 'msg right' });
    if (currentContact === 'unknown') {
        const currentChoices = document.querySelectorAll('.choice-btn');
        let matched = false;
        currentChoices.forEach(btn => {
            if (text.toLowerCase().includes(btn.innerText.toLowerCase())) {
                btn.click();
                matched = true;
            }
        });
        if (!matched) setTimeout(() => playAIResponse(text), 1200);
    } else {
        setTimeout(() => playAIResponse(text), 1500);
    }
}

async function playAIResponse(userInput) {
    const input = userInput.toLowerCase();
    let response = "";
    let isCreepy = false;
    if (currentContact === 'unknown') {
        const analysis = {
            fear: (input.match(/scared|afraid|fear|terrified|god|help|please|no|stop/g) || []).length
        };
        if (input.includes("time")) {
            const now = new Date();
            response = `It's ${now.getHours()}:${now.getMinutes()}. Time for you to realize you're not safe.`;
        } else if (input.includes("photo") || input.includes("pic")) {
            response = "I'm right here. Look closer.";
            setTimeout(() => sendPhotoMessage("stalker_id.png"), 3000);
        } else if (analysis.fear > 0) {
            response = "Your fear is my primary source. Keep typing.";
        } else {
            response = "I'm getting closer with every word you type.";
        }
    } else if (currentContact === 'mom') {
        if (input.includes("help") || input.includes("scared") || input.includes("stranger")) {
            response = "WHAT?! Stay in your room. I'm calling the police right now! Don't open the door for anyone!";
        } else if (input.includes("where") || input.includes("home")) {
            response = "I'm stuck in traffic near the bridge. Please tell me you locked the kitchen window.";
        } else if (input.includes("love")) {
            response = "I love you too baby. Just stay safe. I'll be there in 15 minutes.";
        } else {
            response = "I can't talk right now honey. Just make sure the back door is bolted.";
        }
    } else if (currentContact === 'dad') {
        if (input.includes("pass key") || input.includes("passcode") || input.includes("cam 5")) {
            response = "Yeah, I remember. The passcode for the Garage (Cam 5) is 7394. I set it to that just in case of an emergency.";
        } else if (input.includes("stranger") || input.includes("window")) {
            response = "I see him on the porch camera! He's wearing a mask. Get to the safe room NOW!";
        } else {
            response = "I'm late at work. Did the alarm system beep? It's showing a connection error.";
        }
    } else if (currentContact === 'brother') {
        response = "Yo, there's a black car sitting outside your driveway. Driver is just staring. Did you invite someone?";
        isCreepy = true;
    } else if (currentContact === 'anu') {
        response = "Did you just send me a weird link? My phone just played a scream recording. This isn't funny.";
        isCreepy = true;
    } else {
        response = "The network is slow. Everyone says lines are being cut. Are you there?";
    }
    typingIndicator.style.display = 'flex';
    contactStatus.innerText = "Typing...";
    await new Promise(r => setTimeout(r, 2000));
    typingIndicator.style.display = 'none';
    contactStatus.innerText = contacts[currentContact].status;
    receiveMessage(response, 'left', currentContact === 'unknown' || isCreepy);
    
    // RE-SHOW SUGGESTIONS AFTER RESPONSE
    setTimeout(() => {
        showFamilyChoices(getSuggestionsFor(currentContact));
    }, 1500);

    if (isCreepy || (currentContact === 'unknown' && Math.random() > 0.7)) {
        document.body.classList.add('glitch-active');
        glitchSound.play().catch(e => {});
        setTimeout(() => document.body.classList.remove('glitch-active'), 400);
    }
}

function sendPhotoMessage(url) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg left unknown photo-msg';
    msgDiv.style.background = 'transparent';
    msgDiv.style.padding = '0';
    msgDiv.style.border = 'none';
    const img = document.createElement('img');
    img.src = url;
    img.style.width = '120px';
    img.style.height = '150px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '4px';
    img.style.marginTop = '10px';
    img.style.border = '4px solid white';
    img.style.boxShadow = '0 5px 15px rgba(0,0,0,0.8)';
    img.onload = () => chatBody.scrollTo(0, chatBody.scrollHeight);
    msgDiv.appendChild(img);
    chatBody.appendChild(msgDiv);
    notifSound.play().catch(e => {});
}

if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
}
if (sendBtn) sendBtn.addEventListener('click', handleSend);

let callTimeout;
let isRinging = false;

function startCreepyCall() {
    const callOverlay = document.getElementById('call-overlay');
    const callStatus = document.getElementById('call-status');
    const bgMusic = document.getElementById('bg-music');
    const ringtone = document.getElementById('ringtone-sound');
    callOverlay.style.display = 'flex';
    isRinging = true;
    if (bgMusic) bgMusic.pause();
    if (ringtone) {
        ringtone.currentTime = 0;
        ringtone.play().catch(e => {});
    }
    callStatus.innerText = "INCOMING CALL...";
}

function acceptCall() {
    if (!isRinging) return;
    isRinging = false;
    const callStatus = document.getElementById('call-status');
    const ringtone = document.getElementById('ringtone-sound');
    const glitchSound = document.getElementById('glitch-sound');
    if (ringtone) ringtone.pause();
    callStatus.innerText = "CONNECTED";
    callStatus.style.color = "#4cd964";
    document.body.classList.add('glitch-active');
    glitchSound.play().catch(e => {});
    const msg = new SpeechSynthesisUtterance("Hey man... what is your name?");
    msg.pitch = 0.1;
    msg.rate = 0.7;
    window.speechSynthesis.speak(msg);
    setTimeout(() => {
        callStatus.innerText = "HEY MAN...";
        setTimeout(() => {
            callStatus.innerText = "WHAT IS YOUR NAME?";
        }, 1500);
    }, 1000);
    setTimeout(() => {
        endCall();
        setTimeout(() => playAIResponse("I'm waiting for your name."), 1000);
    }, 8000);
}

function endCall() {
    const callOverlay = document.getElementById('call-overlay');
    const bgMusic = document.getElementById('bg-music');
    const ringtone = document.getElementById('ringtone-sound');
    isRinging = false;
    window.speechSynthesis.cancel();
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    callOverlay.style.display = 'none';
    document.body.classList.remove('glitch-active');
    if (bgMusic) bgMusic.play().catch(e => {});
    document.getElementById('call-status').innerText = "CALLING...";
    document.getElementById('call-status').style.color = "#888";
}

function requestFullScreen() {
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
                console.log(`Fullscreen request failing (ignoring): ${err.message}`);
            });
        }
    }
}
