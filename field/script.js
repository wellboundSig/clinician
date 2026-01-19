// Signature Lookup Script
// Fetches pre-generated signatures from the EXPORTSIG folder

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

    // Format name for filename lookup (LASTNAME-FIRSTNAME.txt)
    function formatNameForLookup(firstName, lastName) {
        // Clean and uppercase the names
        const cleanFirst = firstName.trim().toUpperCase().replace(/\s+/g, '-');
        const cleanLast = lastName.trim().toUpperCase().replace(/\s+/g, '-');
        return `${cleanLast}-${cleanFirst}.txt`;
    }

    // Fetch signature file
    async function fetchSignature(firstName, lastName) {
        const filename = formatNameForLookup(firstName, lastName);
        const url = `../EXPORTSIG/${filename}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Signature not found for ${firstName} ${lastName}`);
            }
            return await response.text();
        } catch (error) {
            console.error('Error fetching signature:', error);
            throw error;
        }
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

        // Add loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        hideResults();

        try {
            const signature = await fetchSignature(firstName, lastName);
            showResult(signature);
        } catch (error) {
            showError(`Signature not found for "${firstName} ${lastName}"`);
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });

    // Copy button click
    copyBtn.addEventListener('click', copyToClipboard);

    // Auto-focus first input
    firstNameInput.focus();
});
