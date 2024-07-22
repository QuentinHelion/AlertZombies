// client.js
const socket = new WebSocket('ws://localhost:8080');
let scene, camera, renderer;
let player, bullets = [], zombies = [];
let velocity = new THREE.Vector3(); // Pour stocker la vélocité du joueur
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let jumpVelocity = 0.2;
let gravity = -0.001;
let isJumping = false;
let isSprinting = false;
let onGround = true;
let score = 0; // Score du joueur
let waveNumber = 1; // Compteur de manches
const clock = new THREE.Clock();

const STEPS_PER_FRAME = 5;

// Variables pour le contrôle de la souris
let mouseSensitivity = 0.002;
let pitch = 0;
let yaw = 0;
const maxPitch = Math.PI / 2; // Limiter la rotation verticale

// Variables pour le contrôle des touches
let keys = {
    'z': false,
    's': false,
    'q': false,
    'd': false,
    'k': false,
    'Shift': false
};

// Positions initiales des zombies (à ajuster pour chaque manche)
const initialZombiePositions = [
    new THREE.Vector3(10, 0.5, 10),
    new THREE.Vector3(-10, 0.5, -10),
    new THREE.Vector3(15, 0.5, -15)
];

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ';
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Ajout du sol
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    scene.add(floor);

    // Ajout d'obstacles (cubes)
    const obstacleGeometry = new THREE.BoxGeometry();
    const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    for (let i = 0; i < 10; i++) {
        const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
        obstacle.position.set(Math.random() * 80 - 40, 0.5, Math.random() * 80 - 40);
        scene.add(obstacle);
    }

    const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.y = 0.5;
    player.rotation.order = 'YXZ';
    player.add(camera);
    scene.add(player);

    camera.position.z = 0;
    camera.position.y = 0.5;

    // Création d'éléments HTML pour afficher le score et le compteur de manches
    const infoElement = document.createElement('div');
    infoElement.style.position = 'absolute';
    infoElement.style.top = '10px';
    infoElement.style.left = '10px';
    infoElement.style.color = '#ffffff';
    infoElement.style.fontSize = '24px';
    infoElement.style.fontFamily = 'Arial';
    document.body.appendChild(infoElement);

    // Faire apparaître les zombies au lancement
    startWave(waveNumber);

    function animate(){
        const deltaTime = Math.min( 0.05, clock.getDelta() ) / STEPS_PER_FRAME;

        // for(let i = 0; i < STEPS_PER_FRAME; i++){
        //     handleMovement(deltaTime );
        // }
        
        requestAnimationFrame(animate);
        applyPhysics();
        checkCollisions();
        updateScore();
        updateWaveInfo(); // Mise à jour du compteur de manches
        handleMovement(deltaTime );
        updateZombieMovement(); // Mise à jour du déplacement des zombies
        renderer.render(scene, camera);
    }
    animate();

    // Add pointer lock event listeners
    document.addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === document.body) {
            document.addEventListener('mousemove', onMouseMove, false);
        } else {
            document.removeEventListener('mousemove', onMouseMove, false);
        }
    });

    // Release pointer lock on Esc
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document.exitPointerLock();
        }
        if (event.key === ' ') { // Espace pour sauter
            if (onGround) {
                isJumping = true;
            }
        }
        if (event.key in keys) {
            keys[event.key] = true;
        }
    });

    document.addEventListener('keyup', (event) => {
        if (event.key in keys) {
            keys[event.key] = false;
        }
    });
}

function onMouseMove(event) {
    // yaw -= event.movementX * mouseSensitivity;
    // pitch -= event.movementY * mouseSensitivity;
    //
    // // Limiter la rotation verticale pour éviter que la caméra ne fasse un tour complet
    // pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
    //
    // player.rotation.y = yaw;
    // player.rotation.x = pitch;
    player.rotation.y -= event.movementX / 500;
    player.rotation.x += event.movementY / 500 ;
}

function applyPhysics() {
    if (isJumping) {
        velocity.y = jumpVelocity;
        isJumping = false;
        onGround = false;
    }

    // Appliquer la gravité
    velocity.y += gravity;

    // Appliquer la vélocité
    player.position.add(velocity.clone());

    // Vérifier si le joueur touche le sol
    if (player.position.y <= 0.5) {
        player.position.y = 0.5;
        velocity.y = 0;
        onGround = true;
    }
}

function getForwardVector() {
    player.getWorldDirection( playerDirection ); // renvoie le vecteur qui correspond a la direction du joueur
    playerDirection.y = 0;
    playerDirection.normalize(); // met entre 1 et 0

    return playerDirection;
}

function getSideVector() {
    player.getWorldDirection( playerDirection );  // renvoie le vecteur qui correspond a la direction du joueur
    playerDirection.y = 0;
    playerDirection.normalize(); // met entre 1 et 0
    playerDirection.cross( player.up ); // croise le vecteur de direction coter avec le vecteur de direction avant

    return playerDirection;
}

function handleMovement(deltaTime) {

    const moveDistance = isSprinting ? 0.2 : 0.1; // Vitesse de sprint
    const SPEED = 0.2;
    const speedDelta = deltaTime * SPEED;

    if (keys['z']) {
        velocity.add( getForwardVector().multiplyScalar( -speedDelta) );
    }
    if (keys['s']) {
        velocity.add( getForwardVector().multiplyScalar( speedDelta ) );
    }
    if (keys['q']) {
        velocity.add( getSideVector().multiplyScalar( speedDelta ) );
    }
    if (keys['d']) {
        velocity.add( getSideVector().multiplyScalar( -speedDelta ) );
    }
    if ( keys[ 'k' ] ) {
        console.log("x: "+player.position.x);
        console.log("z: "+player.position.z);
    }

    // Mise à jour de la position de la caméra en fonction du joueur
    // camera.position.copy(player.position).add(new THREE.Vector3(0, 2, 5).applyQuaternion(camera.quaternion));
    let damping = Math.exp( -4 * deltaTime ) - 1; // effet de ralentissement
    console.log(damping);
    velocity.addScaledVector( velocity, damping ); // freine le joueur
    // velocity.add( getSideVector().multiplyScalar( -damping ) );
    sendPositionUpdate(); // Envoi des mises à jour de la position
}

function sendPositionUpdate() {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'updatePosition', position: player.position }));
    }
}

function spawnZombie(position) {
    // Création d'un zombie basique avec une géométrie de boîte
    const zombieGeometry = new THREE.BoxGeometry(1, 1.5, 1);
    const zombieMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const zombie = new THREE.Mesh(zombieGeometry, zombieMaterial);
    zombie.position.copy(position);
    scene.add(zombie);
    zombies.push(zombie);
}

function startWave(number) {
    // Réinitialiser les zombies
    zombies.forEach(zombie => scene.remove(zombie));
    zombies = [];

    // Calculer le nombre de zombies à ajouter pour cette manche
    const numberOfZombies = Math.ceil(3 * Math.pow(1.1, number)); // Ajoute 10% à chaque manche
    const positions = [];

    for (let i = 0; i < numberOfZombies; i++) {
        positions.push(new THREE.Vector3(
            Math.random() * 60 - 30,
            0.5,
            Math.random() * 60 - 30
        ));
    }

    // Faire apparaître les zombies pour cette manche
    positions.forEach(position => spawnZombie(position));
}

function updateZombieMovement() {
    zombies.forEach(zombie => {
        // Trouver le joueur le plus proche
        const closestPlayer = player; // Actuellement, il n'y a qu'un joueur
        const direction = new THREE.Vector3().subVectors(closestPlayer.position, zombie.position).normalize();
        zombie.position.add(direction.multiplyScalar(0.02)); // Vitesse de déplacement
    });
}

function checkCollisions() {
    bullets.forEach((bullet, bulletIndex) => {
        bullet.position.add(bullet.velocity);
        zombies.forEach((zombie, zombieIndex) => {
            if (bullet.position.distanceTo(zombie.position) < 1) {
                scene.remove(zombie);
                zombies.splice(zombieIndex, 1);
                scene.remove(bullet);
                bullets.splice(bulletIndex, 1);
                score += 1; // Incrementer le score
                sendZombieKilled(); // Envoi de la mise à jour du score

                // Vérifier si tous les zombies sont morts
                if (zombies.length === 0) {
                    waveNumber++;
                    startWave(waveNumber);
                }
            }
        });
    });
}

function sendZombieKilled() {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'zombieKilled' }));
    }
}

function updateScore() {
    const infoElement = document.querySelector('div');
    infoElement.innerText = `Score: ${score} | Manche: ${waveNumber}`;
}

function updateWaveInfo() {
    // Mise à jour du compteur de manches
    updateScore(); // Utiliser la fonction updateScore pour afficher les infos de la manche
}

document.addEventListener('click', (event) => {
    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(0.1),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    bullet.position.copy(player.position);
    bullet.velocity = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    scene.add(bullet);
    bullets.push(bullet);
    sendShoot(bullet); // Envoi du tir
});

function sendShoot(bullet) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'shoot', position: bullet.position, direction: bullet.velocity }));
    }
}

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'updatePlayers') {
        // Update other players' positions
    } else if (data.type === 'spawnZombie') {
        spawnZombie(new THREE.Vector3(data.position.x, data.position.y, data.position.z));
    } else if (data.type === 'shoot') {
        // Handle other players' shots
    } else if (data.type === 'zombieKilled') {
        score += 1; // Incrémenter le score en cas de zombie tué par un autre joueur
    }
});

init();
