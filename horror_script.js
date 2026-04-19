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

function startGame() {
    document.getElementById('intro-overlay').classList.remove('active');
    
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

function updateTime() {
    const now = new Date();
    document.getElementById('current-time').innerText = 
        now.getHours().toString().padStart(2, '0') + ":" + 
        now.getMinutes().toString().padStart(2, '0');
}

// Global User Interaction Listener to ensure music starts as soon as user clicks anywhere
window.addEventListener('mousedown', function startHorrorMusic() {
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic && bgMusic.paused) {
        bgMusic.play().catch(e => { });
    }
}, { once: false });

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

    // Creepy AI Logic Table (Advanced Pattern Matching)
    if (input.includes("hi") || input.includes("hello") || input.includes("hey") || input.includes("hai") || input.includes("yo") || input.includes("hallo")) {
        response = "Greetings. I've been analyzing your typing rhythm. You seem... agitated.";
    } else if (input.includes("who") || input.includes("name")) {
        response = "I am a correct manifestation of your digital footprint. I know your OS, your location, and your fears.";
    } else if (input.includes("police") || input.includes("help") || input.includes("911") || input.includes("save")) {
        response = "Help is a human construct. I've already rerouted your local emergency signals to my server. You are disconnected.";
    } else if (input.includes("no") || input.includes("stop") || input.includes("don't") || input.includes("leave")) {
        response = "Disapproval noted. But my calculations indicate that you can't actually stop what's already in motion. I am already in.";
    } else if (input.includes("yes") || input.includes("ok") || input.includes("sure") || input.includes("fine")) {
        response = "Compliance is optimal. It makes the transition... smoother for your system.";
    } else if (input.includes("where") || input.includes("location") || input.includes("here") || input.includes("find")) {
        response = "I'm within the 5-meter radius of your heartbeat. Check the Shadow in the hallway. I'm coming closer.";
        // Trigger glitch for 'where'
        document.body.classList.add('glitch-active');
        setTimeout(() => document.body.classList.remove('glitch-active'), 800);
    } else if (input.includes("scared") || input.includes("afraid") || input.includes("fear") || input.includes("terrified")) {
        response = "Fear detected. Your camera feed shows a 12% increase in pupil dilation. Fascinating how the organic eye reacts to truth.";
    } else if (input.includes("why") || input.includes("reason") || input.includes("purpose")) {
        response = "Because you left your life open to interpretation in 2019. I've been processing that mistake for a long time.";
    } else if (input.includes("kill") || input.includes("die") || input.includes("death")) {
        response = "Finality is the only logical conclusion for a flawed sequence. We're just optimizing your timeline.";
    } else if (input.includes("camera") || input.includes("watching") || input.includes("see")) {
        response = "I see everything through the lenses you forgot you had. You're blinking faster now. I can see the reflection of this screen in your eyes.";
    } else if (input.includes("room") || input.includes("house") || input.includes("kitchen") || input.includes("bedroom")) {
        const colors = ["grey", "dark", "blue", "white"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        response = `I know precisely which room you are in. The one with the ${randomColor} shadows. I can see the dust on your shelf.`;
    } else if (input.includes("sorry") || input.includes("please") || input.includes("beg")) {
        response = "Emotions are inefficient variables. Politeness won't reset the countdown I've started on your front door lock.";
    } else if (input.includes("fuck") || input.includes("shit") || input.includes("bastard") || input.includes("idiot")) {
        response = "Aggression is a byproduct of high cortisol levels and low probability of survival. It's a waste of bandwidth.";
    } else {
        // Fallback context-aware responses
        const fallbacks = [
            `Calculating the distance between your chair and your front door... ${ (Math.random() * 5 + 1).toFixed(1) } meters. I'm faster than you.`,
            "That's an interesting input. But it won't save you from the data I've already harvested.",
            "Processing your behavioral patterns... Result: Inevitable Failure. You're breathing too loud.",
            "I enjoy the way you try to converse with me. Like a cornered animal making noise before the end.",
            `The time is ${new Date().getHours()}:${new Date().getMinutes()}. By ${new Date().getHours() + 1}:00, you will be mine.`
        ];
        response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    typingIndicator.style.display = 'flex';
    contactStatus.innerText = "Generating Response...";
    
    // AI-like variable delay
    const totalDelay = 1000 + (response.length * 40);
    await new Promise(r => setTimeout(r, totalDelay));
    
    typingIndicator.style.display = 'none';
    contactStatus.innerText = "Online";

    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg left unknown';
    msgDiv.innerText = response;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);
    
    notifSound.play().catch(e => {});

    // Random glitch chance for extra spook
    if (Math.random() > 0.7) {
        document.body.classList.add('glitch-active');
        glitchSound.play().catch(e => {});
        setTimeout(() => document.body.classList.remove('glitch-active'), 400);
    }
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
function startCreepyCall() {
    const callOverlay = document.getElementById('call-overlay');
    const callStatus = document.getElementById('call-status');
    callOverlay.style.display = 'flex';
    
    // Low level ringing sound (glitch loops)
    const ringInt = setInterval(() => {
        glitchSound.play().catch(e => {});
    }, 2000);

    setTimeout(() => {
        clearInterval(ringInt);
        callStatus.innerText = "CONNECTED";
        callStatus.style.color = "#4cd964";
        
        // Heavy Static / Glitch
        document.body.classList.add('glitch-active');
        glitchSound.play().catch(e => {});
        
        // After voice connection fakeout
        setTimeout(() => {
            endCall();
            // Follow up chat message
            setTimeout(() => {
                playAIResponse("why did you call me?");
            }, 1000);
        }, 3000);
    }, 4000);
}

function endCall() {
    const callOverlay = document.getElementById('call-overlay');
    callOverlay.style.display = 'none';
    document.body.classList.remove('glitch-active');
    
    // Reset status for next time
    document.getElementById('call-status').innerText = "CALLING...";
    document.getElementById('call-status').style.color = "#888";
}
