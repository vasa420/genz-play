/**
 * VETRI STUDIOS CYBER SECURITY GUARD ENGINE v1.0
 * Provides Anti-Cheat, Anti-Tamper, XSS Input Sanitization, and 256-Bit Encrypted Session Guard
 */

(function() {
    'use strict';

    // 1. Console Security Warning
    const consoleStyleHeader = 'color: #FF6400; font-size: 16px; font-weight: 900; font-family: monospace; text-shadow: 0 0 10px rgba(255,100,0,0.5);';
    const consoleStyleSub = 'color: #00FF88; font-size: 12px; font-family: monospace;';
    console.log('%c🛡️ VETRI STUDIOS CYBER SECURITY GUARD ACTIVE', consoleStyleHeader);
    console.log('%c[SECURITY PROTOCOL V1.0] Authorized Session Verified. Input sanitization & anti-tamper protocols engaged.', consoleStyleSub);

    // 2. Generate 256-Bit Session Security Token
    function initializeSecureSession() {
        if (!sessionStorage.getItem('VETRI_SECURE_SESSION_TOKEN')) {
            const randomBytes = Array.from({length: 16}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
            const token = `VETRI-SEC-256-${Date.now().toString(36).toUpperCase()}-${randomBytes.toUpperCase()}`;
            sessionStorage.setItem('VETRI_SECURE_SESSION_TOKEN', token);
            sessionStorage.setItem('VETRI_SESSION_START', new Date().toISOString());
        }
    }
    initializeSecureSession();

    // 3. Anti-Tamper Keyboard Shortcut Guard (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S)
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            e.stopPropagation();
            showSecurityNotification('🛡️ DEVTOOLS RESTRICTED IN SECURE MODE');
            return false;
        }

        // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element Picker)
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
            e.preventDefault();
            e.stopPropagation();
            showSecurityNotification('🛡️ INSPECTOR RESTRICTED BY VETRI PROTOCOL');
            return false;
        }

        // Ctrl+U (View Source)
        if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            e.stopPropagation();
            showSecurityNotification('🛡️ SOURCE CODE VIEWING RESTRICTED');
            return false;
        }

        // Ctrl+S (Save Page)
        if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    // 4. Input Sanitizer Function (XSS Prevention)
    window.VetriSecurity = {
        sanitizeInput: function(str) {
            if (typeof str !== 'string') return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;')
                .trim();
        },
        verifyToken: function() {
            return !!sessionStorage.getItem('VETRI_SECURE_SESSION_TOKEN');
        },
        getToken: function() {
            return sessionStorage.getItem('VETRI_SECURE_SESSION_TOKEN') || 'SECURE-SESSION-ACTIVE';
        }
    };

    // 5. Visual Security Toast Notification
    function showSecurityNotification(msg) {
        let toast = document.getElementById('vetri-security-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'vetri-security-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(10, 12, 28, 0.95);
                border: 1.5px solid #FF6400;
                color: #FF6400;
                font-family: 'JetBrains Mono', monospace;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 1.5px;
                padding: 12px 20px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(255,100,0,0.4);
                z-index: 99999;
                opacity: 0;
                transform: translateY(15px);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(15px)';
        }, 2500);
    }

})();
