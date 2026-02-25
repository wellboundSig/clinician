// ── Paste your deployed Apps Script Web App URL here ──
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx41Jh09zhrKP9HBH1vvW4ojxviFkvP-Q1rnl86nfZL8QMZWMJYdfkJgxL8cNg3xYMP/exec';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('generatorForm');
    const resultSection = document.getElementById('resultSection');
    const signatureOutput = document.getElementById('signatureOutput');
    const copyBtn = document.getElementById('copyBtn');
    const copyIcon = document.getElementById('copyIcon');
    const checkIcon = document.getElementById('checkIcon');
    const copyText = document.getElementById('copyText');
    const phoneInput = document.getElementById('phone');
    const submitBtn = form.querySelector('.submit-btn');
    const submitBtnText = submitBtn.querySelector('span');

    // Auto-format phone number as user types (XXX.XXX.XXXX)
    phoneInput.addEventListener('input', (e) => {
        let digits = e.target.value.replace(/\D/g, '');
        if (digits.length > 10) digits = digits.slice(0, 10);

        let formatted = '';
        if (digits.length > 6) {
            formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
        } else if (digits.length > 3) {
            formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
        } else {
            formatted = digits;
        }
        e.target.value = formatted;
    });

    function generateSignature(firstName, lastName, discipline, phone, email) {
        const lines = [
            `${firstName} ${lastName}`,
            discipline,
            'Wellbound Certified Home Health Agency',
            `Phone | ${phone}`,
            `Email | ${email}`
        ];
        return lines.join('\n');
    }

    function setLoading(loading) {
        submitBtn.disabled = loading;
        submitBtn.classList.toggle('loading', loading);
        submitBtnText.textContent = loading ? 'Saving…' : 'Generate Signature';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const firstName  = document.getElementById('firstName').value.trim();
        const lastName   = document.getElementById('lastName').value.trim();
        const discipline = document.getElementById('discipline').value;
        const phone      = phoneInput.value.trim();
        const email      = document.getElementById('email').value.trim();

        const signature = generateSignature(firstName, lastName, discipline, phone, email);

        signatureOutput.textContent = signature;
        resultSection.classList.remove('hidden');
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Save to Google Sheet in the background
        if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== 'PASTE_YOUR_WEB_APP_URL_HERE') {
            setLoading(true);
            try {
                await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        discipline,
                        phone,
                        email
                    })
                });
                showStatus('Saved to Google Sheet', 'success');
            } catch (err) {
                console.error('Failed to save to sheet:', err);
                showStatus('Signature generated but could not save to sheet', 'error');
            } finally {
                setLoading(false);
            }
        }
    });

    function showStatus(message, type) {
        let statusEl = document.getElementById('statusMessage');
        if (!statusEl) {
            statusEl = document.createElement('p');
            statusEl.id = 'statusMessage';
            resultSection.appendChild(statusEl);
        }
        statusEl.textContent = message;
        statusEl.className = `status-message status-${type}`;
        setTimeout(() => statusEl.remove(), 4000);
    }

    async function copyToClipboard() {
        const text = signatureOutput.textContent;

        try {
            await navigator.clipboard.writeText(text);

            copyBtn.classList.add('copied');
            copyIcon.classList.add('hidden');
            checkIcon.classList.remove('hidden');
            copyText.textContent = 'Copied!';

            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyIcon.classList.remove('hidden');
                checkIcon.classList.add('hidden');
                copyText.textContent = 'Copy';
            }, 2000);
        } catch (error) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            copyText.textContent = 'Copied!';
            setTimeout(() => {
                copyText.textContent = 'Copy';
            }, 2000);
        }
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copyToClipboard);
    }

    document.getElementById('firstName').focus();
});
