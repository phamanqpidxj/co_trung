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
        let character; // This will hold the main player's element

        if (characterName) {
            document.getElementById('ui-character-name').textContent = characterName;
        }

        if (isMultiplayer) {
            socket.emit('new player', {
                name: characterName,
                image: characterImage,
                role: role, // Send the role
                x: 800,
                y: 450
            });

            socket.on('update member list', (memberList) => {
                const memberListElement = document.getElementById('member-list');
                memberListElement.innerHTML = ''; // Clear the list
                for (const member of memberList) {
                    const li = document.createElement('li');
                    li.textContent = `${member.name} (${member.role})`;
                    memberListElement.appendChild(li);
                }
            });

            // Listen for the list of current players
            socket.on('current players', (serverPlayers) => {
                for (const id in serverPlayers) {
                    const playerElement = createPlayer(serverPlayers[id]);
                    if (id === socket.id) {
                        character = playerElement; // Assign the main character
                    }
                }
            });

            // Listen for a new player connecting
            socket.on('new player connected', (playerData) => {
                createPlayer(playerData);
            });

            // Listen for player movement
            socket.on('player moved', (data) => {
                if (players[data.id]) {
                    players[data.id].style.left = data.x + 'px';
                    players[data.id].style.top = data.y + 'px';
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

        function createPlayer(playerData) {
            if (!playerData || !playerData.id) return;
            const playerElement = document.createElement('div');
            playerElement.classList.add('character');
            playerElement.style.left = playerData.x + 'px';
            playerElement.style.top = playerData.y + 'px';
            if (playerData.image) {
                 playerElement.style.backgroundImage = `url(${playerData.image})`;
            }

            const nameTag = document.createElement('div');
            nameTag.classList.add('name-tag');
            nameTag.textContent = playerData.name;
            playerElement.appendChild(nameTag);

            players[playerData.id] = playerElement;
            gameContainer.appendChild(playerElement);
            return playerElement; // Return the created element
        }

        let x = 800;
        let y = 450;
        const speed = 5;

        const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

        document.addEventListener('keydown', (e) => {
            if (document.activeElement === document.getElementById('chat-input')) return;
            if (e.key in keys) keys[e.key] = true;
        });

        document.addEventListener('keyup', (e) => {
            if (e.key in keys) keys[e.key] = false;
        });

        function createDustParticle(element) {
            const particle = document.createElement('div');
            particle.classList.add('dust-particle');
            const size = Math.random() * 10 + 5;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;

            const rect = element.getBoundingClientRect();
            particle.style.left = `${rect.left + window.scrollX + rect.width / 2 - size / 2}px`;
            particle.style.top = `${rect.top + window.scrollY + rect.height - size}px`;

            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }

        function isColliding(rect1, rect2) {
            return (
                rect1.x < rect2.x + rect2.width &&
                rect1.x + rect1.width > rect2.x &&
                rect1.y < rect2.y + rect2.height &&
                rect1.y + rect1.height > rect2.y
            );
        }

        function gameLoop() {
            if (!character) { // Wait until the character is created
                requestAnimationFrame(gameLoop);
                return;
            }

            let moved = false;
            const newPos = { x, y };

            if (keys.ArrowUp) { newPos.y -= speed; moved = true; }
            if (keys.ArrowDown) { newPos.y += speed; moved = true; }
            if (keys.ArrowLeft) { newPos.x -= speed; moved = true; }
            if (keys.ArrowRight) { newPos.x += speed; moved = true; }

            if (moved) {
                const charSize = 50;
                const gameRect = gameContainer.getBoundingClientRect();

                // Clamp position to game boundaries
                newPos.x = Math.max(0, Math.min(newPos.x, gameRect.width - charSize));
                newPos.y = Math.max(0, Math.min(newPos.y, gameRect.height - charSize));

                // Collision detection
                let collision = false;
                const playerRect = { x: newPos.x, y: newPos.y, width: charSize, height: charSize };

                for (const obj of mapObjects) {
                    if (obj.data.isObstacle) {
                        const objRect = obj.element.getBoundingClientRect();
                        // Adjust for game container's position relative to viewport
                        const correctedObjRect = {
                            x: obj.element.offsetLeft,
                            y: obj.element.offsetTop,
                            width: objRect.width,
                            height: objRect.height
                        };

                        if (isColliding(playerRect, correctedObjRect)) {
                            collision = true;
                            break;
                        }
                    }
                }

                if (!collision) {
                    x = newPos.x;
                    y = newPos.y;
                    character.style.left = `${x}px`;
                    character.style.top = `${y}px`;
                }

                createDustParticle(character);

                if (isMultiplayer) {
                    socket.emit('move', { x, y });
                }
            }
            requestAnimationFrame(gameLoop);
        }
        gameLoop();

        let mapObjects = [];
        let selectedObject = null;

        makeDraggable(document.getElementById('game-ui'));
        makeDraggable(document.getElementById('member-list-container'));

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
            // Ensure data object is not directly the element
            const objectData = { src: data.src, left: data.left, top: data.top, isObstacle: data.isObstacle || false };
            mapObjects.push({ element: img, data: objectData });

            if (role === 'admin') makeDraggable(img);
        }

        function makeDraggable(element) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            const handle = element.querySelector('.drag-handle') || element;

            handle.onmousedown = dragMouseDown;

            // Handle selection for map objects
            if (element.classList.contains('map-object')) {
                element.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering game container click
                    selectObject(element);
                });
            }

            function dragMouseDown(e) {
                e.preventDefault();
                // We don't set selectedObject here anymore, it's done on click
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

        function selectObject(element) {
            selectedObject = element;
            const selectedObjectTools = document.getElementById('selected-object-tools');
            selectedObjectTools.style.display = 'block';

            // Sync checkbox with object's data
            const objectData = mapObjects.find(obj => obj.element === element)?.data;
            const isObstacleCheckbox = document.getElementById('is-obstacle-checkbox');
            if (objectData) {
                isObstacleCheckbox.checked = objectData.isObstacle || false;
            }

            // Update object data on checkbox change
            isObstacleCheckbox.onchange = () => {
                if (objectData) {
                    objectData.isObstacle = isObstacleCheckbox.checked;
                }
            };

            // Add a visual indicator for selection
            document.querySelectorAll('.map-object').forEach(obj => obj.style.border = 'none');
            element.style.border = '2px solid blue';
        }

        function deselectObject() {
            if (selectedObject) {
                selectedObject.style.border = 'none';
            }
            selectedObject = null;
            document.getElementById('selected-object-tools').style.display = 'none';
        }

        // Deselect when clicking on the container background
        gameContainer.addEventListener('click', deselectObject);


        function saveMap() {
            const embedCode = document.getElementById('embed-code-input').value;
            const mapLayout = {
                objects: mapObjects.map(obj => ({
                    src: obj.element.src,
                    left: obj.element.style.left,
                    top: obj.element.style.top,
                    isObstacle: obj.data.isObstacle || false // Include isObstacle property
                })),
                terrainColor: gameContainer.style.backgroundColor,
                embedCode: embedCode // Add embed code to the layout
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

                const embedContainer = document.getElementById('embed-container');
                if (role === 'admin' && mapLayout.embedCode) {
                    embedContainer.innerHTML = mapLayout.embedCode;
                    embedContainer.style.display = 'block';
                    document.getElementById('embed-code-input').value = mapLayout.embedCode;
                } else {
                    embedContainer.innerHTML = '';
                    embedContainer.style.display = 'none';
                }
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
