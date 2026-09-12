// ===== 1. API KEY =====
let API_KEY = localStorage.getItem('jarvis_key');

if (!API_KEY) {
    API_KEY = prompt('Enter your Gemini API Key:');

    if (API_KEY) {
        localStorage.setItem('jarvis_key', API_KEY);
    }
}


// ===== 2. SMART MODELS =====
const MODELS = [
    "gemini-3.6-flash",
    "gemini-flash-latest"
];

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const micBtn = document.getElementById('mic-btn');


// ======================================================
// 🧠 J.A.R.V.I.S BRAIN
// ======================================================

const BRAIN_KEY = "jarvis_brain_memory";

let brainMemory = JSON.parse(
    localStorage.getItem(BRAIN_KEY) || "[]"
);


// Save memory
function saveToBrain(role, message) {

    brainMemory.push({
        role: role,
        message: message,
        time: new Date().toISOString()
    });

    // Keep latest 50 messages
    if (brainMemory.length > 50) {
        brainMemory = brainMemory.slice(-50);
    }

    localStorage.setItem(
        BRAIN_KEY,
        JSON.stringify(brainMemory)
    );
}


// Get memory
function getBrainMemory() {
    return brainMemory;
}


// Clear memory
function clearBrain() {

    brainMemory = [];

    localStorage.removeItem(BRAIN_KEY);

    if (chat) {
        chat.innerHTML = "";
    }

    console.log("🧠 J.A.R.V.I.S Brain cleared.");
}


// Restore old conversation
function restoreBrain() {

    if (!chat) return;

    chat.innerHTML = "";

    brainMemory.forEach(item => {

        if (item.role === "user") {

            add(
                "YOU: " + item.message,
                "user"
            );

        } else if (item.role === "assistant") {

            add(
                "J.A.R.V.I.S: " + item.message,
                "ai"
            );
        }

    });
}


// ======================================================
// 🧠 CREATE MEMORY CONTEXT FOR GEMINI
// ======================================================

function buildBrainContext() {

    if (brainMemory.length === 0) {
        return "";
    }

    const recentMemory =
        brainMemory.slice(-20);

    let context =
        "\n\n--- J.A.R.V.I.S MEMORY ---\n";

    recentMemory.forEach(item => {

        if (item.role === "user") {

            context +=
                "USER: " +
                item.message +
                "\n";

        } else {

            context +=
                "J.A.R.V.I.S: " +
                item.message +
                "\n";
        }
    });

    context +=
        "--- END MEMORY ---\n\n";

    return context;
}


// ======================================================
// 3. GEMINI
// ======================================================

async function callGemini(prompt) {

    let lastErr;

    for (const m of MODELS) {

        try {

            const res = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                + m
                + ":generateContent?key="
                + API_KEY,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        contents: [

                            {
                                parts: [

                                    {
                                        text:
                                            "You are J.A.R.V.I.S, a helpful AI assistant. " +
                                            "Use the memory provided to maintain continuity. " +
                                            "Do not claim to remember something unless it is in the memory.\n\n" +
                                            buildBrainContext() +
                                            "\nCURRENT USER MESSAGE:\n" +
                                            prompt
                                    }

                                ]
                            }

                        ]

                    })
                }
            );


            const data = await res.json();


            if (data.error) {

                lastErr =
                    new Error(
                        data.error.message
                    );


                if (
                    /high demand|temporar|quota|rate|unavailable|no longer available|deprecated/i
                        .test(data.error.message)
                ) {

                    continue;
                }

                throw lastErr;
            }


            return data.candidates[0]
                .content.parts[0].text;

        }

        catch (e) {

            lastErr = e;
        }
    }


    throw lastErr;
}


// ======================================================
// 4. ASK GEMINI
// ======================================================

async function askGemini(p) {

    add(
        "J.A.R.V.I.S: Thinking...",
        "ai"
    );


    try {

        const reply =
            await callGemini(p);


        // Replace Thinking message
        chat.lastChild.innerText =
            "J.A.R.V.I.S: " + reply;


        // 🧠 SAVE AI RESPONSE
        saveToBrain(
            "assistant",
            reply
        );


        // VOICE
        speak(reply);

    }

    catch (e) {

        chat.lastChild.innerText =
            "J.A.R.V.I.S: ERROR - " +
            e.message;
    }
}


// ======================================================
// 5. SPEECH RECOGNITION
// ======================================================

const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


let rec = null;


if (SR) {

    rec = new SR();

    rec.lang = 'en-US';

    rec.onresult = (e) => {

        const t =
            e.results[0][0].transcript;


        add(
            "YOU: " + t,
            "user"
        );


        // 🧠 SAVE USER MESSAGE
        saveToBrain(
            "user",
            t
        );


        askGemini(t);
    };


    rec.onend = () => {

        if (micBtn) {
            micBtn.innerText = '🎤';
        }

    };

}


// Microphone button
if (micBtn) {

    micBtn.onclick = () => {

        if (!rec) {

            alert(
                "Speech recognition is not supported in this browser."
            );

            return;
        }


        rec.start();

        micBtn.innerText =
            'LISTENING...';
    };

}


// ======================================================
// 6. TEXT TO SPEECH
// ======================================================

let voices = [];


function loadVoices() {

    voices =
        speechSynthesis.getVoices();
}


loadVoices();

speechSynthesis.onvoiceschanged =
    loadVoices;


function speak(t) {

    const u =
        new SpeechSynthesisUtterance(t);


    u.rate = 1.05;

    u.pitch = 0.85;


    const v =
        voices.find(v =>
            v.lang.startsWith('en')
        );


    if (v) {

        u.voice = v;
    }


    speechSynthesis.speak(u);
}


// ======================================================
// 7. TEXT SEND BUTTON
// ======================================================

const sendBtn =
    document.getElementById('send');


if (sendBtn) {

    sendBtn.onclick = () => {

        const t =
            input.value.trim();


        if (!t) return;


        add(
            "YOU: " + t,
            "user"
        );


        input.value = "";


        // 🧠 SAVE USER MESSAGE
        saveToBrain(
            "user",
            t
        );


        askGemini(t);
    };

}


// ======================================================
// 8. ADD MESSAGE TO CHAT
// ======================================================

function add(t, w) {

    const d =
        document.createElement('div');


    d.className =
        'msg ' + w;


    d.innerText = t;


    chat.appendChild(d);


    chat.scrollTop =
        chat.scrollHeight;
}


// ======================================================
// 9. START J.A.R.V.I.S BRAIN
// ======================================================

window.addEventListener(
    "load",
    () => {

        restoreBrain();

        console.log(
            "🧠 J.A.R.V.I.S Brain online."
        );

    }
);
