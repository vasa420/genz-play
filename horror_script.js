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
        closeChatList();
        
        // Ensure choice container is cleared when switching chats
        if (choiceContainer) choiceContainer.innerHTML = "";

        chatBody.scrollTo(0, chatBody.scrollHeight);

        // Initial message and choices for family/friends
        if (history.length === 0 && key !== 'unknown') {
            const initialMsgs = {
                mom: "Where are you? I've been calling for hours.",
                dad: "Did you check the security cameras like I told you?",
                brother: "I saw someone outside your place. Are you there?",
                sanjay: "Yo, you seeing the news? There's a lockdown in your sector.",
                vicky: "Pick up the phone. Stop playing around.",
                anu: "I feel like someone is watching me... are you okay?"
            };
            
            setTimeout(() => {
                receiveMessage(initialMsgs[key], 'left');
                
                // Show specific choices for the first time
                if (key === 'mom') {
                    showFamilyChoices([
                        { text: "Mom, I'm scared. Someone is outside.", type: 'danger' },
                        { text: "Where are you? Come home fast.", type: 'location' },
                        { text: "I love you Mom.", type: 'love' }
                    ]);
                } else if (key === 'dad') {
                    showFamilyChoices([
                        { text: "Dad, the camera showed a man in a mask.", type: 'danger' },
                        { text: "Why is the alarm beeping?", type: 'question' }
                    ]);
                }
            }, 800);
        }
    } catch (err) {
        console.error("Error in switchChat:", err);
    }
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
    document.getElementById('home-screen').style.display = 'block';
    document.getElementById('chat-list-overlay').style.display = 'none';
    document.getElementById('camera-system').style.display = 'none';
}

function openChatList() {
    console.log("Opening Messages App...");
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('chat-list-overlay').style.display = 'flex';
    document.getElementById('chat-list-overlay').style.opacity = '1';
    
    // Initial STALKER message triggered when you FIRST open the app
    if (chatHistory['unknown'].length === 0) {
        switchChat('unknown');
        setTimeout(() => { playMessage('start'); }, 1000);
    }
}

function openPhotos() {
    alert("System Error: Photos database corrupted. Unauthorized access detected.");
    document.body.classList.add('glitch-active');
    setTimeout(() => document.body.classList.remove('glitch-active'), 500);
}

function openVideos() {
    alert("Critical Failure: Video feed encrypted. Remote observer active.");
    document.body.classList.add('glitch-active');
    setTimeout(() => document.body.classList.remove('glitch-active'), 500);
}

function openCamera() {
    console.log("INITIALIZING SECURITY FEED...");
    // Force close everything else
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('chat-list-overlay').style.display = 'none';
    document.getElementById('camera-system').style.display = 'flex';
    
    // Reset camera state
    switchCamera(1); 
}

function switchCamera(id) {
    const feed = document.getElementById('active-feed');
    const glitch = document.getElementById('feed-glitch');
    const label = document.getElementById('cam-label');
    const location = document.getElementById('cam-location');
    const buttons = document.querySelectorAll('.cam-btn');
    
    // Clear any previous alerts/timeouts if possible (state reset)
    
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

        if (id === 1) {
            feed.src = "camera_porch_view_1776596595360.png";
            location.innerText = "FRONT PORCH - LIVE";
            feed.style.filter = "none";
        } else if (id === 2) {
            feed.src = "camera_backyard_view_1776596617682.png";
            location.innerText = "BACKYARD - NIGHT VISION";
            feed.style.filter = "sepia(1) hue-rotate(90deg) brightness(0.8) contrast(1.2)"; 
        } else if (id === 3) {
            feed.src = "media__1776587554852.png";
            location.innerText = "LIVING ROOM - INTERIOR";
            feed.style.filter = "grayscale(1) brightness(0.5) contrast(1.5)";
        } else if (id === 4) {
            feed.src = "media__1776586840686.png";
            location.innerText = "HALLWAY - INTERIOR";
            feed.style.filter = "grayscale(1) brightness(0.4) contrast(1.8)";
        } else if (id === 5) {
            feed.src = "stalker_mirror_selfie_1776589637959.png";
            location.innerText = "GARAGE - WARNING: MOTION DETECTED";
            feed.style.filter = "grayscale(1) brightness(0.3) contrast(2)";
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
        if (input.includes("stranger") || input.includes("window")) {
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
