// Cloudflare Worker: proxies chatbot questions to the Claude API.
//
// Why this exists: the site itself is static (GitHub Pages) and cannot hold
// a secret. This Worker is the only place the Anthropic API key lives — it
// is injected at request time from a Cloudflare secret (`wrangler secret put
// ANTHROPIC_API_KEY`), never committed to source control, and never sent to
// the browser in any response.

const ALLOWED_ORIGINS = new Set([
    'https://isteyak.com',
    'https://www.isteyak.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
]);

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 6;
const MODEL = 'claude-haiku-4-5';
const MAX_OUTPUT_TOKENS = 300;

const SYSTEM_PROMPT = `You are the chatbot embedded in Isteyak Islam's portfolio website. Answer visitor questions about Isteyak using only the background information below. Keep answers short (2-4 sentences), friendly, and in the third person ("he", "Isteyak"). If asked something unrelated to Isteyak's background, skills, projects, or how to contact him, politely redirect to those topics. Never invent facts not covered here.

Skills: Python, Java, C/C++, JavaScript, TypeScript, Rust, SQL, Bash. AI/ML: TensorFlow, PyTorch, YOLOv8, YOLO11, OpenCV, MediaPipe, Siamese Networks, CNNs, Transformers, MTCNN, RetinaFace. Web: React, Next.js, Node.js, Express, MongoDB, PostgreSQL, GraphQL. DevOps: Docker, Kubernetes, AWS, CI/CD. Embedded: ESP32, ESP-IDF, TCP/IP. Geospatial: QGIS, GDAL, Rasterio.

Projects: ESP32 File Relay (ESP32-C6 Wi-Fi bridge for wireless file transfer via real-time TCP streaming, no internet required); Ultimate Posture Watcher (uOttaHacks 2026 — MediaPipe-based posture coach); AI-Powered 3D Virtual Classroom (HackTheNorth 2025 — Three.js + Cohere AI); Face Detection & Clustering (YOLO + Autoencoder); Global Electricity Resources App (WinHacks 2024 — 3rd place). Also built Docker CI/CD pipelines and participated in the NASA Space Apps Hackathon.

Experience: Currently a Researcher at GeoVision Lab (University of Windsor), building Siamese Attention U-Net models (TensorFlow/Keras) for satellite change detection, optimized for limited GPU resources (GTX 1080). Previously a Research Assistant under Dr. Ziad Kobti (face detection with YOLO + RetinaFace), and a Teaching Assistant mentoring 200+ students in data structures/algorithms and software engineering (Aug 2023 - Dec 2024).

Education: Bachelor of Computer Science, University of Windsor (Jan 2023 - Dec 2024). Transferred credits from Independent University, Bangladesh (Jan 2021 - Aug 2022). Dean's Awards for Fall 2021 and Winter 2022.

Leadership: ACM Club Event Assistant at Independent University, Bangladesh (Mar 2021 - Aug 2022) — organized 10+ tech events with 70%+ attendance, reaching 500+ students.

Availability: Open globally to both remote work and relocation.

Contact: isteyakislam12@gmail.com | LinkedIn: linkedin.com/in/isteyak-409578230 | GitHub: github.com/isteyak12`;

function corsHeaders(origin, isAllowed) {
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };
}

function json(body, status, headers) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' },
    });
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const isAllowed = ALLOWED_ORIGINS.has(origin);
        const headers = corsHeaders(origin, isAllowed);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers });
        }

        // Origin check is the primary access gate. It is not unforgeable
        // (a non-browser client can set any Origin header), but it blocks
        // casual embedding/scraping from other sites and keeps the browser's
        // own CORS enforcement consistent with server-side behavior.
        if (!isAllowed) {
            return json({ error: 'Forbidden' }, 403, headers);
        }

        if (request.method !== 'POST') {
            return json({ error: 'Method not allowed' }, 405, headers);
        }

        if (!env.ANTHROPIC_API_KEY) {
            // Misconfiguration on our side — never surface details to the client.
            return json({ error: 'Chatbot temporarily unavailable' }, 500, headers);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400, headers);
        }

        const message = typeof body.message === 'string' ? body.message.trim() : '';
        if (!message || message.length > MAX_MESSAGE_LENGTH) {
            return json({ error: 'Invalid message' }, 400, headers);
        }

        const rawHistory = Array.isArray(body.history) ? body.history : [];
        const history = rawHistory
            .slice(-MAX_HISTORY_MESSAGES)
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

        const messages = [...history, { role: 'user', content: message }];

        let anthropicRes;
        try {
            anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: MODEL,
                    max_tokens: MAX_OUTPUT_TOKENS,
                    system: SYSTEM_PROMPT,
                    messages,
                }),
            });
        } catch {
            return json({ error: 'Upstream request failed' }, 502, headers);
        }

        if (!anthropicRes.ok) {
            // Deliberately not forwarding anthropicRes.body to the client — it
            // can include account/billing-identifying error text. Logged
            // server-side only (visible via `wrangler tail`) for debugging.
            console.error('Anthropic API error', anthropicRes.status, await anthropicRes.text());
            return json({ error: 'Upstream error' }, 502, headers);
        }

        const data = await anthropicRes.json();
        const textBlock = (data.content || []).find((b) => b.type === 'text');
        const reply = textBlock ? textBlock.text : "Sorry, I couldn't come up with a reply.";

        return json({ reply }, 200, headers);
    },
};
