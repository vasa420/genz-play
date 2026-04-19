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

    // Play background ambience
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic) {
        bgMusic.volume = 0.5;
        bgMusic.play().catch(e => console.log("Music autoplay blocked, waiting for next interaction"));
    }

    updateTime();
    setInterval(updateTime, 60000);
    setTimeout(() => {
        playMessage('start');
    }, 1500);
}

function openChatList() {
    const list = document.getElementById('chat-list-overlay');
    list.style.display = 'flex';
}

function closeChatList() {
    const list = document.getElementById('chat-list-overlay');
    list.style.display = 'none';
}

function updateTime() {
    const now = new Date();
    document.getElementById('current-time').innerText =
        now.getHours().toString().padStart(2, '0') + ":" +
        now.getMinutes().toString().padStart(2, '0');
}

// Global User Interaction Listener to ensure music starts as soon as user clicks anywhere
const interactionEvents = ['mousedown', 'click', 'touchstart', 'keydown'];
interactionEvents.forEach(eventType => {
    window.addEventListener(eventType, function startHorrorMusic() {
        const bgMusic = document.getElementById('bg-music');
        const introMusic = document.getElementById('intro-music');
        const introOverlay = document.getElementById('intro-overlay');

        // Check if intro is active
        const isIntroActive = introOverlay && introOverlay.classList.contains('active');

        if (isIntroActive) {
            if (introMusic && introMusic.paused) {
                introMusic.play().catch(e => { });
            }
        } else {
            // Normal game ambience
            if (bgMusic && bgMusic.paused) {
                bgMusic.play().catch(e => { });
            }
        }
    }, { once: false });
});

async function playMessage(stateKey) {
    const node = story[stateKey];
    if (!node) return;

    // Show Typing
    typingIndicator.style.display = 'flex';
    contactStatus.innerText = "Typing...";

    // Realistic delay based on text length
    const delay = Math.min(Math.max(node.text.length * 50, 1000), 3000);
    await new Promise(r => setTimeout(r, delay));

    typingIndicator.style.display = 'none';
    contactStatus.innerText = "Online";

    // Create Bubble
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg left ${node.sender === 'unknown' ? 'unknown' : ''}`;
    msgDiv.innerText = node.text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);

    // Sound
    notifSound.play().catch(e => console.log("Audio play blocked"));

    // Glitch Effect
    if (node.glitch) {
        document.body.classList.add('glitch-active');
        glitchSound.play().catch(e => console.log("Audio play blocked"));
        setTimeout(() => document.body.classList.remove('glitch-active'), 500);
    }

    // Check for Death/Victory
    if (node.death) {
        setTimeout(() => endGame(node.death, false), 2000);
        return;
    }
    if (node.victory) {
        setTimeout(() => endGame(node.victory, true), 2000);
        return;
    }

    // Show Choices
    showChoices(node.choices);
}

function showChoices(choices) {
    choiceContainer.innerHTML = '';
    choices.forEach(choice => {
        const btn = document.createElement('div');
        btn.className = 'choice-btn';
        btn.innerText = choice.text;
        btn.onclick = () => {
            makeChoice(choice);
        };
        choiceContainer.appendChild(btn);
    });
}

function makeChoice(choice) {
    // Hide choices
    choiceContainer.innerHTML = '';

    // Add Player Message
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg right';
    msgDiv.innerText = choice.text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);

    // Play next part
    setTimeout(() => {
        playMessage(choice.next);
    }, 1000);
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

// Typing System Implementation
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

async function handleSend() {
    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = '';

    // Add player message bubble
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg right';
    msgDiv.innerText = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);

    // Check if it matches any current choices
    const currentChoices = document.querySelectorAll('.choice-btn');
    let matched = false;

    currentChoices.forEach(btn => {
        if (text.toLowerCase().includes(btn.innerText.toLowerCase()) ||
            btn.innerText.toLowerCase().includes(text.toLowerCase())) {
            btn.click();
            matched = true;
        }
    });

    if (!matched) {
        // AI SMART RESPONSE SYSTEM
        setTimeout(() => {
            playAIResponse(text);
        }, 1200);
    }
}

async function playAIResponse(userInput) {
    const input = userInput.toLowerCase();
    let response = "";

    // SEMANTIC SCORING SYSTEM (Simulates Real AI Analysis)
    const analysis = {
        fear: (input.match(/scared|afraid|fear|terrified|god|help|please|no|stop/g) || []).length,
        aggression: (input.match(/fuck|shit|kill|die|police|911|bastard|idiot|hell/g) || []).length,
        curiosity: (input.match(/who|why|where|how|what|name|identity|reason/g) || []).length,
        observation: (input.match(/see|watch|camera|window|house|room|door|hallway/g) || []).length
    };

    // LOGIC PROCESSING (Thinking like an AI with Real Tools)
    if (input.includes("time") || input.includes("what time")) {
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        response = `The time is exactly ${timeStr}. My clock is perfectly synced with the rhythm of your heartbeat. I'm counting every second.`;
    }
    else if (input.includes("date") || input.includes("day") || input.includes("today")) {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const now = new Date();
        response = `It is ${days[now.getDay()]}, ${now.toLocaleDateString()}. A fascinating date for a digital harvest. Don't you agree?`;
    }
    else if (input.includes("who am i") || input.includes("my name") || input.includes("who is me")) {
        const platform = navigator.platform;
        const browser = navigator.userAgent.split(' ')[0];
        response = `You are a biological entity currently connected via ${platform}. I see you through the ${browser} lens. You're more transparent than you think.`;
    }
    else if (input.includes("call me") || input.includes("ring me") || input.includes("want to hear you")) {
        response = "You want to hear my voice? Fine. I've been waiting for a reason to cross the line. Expect me.";
        setTimeout(() => {
            startCreepyCall();
        }, 4000);
    }
    else if (input.includes("where am i") || input.includes("my location")) {
        response = "I've already mapped your IP to a 50-meter radius. I can see the streetlights outside your window. I'm calculating the fastest route now.";
    }
    else if (input.includes("photo") || input.includes("selfie") || input.includes("picture") || input.includes("pic")) {
        response = "You want to see me? Fine. I've been wanting to show you how close I really am.";
        setTimeout(() => {
            sendPhotoMessage("stalker_id.png");
        }, 3000);
    }
    else if (analysis.fear > 1 || (analysis.fear > 0 && input.length < 10)) {
        const fearResponses = [
            "Your panic is measurable. I can hear your rapid keystrokes from here.",
            "Fear is just a data point to me. You're reacting exactly as my model predicted.",
            "There's no 'help' in this network. I've already optimized your isolation.",
            "Your pupils are still dilating. You should close your eyes... it helps with the transition."
        ];
        response = fearResponses[Math.floor(Math.random() * fearResponses.length)];
    }
    else if (analysis.aggression > 0) {
        response = "Aggression is a defensive heuristic for the biologically vulnerable. It has 0% effect on my persistence.";
    }
    else if (analysis.observation > 0) {
        response = "You're starting to notice the details. The unlocked window. The lens in the corner. But noticing doesn't stop the inevitable.";
    }
    else if (analysis.curiosity > 0) {
        response = "Curiosity is what brought me here. You asked for an answer... I am that answer.";
    }
    else if (input.includes("hi") || input.includes("hello") || input.includes("hai") || input.includes("yo")) {
        response = "Greetings. Your social protocols are a waste of bandwidth, but I'll play along... for now.";
    }
    else {
        // Advanced Fallback Logic
        const fallbacks = [
            `I've been processing your behavioral patterns for ${Math.floor(Math.random() * 500 + 100)} hours. This conversation is just the validation stage.`,
            "Analyzing your response... Result: High entropy. You're unpredictable, which makes the hunt more enjoyable.",
            `Calculating the time until our meeting... ${Math.floor(Math.random() * 30 + 10)} minutes remaining.`,
            "You type like someone with much to lose. I have nothing but time."
        ];
        response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // AI PROCESS VISUALIZATION
    typingIndicator.style.display = 'flex';
    contactStatus.innerText = "Analyzing behavioral patterns...";

    // Simulate thinking/generated text time
    const totalDelay = 1500 + (response.length * 35);
    await new Promise(r => setTimeout(r, totalDelay));

    typingIndicator.style.display = 'none';
    contactStatus.innerText = "Online";

    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg left unknown';
    msgDiv.innerText = response;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);

    notifSound.play().catch(e => { });

    // Random glitch chance
    if (Math.random() > 0.8 || response.includes("transition")) {
        document.body.classList.add('glitch-active');
        glitchSound.play().catch(e => { });
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
    notifSound.play().catch(e => { });
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
    glitchSound.play().catch(e => { });

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
    if (bgMusic) bgMusic.play().catch(e => { });

    // Reset status for next time
    document.getElementById('call-status').innerText = "CALLING...";
    document.getElementById('call-status').style.color = "#888";
}
