// Audio elements
const notifSound = document.getElementById('notif-sound');
const glitchSound = document.getElementById('glitch-sound');
const bgMusic = document.getElementById('bg-music');
const ringtone = document.getElementById('ringtone-sound');
const creepyImpact = document.getElementById('creepy-impact-sound');
const policeSiren = document.getElementById('police-siren-sound');
const heavyBreathing = document.getElementById('heavy-breathing-sound');
const thunderSound = document.getElementById('thunder-sound');
const musicBox = document.getElementById('mystical-music-box');
const doorBlockSound = document.getElementById('door-block-sound');
const footstepsSound = document.getElementById('footsteps-sound');

// Game state variables
let currentGameState = 'start';
let currentContact = '';
let currentTab = 'recents';
let activeApp = 'home';
let cabinRelays = {
    frontDoor: false, // false = UNLOCKED, true = LOCKED
    backPatio: true,  // starts LOCKED
    shutters: true    // starts CLOSED
};
let powerGrid = {
    mainPower: true,
    fuel: 100
};
let generatorUnlocked = false;
let generatorRebooted = false;
let generatorProgress = 0;
let generatorInterval = null;
let dialedNumber = '';
let isRinging = false;
let pinEntered = '';
const correctPin = '8821';

// Story script data
const contacts = {
    unknown: { name: "Unknown Hacked", avatar: "horror_intro_2.png", status: "Online", unread: false },
    dad: { name: "Dad", avatar: "dad_avatar_1776594470213.png", status: "Driving...", unread: false },
    miller: { name: "Det. Miller", avatar: "sanjay_avatar_1776594526096.png", status: "Online", unread: false },
    rahul: { name: "Rahul (Friend)", avatar: "vicky_avatar_1776594551824.png", status: "Away", unread: false }
};

const chatHistory = {
    unknown: [], dad: [], miller: [], rahul: []
};

// Start system time update
function updateTime() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) timeDisplay.innerText = `${hrs}:${mins}`;
    
    const mockTimeDisplay = document.getElementById('mock-lock-time');
    if (mockTimeDisplay) mockTimeDisplay.innerText = `${hrs}:${mins}`;
    
    const hudTime = document.getElementById('hud-cam-time');
    if (hudTime) hudTime.innerText = `${hrs}:${mins}:${secs}`;
}
setInterval(updateTime, 1000);
updateTime();

// Cinematic Lock Screen Pin State
let mockPinEntered = '';
const correctMockPin = '1031';
let mockCallTimerInterval = null;
let activeCallContact = 'dad';

window.pressMockKey = function(digit) {
    if (mockPinEntered.length < 4) {
        mockPinEntered += digit;
        playBeepSound();
        updateMockDots();
        
        if (mockPinEntered.length === 4) {
            setTimeout(verifyMockPin, 400);
        }
    }
};

window.clearMockKeys = function() {
    mockPinEntered = '';
    updateMockDots();
};

window.backspaceMockKeys = function() {
    mockPinEntered = mockPinEntered.slice(0, -1);
    updateMockDots();
};

function updateMockDots() {
    for (let i = 0; i < 4; i++) {
        const dot = document.getElementById(`mock-dot-${i}`);
        if (dot) {
            dot.className = 'lock-dot';
            if (i < mockPinEntered.length) {
                dot.classList.add('active');
            }
        }
    }
}

function verifyMockPin() {
    if (mockPinEntered === correctMockPin) {
        // Unlock Mock Phone!
        const mockStatus = document.getElementById('mock-lock-status');
        if (mockStatus) {
            mockStatus.innerText = "🔓 UNLOCKED";
            mockStatus.style.color = "#00ff88";
        }
        
        // Play success chime
        if (notifSound) notifSound.play().catch(e => {});
        
        // Glow dots green
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`mock-dot-${i}`);
            if (dot) {
                dot.className = 'lock-dot active';
                dot.style.background = '#00ff88';
                dot.style.borderColor = '#00ff88';
                dot.style.boxShadow = '0 0 10px #00ff88';
            }
        }
        
        setTimeout(() => {
            proceedToGameFromCinematic();
        }, 1000);
    } else {
        // Shakes red on wrong PIN
        const mockStatus = document.getElementById('mock-lock-status');
        if (mockStatus) {
            mockStatus.innerText = "❌ ACCESS DENIED";
            mockStatus.style.color = "#ff3e3e";
        }
        
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`mock-dot-${i}`);
            if (dot) {
                dot.classList.add('error');
            }
        }
        
        if (creepyImpact) creepyImpact.play().catch(e => {});
        
        setTimeout(() => {
            mockPinEntered = '';
            if (mockStatus) {
                mockStatus.innerText = "🔒 ENTER PASSCODE";
                mockStatus.style.color = "#ff3e3e";
            }
            updateMockDots();
        }, 1200);
    }
}

// Cinematic Call actions
// Cinematic Call actions
window.declineCinematicCall = function() {
    playBeepSound();
    
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    
    if (activeCallContact === 'mom') {
        // Hide caller screen entirely
        document.getElementById('mock-caller-screen-ui').style.display = 'none';
        
        // Trigger Dad's message 2.5 seconds later
        setTimeout(() => {
            receiveChatMessage('dad', "Priya, are you at the cabin yet? Lock the front doors now! The storm is getting severe.");
            showNotification("Dad", "Priya, are you at the cabin yet? Lock the front doors now!");
        }, 2500);
    } else {
        // Hide call controls and show passcode input UI instead
        document.getElementById('mock-call-actions-ui').style.display = 'none';
        document.getElementById('mock-lock-screen-ui').style.display = 'flex';
    }
};

function speakCustomVoice(text, isMale) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    if (isMale) {
        const maleVoice = voices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('google uk english male') || v.name.toLowerCase().includes('david'));
        if (maleVoice) {
            utterance.voice = maleVoice;
        } else {
            utterance.pitch = 0.85; // Lower pitch to sound masculine
        }
        utterance.rate = 0.95;
    } else {
        const femaleVoice = voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('google us english'));
        if (femaleVoice) {
            utterance.voice = femaleVoice;
        } else {
            utterance.pitch = 1.25; // Higher pitch for female voice
        }
        utterance.rate = 1.05;
    }
    return utterance;
}

window.acceptCinematicCall = function() {
    playBeepSound();
    
    // Stop the caller screen ringtone
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    
    // Switch mock UI to connected
    document.getElementById('mock-call-actions-ui').style.display = 'none';
    document.getElementById('mock-connecting-ui').style.display = 'flex';
    document.getElementById('mock-reply-suggestion').style.display = 'none';
    
    let seconds = 0;
    const timerDisplay = document.getElementById('mock-call-timer');
    const connectStatusText = document.getElementById('mock-connect-status');
    connectStatusText.innerText = "Connected";
    
    // Start ticking call timer
    mockCallTimerInterval = setInterval(() => {
        seconds++;
        const minsStr = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secsStr = String(seconds % 60).padStart(2, '0');
        if (timerDisplay) timerDisplay.innerText = `${minsStr}:${secsStr}`;
    }, 1000);
    
    // Dynamic logic based on who is calling
    if (activeCallContact === 'mom') {
        // Mom's call
        setTimeout(() => {
            const momText = "Hey Priya, I will come soon, you go and eat first.";
            const momUtterance = speakCustomVoice(momText, false); // female voice
            window.activeUtterance = momUtterance; // Prevent GC
            
            let voiceFired = false;
            momUtterance.onend = function() {
                if (voiceFired) return;
                voiceFired = true;
                const replyBtn = document.getElementById('mock-reply-suggestion');
                const replySpan = replyBtn ? replyBtn.querySelector('span') : null;
                if (replyBtn && replySpan) {
                    replySpan.innerText = "💬 Say: \"Ok Mom\"";
                    replyBtn.style.display = 'block';
                }
            };
            
            // Fallback for voice end
            setTimeout(() => {
                if (!voiceFired) {
                    momUtterance.onend();
                }
            }, 5000);
            
            window.speechSynthesis.speak(momUtterance);
        }, 1000);
    } else {
        // Dad's call
        setTimeout(() => {
            const dadText = "Hey Priya, please be safe, lock all the doors, I will be there soon.";
            const dadUtterance = speakCustomVoice(dadText, true); // male voice
            window.activeUtterance = dadUtterance; // Prevent GC
            
            let voiceFired = false;
            dadUtterance.onend = function() {
                if (voiceFired) return;
                voiceFired = true;
                const replyBtn = document.getElementById('mock-reply-suggestion');
                const replySpan = replyBtn ? replyBtn.querySelector('span') : null;
                if (replyBtn && replySpan) {
                    replySpan.innerText = "💬 Say: \"Ok Dad, come fast\"";
                    replyBtn.style.display = 'block';
                }
            };
            
            // Fallback
            setTimeout(() => {
                if (!voiceFired) {
                    dadUtterance.onend();
                }
            }, 5000);
            
            window.speechSynthesis.speak(dadUtterance);
        }, 1000);
    }
};

window.triggerPlayerSpeechReply = function() {
    // Hide the reply suggestion button once clicked
    const replyBtn = document.getElementById('mock-reply-suggestion');
    if (replyBtn) replyBtn.style.display = 'none';
    
    if (activeCallContact === 'mom') {
        const replyText = "Ok Mom";
        const priyaUtterance = speakCustomVoice(replyText, false);
        window.activeUtterance = priyaUtterance; // Prevent GC
        
        let voiceFired = false;
        priyaUtterance.onend = function() {
            if (voiceFired) return;
            voiceFired = true;
            cutMockCall();
        };
        
        // Fallback
        setTimeout(() => {
            if (!voiceFired) {
                priyaUtterance.onend();
            }
        }, 3000);
        
        window.speechSynthesis.speak(priyaUtterance);
    } else {
        const replyText = "Ok Dad, come fast";
        const priyaUtterance = speakCustomVoice(replyText, false);
        window.activeUtterance = priyaUtterance; // Prevent GC
        
        let voiceFired = false;
        priyaUtterance.onend = function() {
            if (voiceFired) return;
            voiceFired = true;
            cutMockCall();
        };
        
        // Fallback
        setTimeout(() => {
            if (!voiceFired) {
                priyaUtterance.onend();
            }
        }, 3000);
        
        window.speechSynthesis.speak(priyaUtterance);
    }
};

function cutMockCall() {
    playBeepSound();
    
    const connectStatusText = document.getElementById('mock-connect-status');
    if (connectStatusText) connectStatusText.innerText = "Call Ended";
    
    setTimeout(() => {
        clearInterval(mockCallTimerInterval);
        
        // Hide connecting UI
        const connectingUI = document.getElementById('mock-connecting-ui');
        if (connectingUI) connectingUI.style.display = 'none';
        
        // Hide caller screen UI housing the lock screen
        const callerUI = document.getElementById('mock-caller-screen-ui');
        if (callerUI) callerUI.style.display = 'none';
        
        if (activeCallContact === 'mom') {
            // Suggest she goes and eats now
            setTimeout(() => {
                const banner = document.getElementById('narrative-suggestion-banner');
                const text = document.getElementById('narrative-suggestion-text');
                if (banner && text) {
                    text.innerText = "💬 I was hungry, I want to eat now";
                    banner.style.display = 'block';
                    banner.onclick = window.triggerEnterKitchen;
                }
            }, 2000);
        } else {
            // Keep phone on lock screen passcode input UI for Dad's call
            if (callerUI) callerUI.style.display = 'flex';
            document.getElementById('mock-call-actions-ui').style.display = 'none';
            document.getElementById('mock-lock-screen-ui').style.display = 'flex';
        }
    }, 1200);
}

function proceedToGameFromCinematic() {
    // Hide the mock phone lock/caller/connecting screens
    const lockScreen = document.getElementById('mock-lock-screen-ui');
    if (lockScreen) lockScreen.style.display = 'none';
    const callerScreen = document.getElementById('mock-caller-screen-ui');
    if (callerScreen) callerScreen.style.display = 'none';
    const connectingScreen = document.getElementById('mock-connecting-ui');
    if (connectingScreen) connectingScreen.style.display = 'none';
    
    // Cancel any active TTS speech
    window.speechSynthesis.cancel();
    
    // Stop loop if they accepted or bypassed call
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    
    startGame();
}

// Show warning screen & start cinematic bedroom door entry / desk zoom sequence
window.showWarning = function() {
    requestFullScreen();
    document.getElementById('intro-overlay').style.display = 'none';
    
    // Completely terminate and remove the background video to prevent audio leakage
    const introVideo = document.getElementById('intro-video-bg');
    if (introVideo) {
        introVideo.pause();
        introVideo.muted = true;
        introVideo.src = "";
        try {
            introVideo.load();
        } catch(e) {}
        introVideo.remove();
    }
    
    // Play storm rain sound immediately
    if (thunderSound) {
        thunderSound.volume = 0.3;
        thunderSound.loop = true;
        thunderSound.play().catch(e => console.log("Storm sound waiting for interaction"));
    }
    
    // Activate cinematic intro layout
    const cinematicContainer = document.getElementById('cinematic-intro-container');
    cinematicContainer.classList.add('active');
    cinematicContainer.style.opacity = '1';
    
    const doorStage = document.getElementById('cinematic-door-stage');
    const doorFrame = doorStage ? doorStage.querySelector('.door-frame') : null;
    const doorLeaf = document.getElementById('door-leaf');
    
    // Phase 1: Start walking slowly towards the bedroom door down the hallway
    setTimeout(() => {
        if (doorStage) doorStage.classList.add('walk-to-door');
        if (doorFrame) doorFrame.classList.add('bobbing'); // head-bob footfalls sway
        if (footstepsSound) {
            footstepsSound.volume = 0.5;
            footstepsSound.play().catch(e => {});
        }
    }, 100);
    
    // Phase 2: Arrive at door at 4.0 seconds, stop walking, and open the bedroom door
    setTimeout(() => {
        if (doorFrame) doorFrame.classList.remove('bobbing'); // stand still
        if (doorLeaf) doorLeaf.classList.add('open');
        if (footstepsSound) {
            footstepsSound.pause();
            footstepsSound.currentTime = 0;
        }
        
        // Play door squeak/creepy audio
        if (creepyImpact) {
            creepyImpact.volume = 0.4;
            creepyImpact.play().catch(e => {});
        }
        
        // Phase 3: Walk through the open bedroom door at 6.0 seconds
        setTimeout(() => {
            if (doorStage) doorStage.classList.add('zoomed-through');
            if (doorFrame) doorFrame.classList.add('bobbing'); // start bobbing again as we step through
            if (footstepsSound) {
                footstepsSound.volume = 0.5;
                footstepsSound.play().catch(e => {});
            }
            
            const roomStage = document.getElementById('cinematic-room-stage');
            if (roomStage) roomStage.classList.add('active');
            
            // Start phone ringtone audio
            if (ringtone) {
                ringtone.volume = 0.6;
                ringtone.loop = true;
                ringtone.play().catch(e => {});
            }
            
            // Camera slow zooms in on the desk
            setTimeout(() => {
                roomStage.classList.add('zoomed-in');
            }, 100);
            
            // Phase 4: Settle camera zoom on phone at 10.5 seconds and display Dad call screen
            setTimeout(() => {
                if (doorFrame) doorFrame.classList.remove('bobbing');
                if (footstepsSound) {
                    footstepsSound.pause();
                    footstepsSound.currentTime = 0;
                }
                
                const phoneScreen = document.getElementById('mock-phone-screen');
                if (phoneScreen) phoneScreen.classList.remove('ring-glow'); // settle screen display
                
                const callerUI = document.getElementById('mock-caller-screen-ui');
                if (callerUI) callerUI.style.display = 'flex';
                
                const callActionsUI = document.getElementById('mock-call-actions-ui');
                if (callActionsUI) callActionsUI.style.display = 'flex';
            }, 4500);
            
        }, 2000); // 2 seconds for door swing to reveal bedroom
        
    }, 4100); // Walk down hallway duration
};

// Start game sequence
function startGame() {
    console.log("Game started.");
    
    // Background ambient music from Part 1 is disabled to prevent mingling

    
    // Switch to Home screen
    openHome();

    // Play door blocking/opening sound after 4 seconds
    setTimeout(() => {
        if (doorBlockSound) {
            doorBlockSound.volume = 0.8;
            doorBlockSound.play().catch(e => console.log("Door block sound blocked:", e));
        }

        // Trigger sudden lightning flash
        const flash = document.createElement('div');
        flash.className = 'sudden-lightning-active';
        const container = document.getElementById('cinematic-intro-container');
        if (container) {
            container.appendChild(flash);
            setTimeout(() => flash.remove(), 1200);
        }

        // Trigger thunder sound
        if (thunderSound) {
            thunderSound.volume = 1.0;
            thunderSound.play().catch(e => {});
        }

        // Show suggestion after 1.5 seconds from sound start
        setTimeout(() => {
            const banner = document.getElementById('narrative-suggestion-banner');
            const text = document.getElementById('narrative-suggestion-text');
            if (banner && text) {
                banner.style.display = 'block';
                text.innerText = "💬 Who's that was opening the door?";
                banner.onclick = window.triggerWhoIsOpenDoorSuggestion;
            }
        }, 1500);
    }, 4000);
}

// Fullscreen API helper
function requestFullScreen() {
    const docEl = document.documentElement;
    const requestFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    if (requestFS) {
        requestFS.call(docEl).catch(err => {
            console.log(`Fullscreen error: ${err.message}`);
        });
    }
}

// App routing logic
function openHome() {
    hideAllAppOverlays();
    activeApp = 'home';
    document.getElementById('home-screen').style.display = 'block';
}

function openSmartCabin() {
    hideAllAppOverlays();
    activeApp = 'smart-cabin';
    document.getElementById('smart-cabin-overlay').style.display = 'flex';
    document.getElementById('cabin-alert-dot').style.display = 'none';
    updateSmartCabinUI();
}

function openMessagesList() {
    hideAllAppOverlays();
    activeApp = 'messages-list';
    document.getElementById('messages-list-overlay').style.display = 'flex';
    document.getElementById('msg-notif-dot').style.display = 'none';
    contacts.unknown.unread = false; // Reset unread marker on view
    renderChatList();
}

function openCCTV() {
    hideAllAppOverlays();
    activeApp = 'cctv';
    document.getElementById('cctv-overlay').style.display = 'flex';
    switchCCTV(1); // Default to CAM 1
}

function openPhoneDialer() {
    hideAllAppOverlays();
    activeApp = 'phone';
    document.getElementById('phone-app-overlay').style.display = 'flex';
    switchPhoneTab('recents');
}

function hideAllAppOverlays() {
    const overlays = [
        'home-screen',
        'smart-cabin-overlay',
        'messages-list-overlay',
        'chat-active-overlay',
        'cctv-overlay',
        'phone-app-overlay',
        'call-overlay'
    ];
    overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// --- Smart Cabin App controls ---
function updateSmartCabinUI() {
    // Relays
    const frontStatus = document.getElementById('front-door-status');
    const frontBtn = document.getElementById('front-door-btn');
    const frontCard = document.getElementById('front-door-card');
    
    if (cabinRelays.frontDoor) {
        frontStatus.innerText = "LOCKED";
        frontStatus.className = "relay-status locked";
        frontBtn.innerText = "UNLOCK";
        frontBtn.className = "lock-toggle-btn";
        frontCard.style.borderColor = "var(--glass-border)";
    } else {
        frontStatus.innerText = "UNLOCKED";
        frontStatus.className = "relay-status unlocked";
        frontBtn.innerText = "LOCK";
        frontBtn.className = "lock-toggle-btn unlock-mode";
        // If system is in alert phase, glow red
        if (currentGameState === 'alert_front_unlocked') {
            frontCard.style.borderColor = "var(--acc-red)";
        }
    }

    const backStatus = document.getElementById('back-patio-status');
    const backBtn = document.getElementById('back-patio-btn');
    const backCard = document.getElementById('back-patio-card');
    
    if (cabinRelays.backPatio) {
        backStatus.innerText = "LOCKED";
        backStatus.className = "relay-status locked";
        backBtn.innerText = "UNLOCK";
        backBtn.className = "lock-toggle-btn";
        backCard.style.borderColor = "var(--glass-border)";
    } else {
        backStatus.innerText = "UNLOCKED";
        backStatus.className = "relay-status unlocked";
        backBtn.innerText = "LOCK";
        backBtn.className = "lock-toggle-btn unlock-mode";
        if (currentGameState === 'alert_back_unlocked') {
            backCard.style.borderColor = "var(--acc-red)";
        }
    }

    const shutterStatus = document.getElementById('shutters-status');
    const shutterBtn = document.getElementById('shutters-btn');
    if (cabinRelays.shutters) {
        shutterStatus.innerText = "CLOSED";
        shutterStatus.className = "relay-status locked";
        shutterBtn.innerText = "OPEN";
    } else {
        shutterStatus.innerText = "OPEN";
        shutterStatus.className = "relay-status unlocked";
        shutterBtn.innerText = "CLOSE";
    }

    // Power UI
    const powerStatus = document.getElementById('main-power-status');
    const fuelText = document.getElementById('gen-fuel-pct');
    const fuelFill = document.getElementById('fuel-progress');
    
    if (powerGrid.mainPower) {
        powerStatus.innerText = "ONLINE";
        powerStatus.className = "utility-val active";
        fuelText.innerText = "STANDBY";
        fuelText.className = "utility-val";
        fuelFill.style.width = '100%';
        fuelFill.style.background = 'var(--acc-green)';
    } else {
        powerStatus.innerText = "SEVERED";
        powerStatus.className = "utility-val offline";
        
        fuelText.innerText = `${Math.floor(powerGrid.fuel)}%`;
        fuelFill.style.width = `${powerGrid.fuel}%`;
        
        if (powerGrid.fuel < 20) {
            fuelText.className = "utility-val offline";
            fuelFill.style.background = 'var(--acc-red)';
        } else {
            fuelText.className = "utility-val warning";
            fuelFill.style.background = 'var(--acc-orange)';
        }
    }

    // Panic button
    const panicBtn = document.getElementById('panic-btn');
    if (generatorRebooted) {
        panicBtn.classList.remove('disabled');
        panicBtn.disabled = false;
        document.querySelector('.panic-warning').innerText = "SYSTEM ACTIVE. Ready to broadcast audio warning siren.";
        document.querySelector('.panic-warning').style.color = "var(--acc-green)";
    } else {
        panicBtn.classList.add('disabled');
        panicBtn.disabled = true;
    }
}

window.toggleFrontDoor = function() {
    cabinRelays.frontDoor = !cabinRelays.frontDoor;
    playBeepSound();
    updateSmartCabinUI();
    
    // Check if player resolves the alert
    if (currentGameState === 'alert_front_unlocked' && cabinRelays.frontDoor) {
        clearAlertTimeout();
        currentGameState = 'front_locked_success';
        console.log("Front door locked successfully.");
        
        // Trigger hacker chat sequence
        setTimeout(() => {
            receiveChatMessage('unknown', "Fast fingers. Let's see how fast you are in the dark.");
            showNotification("Unknown Hacked", "Fast fingers. Let's see how fast you are in the dark.");
            // Trigger blackout shortly after
            setTimeout(triggerBlackout, 6000);
        }, 3000);
    }
};

window.toggleBackPatio = function() {
    cabinRelays.backPatio = !cabinRelays.backPatio;
    playBeepSound();
    updateSmartCabinUI();

    // Check if player resolves back door alert
    if (currentGameState === 'alert_back_unlocked' && cabinRelays.backPatio) {
        clearAlertTimeout();
        currentGameState = 'back_locked_success';
        console.log("Back patio locked successfully during alert.");
        
        // Let the reboot process finish
        setTimeout(() => {
            if (generatorRebooted) {
                // Intruder prepares to smash patio glass
                triggerIntruderSmashGlass();
            }
        }, 2000);
    }
};

window.toggleShutters = function() {
    cabinRelays.shutters = !cabinRelays.shutters;
    playBeepSound();
    updateSmartCabinUI();
};

// --- CCTV Cameras App logic ---
let currentCCTVId = 1;
window.switchCCTV = function(id) {
    currentCCTVId = id;
    const hudNum = document.getElementById('hud-cam-num');
    const hudName = document.getElementById('hud-cam-name');
    const feedImg = document.getElementById('cctv-feed-img');
    const feedVideo = document.getElementById('cctv-feed-video');
    const lockScreen = document.getElementById('cam-lock-screen');
    const rebootScreen = document.getElementById('generator-reboot-screen');
    
    // Update button states
    document.querySelectorAll('.cctv-btn').forEach((btn, idx) => {
        if (idx + 1 === id) {
            btn.classList.add('active-cctv');
        } else {
            btn.classList.remove('active-cctv');
        }
    });

    // Camera glitch effect
    const staticOverlay = document.getElementById('cctv-glitch');
    staticOverlay.style.opacity = '0.9';
    if (glitchSound) glitchSound.play().catch(e => {});

    setTimeout(() => {
        staticOverlay.style.opacity = '0';
        hudNum.innerText = id;
        
        // Reset view visibility
        feedImg.style.display = 'block';
        feedVideo.style.display = 'none';
        lockScreen.style.display = 'none';
        rebootScreen.style.display = 'none';

        if (id === 1) {
            hudName.innerText = "FRONT ENTRY PORCH";
            // If in phase 2, show the creepy visitor shadow
            if (currentGameState !== 'start') {
                feedImg.src = "horror_intro_2.png"; // Shadowy visitor image
                feedImg.style.filter = "brightness(0.4) contrast(1.4) sepia(0.2) hue-rotate(330deg)";
            } else {
                feedImg.src = "horror_intro_2.png"; // Normal cabin storm
                feedImg.style.filter = "brightness(0.6) contrast(1.1) grayscale(0.2)";
            }
        } 
        else if (id === 2) {
            hudName.innerText = "BACK DECK PATIO";
            // If siren active, play the stranger video fleeing
            if (currentGameState === 'siren_active') {
                feedImg.style.display = 'none';
                feedVideo.style.display = 'block';
                feedVideo.play().catch(e => {});
            } else {
                feedImg.src = "horror_intro_2.png"; // Sliding glass door view
                feedImg.style.filter = "brightness(0.4) contrast(1.2) grayscale(0.5)";
            }
        } 
        else if (id === 3) {
            hudName.innerText = "LIVING ROOM INNER";
            feedImg.src = "horror_intro_2.png"; // Inner cabin view
            // If shutters closed, make it green night vision
            if (cabinRelays.shutters) {
                feedImg.style.filter = "brightness(0.3) contrast(1.2) sepia(1) hue-rotate(90deg)";
            } else {
                feedImg.style.filter = "brightness(0.5) contrast(1.1) grayscale(0.2)";
            }
        } 
        else if (id === 4) {
            hudName.innerText = "GENERATOR SECURITY UNIT";
            if (!generatorUnlocked) {
                // Show PIN entry layout
                lockScreen.style.display = 'flex';
                feedImg.style.display = 'none';
                updatePinDisplay();
            } else {
                // Show Reboot utility controls
                rebootScreen.style.display = 'flex';
                feedImg.style.display = 'none';
            }
        }
    }, 400);
};

// PIN entry controls for CAM 4
window.enterPinDigit = function(n) {
    if (pinEntered.length < 4) {
        pinEntered += n;
        playBeepSound();
        updatePinDisplay();
        
        if (pinEntered.length === 4) {
            setTimeout(verifyPin, 400);
        }
    }
};

window.clearPin = function() {
    pinEntered = '';
    updatePinDisplay();
};

window.backspacePin = function() {
    pinEntered = pinEntered.slice(0, -1);
    updatePinDisplay();
};

function updatePinDisplay() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
        dot.className = 'pin-dot';
        if (i < pinEntered.length) {
            dot.classList.add('active');
        }
    });
}

function verifyPin() {
    if (pinEntered === correctPin) {
        generatorUnlocked = true;
        playBeepSound();
        switchCCTV(4); // reload to show reboot panel
    } else {
        const dots = document.querySelectorAll('.pin-dot');
        dots.forEach(dot => {
            dot.classList.add('error');
        });
        document.querySelector('.lock-error-text').innerText = "ACCESS DENIED - RETRY";
        document.querySelector('.lock-error-text').style.color = "var(--acc-red)";
        
        if (creepyImpact) creepyImpact.play().catch(e => {});

        setTimeout(() => {
            pinEntered = '';
            document.querySelector('.lock-error-text').innerText = "ENTER SECURITY PIN CODE";
            document.querySelector('.lock-error-text').style.color = "#8e8e93";
            updatePinDisplay();
        }, 1200);
    }
}

// Backup Generator Reboot controls
window.startGeneratorReboot = function() {
    const btn = document.getElementById('reboot-action-btn');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    
    const statusText = document.getElementById('reboot-status-text');
    statusText.innerText = "INITIATING SYSTEM REBOOT...";
    statusText.style.color = "var(--acc-orange)";
    
    generatorProgress = 0;
    generatorInterval = setInterval(() => {
        generatorProgress += 4;
        document.getElementById('reboot-progress-fill').style.width = `${generatorProgress}%`;
        
        // Trigger stalker call mid-reboot (around 40%)
        if (generatorProgress === 40) {
            triggerCreepyClimaxCall();
        }

        if (generatorProgress >= 100) {
            clearInterval(generatorInterval);
            finishGeneratorReboot();
        }
    }, 300);
};

function finishGeneratorReboot() {
    generatorRebooted = true;
    powerGrid.mainPower = false; // still severed grid, but generator is actively backing up
    powerGrid.fuel = 100;
    
    const statusText = document.getElementById('reboot-status-text');
    statusText.innerText = "GENERATOR ONLINE - EMERGENCY SIREN ARMED";
    statusText.style.color = "var(--acc-green)";
    
    updateSmartCabinUI();
    
    // Check if patio door is also secured, otherwise wait for player to secure it
    setTimeout(() => {
        if (cabinRelays.backPatio) {
            triggerIntruderSmashGlass();
        }
    }, 2000);
}

// --- Messages / Chat application logic ---
function renderChatList() {
    const container = document.getElementById('chat-list-items');
    container.innerHTML = '';

    Object.keys(contacts).forEach(key => {
        const contact = contacts[key];
        const lastMsg = chatHistory[key].length > 0
            ? chatHistory[key][chatHistory[key].length - 1].text
            : "Tap to initiate secure connection.";
            
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => openActiveChat(key);
        
        div.innerHTML = `
            <div class="chat-avatar" style="background: url('${contact.avatar}') center/cover;"></div>
            <div class="chat-info">
                <div style="display: flex; justify-content: space-between;">
                    <h3>${contact.name}</h3>
                    <span style="font-size: 10px; color: #666;">Now</span>
                </div>
                <p>${lastMsg}</p>
            </div>
            ${contact.unread ? '<div class="unread-dot"></div>' : ''}
        `;
        container.appendChild(div);
    });
}

function openActiveChat(key) {
    hideAllAppOverlays();
    currentContact = key;
    activeApp = 'active-chat';
    
    const contact = contacts[key];
    document.getElementById('contact-name').innerText = contact.name;
    document.getElementById('contact-avatar').style.backgroundImage = `url('${contact.avatar}')`;
    document.getElementById('contact-status').innerText = contact.status;
    
    // Unmark unread status
    contact.unread = false;

    // Clear and reload messages
    const chatBody = document.getElementById('chat-body');
    chatBody.innerHTML = '';
    
    chatHistory[key].forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = msg.className;
        msgDiv.innerText = msg.text;
        chatBody.appendChild(msgDiv);
    });
    
    document.getElementById('chat-active-overlay').style.display = 'flex';
    chatBody.scrollTo(0, chatBody.scrollHeight);
    
    // Load dialogue choices for this segment
    loadChatChoices();
}

function receiveChatMessage(senderKey, text, isScary = false) {
    // Add to logs
    const className = `msg left ${senderKey === 'unknown' || isScary ? 'unknown' : ''}`;
    chatHistory[senderKey].push({ text, className });
    
    if (notifSound) notifSound.play().catch(e => {});

    // If active app is the current chat screen, display bubble in real time
    if (activeApp === 'active-chat' && currentContact === senderKey) {
        const chatBody = document.getElementById('chat-body');
        const msgDiv = document.createElement('div');
        msgDiv.className = className;
        msgDiv.innerText = text;
        chatBody.appendChild(msgDiv);
        chatBody.scrollTo(0, chatBody.scrollHeight);
        loadChatChoices();
    } else {
        // Mark contact as unread
        contacts[senderKey].unread = true;
        document.getElementById('msg-notif-dot').style.display = 'flex';
    }
}

function sendPlayerMessage(text) {
    chatHistory[currentContact].push({ text, className: "msg right" });
    
    const chatBody = document.getElementById('chat-body');
    const msgDiv = document.createElement('div');
    msgDiv.className = "msg right";
    msgDiv.innerText = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTo(0, chatBody.scrollHeight);
    
    // Clear choices during response wait
    document.getElementById('choice-container').innerHTML = '';
}

// Dialogue mapping and chat choice prompts
function loadChatChoices() {
    const container = document.getElementById('choice-container');
    container.innerHTML = '';
    
    let options = [];
    
    if (currentContact === 'dad') {
        const lastDadMsg = chatHistory.dad[chatHistory.dad.length - 1]?.text || '';
        
        if (lastDadMsg.includes("Lock the front doors")) {
            options = [
                { text: "I'm locking it right now.", action: () => replyToDad("I'm locking it right now.", "Good. The SmartCabin controls are on your phone dashboard.") },
                { text: "Is it really that bad?", action: () => replyToDad("Is it really that bad?", "Yes, the winds are strong enough to throw tree branches. Get inside and lock up.") }
            ];
        } else if (lastDadMsg.includes("SmartCabin controls") || lastDadMsg.includes("branches")) {
            options = [
                { text: "Okay, checking the app now.", action: () => {
                    sendPlayerMessage("Okay, checking the app now.");
                    // Open SmartCabin notification alert dot on home screen
                    document.getElementById('cabin-alert-dot').style.display = 'flex';
                }}
            ];
        } else if (lastDadMsg.includes("What is the reboot PIN")) {
            options = [
                { text: "Dad, please! The power went out!", action: () => replyToDad("Dad! The power is cut! What is the reboot PIN for CAM 4?!", "Oh god, Priya! The reboot PIN is 8821! Go to CCTV, open CAM 4, enter the code and reboot it! It will lock the relays physically!") }
            ];
        }
    } 
    else if (currentContact === 'unknown') {
        const lastUnknownMsg = chatHistory.unknown[chatHistory.unknown.length - 1]?.text || '';
        
        if (lastUnknownMsg.includes("Locked in? Cute.")) {
            options = [
                { text: "Who is this?!", action: () => replyToUnknown("Who is this?!", "You think a smart lock can keep me out? I'm already looking at you.") },
                { text: "Leave me alone!", action: () => replyToUnknown("Leave me alone!", "You shouldn't shout. It makes your heart rate go up. Check CCTV Cam 1. I left a mark.") }
            ];
        } else if (lastUnknownMsg.includes("looking at you") || lastUnknownMsg.includes("CCTV Cam 1")) {
            options = [
                { text: "I'm calling the police.", action: () => replyToUnknown("I'm calling the police.", "Lines are blocked, Priya. Go look at CAM 1. I want you to see me.") }
            ];
        }
    }
    else if (currentContact === 'miller') {
        const lastMillerMsg = chatHistory.miller[chatHistory.miller.length - 1]?.text || '';
        
        if (lastMillerMsg.includes("Do you have a backup generator")) {
            options = [
                { text: "Yes, but I don't know the code!", action: () => replyToMiller("Yes, but I don't know the code!", "Ask your Dad. He must have set a safety pin. Find it immediately. The suspect is hacking your relays!") },
                { text: "What do I do?!", action: () => replyToMiller("What do I do?!", "Find the generator PIN. Your father should have it. Enter it in CAM 4. I am dispatching help but trees are blocking the pass!") }
            ];
        }
    }

    options.forEach(opt => {
        const btn = document.createElement('div');
        btn.className = 'choice-btn';
        btn.innerText = opt.text;
        btn.onclick = opt.action;
        container.appendChild(btn);
    });
}

function replyToDad(playerText, replyText) {
    sendPlayerMessage(playerText);
    showTypingIndicator(true);
    setTimeout(() => {
        showTypingIndicator(false);
        receiveChatMessage('dad', replyText);
    }, 1500);
}

function replyToUnknown(playerText, replyText) {
    sendPlayerMessage(playerText);
    showTypingIndicator(true);
    setTimeout(() => {
        showTypingIndicator(false);
        receiveChatMessage('unknown', replyText, true);
        
        if (replyText.includes("Check CCTV Cam 1")) {
            // Trigger scary visitor on porch
            setTimeout(triggerCreepyVisitorOnPorch, 2000);
        }
    }, 2000);
}

function replyToMiller(playerText, replyText) {
    sendPlayerMessage(playerText);
    showTypingIndicator(true);
    setTimeout(() => {
        showTypingIndicator(false);
        receiveChatMessage('miller', replyText);
    }, 1500);
}

function showTypingIndicator(show) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.style.display = show ? 'flex' : 'none';
}

// --- Creepy Stage triggers ---

let alertTimeout = null;

function clearAlertTimeout() {
    if (alertTimeout) {
        clearTimeout(alertTimeout);
        alertTimeout = null;
    }
}

// Step 2 Climax: Shadow on porch & door remotely unlocked
function triggerCreepyVisitorOnPorch() {
    console.log("Visitor triggered on porch.");
    currentGameState = 'creepy_visitor';
    
    // Play scary bang sound
    if (creepyImpact) creepyImpact.play().catch(e => {});
    
    // Unlock front door remotely
    setTimeout(() => {
        cabinRelays.frontDoor = false; // UNLOCKED
        updateSmartCabinUI();
        
        // Show flashing notification banner
        showNotification("SmartCabin System", "Relay Breach: FRONT ENTRY DOOR UNLOCKED REMOTELY!", true);
        document.getElementById('cabin-alert-dot').style.display = 'flex';
        
        currentGameState = 'alert_front_unlocked';
        
        // Start 7.5 second timeout countdown for player to lock the door
        alertTimeout = setTimeout(() => {
            triggerStalkerBreakInDeath("The front door remained unlocked. He didn't have to break the glass.");
        }, 7500);
    }, 2500);
}

// Step 3 Climax: Blackout
function triggerBlackout() {
    console.log("Blackout triggered.");
    currentGameState = 'blackout';
    
    // Play thunder sound
    if (thunderSound) {
        thunderSound.volume = 1.0;
        thunderSound.play().catch(e => {});
    }
    
    // Vibrate/glitch screen
    document.body.classList.add('glitch-active');
    if (glitchSound) glitchSound.play().catch(e => {});
    setTimeout(() => document.body.classList.remove('glitch-active'), 800);
    
    // Cut main power, fuel at 25% and draining
    powerGrid.mainPower = false;
    powerGrid.fuel = 20;
    updateSmartCabinUI();
    
    // Drain battery percentage in status bar
    document.getElementById('battery-pct').innerText = "🪫 2%";
    document.getElementById('battery-pct').classList.add('pulsing');
    
    // Unknown sends thread details
    receiveChatMessage('unknown', "The power is cut. Your smart locks will fail when the backup battery drains in 3 minutes. And then, the door opens.");
    
    // Miller contacts you
    setTimeout(() => {
        receiveChatMessage('miller', "Priya! The suspect has cut your power lines. Do you have a backup generator?");
        showNotification("Det. Miller", "Priya! The suspect has cut your power lines.");
    }, 4000);
}

// Step 4 Climax: Creepy call during generator reboot
function triggerCreepyClimaxCall() {
    console.log("Creepy call triggered mid-reboot.");
    
    // Trigger incoming phone call overlay
    isRinging = true;
    currentContact = 'unknown';
    
    const callOverlay = document.getElementById('call-overlay');
    const callStatus = document.getElementById('call-status');
    const callName = document.getElementById('call-name');
    const callAvatar = document.getElementById('call-avatar');
    
    callName.innerText = "Unknown Hacked";
    callAvatar.style.backgroundImage = "url('horror_intro_2.png')";
    callAvatar.innerText = "";
    
    if (bgMusic) bgMusic.pause();
    if (ringtone) {
        ringtone.currentTime = 0;
        ringtone.play().catch(e => {});
    }
    
    callStatus.innerText = "INCOMING HACKED LINE...";
    document.getElementById('accept-btn').style.display = 'flex';
    
    callOverlay.style.display = 'flex';
}

window.acceptCall = function() {
    if (!isRinging) return;
    isRinging = false;
    
    if (ringtone) ringtone.pause();
    document.getElementById('accept-btn').style.display = 'none';
    
    const callStatus = document.getElementById('call-status');
    callStatus.innerText = "CONNECTED";
    callStatus.style.color = "var(--acc-green)";
    
    // Vibrate/glitch call screen
    document.body.classList.add('glitch-active');
    if (glitchSound) glitchSound.play().catch(e => {});
    setTimeout(() => document.body.classList.remove('glitch-active'), 500);

    // Speak creepy TTS sentence
    speakVoice("I am standing at the back patio. The glass is very thin.");
    callStatus.innerText = "UNKNOWN: I AM AT THE BACK PATIO.";
    
    // Unlock back patio door remotely
    setTimeout(() => {
        cabinRelays.backPatio = false; // UNLOCKED
        updateSmartCabinUI();
        
        callStatus.innerText = "WARNING: RELAY PATIO COMPROMISED";
        callStatus.style.color = "var(--acc-red)";
        
        // Show choice to lock patio
        showCallChoices([
            {
                text: "LOCK PATIO DOOR FROM PHONE",
                callback: () => {
                    cabinRelays.backPatio = true;
                    playBeepSound();
                    updateSmartCabinUI();
                    speakVoice("Damn you.");
                    callStatus.innerText = "UNKNOWN: Damn you.";
                    
                    setTimeout(() => {
                        endCall();
                    }, 1500);
                }
            }
        ]);
        
        // Timeout check: if player doesn't click within 6 seconds, they die
        currentGameState = 'alert_back_unlocked';
        alertTimeout = setTimeout(() => {
            endCall();
            triggerStalkerBreakInDeath("The sliding glass door clicked open. You were too slow.");
        }, 6500);
        
    }, 2000);
};

window.endCall = function() {
    isRinging = false;
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
    window.speechSynthesis.cancel();
    document.getElementById('call-overlay').style.display = 'none';
    document.getElementById('call-choice-container').innerHTML = '';

};

// Text to speech API wrapper
function speakVoice(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.2; // deep, scary hacking voice
    utterance.rate = 0.75;
    window.speechSynthesis.speak(utterance);
}

function showCallChoices(choices) {
    const container = document.getElementById('call-choice-container');
    container.innerHTML = '';
    
    choices.forEach(c => {
        const btn = document.createElement('button');
        btn.innerText = c.text;
        btn.style.cssText = "background: rgba(255,59,48,0.2); border: 1.5px solid var(--acc-red); color: white; padding: 12px 20px; border-radius: 20px; cursor: pointer; transition: 0.3s; width: 260px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase;";
        btn.onclick = () => {
            container.innerHTML = '';
            c.callback();
        };
        container.appendChild(btn);
    });
}

// Step 5 Climax: Glass smash and final alarm action
function triggerIntruderSmashGlass() {
    console.log("Intruder smashing glass.");
    currentGameState = 'smash_glass';
    
    // Play glass break / loud smash sound
    if (creepyImpact) creepyImpact.play().catch(e => {});
    
    setTimeout(() => {
        // Smart cabin shows compromised state
        document.getElementById('network-status').innerText = "COMPROMISED";
        document.getElementById('network-status').className = "status-badge compromised-badge";
        document.getElementById('network-desc').innerText = "ALERT: Backyard patio glass perimeter broken. Motion detected in Living Room!";
        document.getElementById('network-desc').style.color = "var(--acc-red)";
        
        // Open cabin app with alert dot
        document.getElementById('cabin-alert-dot').style.display = 'flex';
        showNotification("Cabin Alert", "WARNING: LIVING ROOM INTRUSION DETECTED!", true);
        
        // Enable siren alarm button
        updateSmartCabinUI();
        
        // Force show SmartCabin app
        openSmartCabin();
        
        // Start 7.5 second timeout countdown for player to hit the PANIC button!
        currentGameState = 'siren_countdown';
        alertTimeout = setTimeout(() => {
            triggerStalkerBreakInDeath("He came through the shattered glass. The warning siren remained silent.");
        }, 7500);
    }, 2000);
}

window.triggerPanicSiren = function() {
    if (!generatorRebooted) return;
    
    clearAlertTimeout();
    console.log("Panic siren triggered!");
    currentGameState = 'siren_active';
    
    // Play police siren loop loudly
    if (policeSiren) {
        policeSiren.volume = 1.0;
        policeSiren.loop = true;
        policeSiren.play().catch(e => {});
    }
    
    updateSmartCabinUI();
    
    // Turn cctv feed to intruder running away video on CAM 2
    if (activeApp === 'cctv') {
        switchCCTV(2);
    }
    
    // Detective Miller messages you
    setTimeout(() => {
        receiveChatMessage('miller', "Priya! The rangers just reached the cabin area. They heard the siren alarm. The suspect is fleeing into the pines. We have him cornered. You are safe!");
        showNotification("Det. Miller", "Priya! You are safe! Rangers have secured the perimeter.");
        
        // Start game ending transition after 5 seconds
        setTimeout(triggerVictoryEnd, 5000);
    }, 2500);
};

// End game states (Death vs Victory)
function triggerStalkerBreakInDeath(reasonText) {
    console.log("Player died.");
    clearAlertTimeout();
    
    // Stop all audio
    if (bgMusic) bgMusic.pause();
    if (thunderSound) thunderSound.pause();
    if (ringtone) ringtone.pause();
    if (policeSiren) policeSiren.pause();
    window.speechSynthesis.cancel();
    
    // Show death screen and play gun video jumpscare
    const gameOverOverlay = document.getElementById('game-over');
    const deathVideo = document.getElementById('death-scary-video');
    document.getElementById('death-reason').innerText = reasonText;
    
    gameOverOverlay.style.display = 'flex';
    
    if (deathVideo) {
        deathVideo.currentTime = 0;
        deathVideo.play().catch(e => console.log("Death video skipped"));
    }
}

function triggerVictoryEnd() {
    console.log("Player survived.");
    
    // Stop loops
    if (policeSiren) policeSiren.pause();
    if (thunderSound) thunderSound.pause();
    
    const awarenessOverlay = document.getElementById('final-awareness-overlay');
    awarenessOverlay.style.display = 'flex';
}

// Notification Banner Helper
function showNotification(title, message, isAlert = false) {
    const banner = document.getElementById('notif-banner');
    const bTitle = document.getElementById('notif-title');
    const bText = document.getElementById('notif-text');
    
    bTitle.innerText = title;
    bText.innerText = message;
    
    if (isAlert) {
        banner.style.borderLeftColor = "var(--acc-red)";
        bTitle.style.color = "var(--acc-red)";
    } else {
        banner.style.borderLeftColor = "var(--acc-blue)";
        bTitle.style.color = "var(--acc-blue)";
    }
    
    banner.style.top = '10px';
    setTimeout(() => {
        banner.style.top = '-100px';
    }, 4500);
}

// Sound effects helpers
function playBeepSound() {
    if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = window.audioCtx.createOscillator();
    const gain = window.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, window.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, window.audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(window.audioCtx.destination);
    osc.start();
    osc.stop(window.audioCtx.currentTime + 0.05);
}

window.playMysticalMusic = function() {
    if (musicBox) {
        if (musicBox.paused) {
            musicBox.volume = 0.6;
            musicBox.play().catch(e => {});
            alert("Now playing: Mystical Music Box");
        } else {
            musicBox.pause();
        }
    }
};

// Dialer application methods
window.switchPhoneTab = function(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.phone-tab').forEach(t => {
        t.classList.remove('active');
    });
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    const listContent = document.getElementById('phone-list-content');
    const keypadContent = document.getElementById('phone-keypad-content');
    
    if (tab === 'keypad') {
        listContent.style.display = 'none';
        keypadContent.style.display = 'flex';
    } else {
        listContent.style.display = 'block';
        keypadContent.style.display = 'none';
        populateDialerLists(tab);
    }
};

function populateDialerLists(type) {
    const list = document.getElementById('phone-list-content');
    list.innerHTML = '';
    
    Object.keys(contacts).forEach(key => {
        const contact = contacts[key];
        const item = document.createElement('div');
        item.className = 'recent-item';
        
        item.innerHTML = `
            <div style="width: 40px; height: 40px; background: url('${contact.avatar}') center/cover; border-radius: 50%; margin-right: 12px; border: 1px solid var(--glass-border);"></div>
            <div style="flex: 1;">
                <h3 style="font-size: 14px; font-weight: 500; color: white;">${contact.name}</h3>
                <p style="font-size: 11px; color: #666; margin-top: 2px;">${type === 'recents' ? 'Outgoing' : 'Mobile'}</p>
            </div>
            <div style="font-size: 11px; color: #666;">${type === 'recents' ? 'Today' : ''}</div>
        `;
        
        item.onclick = () => {
            alert(`Calling ${contact.name}... Outbound lines are jammed by weather.`);
        };
        list.appendChild(item);
    });
}

window.dialDigit = function(n) {
    if (dialedNumber.length < 11) {
        dialedNumber += n;
        document.getElementById('phone-display').innerText = dialedNumber;
        playBeepSound();
    }
};

window.deleteDialDigit = function() {
    dialedNumber = dialedNumber.slice(0, -1);
    document.getElementById('phone-display').innerText = dialedNumber;
};

window.performCall = function() {
    if (dialedNumber === '') return;
    
    if (dialedNumber === '911') {
        alert("Emergency: Mountain cellular grids are currently down due to storm conditions.");
    } else if (dialedNumber === '8821') {
        alert("Pin correct. Dialing bypass grid...");
        openCCTV();
        switchCCTV(4);
    } else {
        alert("Connection jammed: All channels occupied.");
    }
    
    dialedNumber = '';
    document.getElementById('phone-display').innerText = '';
};

// Initial triggers on page load
document.addEventListener('DOMContentLoaded', () => {
    // Keep intro video muted on click to prevent background music mixing
    const introVideo = document.getElementById('intro-video-bg');
    if (introVideo) {
        const events = ['click', 'touchstart', 'mousedown'];
        const unmute = () => {
            if (introVideo && introVideo.parentNode) {
                introVideo.muted = true;
                introVideo.play().catch(e => {});
            }
            events.forEach(evt => {
                window.removeEventListener(evt, unmute);
            });
        };
        events.forEach(evt => {
            window.addEventListener(evt, unmute);
        });
    }
});

// Narrative Transitions for Door Check Sequence
function triggerWhoIsOpenDoorSuggestion() {
    const banner = document.getElementById('narrative-suggestion-banner');
    const text = document.getElementById('narrative-suggestion-text');
    if (banner) banner.style.display = 'none';
    
    // Speak in female voice
    const utterance = speakCustomVoice("Who was opening the door?", false);
    window.activeUtterance = utterance; // Prevent GC
    
    let voiceFired = false;
    utterance.onend = function() {
        if (voiceFired) return;
        voiceFired = true;
        if (banner && text) {
            banner.style.display = 'block';
            text.innerText = "💬 Go and check it";
            banner.onclick = window.triggerGoCheckItSuggestion;
        }
    };
    
    // Fallback timer (4s) to ensure progression even if TTS is blocked
    setTimeout(() => {
        if (!voiceFired) {
            utterance.onend();
        }
    }, 4000);
    
    window.speechSynthesis.speak(utterance);
}
window.triggerWhoIsOpenDoorSuggestion = triggerWhoIsOpenDoorSuggestion;

function triggerGoCheckItSuggestion() {
    const banner = document.getElementById('narrative-suggestion-banner');
    if (banner) banner.style.display = 'none';
    
    const doorStage = document.getElementById('cinematic-door-stage');
    const doorFrame = doorStage ? doorStage.querySelector('.door-frame') : null;
    const doorLeaf = document.getElementById('door-leaf');
    const roomStage = document.getElementById('cinematic-room-stage');
    
    // Step 1: Zoom out of desk phone
    if (roomStage) roomStage.classList.remove('zoomed-in');
    
    // Step 2: Transition back to hallway doorway and reset door stage to walk-in position
    setTimeout(() => {
        if (roomStage) roomStage.classList.remove('active');
        if (doorStage) {
            doorStage.classList.remove('walk-to-door');
            doorStage.classList.remove('zoomed-through');
        }
        if (doorLeaf) doorLeaf.classList.remove('open');
        
        // Force layout reflow
        if (doorStage) doorStage.offsetHeight;
        
        // Step 3: Walk FORWARD to the closed door frame
        setTimeout(() => {
            if (doorStage) doorStage.classList.add('walk-to-door');
            if (doorFrame) {
                doorFrame.classList.remove('checking');
                doorFrame.classList.add('bobbing');
            }
            if (footstepsSound) {
                footstepsSound.volume = 0.5;
                footstepsSound.play().catch(e => {});
            }
            
            if (creepyImpact) {
                creepyImpact.volume = 0.25;
                creepyImpact.play().catch(e => {});
            }
        }, 50);
    }, 1500);
    
    // Step 4: Arrive at door frame and check left/right
    setTimeout(() => {
        if (doorFrame) {
            doorFrame.classList.remove('bobbing');
            doorFrame.classList.add('checking');
        }
        if (footstepsSound) {
            footstepsSound.pause();
            footstepsSound.currentTime = 0;
        }
        
        if (heavyBreathing) {
            heavyBreathing.volume = 0.5;
            heavyBreathing.loop = true;
            heavyBreathing.play().catch(e => {});
        }
    }, 5600); // 1.5s transition + 4.1s walking down hallway
    
    // Automatically return after checking is completed
    setTimeout(() => {
        if (heavyBreathing) {
            heavyBreathing.pause();
            heavyBreathing.loop = false;
        }
        
        const text = document.getElementById('narrative-suggestion-text');
        if (banner && text) {
            banner.style.display = 'block';
            text.innerText = "💬 No one is here. Returning to the bedroom...";
            banner.onclick = null;
        }
        
        // Return automatically after 1.5 seconds of displaying the message
        setTimeout(() => {
            if (banner) banner.style.display = 'none';
            triggerReturnToBedroomSuggestion();
        }, 1500);
    }, 9600);
}
window.triggerGoCheckItSuggestion = triggerGoCheckItSuggestion;

function triggerReturnToBedroomSuggestion() {
    const banner = document.getElementById('narrative-suggestion-banner');
    if (banner) banner.style.display = 'none';
    
    const doorStage = document.getElementById('cinematic-door-stage');
    const doorFrame = doorStage ? doorStage.querySelector('.door-frame') : null;
    const doorLeaf = document.getElementById('door-leaf');
    const roomStage = document.getElementById('cinematic-room-stage');
    
    // Step 1: Open door leaf and walk forward
    if (doorFrame) {
        doorFrame.classList.remove('checking');
        doorFrame.classList.add('bobbing');
    }
    if (doorLeaf) doorLeaf.classList.add('open');
    if (footstepsSound) {
        footstepsSound.volume = 0.5;
        footstepsSound.play().catch(e => {});
    }
    
    if (creepyImpact) {
        creepyImpact.volume = 0.4;
        creepyImpact.play().catch(e => {});
    }
    
    setTimeout(() => {
        if (doorStage) doorStage.classList.add('zoomed-through');
    }, 500);
    
    // Step 2: Walk back to bedroom and zoom in
    setTimeout(() => {
        if (roomStage) {
            roomStage.style.display = 'flex';
            roomStage.offsetHeight;
            roomStage.classList.add('active');
            roomStage.style.opacity = '1';
            setTimeout(() => {
                roomStage.classList.add('zoomed-in');
            }, 100);
        }
    }, 2000);
    
    // Step 3: Settle camera back on phone
    setTimeout(() => {
        if (doorFrame) doorFrame.classList.remove('bobbing');
        if (footstepsSound) {
            footstepsSound.pause();
            footstepsSound.currentTime = 0;
        }
        // Trigger Mom's call 0.5 seconds after camera settles down
        setTimeout(() => {
            triggerMomCall();
        }, 500);
    }, 6500);
}
window.triggerReturnToBedroomSuggestion = triggerReturnToBedroomSuggestion;

function triggerMomCall() {
    activeCallContact = 'mom';
    
    // Change label and avatar dynamically
    const nameLabel = document.getElementById('mock-caller-name-label');
    const avatarImg = document.getElementById('mock-caller-avatar-img');
    const statusText = document.getElementById('mock-connect-status');
    const timerDisplay = document.getElementById('mock-call-timer');
    
    if (nameLabel) nameLabel.innerText = "Mom";
    if (avatarImg) {
        avatarImg.innerText = "👩";
        avatarImg.className = "mock-caller-avatar pulsing";
    }
    if (statusText) statusText.innerText = "Incoming Call...";
    if (timerDisplay) timerDisplay.innerText = "00:00";
    
    // Show call controls and hide the lockscreen container (since we don't want it to show up on decline)
    const lockScreenUI = document.getElementById('mock-lock-screen-ui');
    if (lockScreenUI) lockScreenUI.style.display = 'none';
    
    const callActionsUI = document.getElementById('mock-call-actions-ui');
    if (callActionsUI) callActionsUI.style.display = 'flex';
    
    // Show caller screen UI overlay
    const callerScreenUI = document.getElementById('mock-caller-screen-ui');
    if (callerScreenUI) callerScreenUI.style.display = 'block';
    
    // Play ringtone
    if (ringtone) {
        ringtone.loop = true;
        ringtone.volume = 0.6;
        ringtone.play().catch(e => console.log("Ringtone error:", e));
    }
}

// ==========================================================================
// Kitchen Transition and Animations Implementation
// ==========================================================================

function showKitchenCaption(text) {
    const captionOverlay = document.getElementById('kitchen-caption-overlay');
    const captionText = document.getElementById('kitchen-caption-text');
    if (captionOverlay && captionText) {
        captionText.innerText = text;
        captionOverlay.style.display = 'block';
    }
}

function hideKitchenCaption() {
    const captionOverlay = document.getElementById('kitchen-caption-overlay');
    if (captionOverlay) {
        captionOverlay.style.display = 'none';
    }
}

window.triggerEnterKitchen = function() {
    console.log("Entering hallway walk transition...");
    
    // Hide suggestion banner
    const banner = document.getElementById('narrative-suggestion-banner');
    if (banner) banner.style.display = 'none';
    
    const roomStage = document.getElementById('cinematic-room-stage');
    const walkStage = document.getElementById('cinematic-walk-stage');
    const walkView = document.getElementById('hallway-walk-view');
    const kitchenStage = document.getElementById('cinematic-kitchen-stage');
    
    // Step 1: Animate camera walking out of bedroom (bobbing and zooming forward past desk)
    if (roomStage) {
        // Keep zoomed-in active so the desk is flat and matches the walk out perspective
        roomStage.classList.add('walking-out');
    }
    if (footstepsSound) {
        footstepsSound.volume = 0.5;
        footstepsSound.play().catch(e => {});
    }
    
    // Play transition sound
    if (creepyImpact) {
        creepyImpact.volume = 0.3;
        creepyImpact.play().catch(e => {});
    }
    
    setTimeout(() => {
        // Hide room stage
        if (roomStage) {
            roomStage.classList.remove('active');
            roomStage.classList.remove('walking-out');
            roomStage.classList.remove('zoomed-in'); // Reset zoomed-in state for return
        }
        
        // Show walk stage (hallway)
        if (walkStage) {
            walkStage.style.display = 'flex';
            // Reflow
            walkStage.offsetHeight;
            walkStage.classList.add('active');
        }
        
        // Start camera bobbing walk animation
        if (walkView) {
            walkView.classList.add('bobbing');
        }
        
        // Voice walk line
        const walkUtterance = speakCustomVoice("I should go check the kitchen. I'm starving.", false);
        window.activeUtterance = walkUtterance;
        
        // Walk down hallway duration: 3.5 seconds
        setTimeout(() => {
            // Hide walk stage and bobbing
            if (walkView) walkView.classList.remove('bobbing');
            if (walkStage) {
                walkStage.classList.remove('active');
                walkStage.style.opacity = '0';
            }
            if (footstepsSound) {
                footstepsSound.pause();
                footstepsSound.currentTime = 0;
            }
            
            // Wait for walk stage fadeout (1s), then show kitchen
            setTimeout(() => {
                if (walkStage) walkStage.style.display = 'none';
                
                if (kitchenStage) {
                    kitchenStage.style.display = 'flex';
                    kitchenStage.offsetHeight;
                    kitchenStage.classList.add('active');
                }
                
                // Wait 500ms to start Priya's entrance
                setTimeout(() => {
                    startPriyaKitchenSequence();
                }, 500);
                
            }, 1000);
            
        }, 3500);
        
    }, 2500); // 2.5s bedroom walking animation
};

function startPriyaKitchenSequence() {
    const priya = document.getElementById('kitchen-priya');
    const fridge = document.getElementById('kitchen-refrigerator');
    const heldSandwich = document.getElementById('kitchen-held-sandwich');
    const armRight = document.getElementById('priya-avatar-arm-right');
    const mouth = document.getElementById('priya-avatar-mouth');
    
    // Reset all 3 sandwiches inside refrigerator
    for (let i = 1; i <= 3; i++) {
        const s = document.getElementById(`fridge-sandwich-${i}`);
        if (s) {
            s.style.display = 'block';
            s.className = 'sandwich-food small';
        }
    }
    
    if (heldSandwich) {
        heldSandwich.style.display = 'none';
        heldSandwich.className = 'sandwich-food held';
    }
    if (priya) {
        priya.style.left = '-150px';
        priya.classList.remove('walking');
    }
    if (fridge) fridge.classList.remove('open');
    if (armRight) {
        armRight.className = 'priya-arm-right';
        armRight.style.transform = '';
    }
    if (mouth) mouth.className = 'priya-mouth';
    
    // 1. Voice line: "I was so hungry... let me grab something from the fridge."
    const enterUtterance = speakCustomVoice("I was so hungry... let me grab something from the fridge.", false);
    window.activeUtterance = enterUtterance;
    showKitchenCaption("Priya: I was so hungry... let me grab something from the fridge.");
    
    // Make Priya walk in
    setTimeout(() => {
        if (priya) {
            priya.classList.add('walking');
            priya.style.left = '320px'; // move to center of kitchen
        }
    }, 500);
    
    // 3.5 seconds for walking animation
    setTimeout(() => {
        if (priya) priya.classList.remove('walking');
        hideKitchenCaption();
        
        // Start eating the 3 sandwiches one-by-one!
        eatSandwichSequence(1);
        
    }, 4000);
}

function eatSandwichSequence(num) {
    if (num > 3) {
        // Finished all 3 sandwiches! Show return suggestion banner inside the kitchen
        const kitchenBanner = document.getElementById('kitchen-suggestion-banner');
        if (kitchenBanner) {
            kitchenBanner.style.display = 'block';
            kitchenBanner.onclick = window.triggerExitKitchenInteractive;
        } else {
            // Fallback if element not found
            window.triggerExitKitchenInteractive();
        }
        return;
    }
    
    const fridge = document.getElementById('kitchen-refrigerator');
    const heldSandwich = document.getElementById('kitchen-held-sandwich');
    const fridgeSandwich = document.getElementById(`fridge-sandwich-${num}`);
    const armRight = document.getElementById('priya-avatar-arm-right');
    const mouth = document.getElementById('priya-avatar-mouth');
    
    // Step 1: Open refrigerator
    showKitchenCaption(`Priya: Grabbing sandwich ${num} from the refrigerator...`);
    if (fridge) fridge.classList.add('open');
    
    // Wait 1.5s for fridge door to open fully
    setTimeout(() => {
        // Priya reaches in to grab the sandwich
        if (armRight) armRight.style.transform = 'rotate(-120deg) translateY(-10px) translateX(-5px)';
        
        // Wait 1s for grab
        setTimeout(() => {
            // Refrigerator sandwich disappears, held sandwich appears in hand
            if (fridgeSandwich) fridgeSandwich.style.display = 'none';
            if (heldSandwich) {
                heldSandwich.style.display = 'block';
                heldSandwich.className = 'sandwich-food held'; // reset bites
            }
            // Hand goes back down
            if (armRight) armRight.style.transform = '';
            
            // Close refrigerator door
            if (fridge) fridge.classList.remove('open');
            hideKitchenCaption();
            
            // Wait 1s after closing before eating
            setTimeout(() => {
                // Step 2: Eat this sandwich (3 bites)
                showKitchenCaption(`Priya: Munching sandwich ${num}...`);
                
                // Bite 1
                if (armRight) armRight.classList.add('eating');
                if (mouth) mouth.classList.add('chewing');
                speakCustomVoice("Mmm", false);
                
                setTimeout(() => {
                    if (heldSandwich) heldSandwich.classList.add('bite-1');
                }, 1000);
                
                setTimeout(() => {
                    if (armRight) armRight.className = 'priya-arm-right';
                    if (mouth) mouth.className = 'priya-mouth';
                    
                    // Bite 2 after 0.8s pause
                    setTimeout(() => {
                        if (armRight) armRight.classList.add('eating');
                        if (mouth) mouth.classList.add('chewing');
                        
                        setTimeout(() => {
                            if (heldSandwich) heldSandwich.classList.add('bite-2');
                        }, 1000);
                        
                        setTimeout(() => {
                            if (armRight) armRight.className = 'priya-arm-right';
                            if (mouth) mouth.className = 'priya-mouth';
                            
                            // Bite 3 after 0.8s pause
                            setTimeout(() => {
                                if (armRight) armRight.classList.add('eating');
                                if (mouth) mouth.classList.add('chewing');
                                
                                setTimeout(() => {
                                    if (heldSandwich) heldSandwich.classList.add('bite-3');
                                }, 1000);
                                
                                setTimeout(() => {
                                    if (armRight) armRight.className = 'priya-arm-right';
                                    if (mouth) mouth.className = 'priya-mouth';
                                    if (heldSandwich) heldSandwich.style.display = 'none';
                                    hideKitchenCaption();
                                    
                                    // Move to next sandwich!
                                    setTimeout(() => {
                                        eatSandwichSequence(num + 1);
                                    }, 1000);
                                    
                                }, 2000);
                            }, 1000);
                            
                        }, 2000);
                    }, 800);
                    
                }, 2000);
                
            }, 1000);
            
        }, 1000);
        
    }, 1500);
}

window.triggerExitKitchenInteractive = function() {
    console.log("User clicked return to bedroom suggestion.");
    
    // Hide the kitchen suggestion banner
    const kitchenBanner = document.getElementById('kitchen-suggestion-banner');
    if (kitchenBanner) kitchenBanner.style.display = 'none';
    
    const priya = document.getElementById('kitchen-priya');
    const kitchenStage = document.getElementById('cinematic-kitchen-stage');
    const walkStage = document.getElementById('cinematic-walk-stage');
    const walkView = document.getElementById('hallway-walk-view');
    const roomStage = document.getElementById('cinematic-room-stage');
    
    const exitUtterance = speakCustomVoice("Much better... Now I should get back to the bedroom.", false);
    window.activeUtterance = exitUtterance;
    showKitchenCaption("Priya: Much better... Now I should get back to the bedroom.");
    
    setTimeout(() => {
        // Walk Priya back off-screen left
        if (priya) {
            priya.classList.add('walking');
            priya.style.left = '-150px';
        }
        
        setTimeout(() => {
            if (priya) priya.classList.remove('walking');
            hideKitchenCaption();
            
            // Fade out kitchen stage
            if (kitchenStage) {
                kitchenStage.classList.remove('active');
                kitchenStage.style.opacity = '0';
            }
            
            // Fade back in hallway walk stage
            setTimeout(() => {
                if (kitchenStage) kitchenStage.style.display = 'none';
                
                if (walkStage) {
                    walkStage.style.opacity = '1';
                    walkStage.style.display = 'flex';
                    // Reflow
                    walkStage.offsetHeight;
                    walkStage.classList.add('active');
                }
                if (footstepsSound) {
                    footstepsSound.volume = 0.5;
                    footstepsSound.play().catch(e => {});
                }
                
                if (walkView) {
                    walkView.classList.add('bobbing');
                }
                
                // Walk back down hallway duration: 2.5 seconds
                setTimeout(() => {
                    if (walkView) walkView.classList.remove('bobbing');
                    if (walkStage) {
                        walkStage.classList.remove('active');
                        walkStage.style.opacity = '0';
                    }
                    
                    // Wait for walk stage fadeout (1s), then show bedroom
                    setTimeout(() => {
                        if (walkStage) walkStage.style.display = 'none';
                        
                        if (roomStage) {
                            roomStage.style.display = 'flex';
                            // Reflow
                            roomStage.offsetHeight;
                            roomStage.classList.add('active');
                            roomStage.style.opacity = '1';
                            roomStage.classList.add('walking-in');
                        }
                        
                        // Wait for walking-in animation (2.5s)
                        setTimeout(() => {
                            if (roomStage) {
                                roomStage.classList.remove('walking-in');
                                roomStage.classList.add('zoomed-in');
                            }
                            if (footstepsSound) {
                                footstepsSound.pause();
                                footstepsSound.currentTime = 0;
                            }
                            
                            // Let camera settle and then trigger Dad's message
                            setTimeout(() => {
                                console.log("Triggering Dad's storm message after kitchen sequence.");
                                receiveChatMessage('dad', "Priya, are you at the cabin yet? Lock the front doors now! The storm is getting severe.");
                                showNotification("Dad", "Priya, are you at the cabin yet? Lock the front doors now!");
                                
                                // Enable smart lock alert dot on screen
                                const alertDot = document.getElementById('cabin-alert-dot');
                                if (alertDot) alertDot.style.display = 'flex';
                                
                                // Trigger loading choices
                                loadChatChoices();
                            }, 1000);
                            
                        }, 2500);
                        
                    }, 1000);
                    
                }, 2500);
                
            }, 1000); // Wait for kitchen fadeout transition
            
        }, 2500); // Priya walking duration
        
    }, 2000); // 2s after voicing exit line
};
