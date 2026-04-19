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
    currentContact = key;
    const contact = contacts[key];
    
    // Update Header
    document.getElementById('contact-name').innerText = contact.name;
    document.getElementById('contact-avatar').innerText = ""; 
    document.getElementById('contact-avatar').style.background = `url('${contact.avatar}')`;
    document.getElementById('contact-avatar').style.backgroundSize = "cover";
    document.getElementById('contact-status').innerText = contact.status;
    
    // Clear and reload body
    chatBody.innerHTML = "";
    chatHistory[key].forEach(msg => {
        const div = document.createElement('div');
        div.className = msg.class;
        div.innerText = msg.text;
        chatBody.appendChild(div);
    });
    
    closeChatList();
    chatBody.scrollTo(0, chatBody.scrollHeight);

    // Initial message if empty for family
    if (chatHistory[key].length === 0 && key !== 'unknown') {
        const initialMsg = {
            mom: "Where are you? I've been calling for hours.",
            dad: "Did you check the security cameras like I told you?",
            brother: "I saw someone outside your place. Are you there?",
            sanjay: "Yo, you seeing the news? There's a lockdown in your sector.",
            vicky: "Pick up the phone. Stop playing around.",
            anu: "I feel like someone is watching me... are you okay?"
        };
        setTimeout(() => {
            receiveMessage(initialMsg[key], 'left');
        }, 1000);
    }
}

async function receiveMessage(text, side, isUnknown = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${side} ${isUnknown ? 'unknown' : ''}`;
    msgDiv.innerText = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);
    
    // Save to history
    chatHistory[currentContact].push({ text, class: msgDiv.className });
    
    notifSound.play().catch(e => {});
}

async function showWarning() {
    const intro = document.getElementById('intro-overlay');
    const transition = document.getElementById('cinematic-transition');
    const warning = document.getElementById('headphones-warning');
    const bar = document.getElementById('loading-progress');
    const introMusic = document.getElementById('intro-music');

    // 1. Start slow transition to black
    transition.style.opacity = '1';
    
    // Fade out intro music slowly
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

    // 2. Wait for full black screen (2 seconds)
    await new Promise(r => setTimeout(r, 2100));

    // 3. Switch screens under the black cover
    intro.style.display = 'none';
    intro.classList.remove('active');
    warning.style.display = 'flex';
    
    // 4. Fade out the black cover
    transition.style.opacity = '0';
    await new Promise(r => setTimeout(r, 1000));

    // 5. Start loading bar
    bar.style.transition = 'width 5s linear';
    setTimeout(() => {
        bar.style.width = '100%';
    }, 100);

    setTimeout(() => {
        startGame();
    }, 5100);
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
    
    // Start with Stalker
    switchChat('unknown');
    setTimeout(() => {
        playMessage('start');
    }, 1500);
}

function openChatList() {
    document.getElementById('chat-list-overlay').style.display = 'flex';
}

function closeChatList() {
    document.getElementById('chat-list-overlay').style.display = 'none';
}

function updateTime() {
    const now = new Date();
    document.getElementById('current-time').innerText = 
        now.getHours().toString().padStart(2, '0') + ":" + 
        now.getMinutes().toString().padStart(2, '0');
}

// ... Interaction listener ...

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

// ... showChoices, makeChoice, endGame ...

async function handleSend() {
    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = '';
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg right';
    msgDiv.innerText = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);

    // Save to history
    chatHistory[currentContact].push({ text, class: 'msg right' });

    // Stalker story matching
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
        // Person-based AI responses
        setTimeout(() => playAIResponse(text), 1500);
    }
}

async function playAIResponse(userInput) {
    const input = userInput.toLowerCase();
    let response = "";
    let isCreepy = false;

    if (currentContact === 'unknown') {
        // STALKER LOGIC (Original)
        const analysis = {
            fear: (input.match(/scared|afraid|fear|terrified|god|help|please|no|stop/g) || []).length,
            aggression: (input.match(/fuck|shit|kill|die|police|911|bastard|idiot|hell/g) || []).length
        };

        if (input.includes("time")) {
            const timeStr = new Date().getHours() + ":" + new Date().getMinutes();
            response = `It's ${timeStr}. Time for you to realize you're not as safe as you thought.`;
        } else if (input.includes("photo") || input.includes("pic")) {
            response = "I'm right here. Look closer.";
            setTimeout(() => sendPhotoMessage("stalker_id.png"), 3000);
        } else {
            response = "Your words are meaningless. I'm already past the first floor.";
        }
    } else {
        // FAMILY / FRIENDS LOGIC
        if (currentContact === 'mom') {
            response = input.includes("love") ? "I love you too. But please, lock the doors. The news is saying something is out there." : "Are you listening? I have a bad feeling. Check your driveway.";
        } else if (currentContact === 'dad') {
            response = input.includes("help") ? "I'm calling the neighbors. Stand away from the windows. I'm coming home now." : "Don't ignore me. The security alarm just sent a notification. Did you trip it?";
        } else if (currentContact === 'brother') {
            response = "I'm outside your street. Wait... why is there a man in a black hoodie standing near your garage?";
            isCreepy = true;
        } else if (currentContact === 'anu') {
            response = "I just got a weird call from your number... but it wasn't you. It was just heavy breathing. What's going on?";
            isCreepy = true;
        } else {
            response = "I can't talk right now, I'm trying to reach the police for you. They aren't answering.";
        }
    }

    typingIndicator.style.display = 'flex';
    contactStatus.innerText = "Typing...";
    await new Promise(r => setTimeout(r, 2000));
    typingIndicator.style.display = 'none';
    contactStatus.innerText = contacts[currentContact].status;

    receiveMessage(response, 'left', currentContact === 'unknown' || isCreepy);
    
    if (isCreepy) {
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

    // Passport Size Styling
    const img = document.createElement('img');
    img.src = url;
    img.style.width = '120px'; // Passport Width
    img.style.height = '150px'; // Passport Height
    img.style.objectFit = 'cover';
    img.style.borderRadius = '4px'; // Sharper corners for ID feel
    img.style.marginTop = '10px';
    img.style.border = '4px solid white'; // Physical photo border
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

if (sendBtn) {
    sendBtn.addEventListener('click', handleSend);
}

// Creepy Call System
let callTimeout;
let isRinging = false;

function startCreepyCall() {
    const callOverlay = document.getElementById('call-overlay');
    const callStatus = document.getElementById('call-status');
    const bgMusic = document.getElementById('bg-music');
    const ringtone = document.getElementById('ringtone-sound');
    
    callOverlay.style.display = 'flex';
    isRinging = true;

    // Stop background music and start ringtone
    if (bgMusic) bgMusic.pause();
    if (ringtone) {
        ringtone.currentTime = 0;
        ringtone.play().catch(e => console.log("Ringtone blocked, wait for interaction"));
    }

    callStatus.innerText = "INCOMING CALL...";
    callStatus.style.color = "#888";
}

function acceptCall() {
    if (!isRinging) return;
    isRinging = false;
    
    const callStatus = document.getElementById('call-status');
    const ringtone = document.getElementById('ringtone-sound');
    const glitchSound = document.getElementById('glitch-sound');

    // Stop ringtone and start connection
    if (ringtone) ringtone.pause();
    
    callStatus.innerText = "CONNECTED";
    callStatus.style.color = "#4cd964";
    
    // Heavy Static / Glitch
    document.body.classList.add('glitch-active');
    glitchSound.play().catch(e => {});

    // AI VOICEOVER (Creepy Web Speech)
    const msg = new SpeechSynthesisUtterance("Hey man... what is your name?");
    msg.pitch = 0.1; // Deep voice
    msg.rate = 0.7;  // Slow voice
    window.speechSynthesis.speak(msg);
    
    setTimeout(() => {
        callStatus.innerText = "HEY MAN...";
        setTimeout(() => {
            callStatus.innerText = "WHAT IS YOUR NAME?";
        }, 1500);
    }, 1000);
    
    // Auto-end call after voice finish
    setTimeout(() => {
        endCall();
        // Follow up chat message
        setTimeout(() => {
            playAIResponse("I'm waiting for your name. Don't keep me waiting.");
        }, 1000);
    }, 8000);
}

function endCall() {
    const callOverlay = document.getElementById('call-overlay');
    const bgMusic = document.getElementById('bg-music');
    const ringtone = document.getElementById('ringtone-sound');
    
    isRinging = false;
    window.speechSynthesis.cancel(); // Stop talking if ending early
    
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }

    callOverlay.style.display = 'none';
    document.body.classList.remove('glitch-active');
    
    // Resume background music
    if (bgMusic) bgMusic.play().catch(e => {});
    
    // Reset status for next time
    document.getElementById('call-status').innerText = "CALLING...";
    document.getElementById('call-status').style.color = "#888";
}
