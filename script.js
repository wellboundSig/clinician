// Signature Generator Script
// Parses employee spreadsheets and generates plain text signature files

class SignatureGenerator {
    constructor() {
        this.heroData = [];
        this.emailLookup = new Map(); // Multiple keys per person -> { email, source }
        this.phoneLookup = new Map(); // Multiple keys per person -> { phone, source }
        this.allReferenceData = []; // Store all reference sheet data for deep searching
        this.indexedNames = new Map(); // Track which names we indexed from each source
        this.generatedCount = 0;
        this.skippedCount = 0;
        
        this.initElements();
        this.bindEvents();
    }
    
    initElements() {
        this.heroFileInput = document.getElementById('heroFile');
        this.refFilesInput = document.getElementById('refFiles');
        this.txtFilesInput = document.getElementById('txtFiles');
        this.runBtn = document.getElementById('runBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.logOutput = document.getElementById('logOutput');
        
        this.heroFileText = document.getElementById('heroFileText');
        this.refFilesText = document.getElementById('refFilesText');
        this.txtFilesText = document.getElementById('txtFilesText');
        
        this.statusHero = document.getElementById('statusHero');
        this.statusRef = document.getElementById('statusRef');
        this.statusTxt = document.getElementById('statusTxt');
        this.statusGenerated = document.getElementById('statusGenerated');
        this.statusSkipped = document.getElementById('statusSkipped');
    }
    
    bindEvents() {
        // File input change handlers
        this.heroFileInput.addEventListener('change', (e) => this.handleHeroFile(e));
        this.refFilesInput.addEventListener('change', (e) => this.handleRefFiles(e));
        this.txtFilesInput.addEventListener('change', (e) => this.handleTxtFiles(e));
        
        // Button handlers
        this.runBtn.addEventListener('click', () => this.runGeneration());
        this.clearBtn.addEventListener('click', () => this.clearLogs());
        
        // Fallback: Make labels clickable
        document.querySelectorAll('.file-label').forEach(label => {
            label.addEventListener('click', (e) => {
                const wrapper = label.closest('.file-input-wrapper');
                const input = wrapper ? wrapper.querySelector('input[type="file"]') : null;
                if (input && e.target === label) {
                    input.click();
                }
            });
        });
        
        // Check if XLSX library loaded
        if (typeof XLSX === 'undefined') {
            this.log('WARNING: XLSX library not loaded. Excel parsing may fail.', 'warning');
            this.log('Try running with a local server: python3 -m http.server 8000', 'warning');
        } else {
            this.log('XLSX library loaded successfully', 'success');
        }
    }
    
    log(message, type = 'info') {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        line.textContent = `[${timestamp}] ${message}`;
        this.logOutput.appendChild(line);
        this.logOutput.scrollTop = this.logOutput.scrollHeight;
    }
    
    clearLogs() {
        this.logOutput.innerHTML = '';
        this.log('Logs cleared', 'system');
        this.log('Ready for input files...', 'system');
    }
    
    updateStatus() {
        this.statusGenerated.textContent = `GENERATED: ${this.generatedCount}`;
        this.statusSkipped.textContent = `SKIPPED: ${this.skippedCount}`;
    }
    
    checkRunnable() {
        this.runBtn.disabled = this.heroData.length === 0;
    }
    
    // ==================== NAME NORMALIZATION ====================
    
    // Clean and normalize a name component
    normalizeNamePart(name) {
        if (!name) return '';
        return name.toString()
            .toLowerCase()
            .trim()
            .replace(/[^a-z\-\']/g, '') // Keep only letters, hyphens, apostrophes
            .replace(/\s+/g, '');
    }
    
    // Generate multiple lookup keys for a name to handle various formats
    generateNameKeys(firstName, lastName) {
        const first = this.normalizeNamePart(firstName);
        const last = this.normalizeNamePart(lastName);
        
        if (!first && !last) return [];
        
        const keys = [];
        
        // Standard keys
        if (first && last) {
            keys.push(`${first}|${last}`);
            keys.push(`${last}|${first}`);
            keys.push(`${first}${last}`); // No separator
            keys.push(`${last}${first}`);
        }
        
        // Handle hyphenated names - also try first part only
        if (last && last.includes('-')) {
            const lastParts = last.split('-');
            for (const part of lastParts) {
                if (first) {
                    keys.push(`${first}|${part}`);
                    keys.push(`${part}|${first}`);
                }
            }
        }
        
        if (first && first.includes('-')) {
            const firstParts = first.split('-');
            for (const part of firstParts) {
                if (last) {
                    keys.push(`${part}|${last}`);
                    keys.push(`${last}|${part}`);
                }
            }
        }
        
        return [...new Set(keys)]; // Remove duplicates
    }
    
    // Parse a combined name string into first and last name
    parseNameFromCombined(combinedName) {
        if (!combinedName) return { firstName: '', lastName: '' };
        
        let name = combinedName.toString().trim();
        let firstName = '';
        let lastName = '';
        
        // Remove quotes if present
        name = name.replace(/^["']|["']$/g, '');
        
        if (name.includes(',')) {
            // Format: "Last, First" or "LAST, FIRST"
            const parts = name.split(',').map(p => p.trim());
            lastName = parts[0] || '';
            firstName = parts[1] || '';
        } else {
            // Format: "First Last" or "First Middle Last" or "FIRST LAST"
            const parts = name.split(/\s+/).filter(p => p);
            if (parts.length >= 2) {
                firstName = parts[0];
                // Handle names like "Jennifer McIntosh-Wright" - last name is everything after first
                lastName = parts.slice(1).join(' ');
                // But for matching, we'll use just the last word as primary last name
                if (parts.length > 2) {
                    // Store the actual last word as the last name for key generation
                    lastName = parts[parts.length - 1];
                }
            } else if (parts.length === 1) {
                // Just one name - could be either
                firstName = parts[0];
            }
        }
        
        return { firstName, lastName };
    }
    
    // Convert to proper case: first letter uppercase, rest lowercase
    formatName(name) {
        if (!name) return '';
        return name.toString()
            .toLowerCase()
            .split(/[\s\-]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(name.includes('-') ? '-' : ' ');
    }
    
    // ==================== PHONE NUMBER DETECTION ====================
    
    // Check if a value looks like a phone number
    isPhoneNumber(value) {
        if (!value) return false;
        const str = value.toString().trim();
        // Remove common separators and check if we have 10-11 digits
        const digits = str.replace(/[\s\-\.\(\)]+/g, '');
        // Must be mostly digits (allow for some non-digit chars like ext)
        const digitCount = (digits.match(/\d/g) || []).length;
        // Phone numbers typically have 10 digits (US) or 11 (with country code)
        // Also accept 7 digits (local)
        if (digitCount >= 7 && digitCount <= 15) {
            // Make sure it's not just a random number - should have phone-like patterns
            // At least 7 consecutive or separated digits
            if (/\d{3}[\s\-\.]?\d{3}[\s\-\.]?\d{4}/.test(str) || 
                /\(\d{3}\)\s*\d{3}[\s\-\.]?\d{4}/.test(str) ||
                /\d{10,11}/.test(digits)) {
                return true;
            }
        }
        return false;
    }
    
    // Format phone number with periods
    formatPhoneNumber(phone) {
        if (!phone) return '';
        const str = phone.toString().trim();
        // Extract just digits
        const digits = str.replace(/\D/g, '');
        if (digits.length === 10) {
            return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
        } else if (digits.length === 11 && digits[0] === '1') {
            return `${digits.slice(1,4)}.${digits.slice(4,7)}.${digits.slice(7)}`;
        } else if (digits.length >= 7) {
            // Best effort formatting
            if (digits.length === 7) {
                return `${digits.slice(0,3)}.${digits.slice(3)}`;
            }
            return str; // Return original if can't format nicely
        }
        return str;
    }
    
    // ==================== EMAIL DETECTION ====================
    
    isEmail(value) {
        if (!value) return false;
        const str = value.toString().trim().toLowerCase();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
    }
    
    // ==================== DATA STORAGE ====================
    
    // Store email with multiple key variants for lookup
    storeEmail(firstName, lastName, email, source = 'unknown') {
        if (!email || !this.isEmail(email)) return;
        
        const keys = this.generateNameKeys(firstName, lastName);
        const displayName = `${firstName} ${lastName}`.trim();
        
        for (const key of keys) {
            if (!this.emailLookup.has(key)) {
                this.emailLookup.set(key, { 
                    email: email.toLowerCase().trim(), 
                    source,
                    name: displayName
                });
            }
        }
        
        // Track indexed names per source
        if (!this.indexedNames.has(source)) {
            this.indexedNames.set(source, new Set());
        }
        this.indexedNames.get(source).add(displayName.toLowerCase());
    }
    
    // Store phone with multiple key variants for lookup
    storePhone(firstName, lastName, phone, source = 'unknown') {
        if (!phone || !this.isPhoneNumber(phone)) return;
        
        const keys = this.generateNameKeys(firstName, lastName);
        for (const key of keys) {
            if (!this.phoneLookup.has(key)) {
                this.phoneLookup.set(key, { 
                    phone: phone.toString().trim(), 
                    source 
                });
            }
        }
    }
    
    // Look up email using multiple key strategies - returns { email, source } or null
    findEmail(firstName, lastName) {
        const keys = this.generateNameKeys(firstName, lastName);
        for (const key of keys) {
            if (this.emailLookup.has(key)) {
                return this.emailLookup.get(key);
            }
        }
        return null;
    }
    
    // Look up phone using multiple key strategies - returns { phone, source } or null
    findPhoneFromLookup(firstName, lastName) {
        const keys = this.generateNameKeys(firstName, lastName);
        for (const key of keys) {
            if (this.phoneLookup.has(key)) {
                return this.phoneLookup.get(key);
            }
        }
        return null;
    }
    
    // ==================== FILE HANDLERS ====================
    
    findColumnIndex(headers, possibleNames) {
        const normalizedHeaders = headers.map(h => (h || '').toString().toLowerCase().trim());
        for (const name of possibleNames) {
            const idx = normalizedHeaders.indexOf(name.toLowerCase());
            if (idx !== -1) return idx;
        }
        // Partial match
        for (const name of possibleNames) {
            const idx = normalizedHeaders.findIndex(h => h.includes(name.toLowerCase()));
            if (idx !== -1) return idx;
        }
        return -1;
    }
    
    async handleHeroFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.log(`Loading hero spreadsheet: ${file.name}`, 'info');
        this.heroFileText.textContent = file.name;
        this.heroFileInput.parentElement.querySelector('.file-label').classList.add('has-file');
        
        try {
            const data = await this.readSpreadsheet(file);
            if (data.length < 2) {
                this.log('ERROR: Hero spreadsheet appears empty or has no data rows', 'error');
                return;
            }
            
            const headers = data[0];
            const rows = data.slice(1);
            
            // Find required columns
            const lastNameIdx = this.findColumnIndex(headers, ['last name', 'lastname', 'last']);
            const firstNameIdx = this.findColumnIndex(headers, ['first name', 'firstname', 'first']);
            const jobDescIdx = this.findColumnIndex(headers, ['primary job description', 'job description', 'job title', 'title']);
            const cellPhoneIdx = this.findColumnIndex(headers, ['cell phone', 'cellphone', 'cell', 'mobile']);
            const workPhoneIdx = this.findColumnIndex(headers, ['work phone', 'workphone', 'office phone', 'phone']);
            const homePhoneIdx = this.findColumnIndex(headers, ['home phone', 'homephone', 'home']);
            const workEmailIdx = this.findColumnIndex(headers, ['work email', 'workemail', 'email']);
            
            if (lastNameIdx === -1 || firstNameIdx === -1) {
                this.log('ERROR: Could not find First Name and Last Name columns', 'error');
                return;
            }
            
            this.heroData = [];
            for (const row of rows) {
                if (!row[firstNameIdx] && !row[lastNameIdx]) continue; // Skip empty rows
                
                const employee = {
                    firstName: this.formatName(row[firstNameIdx]),
                    lastName: this.formatName(row[lastNameIdx]),
                    jobDescription: row[jobDescIdx] || '',
                    cellPhone: row[cellPhoneIdx] || '',
                    workPhone: row[workPhoneIdx] || '',
                    homePhone: row[homePhoneIdx] || '',
                    workEmail: row[workEmailIdx] || ''
                };
                
                // Also store hero data in lookups for cross-referencing
                if (employee.workEmail && this.isEmail(employee.workEmail)) {
                    this.storeEmail(employee.firstName, employee.lastName, employee.workEmail, `HERO:${file.name}`);
                }
                if (employee.cellPhone && this.isPhoneNumber(employee.cellPhone)) {
                    this.storePhone(employee.firstName, employee.lastName, employee.cellPhone, `HERO:${file.name}`);
                }
                if (employee.workPhone && this.isPhoneNumber(employee.workPhone)) {
                    this.storePhone(employee.firstName, employee.lastName, employee.workPhone, `HERO:${file.name}`);
                }
                if (employee.homePhone && this.isPhoneNumber(employee.homePhone)) {
                    this.storePhone(employee.firstName, employee.lastName, employee.homePhone, `HERO:${file.name}`);
                }
                
                this.heroData.push(employee);
            }
            
            this.log(`Loaded ${this.heroData.length} employees from hero spreadsheet`, 'success');
            this.statusHero.textContent = `HERO: ${this.heroData.length}`;
            this.checkRunnable();
            
        } catch (err) {
            this.log(`ERROR parsing hero file: ${err.message}`, 'error');
        }
    }
    
    async handleRefFiles(event) {
        const files = event.target.files;
        if (!files.length) return;
        
        this.refFilesText.textContent = `${files.length} file(s) selected`;
        this.refFilesInput.parentElement.querySelector('.file-label').classList.add('has-file');
        
        let totalEmails = 0;
        let totalPhones = 0;
        
        for (const file of files) {
            this.log(`Processing reference file: ${file.name}`, 'info');
            
            try {
                const data = await this.readSpreadsheet(file);
                if (data.length < 2) {
                    this.log(`WARNING: ${file.name} appears empty`, 'warning');
                    continue;
                }
                
                const headers = data[0];
                const rows = data.slice(1);
                
                // Store reference data for deep searching later
                this.allReferenceData.push({ headers, rows, fileName: file.name });
                
                // Try to find name columns (could be combined or separate)
                const lastNameIdx = this.findColumnIndex(headers, ['last name', 'lastname', 'last']);
                const firstNameIdx = this.findColumnIndex(headers, ['first name', 'firstname', 'first']);
                const combinedNameIdx = this.findColumnIndex(headers, ['therapist', 'name', 'employee', 'staff', 'full name', 'fullname', 'employee name']);
                
                const hasSeparateNames = lastNameIdx !== -1 && firstNameIdx !== -1;
                const hasCombinedName = combinedNameIdx !== -1;
                
                if (!hasSeparateNames && !hasCombinedName) {
                    this.log(`WARNING: Could not identify name columns in ${file.name}, will scan all columns`, 'warning');
                }
                
                // Scan ALL columns for emails and phones
                let fileEmails = 0;
                let filePhones = 0;
                const namesInFile = new Set();
                
                for (const row of rows) {
                    let firstName = '', lastName = '';
                    
                    // Get the name first
                    if (hasSeparateNames) {
                        firstName = row[firstNameIdx]?.toString() || '';
                        lastName = row[lastNameIdx]?.toString() || '';
                    } else if (hasCombinedName) {
                        const parsed = this.parseNameFromCombined(row[combinedNameIdx]);
                        firstName = parsed.firstName;
                        lastName = parsed.lastName;
                    }
                    
                    if (!firstName && !lastName) continue;
                    
                    namesInFile.add(`${firstName} ${lastName}`.toLowerCase().trim());
                    
                    // Scan ALL columns for emails and phone numbers
                    for (let i = 0; i < row.length; i++) {
                        const value = row[i];
                        if (!value) continue;
                        
                        const strValue = value.toString().trim();
                        
                        // Check if it's an email
                        if (this.isEmail(strValue)) {
                            this.storeEmail(firstName, lastName, strValue, `REF:${file.name}`);
                            totalEmails++;
                            fileEmails++;
                        }
                        
                        // Check if it's a phone number
                        if (this.isPhoneNumber(strValue)) {
                            this.storePhone(firstName, lastName, strValue, `REF:${file.name}`);
                            totalPhones++;
                            filePhones++;
                        }
                    }
                }
                
                this.log(`Processed ${file.name}: ${namesInFile.size} names, ${fileEmails} emails, ${filePhones} phones`, 'success');
                
            } catch (err) {
                this.log(`ERROR parsing ${file.name}: ${err.message}`, 'error');
            }
        }
        
        this.log(`Reference files indexed: ${this.emailLookup.size} email entries, ${this.phoneLookup.size} phone entries`, 'success');
        this.statusRef.textContent = `REF: ${files.length}`;
    }
    
    async handleTxtFiles(event) {
        const files = event.target.files;
        if (!files.length) return;
        
        this.txtFilesText.textContent = `${files.length} file(s) selected`;
        this.txtFilesInput.parentElement.querySelector('.file-label').classList.add('has-file');
        
        let totalEmails = 0;
        
        for (const file of files) {
            this.log(`Processing TXT file: ${file.name}`, 'info');
            let fileEmails = 0;
            
            try {
                const text = await file.text();
                
                // Parse various formats:
                // "Name Name" <email@domain.com>;
                // <email@domain.com>;
                // Split by semicolon first
                const entries = text.split(';');
                
                for (const entry of entries) {
                    const trimmed = entry.trim();
                    if (!trimmed) continue;
                    
                    // Try to extract email
                    const emailMatch = trimmed.match(/<([^>]+@[^>]+)>/);
                    if (emailMatch) {
                        const email = emailMatch[1].trim();
                        
                        // Try to extract name (before the email)
                        const nameMatch = trimmed.match(/^"([^"]+)"/);
                        if (nameMatch) {
                            const fullName = nameMatch[1].trim();
                            const parsed = this.parseNameFromCombined(fullName);
                            if (parsed.firstName || parsed.lastName) {
                                this.storeEmail(parsed.firstName, parsed.lastName, email, `TXT:${file.name}`);
                                totalEmails++;
                                fileEmails++;
                            }
                        } else {
                            // No name found - try to derive from email
                            // e.g., jmcnair@wellboundhc.com -> might be J McNair
                            // Store by email prefix as a fallback searchable
                        }
                    }
                }
                
                this.log(`Extracted ${fileEmails} emails from ${file.name}`, 'success');
                
            } catch (err) {
                this.log(`ERROR parsing ${file.name}: ${err.message}`, 'error');
            }
        }
        
        this.log(`TXT files: Total email lookup entries: ${this.emailLookup.size}`, 'success');
        this.statusTxt.textContent = `TXT: ${files.length}`;
    }
    
    async readSpreadsheet(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    resolve(jsonData);
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }
    
    // ==================== GENERATION ====================
    
    getEmployeeEmail(employee) {
        // First check if hero sheet has email
        if (employee.workEmail && this.isEmail(employee.workEmail)) {
            return { email: employee.workEmail, source: 'HERO (direct)' };
        }
        
        // Then check lookup tables
        const found = this.findEmail(employee.firstName, employee.lastName);
        if (found) {
            return { email: found.email, source: found.source };
        }
        return null;
    }
    
    getEmployeePhone(employee) {
        // Priority: Cell Phone > Work Phone > Home Phone > Lookup tables
        if (employee.cellPhone && this.isPhoneNumber(employee.cellPhone)) {
            return { phone: this.formatPhoneNumber(employee.cellPhone), source: 'HERO:cellPhone' };
        }
        if (employee.workPhone && this.isPhoneNumber(employee.workPhone)) {
            return { phone: this.formatPhoneNumber(employee.workPhone), source: 'HERO:workPhone' };
        }
        if (employee.homePhone && this.isPhoneNumber(employee.homePhone)) {
            return { phone: this.formatPhoneNumber(employee.homePhone), source: 'HERO:homePhone' };
        }
        
        // Fallback to lookup tables
        const lookupPhone = this.findPhoneFromLookup(employee.firstName, employee.lastName);
        if (lookupPhone) {
            return { phone: this.formatPhoneNumber(lookupPhone.phone), source: lookupPhone.source };
        }
        
        return { phone: '', source: 'none' };
    }
    
    generateSignatureText(employee, email, phone) {
        const name = `${employee.firstName} ${employee.lastName}`;
        const jobDesc = employee.jobDescription || '';
        
        const lines = [
            name,
            jobDesc,
            'Wellbound Certified Home Health Agency',
            `Phone | ${phone}`,
            `Email | ${email}`
        ];
        
        return lines.join('\n');
    }
    
    async runGeneration() {
        if (this.heroData.length === 0) {
            this.log('ERROR: No hero data loaded', 'error');
            return;
        }
        
        this.log('Starting signature generation...', 'system');
        this.log(`Email lookup has ${this.emailLookup.size} entries`, 'info');
        this.log(`Phone lookup has ${this.phoneLookup.size} entries`, 'info');
        this.log('Requesting output folder selection...', 'info');
        
        // Request directory access
        let directoryHandle;
        try {
            directoryHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'downloads'
            });
        } catch (err) {
            if (err.name === 'AbortError') {
                this.log('Folder selection cancelled', 'warning');
            } else {
                this.log(`ERROR: ${err.message}`, 'error');
            }
            return;
        }
        
        this.log(`Output folder selected: ${directoryHandle.name}`, 'success');
        this.generatedCount = 0;
        this.skippedCount = 0;
        this.runBtn.disabled = true;
        document.body.classList.add('processing');
        
        const skippedNames = [];
        
        for (const employee of this.heroData) {
            const emailResult = this.getEmployeeEmail(employee);
            const phoneResult = this.getEmployeePhone(employee);
            
            if (!emailResult) {
                // Log more details about why we couldn't find the email
                const searchKeys = this.generateNameKeys(employee.firstName, employee.lastName);
                this.log(`SKIPPED: ${employee.firstName} ${employee.lastName} - no email found (searched keys: ${searchKeys.slice(0,2).join(', ')})`, 'warning');
                skippedNames.push(`${employee.firstName} ${employee.lastName}`);
                this.skippedCount++;
                this.updateStatus();
                continue;
            }
            
            const signatureText = this.generateSignatureText(employee, emailResult.email, phoneResult.phone);
            const fileName = `${employee.lastName.toUpperCase()}-${employee.firstName.toUpperCase()}.txt`;
            
            try {
                const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(signatureText);
                await writable.close();
                
                this.log(`CREATED: ${fileName} | email from: ${emailResult.source} | phone from: ${phoneResult.source}`, 'success');
                this.generatedCount++;
                this.updateStatus();
                
            } catch (err) {
                this.log(`ERROR writing ${fileName}: ${err.message}`, 'error');
                this.skippedCount++;
                this.updateStatus();
            }
        }
        
        document.body.classList.remove('processing');
        this.runBtn.disabled = false;
        this.log(`========================================`, 'system');
        this.log(`Generation complete: ${this.generatedCount} created, ${this.skippedCount} skipped`, 'system');
        
        // Show summary of indexed names per source
        if (this.indexedNames.size > 0) {
            this.log(`--- Indexed names by source ---`, 'info');
            for (const [source, names] of this.indexedNames) {
                this.log(`${source}: ${names.size} unique names`, 'info');
            }
        }
        
        if (skippedNames.length > 0) {
            this.log(`--- Skipped employees (${skippedNames.length}) ---`, 'warning');
            if (skippedNames.length <= 30) {
                this.log(`${skippedNames.join(', ')}`, 'warning');
            } else {
                this.log(`${skippedNames.slice(0, 30).join(', ')}... and ${skippedNames.length - 30} more`, 'warning');
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        const generator = new SignatureGenerator();
        console.log('SignatureGenerator initialized successfully');
    } catch (err) {
        console.error('Failed to initialize SignatureGenerator:', err);
        const logOutput = document.getElementById('logOutput');
        if (logOutput) {
            const errorLine = document.createElement('div');
            errorLine.className = 'log-line error';
            errorLine.textContent = `[ERROR] Failed to initialize: ${err.message}`;
            logOutput.appendChild(errorLine);
        }
    }
});

// Also try immediate initialization in case DOMContentLoaded already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        if (!window.signatureGeneratorInitialized) {
            window.signatureGeneratorInitialized = true;
            try {
                new SignatureGenerator();
            } catch (err) {
                console.error('Failed to initialize:', err);
            }
        }
    }, 100);
}
