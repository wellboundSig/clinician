// ── Paste your deployed Apps Script Web App URL here ──
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx41Jh09zhrKP9HBH1vvW4ojxviFkvP-Q1rnl86nfZL8QMZWMJYdfkJgxL8cNg3xYMP/exec';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signatureForm');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const resultSection = document.getElementById('resultSection');
    const errorSection = document.getElementById('errorSection');
    const signatureOutput = document.getElementById('signatureOutput');
    const errorMessage = document.getElementById('errorMessage');
    const copyBtn = document.getElementById('copyBtn');
    const copyIcon = document.getElementById('copyIcon');
    const checkIcon = document.getElementById('checkIcon');
    const copyText = document.getElementById('copyText');
    const submitBtn = form ? form.querySelector('.submit-btn') : null;

    let signaturesData = null;   // from local signatures.json
    let sheetSignatures = null;  // from Google Sheet via Apps Script

    // ---- Data loading ----

    function getSignaturesJsonPath() {
        const path = window.location.pathname;
        if (path.match(/\/field\/[^/]+\/?$/) && !path.endsWith('/field/')) {
            return '../signatures.json';
        }
        return 'signatures.json';
    }

    async function loadLocalSignatures() {
        if (signaturesData) return true;
        try {
            const jsonPath = getSignaturesJsonPath();
            const response = await fetch(jsonPath);
            if (!response.ok) throw new Error('Failed to load signatures');
            signaturesData = await response.json();
            console.log(`[local] Loaded ${signaturesData.signatures.length} signatures`);
            return true;
        } catch (error) {
            console.error('Error loading local signatures:', error);
            return false;
        }
    }

    async function loadSheetSignatures() {
        if (sheetSignatures) return true;
        if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'PASTE_YOUR_WEB_APP_URL_HERE') return false;
        try {
            const response = await fetch(APPS_SCRIPT_URL);
            if (!response.ok) throw new Error('Sheet fetch failed');
            const data = await response.json();
            if (data.signatures) {
                sheetSignatures = data;
                console.log(`[sheet] Loaded ${sheetSignatures.signatures.length} signatures`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error loading sheet signatures:', error);
            return false;
        }
    }

    async function loadAllSignatures() {
        await Promise.all([loadLocalSignatures(), loadSheetSignatures()]);
    }

    // ---- Search helpers ----

    function normalize(str) {
        return str.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    function searchInSource(source, firstName, lastName) {
        if (!source || !source.signatures) return null;

        const searchFirst = normalize(firstName);
        const searchLast = normalize(lastName);
        const searchKey = `${searchLast}-${searchFirst}`;

        // Exact key match
        for (const sig of source.signatures) {
            if (normalize(sig.key) === searchKey) return sig.content;
        }

        // Partial match for hyphenated names
        for (const sig of source.signatures) {
            const sigKey = normalize(sig.key);
            const parts = sigKey.split('-');
            if (parts.length >= 2) {
                const sigLast = parts[0];
                const sigFirst = parts[parts.length - 1];
                if (sigLast === searchLast && sigFirst === searchFirst) return sig.content;
            }
        }

        // Fuzzy match
        for (const sig of source.signatures) {
            const sigKey = normalize(sig.key);
            if (sigKey.includes(searchFirst) && sigKey.includes(searchLast)) return sig.content;
        }

        return null;
    }

    function findSignature(firstName, lastName) {
        // Check local JSON first, then Google Sheet
        return searchInSource(signaturesData, firstName, lastName)
            || searchInSource(sheetSignatures, firstName, lastName);
    }

    function searchSlugInSource(source, slug) {
        if (!source || !source.signatures) return null;
        const normalizedSlug = normalize(slug);

        for (const sig of source.signatures) {
            if (normalize(sig.key) === normalizedSlug) return sig.content;
        }

        const parts = normalizedSlug.split('-');
        if (parts.length >= 2) {
            const first = parts[0];
            const last = parts.slice(1).join('-');
            let result = searchInSource(source, first, last);
            if (result) return result;
            result = searchInSource(source, last, first);
            if (result) return result;
        }

        return null;
    }

    function findSignatureBySlug(slug) {
        return searchSlugInSource(signaturesData, slug)
            || searchSlugInSource(sheetSignatures, slug);
    }

    // ---- UI helpers ----

    function showResult(signature) {
        resultSection.classList.remove('hidden');
        errorSection.classList.add('hidden');
        signatureOutput.textContent = signature;
    }

    function showError(message) {
        errorSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        errorMessage.textContent = message;
    }

    function hideResults() {
        resultSection.classList.add('hidden');
        errorSection.classList.add('hidden');
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
            console.error('Failed to copy:', error);
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

    function getNameFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/field\/([^/]+)\/?$/);
        if (match && match[1] && match[1] !== 'index.html') {
            return match[1];
        }
        return null;
    }

    // ---- Event listeners ----

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = firstNameInput.value.trim();
            const lastName = lastNameInput.value.trim();

            if (!firstName || !lastName) {
                showError('Please enter both first and last name');
                return;
            }

            hideResults();

            if (!signaturesData && !sheetSignatures) {
                if (submitBtn) {
                    submitBtn.classList.add('loading');
                    submitBtn.disabled = true;
                }
                await loadAllSignatures();
                if (submitBtn) {
                    submitBtn.classList.remove('loading');
                    submitBtn.disabled = false;
                }
            }

            const signature = findSignature(firstName, lastName);

            if (signature) {
                showResult(signature);
            } else {
                showError(`Signature not found for "${firstName} ${lastName}"`);
            }
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copyToClipboard);
    }

    if (firstNameInput && form && form.style.display !== 'none') {
        firstNameInput.focus();
    }

    // ---- Init ----

    async function init() {
        await loadAllSignatures();

        const nameSlug = getNameFromUrl();
        if (nameSlug) {
            const signature = findSignatureBySlug(nameSlug);
            if (signature) {
                if (form) form.style.display = 'none';
                showResult(signature);
            } else {
                showError(`Signature not found for "${nameSlug.replace(/-/g, ' ')}"`);
            }
        }
    }

    init();
});
