document.addEventListener('DOMContentLoaded', () => {
    const handleFormSubmit = (formId, callback) => {
        const form = document.getElementById(formId);
        if (form) form.addEventListener('submit', callback);
    };

    if (document.getElementById('login-form')) {
        handleFormSubmit('login-form', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            if (username === 'admin' && password === '123456') {
                localStorage.setItem('role', 'admin');
            } else {
                localStorage.setItem('role', 'user');
            }
            if (username) {
                localStorage.setItem('username', username);
                window.location.href = 'create-character.html';
            } else {
                alert('Vui lòng nhập tên người dùng.');
            }
        });
    }

    if (document.getElementById('create-character-form')) {
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

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        const statusElement = document.getElementById('connection-status');
        const role = localStorage.getItem('role') || 'user';
        const characterName = localStorage.getItem('characterName') || 'Guest';
        const characterImage = localStorage.getItem('characterImage');

        let socket, character, x = 800, y = 450, mapObjects = [], selectedObject = null;
        let isZoneChangeInProgress = false;
        let zoneLayout = {};
        let currentZone = 'trung';
        const players = {};
        const speed = 5;
        const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

        try {
            socket = io(window.location.origin, { reconnection: false, timeout: 3000 });
            socket.on('connect', () => {
                document.getElementById('ui-character-name').textContent = characterName;
                statusElement.textContent = 'Trực tuyến';
                statusElement.style.color = 'green';
                setupOnlineMode();
            });
            socket.on('connect_error', () => {
                statusElement.textContent = 'Ngoại tuyến';
                statusElement.style.color = 'red';
                if (socket) socket.disconnect();
                setupOfflineMode();
            });
        } catch (e) {
            statusElement.textContent = 'Ngoại tuyến';
            statusElement.style.color = 'red';
            setupOfflineMode();
        }

        function createPlayer(playerData) {
            if (!playerData || !playerData.id) return null;
            const playerElement = document.createElement('div');
            playerElement.classList.add('character');
            playerElement.style.left = `${playerData.x}px`;
            playerElement.style.top = `${playerData.y}px`;
            if (playerData.image) {
                playerElement.style.backgroundImage = `url(${playerData.image})`;
            }
            const nameTag = document.createElement('div');
            nameTag.classList.add('name-tag');
            nameTag.textContent = playerData.name;
            playerElement.appendChild(nameTag);
            players[playerData.id] = playerElement;
            gameContainer.appendChild(playerElement);
            return playerElement;
        }

        function setupOnlineMode() {
            try {
                document.getElementById('chat-container').style.display = 'flex';
                if (role === 'admin' || role === 'moderator') {
                    document.getElementById('game-ui').classList.add('menu-open');
                    if (role === 'moderator') {
                        const adminTools = document.getElementById('admin-tools');
                        adminTools.querySelector('h4:nth-of-type(2)').style.display = 'none';
                        adminTools.querySelector('textarea#embed-code-input').style.display = 'none';
                        adminTools.querySelector('button#delete-embed-button').style.display = 'none';
                    }
                }
                socket.emit('new player', { name: characterName, image: characterImage, role: role, x: x, y: y });
                character = createPlayer({ id: socket.id, name: characterName, image: characterImage, role: role, x: x, y: y });

                socket.on('current players', (serverPlayers) => {
                    Object.keys(players).filter(id => id !== socket.id).forEach(id => {
                        players[id].remove();
                        delete players[id];
                    });
                    serverPlayers.forEach(playerData => {
                        if (playerData.id !== socket.id) createPlayer(playerData);
                        else {
                            x = playerData.x; y = playerData.y;
                            if(character) {
                                character.style.left = `${x}px`;
                                character.style.top = `${y}px`;
                            }
                        }
                    });
                });

                socket.on('new player connected', createPlayer);
                socket.on('player moved', (data) => {
                    if (players[data.id]) {
                        players[data.id].style.left = `${data.x}px`;
                        players[data.id].style.top = `${data.y}px`;
                        if (data.id === socket.id) { x = data.x; y = data.y; }
                    }
                });
                socket.on('player disconnected', (id) => {
                    if (players[id]) {
                        players[id].remove();
                        delete players[id];
                    }
                });

                socket.on('update member list', (memberList) => {
                    const memberListElement = document.getElementById('member-list');
                    memberListElement.innerHTML = '';
                    memberList.forEach(member => {
                        const li = document.createElement('li');
                        li.textContent = `${member.name} (${member.role})`;
                        if (role === 'admin' && member.id !== socket.id) {
                            const roleSelect = document.createElement('select');
                            roleSelect.innerHTML = `<option value="user" ${member.role === 'user' ? 'selected' : ''}>User</option><option value="moderator" ${member.role === 'moderator' ? 'selected' : ''}>Moderator</option><option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>`;
                            roleSelect.addEventListener('change', (e) => socket.emit('change role', { targetId: member.id, newRole: e.target.value }));
                            li.appendChild(roleSelect);
                        }
                        memberListElement.appendChild(li);
                    });
                });

                socket.on('role changed', (data) => {
                    if (players[data.playerId]) players[data.playerId].role = data.newRole;
                    if (socket.id === data.playerId) {
                        localStorage.setItem('role', data.newRole);
                        window.location.reload();
                    }
                });

                socket.on('zone layout', (layout) => {
                    zoneLayout = layout;
                });
                socket.on('load map', (data) => {
                    currentZone = data.zone;
                    loadMap(data.map);
                });
                socket.on('chat message', (data) => {
                    const chatLog = document.getElementById('chat-log');
                    const messageElement = document.createElement('div');
                    const temp = document.createElement('div');
                    temp.textContent = data.message;
                    messageElement.innerHTML = `<strong>${data.name}:</strong> ${temp.innerHTML}`;
                    chatLog.appendChild(messageElement);
                    chatLog.scrollTop = chatLog.scrollHeight;
                    if (players[data.id]) showChatBubble(players[data.id], data.name, data.message);
                });
            } catch (error) {
                console.error("Error in setupOnlineMode:", error);
                if (socket) socket.disconnect();
            }
        }

        function setupOfflineMode() {
            document.getElementById('chat-container').style.display = 'none';
            if (role === 'admin' || role === 'moderator') {
                document.getElementById('admin-tools').style.display = 'block';
            }
            loadMapFromLocalStorage();
            character = createPlayer({ id: 'local', name: characterName, image: characterImage, role: role, x: x, y: y });
        }

        function gameLoop() {
            if (!character || !gameContainer) { requestAnimationFrame(gameLoop); return; }

            const newPos = { x, y };
            if (keys.ArrowUp) newPos.y -= speed;
            if (keys.ArrowDown) newPos.y += speed;
            if (keys.ArrowLeft) newPos.x -= speed;
            if (keys.ArrowRight) newPos.x += speed;

            const charSize = 50;
            const gameRect = gameContainer.getBoundingClientRect();
            let tempX = Math.max(0, Math.min(newPos.x, gameRect.width - charSize));
            let tempY = Math.max(0, Math.min(newPos.y, gameRect.height - charSize));

            let collision = false;
            const playerRect = { x: tempX, y: tempY, width: charSize, height: charSize };
            for (const obj of mapObjects) {
                if (obj.data.isObstacle) {
                    const correctedObjRect = { x: obj.element.offsetLeft, y: obj.element.offsetTop, width: obj.element.clientWidth, height: obj.element.clientHeight };
                    if (isColliding(playerRect, correctedObjRect)) {
                        collision = true;
                        break;
                    }
                }
            }

            if (!collision) {
                x = tempX;
                y = tempY;
                character.style.left = `${x}px`;
                character.style.top = `${y}px`;
                if (socket && socket.connected) socket.emit('move', { x, y });
            }

            const threshold = 10;
            let direction = null;
            if (y <= threshold) direction = 'up';
            else if (y >= gameRect.height - charSize - threshold) direction = 'down';
            else if (x <= threshold) direction = 'left';
            else if (x >= gameRect.width - charSize - threshold) direction = 'right';

            if (direction) {
                const targetZone = zoneLayout[currentZone] ? zoneLayout[currentZone][direction] : null;
                if (targetZone && !isZoneChangeInProgress) {
                    triggerZoneChange(targetZone);
                }
            } else {
                isZoneChangeInProgress = false;
            }
            requestAnimationFrame(gameLoop);
        }

        function triggerZoneChange(zone) {
            isZoneChangeInProgress = true;
            const confirmed = confirm(`Bạn có muốn đi đến khu vực ${zone} không?`);
            if (confirmed) {
                for (const key in keys) { keys[key] = false; }
                socket.emit('change zone', zone);
            } else {
                // Nudge the player back from the edge to prevent getting stuck
                const threshold = 15;
                const charSize = 50;
                const gameRect = gameContainer.getBoundingClientRect();
                if (y <= threshold) y = threshold;
                if (y >= gameRect.height - charSize - threshold) y = gameRect.height - charSize - threshold;
                if (x <= threshold) x = threshold;
                if (x >= gameRect.width - charSize - threshold) x = gameRect.width - charSize - threshold;

                character.style.left = `${x}px`;
                character.style.top = `${y}px`;
                if (socket && socket.connected) socket.emit('move', { x, y });

                // Allow a new trigger attempt after a short delay
                setTimeout(() => { isZoneChangeInProgress = false; }, 100);
            }
        }

        function isColliding(rect1, rect2) {
            return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
        }

        function showChatBubble(playerElement, name, message) {
            const existingBubble = playerElement.querySelector('.chat-bubble');
            if (existingBubble) existingBubble.remove();
            const bubble = document.createElement('div');
            bubble.classList.add('chat-bubble');
            const temp = document.createElement('div');
            temp.textContent = message;
            bubble.innerHTML = `<strong>${name}:</strong> ${temp.innerHTML}`;
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
            const objectData = { src: data.src, left: data.left, top: data.top, isObstacle: data.isObstacle || false };
            mapObjects.push({ element: img, data: objectData });
            if (role === 'admin' || role === 'moderator') makeDraggable(img);
        }

        function makeDraggable(element) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            const handle = element.querySelector('.drag-handle') || element;
            handle.onmousedown = (e) => {
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
                document.onmousemove = (ev) => {
                    ev.preventDefault();
                    pos1 = pos3 - ev.clientX;
                    pos2 = pos4 - ev.clientY;
                    pos3 = ev.clientX;
                    pos4 = ev.clientY;
                    element.style.top = `${element.offsetTop - pos2}px`;
                    element.style.left = `${element.offsetLeft - pos1}px`;
                };
            };
            if (element.classList.contains('map-object')) {
                element.addEventListener('click', (e) => { e.stopPropagation(); selectObject(element); });
            }
        }

        function selectObject(element) {
            selectedObject = element;
            const selectedObjectTools = document.getElementById('selected-object-tools');
            selectedObjectTools.style.display = 'block';
            const objectData = mapObjects.find(obj => obj.element === element)?.data;
            const isObstacleCheckbox = document.getElementById('is-obstacle-checkbox');
            if (objectData) isObstacleCheckbox.checked = objectData.isObstacle || false;
            isObstacleCheckbox.onchange = () => { if (objectData) objectData.isObstacle = isObstacleCheckbox.checked; };
            document.querySelectorAll('.map-object').forEach(obj => obj.style.border = 'none');
            element.style.border = '2px solid blue';
        }

        function deselectObject() {
            if (selectedObject) selectedObject.style.border = 'none';
            selectedObject = null;
            document.getElementById('selected-object-tools').style.display = 'none';
        }

        function saveMap() {
            const mapLayout = {
                objects: mapObjects.map(obj => ({ src: obj.element.src, left: obj.element.style.left, top: obj.element.style.top, isObstacle: obj.data.isObstacle || false })),
                terrainColor: gameContainer.style.backgroundColor,
                embedCode: document.getElementById('embed-code-input').value
            };
            if (socket && socket.connected) {
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
                setEmbedContent(document.getElementById('embed-container'), mapLayout.embedCode);
                if (role === 'admin') {
                    document.getElementById('embed-code-input').value = mapLayout.embedCode || '';
                }
            }
        }

        function setEmbedContent(container, htmlContent) {
            container.innerHTML = '';
            if (!htmlContent) { container.style.display = 'none'; return; }
            container.style.display = 'block';
            const template = document.createElement('template');
            template.innerHTML = htmlContent;
            Array.from(template.content.childNodes).forEach(node => {
                if (node.nodeName === 'SCRIPT') {
                    const script = document.createElement('script');
                    script.src = node.src;
                    script.async = true;
                    if(node.hasAttribute('data-video-id')) script.setAttribute('data-video-id', node.getAttribute('data-video-id'));
                    document.body.appendChild(script);
                } else {
                    container.appendChild(node.cloneNode(true));
                }
            });
        }

        function loadMapFromLocalStorage() {
            const mapLayout = JSON.parse(localStorage.getItem('mapLayout'));
            loadMap(mapLayout);
        }

        document.addEventListener('keydown', (e) => { if (document.activeElement !== document.getElementById('chat-input') && e.key in keys) keys[e.key] = true; });
        document.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

        const gameUi = document.getElementById('game-ui');
        makeDraggable(gameUi);
        document.getElementById('menu-button').addEventListener('click', () => {
            gameUi.classList.toggle('menu-open');
        });

        gameContainer.addEventListener('click', deselectObject);
        if (role === 'admin' || role === 'moderator') {
            document.getElementById('terrain-color-input').addEventListener('input', (e) => { gameContainer.style.backgroundColor = e.target.value; });
            document.getElementById('add-object-input').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => createMapObject({ src: event.target.result, left: '100px', top: '100px' });
                    reader.readAsDataURL(file);
                }
            });
            document.getElementById('save-map-button').addEventListener('click', saveMap);
            document.getElementById('delete-object-button').addEventListener('click', () => {
                if (selectedObject) {
                    const objectData = mapObjects.find(obj => obj.element === selectedObject);
                    if (objectData) {
                        if (socket && socket.connected) {
                            socket.emit('delete object', { src: objectData.data.src });
                        } else {
                            selectedObject.remove();
                            mapObjects = mapObjects.filter(obj => obj.element !== selectedObject);
                            deselectObject();
                        }
                    }
                }
            });
            if (role === 'admin') {
                document.getElementById('delete-embed-button').addEventListener('click', () => {
                    document.getElementById('embed-code-input').value = '';
                    saveMap();
                });
            }
        }
        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const chatInput = document.getElementById('chat-input');
            if (chatInput.value && socket && socket.connected) {
                const temp = document.createElement('div');
                temp.textContent = chatInput.value;
                socket.emit('chat message', temp.innerHTML);
                chatInput.value = '';
            }
        });
        gameLoop();
    }
});