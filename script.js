document.addEventListener('DOMContentLoaded', () => {
    // Shared logic for forms
    const handleFormSubmit = (formId, callback) => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', callback);
        }
    };

    // --- LOGIN PAGE ---
    handleFormSubmit('login-form', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === 'admin' && password === '123456') {
            localStorage.setItem('username', 'admin');
            localStorage.setItem('role', 'admin');
            window.location.href = 'create-character.html';
        } else if (username) {
            localStorage.setItem('username', username);
            localStorage.setItem('role', 'user');
            window.location.href = 'create-character.html';
        } else {
            alert('Vui lòng nhập tên người dùng.');
        }
    });

    // --- CHARACTER CREATION PAGE ---
    const createCharacterForm = document.getElementById('create-character-form');
    if (createCharacterForm) {
        const characterImageInput = document.getElementById('character-image');
        const previewImage = document.getElementById('preview-image');

        characterImageInput.addEventListener('change', () => {
            const file = characterImageInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    previewImage.style.display = 'block';
                }
                reader.readAsDataURL(file);
            }
        });

        handleFormSubmit('create-character-form', (e) => {
            e.preventDefault();
            const characterName = document.getElementById('character-name').value;
            const characterImageSrc = previewImage.src;

            if (characterName) {
                localStorage.setItem('characterName', characterName);
                if (characterImageSrc && characterImageSrc !== window.location.href) {
                     localStorage.setItem('characterImage', characterImageSrc);
                } else {
                    localStorage.removeItem('characterImage');
                }
                window.location.href = 'game.html';
            } else {
                alert('Vui lòng nhập tên nhân vật.');
            }
        });
    }

    // --- GAME PAGE ---
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        const statusElement = document.getElementById('connection-status');
        const role = localStorage.getItem('role');
        let socket;
        let isMultiplayer = false;

        try {
            const serverURL = window.location.origin;
            console.log(`Connecting to server at: ${serverURL}`);
            socket = io(serverURL, {
                reconnection: false,
                timeout: 3000
            });
            isMultiplayer = true;

            socket.on('connect', () => {
                statusElement.textContent = 'Trực tuyến';
                statusElement.style.color = 'green';
                setupOnlineMode();
            });

            socket.on('connect_error', () => {
                isMultiplayer = false;
                statusElement.textContent = 'Ngoại tuyến';
                statusElement.style.color = 'red';
                socket.disconnect();
                setupOfflineMode();
            });

        } catch (e) {
            isMultiplayer = false;
            statusElement.textContent = 'Ngoại tuyến';
            statusElement.style.color = 'red';
            setupOfflineMode();
        }

        const players = {};
        const characterName = localStorage.getItem('characterName') || 'Guest';
        const characterImage = localStorage.getItem('characterImage');

        const character = document.getElementById('character');
        if (characterImage) {
            character.style.backgroundImage = `url(${characterImage})`;
        }
        if (characterName) {
            document.getElementById('ui-character-name').textContent = characterName;
        }

        if (isMultiplayer) {
            socket.emit('new player', {
                name: characterName,
                image: characterImage,
                x: 800,
                y: 450
            });

            socket.on('update players', (serverPlayers) => {
                 for (const id in players) {
                    if (!serverPlayers[id]) {
                        players[id].remove();
                        delete players[id];
                    }
                }
                for (const id in serverPlayers) {
                    if (id !== socket.id) {
                        const playerData = serverPlayers[id];
                        if (!players[id]) {
                            players[id] = document.createElement('div');
                            players[id].classList.add('character');
                            const nameTag = document.createElement('div');
                            nameTag.classList.add('name-tag');
                            nameTag.textContent = playerData.name;
                            players[id].appendChild(nameTag);
                            gameContainer.appendChild(players[id]);
                        }
                        players[id].style.left = playerData.x + 'px';
                        players[id].style.top = playerData.y + 'px';
                        players[id].style.backgroundImage = `url(${playerData.image})`;
                    }
                }
            });

            socket.on('player disconnected', (id) => {
                if (players[id]) {
                    players[id].remove();
                    delete players[id];
                }
            });

            socket.on('load map', loadMap);
        }

        let x = 800;
        let y = 450;
        const speed = 5;
        character.style.left = `${x}px`;
        character.style.top = `${y}px`;

        const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

        document.addEventListener('keydown', (e) => {
            if (document.activeElement === document.getElementById('chat-input')) return;
            if (e.key in keys) keys[e.key] = true;
        });

        document.addEventListener('keyup', (e) => {
            if (e.key in keys) keys[e.key] = false;
        });

        function gameLoop() {
            if (keys.ArrowUp) y -= speed;
            if (keys.ArrowDown) y += speed;
            if (keys.ArrowLeft) x -= speed;
            if (keys.ArrowRight) x += speed;

            const charSize = 50;
            const gameRect = gameContainer.getBoundingClientRect();
            x = Math.max(0, Math.min(x, gameRect.width - charSize));
            y = Math.max(0, Math.min(y, gameRect.height - charSize));

            character.style.left = `${x}px`;
            character.style.top = `${y}px`;

            if (isMultiplayer) {
                socket.emit('move', { x, y });
            }
            requestAnimationFrame(gameLoop);
        }
        gameLoop();

        let mapObjects = [];
        let selectedObject = null;

        makeDraggable(document.getElementById('game-ui'));

        if (role === 'admin') {
            const adminTools = document.getElementById('admin-tools');
            makeDraggable(adminTools);

            document.getElementById('terrain-color-input').addEventListener('input', (e) => {
                gameContainer.style.backgroundColor = e.target.value;
            });

            document.getElementById('add-object-input').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => createMapObject({ src: event.target.result, left: '100px', top: '100px' });
                    reader.readAsDataURL(file);
                }
            });

            document.getElementById('save-map-button').addEventListener('click', saveMap);

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Delete' && selectedObject) {
                    selectedObject.remove();
                    mapObjects = mapObjects.filter(obj => obj.element !== selectedObject);
                    selectedObject = null;
                }
            });
        }

        if (isMultiplayer) {
            document.getElementById('chat-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const chatInput = document.getElementById('chat-input');
                if (chatInput.value) {
                    socket.emit('chat message', chatInput.value);
                    chatInput.value = '';
                }
            });

            socket.on('chat message', (data) => {
                const chatLog = document.getElementById('chat-log');
                const messageElement = document.createElement('div');
                messageElement.textContent = `${data.name}: ${data.message}`;
                chatLog.appendChild(messageElement);
                chatLog.scrollTop = chatLog.scrollHeight;

                const playerElement = data.id === socket.id ? character : players[data.id];
                if (playerElement) showChatBubble(playerElement, data.name, data.message);
            });
        }

        function showChatBubble(playerElement, name, message) {
            const existingBubble = playerElement.querySelector('.chat-bubble');
            if (existingBubble) existingBubble.remove();
            const bubble = document.createElement('div');
            bubble.classList.add('chat-bubble');
            bubble.innerHTML = `<strong>${name}:</strong> ${message}`;
            playerElement.appendChild(bubble);
            setTimeout(() => bubble.remove(), 5000);
        }

        function createMapObject(data) {
            const img = document.createElement('img');
            img.src = data.src;
            img.className = 'map-object';
            img.style.left = data.left;
            img.style.top = data.top;
            gameContainer.appendChild(img);
            mapObjects.push({ element: img, data: data });
            if (role === 'admin') makeDraggable(img);
        }

        function makeDraggable(element) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            const handle = element.querySelector('.drag-handle') || element;
            handle.onmousedown = dragMouseDown;

            function dragMouseDown(e) {
                e.preventDefault();
                selectedObject = element.classList.contains('map-object') ? element : null;
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }

            function elementDrag(e) {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                element.style.top = (element.offsetTop - pos2) + "px";
                element.style.left = (element.offsetLeft - pos1) + "px";
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }

        function saveMap() {
            const mapLayout = {
                objects: mapObjects.map(obj => ({
                    src: obj.element.src,
                    left: obj.element.style.left,
                    top: obj.element.style.top
                })),
                terrainColor: gameContainer.style.backgroundColor
            };
            if (isMultiplayer) {
                socket.emit('save map', mapLayout);
            } else {
                localStorage.setItem('mapLayout', JSON.stringify(mapLayout));
            }
            alert('Bản đồ đã được lưu!');
        }

        function loadMap(mapLayout) {
            mapObjects.forEach(obj => obj.element.remove());
            mapObjects = [];
            if (mapLayout) {
                if (mapLayout.terrainColor) gameContainer.style.backgroundColor = mapLayout.terrainColor;
                if (mapLayout.objects) mapLayout.objects.forEach(createMapObject);
            }
        }

        function loadMapFromLocalStorage() {
            const mapLayout = JSON.parse(localStorage.getItem('mapLayout'));
            loadMap(mapLayout);
        }

        function setupOnlineMode() {
            const chatContainer = document.getElementById('chat-container');
            if (chatContainer) chatContainer.style.display = 'flex';
            if (role === 'admin') document.getElementById('admin-tools').style.display = 'block';
        }

        function setupOfflineMode() {
            const chatContainer = document.getElementById('chat-container');
            if (chatContainer) chatContainer.style.display = 'none';
            if (role === 'admin') document.getElementById('admin-tools').style.display = 'block';
            loadMapFromLocalStorage();
        }

        if (!isMultiplayer) {
            setupOfflineMode();
        }
    }
});
