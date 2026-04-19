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
    }
};

let currentGameState = 'start';

function startGame() {
    document.getElementById('intro-overlay').classList.remove('active');
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
