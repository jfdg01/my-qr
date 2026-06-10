let state = {
    cardNumber: '',
    deviceId: '',
    constant: '',
    timerInterval: null,
    wakeLock: null
};

let profiles = [];

document.addEventListener('DOMContentLoaded', () => {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || (systemDark ? 'dark' : 'light');
    setTheme(savedTheme);

    const storedProfiles = localStorage.getItem('bf_profiles');
    if (storedProfiles) {
        profiles = JSON.parse(storedProfiles);
        updateProfileSelect();
    }

    const legacyCard = localStorage.getItem('bf_card');
    const legacyDevice = localStorage.getItem('bf_device');
    if (legacyCard && legacyDevice && profiles.length === 0) {
        profiles.push({ name: 'Mon Profil', card: legacyCard, device: legacyDevice });
        saveProfilesToStorage();
        updateProfileSelect();
        localStorage.removeItem('bf_card');
        localStorage.removeItem('bf_device');
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('card') && urlParams.has('device')) {
        state.cardNumber = urlParams.get('card');
        state.deviceId = urlParams.get('device');
        state.constant = urlParams.get('constant') || urlParams.get('guid') || '';
        showQrView();
    } else {
        const favIndex = profiles.findIndex(p => p.favorite);
        if (favIndex !== -1) {
            document.getElementById('profileSelect').value = favIndex;
            loadProfile();
            handleLogin();
        } else if (profiles.length > 0) {
            document.getElementById('profileSelect').value = 0;
            loadProfile();
            loadProfile();
        }
    }
    updateUiState();
});

function updateProfileSelect() {
    const select = document.getElementById('profileSelect');
    select.innerHTML = '<option value="">Nouveau profil</option>';

    profiles.forEach((p, index) => {
        const option = document.createElement('option');
        option.value = index;
        const star = p.favorite ? ' ⭐' : '';
        option.textContent = (p.name || `Card ${p.card}`) + star;
        select.appendChild(option);
    });
}

function loadProfile() {
    const index = document.getElementById('profileSelect').value;
    const favBtn = document.getElementById('favBtn');

    if (index !== "") {
        const p = profiles[index];
        document.getElementById('cardNumber').value = p.card;
        document.getElementById('deviceId').value = p.device;
        document.getElementById('constant').value = p.constant || '';

        favBtn.textContent = p.favorite ? '⭐' : '☆';

        validateCard();
        validateDevice();
        if (p.constant) validateConstant();
    } else {
        document.getElementById('cardNumber').value = '';
        document.getElementById('deviceId').value = '';
        document.getElementById('constant').value = '';
        favBtn.textContent = '☆';
        resetValidation();
    }
    updateUiState();
}

function handleMagicUrlInput(input) {
    const urlStr = input.value.trim();
    if (!urlStr) return;

    try {
        let url;
        if (urlStr.startsWith('http')) {
            url = new URL(urlStr);
        } else {
            url = new URL('http://dummy.com/' + (urlStr.startsWith('?') ? urlStr : '?' + urlStr));
        }

        const params = url.searchParams;
        let found = false;

        // deviceID (magic link format) or device (share URL format)
        let newDevice = params.get('deviceID') || params.get('deviceId') || params.get('device_id') || params.get('device');

        // card-Number (magic link format) or card (share URL format)
        let newCard = params.get('card-Number') || params.get('cardNumber') || params.get('card_number') || params.get('card');

        // constant (share URL format) — not present in the gym login link
        let newConstant = params.get('constant') || params.get('guid');

        if (newConstant) {
            document.getElementById('constant').value = newConstant;
            validateConstant();
            found = true;
        }

        if (newDevice) {
            document.getElementById('deviceId').value = newDevice;
            validateDevice();
            found = true;
        }

        if (newCard) {
            document.getElementById('cardNumber').value = newCard;
            validateCard();
            found = true;
        }

        if (found) {
            const msg = document.getElementById('magicUrlMsg');
            msg.style.display = 'block';
            setTimeout(() => {
                msg.style.display = 'none';
                input.value = '';
            }, 2000);

            // Auto-propose profile save if both card and device found
            if (newCard && newDevice && validateCard() && validateDevice()) {
                setTimeout(() => {
                    if (confirm('Card detected! Do you want to save it as a new profile?')) {
                        const name = prompt('Profile name:', 'My Profile');
                        if (name) {
                            const c = document.getElementById('constant').value.trim();
                        profiles.push({ name, card: newCard, device: newDevice, constant: c, favorite: false });
                            saveProfilesToStorage();
                            updateProfileSelect();
                            document.getElementById('profileSelect').value = profiles.length - 1;
                            loadProfile();
                            showToast('Profile saved!');
                        }
                    }
                }, 300);
            }
        }

    } catch (e) {
        console.log('Invalid URL input', e);
    }
}

function toggleFavorite() {
    const index = document.getElementById('profileSelect').value;
    if (index === "") return;

    const isFav = profiles[index].favorite;

    profiles.forEach(p => p.favorite = false);

    if (!isFav) {
        profiles[index].favorite = true;
    }

    saveProfilesToStorage();
    updateProfileSelect();

    document.getElementById('profileSelect').value = index;
    loadProfile();
}

function saveProfile() {
    const card = document.getElementById('cardNumber').value.trim();
    const device = document.getElementById('deviceId').value.trim();
    const constant = document.getElementById('constant').value.trim();
    const index = document.getElementById('profileSelect').value;

    if (!card || !device) {
        alert("Please fill in the fields.");
        return;
    }

    if (!validateCard() || !validateDevice()) {
        alert("The data seems invalid. Please check the formats.");
        return;
    }

    const name = prompt("Profile name:", index !== "" ? profiles[index].name : "My Profile");
    if (!name) return;

    let isFav = false;
    if (index !== "") {
        isFav = profiles[index].favorite || false;
    }

    const newProfile = { name, card, device, constant, favorite: isFav };

    if (index !== "") {
        profiles[index] = newProfile;
    } else {
        profiles.push(newProfile);
    }

    saveProfilesToStorage();
    updateProfileSelect();

    if (index === "") {
        document.getElementById('profileSelect').value = profiles.length - 1;
    } else {
        document.getElementById('profileSelect').value = index;
    }
    loadProfile();
}

function deleteProfile() {
    const index = document.getElementById('profileSelect').value;
    if (index === "") return;

    if (confirm("Delete this profile?")) {
        profiles.splice(index, 1);
        saveProfilesToStorage();
        updateProfileSelect();
        loadProfile();
    }
}

function saveProfilesToStorage() {
    localStorage.setItem('bf_profiles', JSON.stringify(profiles));
}

function toggleInput(id, btn) {
    const input = document.getElementById(id);
    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
    } else {
        input.type = "password";
        btn.textContent = "👁️";
    }
}

function fillExample() {
    document.getElementById('cardNumber').value = 'V011612761';
    document.getElementById('deviceId').value = 'J5eb75b07ecae846e7d2da8c4474303e6b938';
    document.getElementById('constant').value = 'IRL';
    validateCard();
    validateDevice();
    validateConstant();
}

function validateCard() {
    const input = document.getElementById('cardNumber');
    const error = document.getElementById('cardError');
    const regex = /^V\d+$/i;
    const valid = regex.test(input.value.trim());

    setValidationState(input, error, valid);
    updateUiState();
    return valid;
}

function validateDevice() {
    const input = document.getElementById('deviceId');
    const error = document.getElementById('deviceError');
    const regex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-zA-Z]{10,})$/i;
    const valid = regex.test(input.value.trim());

    setValidationState(input, error, valid);
    updateUiState();
    return valid;
}

function validateConstant() {
    const input = document.getElementById('constant');
    const error = document.getElementById('constantError');
    // The app's constant is a short alphanumeric token (typically 3 chars, e.g. "3M9").
    const regex = /^[0-9a-z]{2,8}$/i;
    const valid = regex.test(input.value.trim());

    setValidationState(input, error, valid);
    updateUiState();
    return valid;
}

function updateUiState() {
    const cardVal = document.getElementById('cardNumber').value.trim();
    const deviceVal = document.getElementById('deviceId').value.trim();
    const magicSection = document.getElementById('magicUrlSection');
    const resetBtn = document.getElementById('resetBtn');

    if (cardVal && deviceVal) {
        magicSection.classList.add('hidden');
        resetBtn.classList.remove('hidden');
    } else {
        magicSection.classList.remove('hidden');
        resetBtn.classList.add('hidden');
    }
}

function resetForm() {
    document.getElementById('cardNumber').value = '';
    document.getElementById('deviceId').value = '';
    document.getElementById('constant').value = '';
    document.getElementById('magicUrl').value = '';

    // Reset Select to default if it was on a profile? 
    // Actually user might want to clear a profile's data but keep selection? 
    // Let's just clear fields. If they select a profile again, it reloads.
    document.getElementById('profileSelect').value = ""; // Set to "Nouveau profil"

    resetValidation();
    updateUiState();
}

function setValidationState(input, errorMsg, isValid) {
    if (input.value.length === 0) {
        input.classList.remove('valid', 'invalid');
        errorMsg.style.display = 'none';
        return;
    }

    if (isValid) {
        input.classList.add('valid');
        input.classList.remove('invalid');
        errorMsg.style.display = 'none';
        errorMsg.classList.remove('error');
    } else {
        input.classList.add('invalid');
        input.classList.remove('valid');
        errorMsg.classList.add('error');
    }
}

function resetValidation() {
    ['cardNumber', 'deviceId'].forEach(id => {
        const input = document.getElementById(id);
        input.classList.remove('valid', 'invalid');
    });
    document.querySelectorAll('.validation-msg').forEach(el => el.classList.remove('error'));
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);
}

function handleLogin() {
    const cardInput = document.getElementById('cardNumber').value.trim();
    const deviceInput = document.getElementById('deviceId').value.trim();
    const constantInput = document.getElementById('constant').value.trim();

    if (!cardInput || !deviceInput) {
        alert("Please fill in all fields");
        return;
    }

    const isCardValid = validateCard();
    const isDeviceValid = validateDevice();
    const isConstantValid = constantInput === '' || validateConstant();

    if (!isCardValid || !isDeviceValid || !isConstantValid) {
        alert("Please fix the format errors before generating.");
        return;
    }

    if (!constantInput) {
        const proceed = confirm(
            "No Constant set.\n\n" +
            "Basic-Fit now validates the constant against your live app session, so the QR " +
            "will likely be rejected at the gate without it.\n\n" +
            "Generate anyway?"
        );
        if (!proceed) return;
    }

    state.cardNumber = cardInput;
    state.deviceId = deviceInput;
    state.constant = constantInput;

    showQrView();
}

function logout() {
    clearInterval(state.timerInterval);
    releaseWakeLock();

    const qrDisplay = document.getElementById('qrDisplay');
    const loginForm = document.getElementById('loginForm');

    qrDisplay.classList.add('fade-out');
    setTimeout(() => {
        qrDisplay.classList.add('hidden');
        qrDisplay.classList.remove('fade-out');
        loginForm.classList.remove('hidden');
        loginForm.classList.add('fade-in');
        setTimeout(() => loginForm.classList.remove('fade-in'), 400);
    }, 300);

    document.getElementById('cardNumber').value = state.cardNumber;
    document.getElementById('deviceId').value = state.deviceId;
    document.getElementById('constant').value = state.constant;

    window.history.pushState({}, document.title, window.location.pathname);
}

function showQrView() {
    const loginForm = document.getElementById('loginForm');
    const qrDisplay = document.getElementById('qrDisplay');

    loginForm.classList.add('fade-out');
    setTimeout(() => {
        loginForm.classList.add('hidden');
        loginForm.classList.remove('fade-out');
        qrDisplay.classList.remove('hidden');
        qrDisplay.classList.add('fade-in');
        setTimeout(() => qrDisplay.classList.remove('fade-in'), 400);
    }, 300);

    startTimer();
}

function shareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('card', state.cardNumber);
    url.searchParams.set('device', state.deviceId);
    if (state.constant) url.searchParams.set('constant', state.constant);

    navigator.clipboard.writeText(url.toString()).then(() => {
        showToast("URL copied to clipboard!");
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function toggleModal(show) {
    const modal = document.getElementById('helpModal');
    if (show) {
        modal.classList.add('show');
    } else {
        modal.classList.remove('show');
    }
}

function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
        toggleModal(false);
    }
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

function generateGUID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 3; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function generateQR() {
    const { cardNumber, deviceId } = state;
    // Basic-Fit validates this "constant" against the live app session, so it must
    // be the value the official app is currently showing — not a random one.
    // Fall back to a random GUID only if the user hasn't supplied one (legacy behavior).
    const guid = state.constant ? state.constant : generateGUID();
    const timestamp = Math.floor(Date.now() / 1000);

    const dataToHash = `${cardNumber}${guid}${timestamp}${deviceId}`;
    const fullHash = await sha256(dataToHash);
    const hashLast8 = fullHash.slice(-8).toUpperCase();

    const content = `GM2:${cardNumber}:${guid}:${timestamp}:${hashLast8}`;

    console.log("Generating:", content);

    const container = document.getElementById('qrcode');
    container.innerHTML = '';

    new QRCode(container, {
        text: content,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });
}

function startTimer() {
    generateQR();
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(generateQR, 5000);

    const bar = document.getElementById('progress');
    bar.style.animation = 'none';
    bar.offsetHeight;
    bar.style.animation = 'progress 5s linear infinite';
}

function toggleFullscreen() {
    const display = document.getElementById('qrDisplay');
    const isEntering = !display.classList.contains('fullscreen');
    display.classList.toggle('fullscreen');

    if (isEntering) {
        requestWakeLock();
    } else {
        releaseWakeLock();
    }
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            state.wakeLock = await navigator.wakeLock.request('screen');
            state.wakeLock.addEventListener('release', () => {
                state.wakeLock = null;
            });
        }
    } catch (e) {
        console.log('Wake Lock not supported or failed:', e);
    }
}

function releaseWakeLock() {
    if (state.wakeLock) {
        state.wakeLock.release();
        state.wakeLock = null;
    }
}

// PWA Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.error('Service Worker Failed', err));
}
