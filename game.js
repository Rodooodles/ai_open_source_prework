class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.players = {};
        this.avatars = {};
        this.websocket = null;
        
        // Camera/viewport
        this.cameraX = 0;
        this.cameraY = 0;
        
        // Avatar rendering
        this.avatarSize = 32; // Base avatar size
        this.loadedAvatarImages = {};
        
        // Movement
        this.pressedKeys = {};
        this.isMoving = false;
        this.movementInterval = null;
        this.movementSpeed = 100; // milliseconds between move commands (faster)
        
        // Camera movement
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupEventListeners();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.drawWorld();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.drawWorld();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Calculate viewport bounds to ensure we don't show past map edges
        const viewportWidth = this.canvas.width;
        const viewportHeight = this.canvas.height;
        
        // Clamp camera position to map boundaries
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - viewportWidth));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - viewportHeight));
        
        // Draw the world map with camera offset
        this.ctx.drawImage(
            this.worldImage,
            this.cameraX, this.cameraY, viewportWidth, viewportHeight,  // source rectangle
            0, 0, viewportWidth, viewportHeight   // destination rectangle
        );
        
        // Draw avatars on top of the world
        this.renderAvatars();
    }
    
    setupEventListeners() {
        // Handle canvas clicks for future click-to-move functionality
        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Convert screen coordinates to world coordinates
            const worldX = Math.floor(x + this.cameraX);
            const worldY = Math.floor(y + this.cameraY);
            
            console.log(`Clicked at world coordinates: (${worldX}, ${worldY})`);
        });
        
        // Handle mouse drag for camera movement
        this.canvas.addEventListener('mousedown', (event) => {
            this.isDragging = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.canvas.style.cursor = 'grabbing';
        });
        
        this.canvas.addEventListener('mousemove', (event) => {
            if (this.isDragging) {
                const deltaX = event.clientX - this.lastMouseX;
                const deltaY = event.clientY - this.lastMouseY;
                
                // Move camera in opposite direction of mouse drag
                this.cameraX -= deltaX;
                this.cameraY -= deltaY;
                
                this.lastMouseX = event.clientX;
                this.lastMouseY = event.clientY;
                
                this.drawWorld();
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });
        
        // Handle keyboard events for movement
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    connectToServer() {
        try {
            this.websocket = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.websocket.onopen = () => {
                console.log('Connected to game server');
                this.joinGame();
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleServerMessage(message);
                } catch (error) {
                    console.error('Error parsing server message:', error);
                }
            };
            
            this.websocket.onclose = () => {
                console.log('Disconnected from game server');
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    this.connectToServer();
                }, 3000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Robert'
        };
        
        this.websocket.send(JSON.stringify(joinMessage));
        console.log('Sent join_game message');
    }
    
    handleServerMessage(message) {
        console.log('Received message:', message);
        console.log('Current players count:', Object.keys(this.players).length);
        console.log('Current players:', Object.keys(this.players));
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    console.log('Joined game successfully!');
                    console.log('My player ID:', this.myPlayerId);
                    console.log('All players received:', Object.keys(this.players));
                    console.log('Players data:', this.players);
                    this.loadAvatarImages();
                    this.centerCameraOnMyAvatar();
                    this.drawWorld();
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                console.log('New player joined:', message.player.username);
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.loadAvatarImages();
                this.drawWorld();
                break;
                
            case 'players_moved':
                console.log('Players moved, updating positions:', Object.keys(message.players));
                Object.assign(this.players, message.players);
                this.centerCameraOnMyAvatar();
                this.drawWorld();
                break;
                
            case 'player_left':
                console.log('Player left:', message.playerId);
                delete this.players[message.playerId];
                this.drawWorld();
                break;
                
            default:
                console.log('Unknown message type:', message.action);
        }
    }
    
    loadAvatarImages() {
        Object.values(this.avatars).forEach(avatar => {
            if (!this.loadedAvatarImages[avatar.name]) {
                this.loadedAvatarImages[avatar.name] = {};
                
                // Load all frames for each direction
                ['north', 'south', 'east'].forEach(direction => {
                    if (avatar.frames[direction]) {
                        this.loadedAvatarImages[avatar.name][direction] = avatar.frames[direction].map(frameData => {
                            const img = new Image();
                            img.src = frameData;
                            return img;
                        });
                    }
                });
            }
        });
    }
    
    centerCameraOnMyAvatar() {
        if (this.myPlayerId && this.players[this.myPlayerId]) {
            const myPlayer = this.players[this.myPlayerId];
            // Center camera on my avatar
            this.cameraX = myPlayer.x - this.canvas.width / 2;
            this.cameraY = myPlayer.y - this.canvas.height / 2;
        }
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.cameraX,
            y: worldY - this.cameraY
        };
    }
    
    renderAvatars() {
        console.log('Rendering', Object.keys(this.players).length, 'players');
        Object.values(this.players).forEach(player => {
            const screenPos = this.worldToScreen(player.x, player.y);
            
            console.log(`Player ${player.username} at world(${player.x}, ${player.y}) -> screen(${screenPos.x}, ${screenPos.y})`);
            
            // Render all avatars regardless of screen position for debugging
            // TODO: Re-enable culling once we fix the rendering issue
            this.renderAvatar(player, screenPos.x, screenPos.y);
        });
    }
    
    renderAvatar(player, screenX, screenY) {
        const avatar = this.avatars[player.avatar];
        if (!avatar || !this.loadedAvatarImages[player.avatar]) return;
        
        // Get the appropriate frame based on direction and animation
        const facing = player.facing;
        const frameIndex = player.animationFrame || 0;
        
        // Handle west direction by using east frames and flipping
        let frames, shouldFlip = false;
        if (facing === 'left' || facing === 'west') {
            frames = this.loadedAvatarImages[player.avatar]['east'];
            shouldFlip = true;
            console.log('Rendering west-facing avatar with flip');
        } else {
            frames = this.loadedAvatarImages[player.avatar][facing];
            console.log('Rendering avatar facing:', facing);
        }
        
        if (!frames || !frames[frameIndex]) return;
        
        const avatarImg = frames[frameIndex];
        
        // Calculate avatar position (center the avatar on the world position)
        const avatarX = screenX - this.avatarSize / 2;
        const avatarY = screenY - this.avatarSize / 2;
        
        console.log('Avatar position:', { screenX, screenY, avatarX, avatarY, shouldFlip });
        
        if (shouldFlip) {
            console.log('Flipping avatar for west direction');
            // Create a temporary canvas to flip the image
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.avatarSize;
            tempCanvas.height = this.avatarSize;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw the image flipped on the temp canvas
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(avatarImg, -this.avatarSize, 0, this.avatarSize, this.avatarSize);
            
            // Draw the flipped image to the main canvas
            this.ctx.drawImage(tempCanvas, avatarX, avatarY, this.avatarSize, this.avatarSize);
            console.log('Flipped avatar drawn at:', avatarX, avatarY);
        } else {
            // Draw avatar normally
            this.ctx.drawImage(avatarImg, avatarX, avatarY, this.avatarSize, this.avatarSize);
        }
        
        // Draw username label
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const labelY = avatarY - 5;
        const labelX = screenX;
        
        // Draw text outline
        this.ctx.strokeText(player.username, labelX, labelY);
        // Draw text fill
        this.ctx.fillText(player.username, labelX, labelY);
    }
    
    handleKeyDown(event) {
        // Prevent default behavior for arrow keys to avoid page scrolling
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
        }
        
        // Map keys to directions
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down', 
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'KeyW': 'up',
            'KeyS': 'down',
            'KeyA': 'left',
            'KeyD': 'right'
        };
        
        // Handle special keys
        if (event.code === 'KeyC') {
            // Center camera on my avatar
            this.centerCameraOnMyAvatar();
            this.drawWorld();
            return;
        }
        
        const direction = keyMap[event.code];
        if (direction && !this.pressedKeys[event.code]) {
            this.pressedKeys[event.code] = true;
            this.sendMoveCommand(direction);
            this.startContinuousMovement();
        }
    }
    
    handleKeyUp(event) {
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left', 
            'ArrowRight': 'right',
            'KeyW': 'up',
            'KeyS': 'down',
            'KeyA': 'left',
            'KeyD': 'right'
        };
        
        const direction = keyMap[event.code];
        if (direction && this.pressedKeys[event.code]) {
            delete this.pressedKeys[event.code];
            this.checkMovementState();
        }
    }
    
    sendMoveCommand(direction) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not connected, cannot send move command');
            return;
        }
        
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        
        this.websocket.send(JSON.stringify(moveMessage));
        console.log(`Sent move command: ${direction}`);
    }
    
    sendStopCommand() {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not connected, cannot send stop command');
            return;
        }
        
        const stopMessage = {
            action: 'stop'
        };
        
        this.websocket.send(JSON.stringify(stopMessage));
        console.log('Sent stop command');
    }
    
    checkMovementState() {
        // Check if any movement keys are still pressed
        const hasMovementKeys = Object.keys(this.pressedKeys).length > 0;
        
        if (this.isMoving && !hasMovementKeys) {
            // All movement keys released, send stop command
            this.isMoving = false;
            this.stopContinuousMovement();
            this.sendStopCommand();
        }
    }
    
    startContinuousMovement() {
        if (this.movementInterval) return; // Already running
        
        this.movementInterval = setInterval(() => {
            const pressedKeys = Object.keys(this.pressedKeys);
            if (pressedKeys.length > 0) {
                // Get the first pressed key direction
                const keyMap = {
                    'ArrowUp': 'up',
                    'ArrowDown': 'down', 
                    'ArrowLeft': 'left',
                    'ArrowRight': 'right',
                    'KeyW': 'up',
                    'KeyS': 'down',
                    'KeyA': 'left',
                    'KeyD': 'right'
                };
                
                const direction = keyMap[pressedKeys[0]];
                if (direction) {
                    this.sendMoveCommand(direction);
                }
            }
        }, this.movementSpeed);
    }
    
    stopContinuousMovement() {
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
