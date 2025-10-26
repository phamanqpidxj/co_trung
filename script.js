document.addEventListener('DOMContentLoaded', () => {
    // Login and Register Forms
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            window.location.href = 'create-character.html';
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            window.location.href = 'create-character.html';
        });
    }

    // Character Creation Form
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

        createCharacterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const characterName = document.getElementById('character-name').value;
            const characterImageSrc = previewImage.src;

            if (characterName && characterImageSrc !== '#') {
                localStorage.setItem('characterName', characterName);
                localStorage.setItem('characterImage', characterImageSrc);
                window.location.href = 'game.html';
            } else {
                alert('Vui lòng nhập tên và chọn ảnh cho nhân vật.');
            }
        });
    }

    // Game Page
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        const character = document.getElementById('character');
        const characterImage = localStorage.getItem('characterImage');

        if (characterImage) {
            character.style.backgroundImage = `url(${characterImage})`;
        }

        let x = gameContainer.offsetWidth / 2;
        let y = gameContainer.offsetHeight / 2;
        const speed = 10;

        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp':
                    y -= speed;
                    break;
                case 'ArrowDown':
                    y += speed;
                    break;
                case 'ArrowLeft':
                    x -= speed;
                    break;
                case 'ArrowRight':
                    x += speed;
                    break;
            }

            // Boundary detection
            const charSize = 50;
            if (x < charSize / 2) x = charSize / 2;
            if (y < charSize / 2) y = charSize / 2;
            if (x > gameContainer.offsetWidth - charSize / 2) x = gameContainer.offsetWidth - charSize / 2;
            if (y > gameContainer.offsetHeight - charSize / 2) y = gameContainer.offsetHeight - charSize / 2;

            character.style.left = `${x}px`;
            character.style.top = `${y}px`;
        });
    }
});
