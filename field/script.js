// Signature Lookup Script
// Loads all signatures from JSON and searches case-insensitively

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
    const submitBtn = form.querySelector('.submit-btn');

    let signaturesData = null;

    // Load signatures JSON on page load
    async function loadSignatures() {
        try {
            const response = await fetch('signatures.json');
            if (!response.ok) throw new Error('Failed to load signatures');
            signaturesData = await response.json();
            console.log(`Loaded ${signaturesData.signatures.length} signatures`);
        } catch (error) {
            console.error('Error loading signatures:', error);
        }
    }

    // Normalize string for comparison (lowercase, trim, remove extra spaces)
    function normalize(str) {
        return str.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    // Find signature by first and last name (case-insensitive)
    function findSignature(firstName, lastName) {
        if (!signaturesData || !signaturesData.signatures) return null;

        const searchFirst = normalize(firstName);
        const searchLast = normalize(lastName);
        
        // Build search key: LASTNAME-FIRSTNAME (normalized for comparison)
        const searchKey = `${searchLast}-${searchFirst}`;

        for (const sig of signaturesData.signatures) {
            // Normalize the key for comparison
            const sigKey = normalize(sig.key);
            
            // Exact match
            if (sigKey === searchKey) {
                return sig.content.replace(/\|/g, '\n');
            }
        }

        // Try partial match (for hyphenated names, etc.)
        for (const sig of signaturesData.signatures) {
            const sigKey = normalize(sig.key);
            const parts = sigKey.split('-');
            
            // Check if lastName matches first part and firstName matches last part
            if (parts.length >= 2) {
                const sigLast = parts[0];
                const sigFirst = parts[parts.length - 1];
                
                if (sigLast === searchLast && sigFirst === searchFirst) {
                    return sig.content.replace(/\|/g, '\n');
                }
            }
        }

        // Try fuzzy match - check if names appear anywhere in the key
        for (const sig of signaturesData.signatures) {
            const sigKey = normalize(sig.key);
            if (sigKey.includes(searchFirst) && sigKey.includes(searchLast)) {
                return sig.content.replace(/\|/g, '\n');
            }
        }

        return null;
    }

    // Show result
    function showResult(signature) {
        resultSection.classList.remove('hidden');
        errorSection.classList.add('hidden');
        signatureOutput.textContent = signature;
    }

    // Show error
    function showError(message) {
        errorSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        errorMessage.textContent = message;
    }

    // Hide both sections
    function hideResults() {
        resultSection.classList.add('hidden');
        errorSection.classList.add('hidden');
    }

    // Copy to clipboard
    async function copyToClipboard() {
        const text = signatureOutput.textContent;
        
        try {
            await navigator.clipboard.writeText(text);
            
            // Show success state
            copyBtn.classList.add('copied');
            copyIcon.classList.add('hidden');
            checkIcon.classList.remove('hidden');
            copyText.textContent = 'Copied!';
            
            // Reset after 2 seconds
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyIcon.classList.remove('hidden');
                checkIcon.classList.add('hidden');
                copyText.textContent = 'Copy';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
            // Fallback for older browsers
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

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        
        if (!firstName || !lastName) {
            showError('Please enter both first and last name');
            return;
        }

        hideResults();

        // Wait for signatures to load if not yet loaded
        if (!signaturesData) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            await loadSignatures();
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }

        const signature = findSignature(firstName, lastName);
        
        if (signature) {
            showResult(signature);
        } else {
            showError(`Signature not found for "${firstName} ${lastName}"`);
        }
    });

    // Copy button click
    copyBtn.addEventListener('click', copyToClipboard);

    // Auto-focus first input
    firstNameInput.focus();

    // Pre-load signatures
    loadSignatures();
});
