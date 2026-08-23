/**
 * ATTACKS GAME 5-DIGIT PASSCODE SECURITY MODULE
 * Passcode: 99123
 */

(function() {
    'use strict';

    const REQUIRED_PASSCODE = '99123';
    let currentInput = '';
    let pendingDestination = null;
    let isVerifying = false;

    // Web Audio Sound Synthesizer
    function playAudioTone(freq, type, duration) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch(e) {}
    }

    function playSuccessSound() {
        playAudioTone(523.25, 'sine', 0.1); // C5
        setTimeout(() => playAudioTone(659.25, 'sine', 0.1), 80); // E5
        setTimeout(() => playAudioTone(783.99, 'sine', 0.12), 160); // G5
        setTimeout(() => playAudioTone(1046.50, 'sine', 0.2), 240); // C6
    }

    function playErrorSound() {
        playAudioTone(180, 'sawtooth', 0.15);
        setTimeout(() => playAudioTone(130, 'sawtooth', 0.25), 100);
    }

    function playKeySound() {
        playAudioTone(440, 'sine', 0.05);
    }

    // Inject CSS Styles for Passcode Modal
    function injectStyles() {
        if (document.getElementById('attacks-passcode-styles')) return;

        const style = document.createElement('style');
        style.id = 'attacks-passcode-styles';
        style.textContent = `
            @keyframes attacksModalFadeIn {
                from { opacity: 0; transform: scale(0.92) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes attacksModalShake {
                0%, 100% { transform: translateX(0); }
                20%, 60% { transform: translateX(-12px); }
                40%, 80% { transform: translateX(12px); }
            }
            @keyframes attacksPulseGlow {
                0%, 100% { box-shadow: 0 0 20px rgba(153, 51, 255, 0.3); }
                50% { box-shadow: 0 0 35px rgba(153, 51, 255, 0.6); }
            }

            .attacks-passcode-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(3, 6, 17, 0.88);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
                font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            .attacks-passcode-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            .attacks-passcode-card {
                background: linear-gradient(145deg, #0d0f22, #161936);
                border: 1.5px solid rgba(153, 51, 255, 0.4);
                border-radius: 24px;
                padding: 32px 28px;
                width: 100%;
                max-width: 380px;
                text-align: center;
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(153, 51, 255, 0.25);
                transform: scale(0.95);
                transition: transform 0.3s ease;
                position: relative;
                overflow: hidden;
            }

            .attacks-passcode-overlay.active .attacks-passcode-card {
                animation: attacksModalFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            .attacks-passcode-card.shake {
                animation: attacksModalShake 0.45s ease-in-out forwards !important;
                border-color: #ff3355 !important;
                box-shadow: 0 0 30px rgba(255, 51, 85, 0.5) !important;
            }

            .attacks-passcode-card.success {
                border-color: #00ff88 !important;
                box-shadow: 0 0 35px rgba(0, 255, 136, 0.5) !important;
            }

            .attacks-shield-icon {
                width: 60px; height: 60px;
                margin: 0 auto 16px;
                border-radius: 18px;
                background: rgba(153, 51, 255, 0.15);
                border: 1px solid rgba(153, 51, 255, 0.4);
                display: flex; align-items: center; justify-content: center;
                font-size: 28px;
                color: #b566ff;
                box-shadow: 0 0 20px rgba(153, 51, 255, 0.3);
            }

            .attacks-passcode-title {
                font-size: 22px;
                font-weight: 900;
                color: #ffffff;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                margin-bottom: 6px;
            }

            .attacks-passcode-subtitle {
                font-family: 'JetBrains Mono', monospace;
                font-size: 11px;
                color: #94a3b8;
                letter-spacing: 1.5px;
                margin-bottom: 24px;
                text-transform: uppercase;
            }

            /* 5 Digit Input Boxes */
            .attacks-digits-row {
                display: flex;
                justify-content: center;
                gap: 10px;
                margin-bottom: 20px;
            }

            .attacks-digit-box {
                width: 48px;
                height: 54px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1.5px solid rgba(255, 255, 255, 0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'JetBrains Mono', monospace;
                font-size: 22px;
                font-weight: 900;
                color: #ffffff;
                transition: all 0.2s ease;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
            }

            .attacks-digit-box.filled {
                border-color: #9933ff;
                background: rgba(153, 51, 255, 0.2);
                color: #b566ff;
                box-shadow: 0 0 12px rgba(153, 51, 255, 0.4);
            }

            .attacks-digit-box.active-cursor {
                border-color: #00d2ff;
                box-shadow: 0 0 10px rgba(0, 210, 255, 0.5);
            }

            /* Status Feedback Message */
            .attacks-status-msg {
                font-family: 'JetBrains Mono', monospace;
                font-size: 12px;
                font-weight: 700;
                min-height: 20px;
                margin-bottom: 20px;
                letter-spacing: 1px;
                color: #94a3b8;
            }
            .attacks-status-msg.error { color: #ff3355; }
            .attacks-status-msg.success { color: #00ff88; }

            /* Onscreen Touch Keypad Grid */
            .attacks-keypad-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                max-width: 300px;
                margin: 0 auto;
            }

            .attacks-key-btn {
                height: 50px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #ffffff;
                font-family: 'Outfit', sans-serif;
                font-size: 18px;
                font-weight: 800;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
                outline: none;
                -webkit-tap-highlight-color: transparent;
            }

            .attacks-key-btn:hover {
                background: rgba(153, 51, 255, 0.25);
                border-color: rgba(153, 51, 255, 0.5);
                transform: translateY(-2px);
            }

            .attacks-key-btn:active {
                transform: translateY(1px) scale(0.96);
                background: rgba(153, 51, 255, 0.4);
            }

            .attacks-key-btn.action-btn {
                font-size: 13px;
                font-weight: 900;
                letter-spacing: 1px;
            }

            .attacks-key-btn.clear-btn {
                background: rgba(255, 51, 85, 0.1);
                border-color: rgba(255, 51, 85, 0.3);
                color: #ff5577;
            }
            .attacks-key-btn.clear-btn:hover {
                background: rgba(255, 51, 85, 0.25);
            }

            .attacks-key-btn.enter-btn {
                background: linear-gradient(135deg, #9933ff, #7000ff);
                border: none;
                color: #ffffff;
                box-shadow: 0 0 15px rgba(153, 51, 255, 0.4);
            }
            .attacks-key-btn.enter-btn:hover {
                box-shadow: 0 0 22px rgba(153, 51, 255, 0.7);
                transform: translateY(-2px) scale(1.02);
            }

            .attacks-close-btn {
                position: absolute;
                top: 16px; right: 16px;
                width: 32px; height: 32px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #94a3b8;
                font-size: 14px;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
            }
            .attacks-close-btn:hover {
                background: rgba(255, 51, 85, 0.2);
                color: #ff3355;
                border-color: #ff3355;
            }
        `;
        document.head.appendChild(style);
    }

    // Build Passcode Modal HTML
    function buildModalDOM() {
        if (document.getElementById('attacks-passcode-modal')) return;

        injectStyles();

        const overlay = document.createElement('div');
        overlay.id = 'attacks-passcode-modal';
        overlay.className = 'attacks-passcode-overlay';
        overlay.innerHTML = `
            <div class="attacks-passcode-card" id="attacks-passcode-card">
                <button class="attacks-close-btn" id="attacks-close-btn" title="Close Security Checkpoint">✕</button>

                <div class="attacks-shield-icon">🔒</div>
                <h2 class="attacks-passcode-title">ATTACKS PASSCODE</h2>
                <div class="attacks-passcode-subtitle">ENTER 5-DIGIT ACCESS CODE</div>

                <!-- 5 Input Display Boxes -->
                <div class="attacks-digits-row">
                    <div class="attacks-digit-box" id="digit-0"></div>
                    <div class="attacks-digit-box" id="digit-1"></div>
                    <div class="attacks-digit-box" id="digit-2"></div>
                    <div class="attacks-digit-box" id="digit-3"></div>
                    <div class="attacks-digit-box" id="digit-4"></div>
                </div>

                <div class="attacks-status-msg" id="attacks-status-msg">REQUIRE SECURITY PERMISSION</div>

                <!-- Touch Keypad -->
                <div class="attacks-keypad-grid">
                    <button class="attacks-key-btn" data-key="1">1</button>
                    <button class="attacks-key-btn" data-key="2">2</button>
                    <button class="attacks-key-btn" data-key="3">3</button>
                    <button class="attacks-key-btn" data-key="4">4</button>
                    <button class="attacks-key-btn" data-key="5">5</button>
                    <button class="attacks-key-btn" data-key="6">6</button>
                    <button class="attacks-key-btn" data-key="7">7</button>
                    <button class="attacks-key-btn" data-key="8">8</button>
                    <button class="attacks-key-btn" data-key="9">9</button>
                    <button class="attacks-key-btn action-btn clear-btn" data-key="CLEAR">CLEAR</button>
                    <button class="attacks-key-btn" data-key="0">0</button>
                    <button class="attacks-key-btn action-btn enter-btn" data-key="ENTER">↵ UNLOCK</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Attach event listeners for keypad buttons
        overlay.querySelectorAll('.attacks-key-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.getAttribute('data-key');
                handleKeyInput(key);
            });
        });

        // Close button listener
        document.getElementById('attacks-close-btn').addEventListener('click', () => {
            closeModal();
        });

        // Background overlay click close (if not required page)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !isPageProtected()) {
                closeModal();
            }
        });

        // Physical Keyboard listener
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('attacks-passcode-modal');
            if (!modal || !modal.classList.contains('active')) return;

            if (e.key >= '0' && e.key <= '9') {
                handleKeyInput(e.key);
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                handleKeyInput('DELETE');
            } else if (e.key === 'Enter') {
                handleKeyInput('ENTER');
            } else if (e.key === 'Escape' && !isPageProtected()) {
                closeModal();
            }
        });
    }

    // Key input logic
    function handleKeyInput(key) {
        if (isVerifying) return;

        if (key === 'CLEAR') {
            currentInput = '';
            playKeySound();
            updateDisplay();
            return;
        }

        if (key === 'DELETE') {
            if (currentInput.length > 0) {
                currentInput = currentInput.slice(0, -1);
                playKeySound();
                updateDisplay();
            }
            return;
        }

        if (key === 'ENTER') {
            if (currentInput.length === 5) {
                verifyPasscode();
            } else {
                showError('PLEASE ENTER ALL 5 DIGITS');
            }
            return;
        }

        if (currentInput.length < 5 && /^[0-9]$/.test(key)) {
            currentInput += key;
            playKeySound();
            updateDisplay();

            if (currentInput.length === 5) {
                setTimeout(verifyPasscode, 150);
            }
        }
    }

    // Update PIN Digits UI
    function updateDisplay() {
        const card = document.getElementById('attacks-passcode-card');
        if (card) {
            card.classList.remove('shake', 'success');
        }

        const msgEl = document.getElementById('attacks-status-msg');
        if (msgEl && !msgEl.classList.contains('error')) {
            msgEl.className = 'attacks-status-msg';
            msgEl.innerText = `DIGITS ENTERED: ${currentInput.length} / 5`;
        }

        for (let i = 0; i < 5; i++) {
            const box = document.getElementById(`digit-${i}`);
            if (box) {
                if (i < currentInput.length) {
                    box.innerText = '●'; // Bullet dot or number: currentInput[i]
                    box.classList.add('filled');
                    box.classList.remove('active-cursor');
                } else if (i === currentInput.length) {
                    box.innerText = '';
                    box.classList.remove('filled');
                    box.classList.add('active-cursor');
                } else {
                    box.innerText = '';
                    box.classList.remove('filled', 'active-cursor');
                }
            }
        }
    }

    // Verify 5-digit passcode
    function verifyPasscode() {
        if (isVerifying) return;
        isVerifying = true;

        const card = document.getElementById('attacks-passcode-card');
        const msgEl = document.getElementById('attacks-status-msg');

        if (currentInput === REQUIRED_PASSCODE) {
            // SUCCESS!
            playSuccessSound();
            sessionStorage.setItem('attacks_unlocked', 'true');

            card.classList.remove('shake');
            card.classList.add('success');

            msgEl.className = 'attacks-status-msg success';
            msgEl.innerText = '✓ ACCESS GRANTED! UNLOCKING...';

            // Reveal passcode digits brief highlight
            for (let i = 0; i < 5; i++) {
                const box = document.getElementById(`digit-${i}`);
                if (box) box.innerText = REQUIRED_PASSCODE[i];
            }

            setTimeout(() => {
                isVerifying = false;
                closeModal();

                if (pendingDestination) {
                    const dest = pendingDestination;
                    pendingDestination = null;
                    window.location.href = dest;
                } else if (isPageProtected()) {
                    // Page was locked, now unlocked! Remove overlay
                    const overlay = document.getElementById('attacks-passcode-modal');
                    if (overlay) overlay.classList.remove('active');
                }
            }, 600);

        } else {
            // INCORRECT PASSCODE
            playErrorSound();
            card.classList.remove('success');
            card.classList.add('shake');

            showError('❌ INCORRECT PASSCODE! ACCESS DENIED');

            setTimeout(() => {
                currentInput = '';
                isVerifying = false;
                card.classList.remove('shake');
                updateDisplay();
            }, 750);
        }
    }

    function showError(msg) {
        const msgEl = document.getElementById('attacks-status-msg');
        if (msgEl) {
            msgEl.className = 'attacks-status-msg error';
            msgEl.innerText = msg;
        }
    }

    function isPageProtected() {
        const path = window.location.pathname.toLowerCase();
        return path.endsWith('attacks_game.html') || path.endsWith('attacks_lobby.html');
    }

    // Public API
    window.openAttacksPasscodeModal = function(destinationUrl) {
        if (sessionStorage.getItem('attacks_unlocked') === 'true') {
            if (destinationUrl) window.location.href = destinationUrl;
            return;
        }

        pendingDestination = destinationUrl || null;
        currentInput = '';
        isVerifying = false;

        buildModalDOM();
        updateDisplay();

        const closeBtn = document.getElementById('attacks-close-btn');
        if (closeBtn) {
            closeBtn.style.display = isPageProtected() && !pendingDestination ? 'none' : 'flex';
        }

        const overlay = document.getElementById('attacks-passcode-modal');
        if (overlay) {
            overlay.classList.add('active');
        }
    };

    function closeModal() {
        const overlay = document.getElementById('attacks-passcode-modal');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    // Auto-check on page load if page requires passcode
    document.addEventListener('DOMContentLoaded', () => {
        if (isPageProtected() && sessionStorage.getItem('attacks_unlocked') !== 'true') {
            window.openAttacksPasscodeModal();
        }
    });

})();
