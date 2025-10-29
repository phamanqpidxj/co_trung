document.addEventListener('DOMContentLoaded', () => {
    const handleFormSubmit = (formId, callback) => {
        const form = document.getElementById(formId);
        if (form) form.addEventListener('submit', callback);
    };

    if (document.getElementById('login-form')) {
        handleFormSubmit('login-form', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (!username) {
                alert('Vui lòng nhập tên người dùng.');
                return;
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                localStorage.setItem('role', data.role);
                localStorage.setItem('username', username);
                window.location.href = 'create-character.html';
            } catch (error) {
                console.error('Login failed:', error);
                alert('Đã xảy ra lỗi đăng nhập.');
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
                    displayZoneTitle();
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

                socket.on('object updated', (data) => {
                    const objectToUpdate = mapObjects.find(obj => obj.data.id === data.id);
                    if (objectToUpdate && objectToUpdate.element) {
                        const el = objectToUpdate.element;
                        el.style.width = data.width;
                        el.style.height = data.height;
                        el.style.left = data.left;
                        el.style.top = data.top;
                        // Also update the local data array to stay in sync
                        objectToUpdate.data.width = data.width;
                        objectToUpdate.data.height = data.height;
                        objectToUpdate.data.left = data.left;
                        objectToUpdate.data.top = data.top;
                    }
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

        function displayZoneTitle() {
            const existingTitle = document.getElementById('zone-title');
            if (existingTitle) {
                existingTitle.remove();
            }

            let titleText = '';
            switch (currentZone) {
                case 'dong':
                    titleText = 'Đông Hải';
                    break;
                case 'tay':
                    titleText = 'Tây Mạc';
                    break;
                case 'bac':
                    titleText = 'Bắc Nguyên';
                    break;
                case 'nam':
                    titleText = 'Nam Cương';
                    break;
                case 'trung':
                    titleText = 'Trung Nguyên';
                    break;
            }

            if (titleText) {
                const titleElement = document.createElement('div');
                titleElement.id = 'zone-title';
                titleElement.textContent = titleText;
                gameContainer.appendChild(titleElement);

                setTimeout(() => {
                    titleElement.remove();
                }, 5000);
            }
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
            // Apply width and height if they exist in the data
            if (data.width) img.style.width = data.width;
            if (data.height) img.style.height = data.height;
            img.dataset.id = data.id || Date.now(); // Assign or generate a unique ID
            gameContainer.appendChild(img);
            const objectData = {
                id: img.dataset.id,
                src: data.src,
                left: data.left,
                top: data.top,
                width: img.style.width,
                height: img.style.height,
                isObstacle: data.isObstacle || false
            };
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
            deselectObject();

            selectedObject = element;
            selectedObject.classList.add('selected');

            const selectedObjectTools = document.getElementById('selected-object-tools');
            selectedObjectTools.style.display = 'block';

            const objectData = mapObjects.find(obj => obj.element === element)?.data;
            const isObstacleCheckbox = document.getElementById('is-obstacle-checkbox');
            const widthInput = document.getElementById('object-width');
            const heightInput = document.getElementById('object-height');

            if (objectData) {
                isObstacleCheckbox.checked = objectData.isObstacle || false;
                widthInput.value = selectedObject.style.width || `${selectedObject.clientWidth}px`;
                heightInput.value = selectedObject.style.height || `${selectedObject.clientHeight}px`;
            }

            isObstacleCheckbox.onchange = () => {
                if (objectData) objectData.isObstacle = isObstacleCheckbox.checked;
            };

            const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right'];
            handles.forEach(handleClass => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${handleClass}`;
                selectedObject.appendChild(handle);
                handle.addEventListener('mousedown', (e) => startResize(e, handleClass));
            });
        }

        function deselectObject() {
            if (selectedObject) {
                selectedObject.classList.remove('selected');
                const handles = selectedObject.querySelectorAll('.resize-handle');
                handles.forEach(handle => handle.remove());
            }
            selectedObject = null;
            document.getElementById('selected-object-tools').style.display = 'none';
        }
        window.selectObject = selectObject; // Expose for testing

        let initialRect, initialMouseX, initialMouseY, currentHandle;

        function startResize(e, handleClass) {
            e.preventDefault();
            e.stopPropagation();

            initialRect = selectedObject.getBoundingClientRect();
            const gameRect = gameContainer.getBoundingClientRect();
            // Adjust for game container's position if it's not at (0,0)
            initialRect.x -= gameRect.x;
            initialRect.y -= gameRect.y;

            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            currentHandle = handleClass;

            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
        }

        function resize(e) {
            if (!selectedObject) return;

            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;

            let newWidth = initialRect.width;
            let newHeight = initialRect.height;
            let newLeft = initialRect.left;
            let newTop = initialRect.top;

            // Calculate new dimensions and positions based on the handle being dragged
            if (currentHandle.includes('right')) {
                newWidth = initialRect.width + dx;
            } else if (currentHandle.includes('left')) {
                newWidth = initialRect.width - dx;
                newLeft = initialRect.left + dx;
            }

            if (currentHandle.includes('bottom')) {
                newHeight = initialRect.height + dy;
            } else if (currentHandle.includes('top')) {
                newHeight = initialRect.height - dy;
                newTop = initialRect.top + dy;
            }

            // Enforce minimum size and adjust position to keep the opposite edge stationary
            if (newWidth <= 10) {
                newWidth = 10;
                if (currentHandle.includes('left')) {
                    // Keep the right edge fixed
                    newLeft = initialRect.left + initialRect.width - 10;
                }
            }

            if (newHeight <= 10) {
                newHeight = 10;
                if (currentHandle.includes('top')) {
                    // Keep the bottom edge fixed
                    newTop = initialRect.top + initialRect.height - 10;
                }
            }

            // Apply the final calculated styles
            selectedObject.style.width = `${newWidth}px`;
            selectedObject.style.left = `${newLeft}px`;
            selectedObject.style.height = `${newHeight}px`;
            selectedObject.style.top = `${newTop}px`;

            // Update the dimension display in the UI
            document.getElementById('object-width').value = `${Math.round(newWidth)}px`;
            document.getElementById('object-height').value = `${Math.round(newHeight)}px`;
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);

            if (selectedObject) {
                const objectData = mapObjects.find(obj => obj.element === selectedObject)?.data;
                if (objectData) {
                    objectData.width = selectedObject.style.width;
                    objectData.height = selectedObject.style.height;
                    objectData.left = selectedObject.style.left;
                    objectData.top = selectedObject.style.top;

                    if (socket && socket.connected) {
                        socket.emit('object updated', {
                            id: objectData.id,
                            width: objectData.width,
                            height: objectData.height,
                            left: objectData.left,
                            top: objectData.top
                        });
                    }
                }
            }
        }

        function saveMap() {
            const mapLayout = {
                objects: mapObjects.map(obj => ({
                    id: obj.data.id, // Ensure ID is saved
                    src: obj.element.src,
                    left: obj.element.style.left,
                    top: obj.element.style.top,
                    width: obj.element.style.width,
                    height: obj.element.style.height,
                    isObstacle: obj.data.isObstacle || false
                })),
                terrainColor: gameContainer.style.backgroundColor,
                embedCode: document.getElementById('embed-code-input').value
            };
            if (socket && socket.connected) {
                socket.emit('save map', mapLayout);
            } else {
                localStorage.setItem('mapLayout', JSON.stringify(mapLayout));
            }
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
            if (!htmlContent) {
                container.style.display = 'none';
                return;
            }
            container.style.display = 'block';
            container.innerHTML = htmlContent;
        }

        function loadMapFromLocalStorage() {
            const mapLayout = JSON.parse(localStorage.getItem('mapLayout'));
            loadMap(mapLayout);
        }

        document.addEventListener('keydown', (e) => { if (document.activeElement !== document.getElementById('chat-input') && e.key in keys) keys[e.key] = true; });
        document.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

        const gameUi = document.getElementById('game-ui');
        makeDraggable(gameUi);

        // Add click listener to the menu button to toggle the '.menu-open' class
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
                            socket.emit('delete object', { id: objectData.data.id });
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