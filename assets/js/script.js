// Close mobile nav when a link is tapped
document.querySelectorAll('.navbar a').forEach(link => {
    link.addEventListener('click', () => {
        document.querySelector('.navbar').classList.remove('open');
    });
});

// Cat meow interaction
(function () {
    const cat = document.getElementById('cat');
    const bubble = document.getElementById('meow-bubble');
    if (!cat || !bubble) return;

    const meows = ['Meow! 🐾', 'Purrr~ 😺', 'Mrrp! 😸', 'Nya~ 🐱', 'Mew! 😻', '*purrs*'];
    let hideTimeout;

    cat.addEventListener('click', () => {
        clearTimeout(hideTimeout);
        bubble.textContent = meows[Math.floor(Math.random() * meows.length)];
        bubble.classList.add('show');
        hideTimeout = setTimeout(() => bubble.classList.remove('show'), 1800);
    });
})();

// ========== CHATBOT ==========
(function () {
    const toggle = document.getElementById('chatbot-toggle');
    const win = document.getElementById('chatbot-window');
    const closeBtn = document.getElementById('chatbot-close');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');
    const msgArea = document.getElementById('chatbot-messages');
    const suggestions = document.getElementById('chatbot-suggestions');
    if (!toggle || !win) return;

    // Toggle open/close
    toggle.addEventListener('click', () => win.classList.toggle('open'));
    closeBtn.addEventListener('click', () => win.classList.remove('open'));

    // Suggestion buttons
    suggestions.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => handleSend(btn.dataset.q));
    });

    // Send on Enter or button click
    sendBtn.addEventListener('click', () => handleSend(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSend(input.value);
    });

    function handleSend(text) {
        text = text.trim();
        if (!text) return;
        addMsg(text, 'user');
        input.value = '';
        setTimeout(() => addMsg(getReply(text), 'bot'), 400);
    }

    function addMsg(text, type) {
        const div = document.createElement('div');
        div.className = 'chat-msg ' + type;
        div.textContent = text;
        msgArea.appendChild(div);
        msgArea.scrollTop = msgArea.scrollHeight;
    }

    // FAQ knowledge base — keyword matching
    const faqs = [
        {
            keys: ['skill', 'tech', 'stack', 'language', 'framework', 'tool'],
            answer: 'Isteyak\'s skills include Python, Java, C/C++, JavaScript, TypeScript, Rust, SQL, and Bash. In AI/ML: TensorFlow, PyTorch, YOLOv8, YOLO11, OpenCV, MediaPipe, Siamese Networks. Web: React, Next.js, Node.js, Express, MongoDB, PostgreSQL, GraphQL. DevOps: Docker, Kubernetes, AWS, CI/CD. Embedded: ESP32, ESP-IDF. Geospatial: QGIS, GDAL, Rasterio.'
        },
        {
            keys: ['project', 'build', 'built', 'made', 'hackathon', 'hack'],
            answer: 'Key projects: ESP32 File Relay (Wi-Fi bridge for wireless file transfer), Ultimate Posture Watcher (uOttaHacks 2026 — MediaPipe posture coach), AI-Powered 3D Virtual Classroom (HackTheNorth 2025 — Three.js + Cohere AI), Face Detection & Clustering (YOLO + Autoencoder), and Global Electricity Resources App (WinHacks 2024 — 3rd place!). Also Docker CI/CD pipelines and NASA Space Apps Hackathon.'
        },
        {
            keys: ['experience', 'work', 'job', 'career', 'professional'],
            answer: 'Isteyak is currently a Researcher at GeoVision Lab (University of Windsor) working on Siamese Attention-UNet models for satellite change detection. Previously: Research Assistant under Dr. Ziad Kobti (face detection with YOLO + RetinaFace), and Teaching Assistant mentoring 200+ students in DSA and software engineering (Aug 2023 – Dec 2024).'
        },
        {
            keys: ['education', 'degree', 'university', 'school', 'study', 'studied'],
            answer: 'Isteyak holds a Bachelor of Computer Science from the University of Windsor (Jan 2023 – Dec 2024). He transferred credits from Independent University, Bangladesh (Jan 2021 – Aug 2022) and earned Dean\'s Awards for Fall 2021 and Winter 2022.'
        },
        {
            keys: ['contact', 'email', 'reach', 'hire', 'connect', 'linkedin', 'github'],
            answer: 'You can reach Isteyak at isteyakislam12@gmail.com. LinkedIn: linkedin.com/in/isteyak-409578230 | GitHub: github.com/isteyak12. He\'s open to remote work and relocation.'
        },
        {
            keys: ['research', 'geospatial', 'satellite', 'siamese', 'change detection', 'geovision'],
            answer: 'Isteyak researches geospatial computer vision at the GeoVision Lab, University of Windsor. He develops Siamese Attention U-Net models using TensorFlow/Keras for change detection on satellite imagery pairs, optimized for limited GPU resources (GTX 1080).'
        },
        {
            keys: ['ai', 'machine learning', 'deep learning', 'computer vision', 'ml', 'cv', 'yolo', 'neural'],
            answer: 'Isteyak specializes in computer vision and deep learning. He works with TensorFlow, PyTorch, YOLOv8, YOLO11, OpenCV, MediaPipe, MTCNN, RetinaFace, CNNs, Siamese Networks, and Transformers. His research focuses on attention-based architectures for geospatial change detection.'
        },
        {
            keys: ['embedded', 'esp32', 'iot', 'hardware', 'firmware'],
            answer: 'Isteyak has built ESP32-based projects including a Wi-Fi File Relay using ESP32-C6 for wireless file transfer via real-time TCP streaming — no internet required. He works with ESP-IDF, TCP/IP, Wi-Fi AP mode, and embedded HTTP servers.'
        },
        {
            keys: ['leader', 'leadership', 'community', 'acm', 'club', 'event'],
            answer: 'Isteyak served as ACM Club Event Assistant at Independent University, Bangladesh (Mar 2021 – Aug 2022), organizing 10+ tech events with 70%+ attendance and reaching 500+ students.'
        },
        {
            keys: ['who', 'about', 'tell me', 'yourself', 'introduction', 'intro'],
            answer: 'Isteyak is a Geospatial Computer Vision Engineer and Full-Stack Developer. He specializes in deep learning models for satellite imagery analysis, and bridges CV research with production web apps. WinHacks 2024 winner (3rd place) and HackTheNorth 2025 participant.'
        },
        {
            keys: ['location', 'where', 'remote', 'relocat', 'available'],
            answer: 'Isteyak is available globally and open to both remote positions and relocation.'
        },
        {
            keys: ['award', 'win', 'achievement', 'dean', 'prize'],
            answer: 'Isteyak won 3rd place at WinHacks 2024, earned Dean\'s Awards for Fall 2021 and Winter 2022, and participated in HackTheNorth 2025, uOttaHacks 2026, and NASA Space Apps Hackathon.'
        }
    ];

    function getReply(text) {
        const lower = text.toLowerCase();
        for (const faq of faqs) {
            if (faq.keys.some(k => lower.includes(k))) return faq.answer;
        }
        return 'Hmm, I\'m not sure about that. Try asking about Isteyak\'s skills, projects, experience, education, research, or contact info!';
    }
})();

// Initialize particles.js
particlesJS('particles-js', {
    "particles": {
        "number": {
            "value": 100,
            "density": {
                "enable": true,
                "value_area": 800
            }
        },
        "color": {
            "value": "#ffffff"
        },
        "shape": {
            "type": "circle",
            "stroke": {
                "width": 0,
                "color": "#000000"
            },
            "polygon": {
                "nb_sides": 5
            }
        },
        "opacity": {
            "value": 0.5,
            "random": false,
            "anim": {
                "enable": false,
                "speed": 1,
                "opacity_min": 0.1,
                "sync": false
            }
        },
        "size": {
            "value": 3,
            "random": true,
            "anim": {
                "enable": false,
                "speed": 40,
                "size_min": 0.1,
                "sync": false
            }
        },
        "line_linked": {
            "enable": true,
            "distance": 150,
            "color": "#ffffff",
            "opacity": 0.4,
            "width": 1
        },
        "move": {
            "enable": true,
            "speed": 6,
            "direction": "none",
            "random": false,
            "straight": false,
            "out_mode": "out",
            "bounce": false,
            "attract": {
                "enable": false,
                "rotateX": 600,
                "rotateY": 1200
            }
        }
    },
    "interactivity": {
        "detect_on": "canvas",
        "events": {
            "onhover": {
                "enable": true,
                "mode": "repulse"
            },
            "onclick": {
                "enable": true,
                "mode": "push"
            },
            "resize": true
        },
        "modes": {
            "grab": {
                "distance": 400,
                "line_linked": {
                    "opacity": 1
                }
            },
            "bubble": {
                "distance": 400,
                "size": 40,
                "duration": 2,
                "opacity": 8,
                "speed": 3
            },
            "repulse": {
                "distance": 200,
                "duration": 0.4
            },
            "push": {
                "particles_nb": 4
            },
            "remove": {
                "particles_nb": 2
            }
        }
    },
    "retina_detect": true
});

// Three.js to display .fbx model
document.addEventListener('DOMContentLoaded', function () {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('model-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0x404040);
    scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    scene.add(directionalLight);

    const loader = new THREE.FBXLoader();
    loader.load('rp_nathan_animated_003_walking.glb', function (object) {
        scene.add(object);
        object.rotation.y = Math.PI; // Rotate model to face the right direction
        animate();
    });

    camera.position.z = 5;

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
