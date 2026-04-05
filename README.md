# Nakama Tic-Tac-Toe (JS)

A professional, server-authoritative Tic-Tac-Toe game built with **Nakama JS Runtime** and **React Native (Expo)**.

---

## 🏗️ Architecture & Design Decisions

### 1. Authoritative Game Model
Unlike traditional p2p games, this project uses an **authoritative match** model. Every move is sent to the server, validated against the current game state, and only then broadcast back to players. This prevents client-side manipulation (cheating) and ensures a single "Source of Truth."

### 2. Real-time Synchronization
We use **WebSockets** for game-loop communication.
- **Matchmaker**: Uses Nakama's internal matchmaker to pair players with similar game mode preferences (Classic vs. Timed).
- **Match Processing**: The `matchLoop` on the server runs 2 times per second (`TICK_RATE = 2`) to process moves, manage the turn-timer, and detect winners.

### 3. Persistence & Stats
User statistics (Wins, Losses, Draws) are stored in Nakama's **Storage Engine** and reflected on a global **Leaderboard**.
- All scoring happens on the server after a match is concluded, preventing leaderboard manipulation.

---

## 🛠️ Backend Setup & Configuration

### Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop) and Docker Compose.

### Local Installation
1.  Open your terminal in the repository root.
2.  Start the entire stack (Postgres, Nakama, and the Frontend):
    ```bash
    docker compose up -d
    ```
3.  The Nakama server is reachable at `http://127.0.0.1:7350` and the **Frontend** at `http://127.0.0.1:8081`.

### Server Configuration Details
The server is configured in `docker-compose.yml` with the following key flags:
- `--session.encryption_key "ttt-session-secret"`: Ensures user sessions survive a server restart.
- `--session.token_expiry_sec 7200`: Access tokens are valid for 2 hours.
- `--session.refresh_token_expiry_sec 5184000`: Refresh tokens last 60 days for a persistent login experience.
- `--runtime.path /data/modules`: Points to the server-side code in `server/modules/`.

---

## 📱 Frontend Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended).
- [pnpm](https://pnpm.io/) (preferred) or npm.

### Local Development
1.  Navigate to the mobile directory:
    ```bash
    cd mobile
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Start the Expo development server:
    ```bash
    pnpm run web
    ```
4.  Open `http://localhost:8081` in your browser.

### Client Configuration
The app defaults to connecting to a local Nakama instance at `127.0.0.1:7350`. You can update these settings in the app's **Lobby** screen if your server is hosted elsewhere.

---

## 🕹️ How to Test Multiplayer

To test the full multiplayer flow on your local machine:

1.  **Open two browser windows** at `http://localhost:8081`.
2.  **Window 1**: Log in as `test1@gmail.com`.
3.  **Window 2**: Log in as `test2@gmail.com`.
4.  **Matchmaking**: Select "Timed" or "Classic" in both, then click **Quick Play**. Both players will automatically be placed in a room.
5.  **Private Rooms**:
    -   Window 1: Click **Create Room**, then copy the generated **Match ID**.
    -   Window 2: Paste the ID into the **Join by ID** box and click **Join**.
6.  **Verify Validation**: Try to move twice in a row; the server should ignore the out-of-turn second click.

---

## 🚀 Deployment Documentation

### Backend Deployment
1.  Host your Nakama server on a VPS (Ubuntu/DigitalOcean/AWS).
2.  Ensure ports `7349` (gRPC), `7350` (HTTP/WS), and `7351` (Console) are open in your firewall.
3.  Set a strong `--session.encryption_key` in your production environment.

### Frontend Deployment
- **Web**: Run `pnpm expo export:web` and host the `dist/` directory on any static host like Vercel, Netlify, or S3.
- **Mobile**: Use EAS Build (`eas build`) to generate `.ipa` (iOS) or `.apk` (Android) binaries for the App Store and Google Play.

---

### OCI/Cloud Deployment
If you are deploying this to an OCI instance (Oracle Cloud), follow these steps to ensure the frontend connects to the correct public IP:

1.  **Open Ports**: Ensure ports `7350` (Nakama), `7351` (Console), and `8081` (Frontend) are open in your VCN Security List.
2.  **Set the Host Variable**: In your terminal on the OCI instance, set your public IP before running compose:
    ```bash
    export NAKAMA_HOST="YOUR_PUBLIC_IP"
    docker compose up -d --build
    ```
    This will bake your public IP into the web app during the container build process.

---

## 📁 Repository Structure
- `server/modules/tictactoe.js`: Core authoritative game logic (Server runtime).
- `mobile/src/context/GameContext.js`: Global state management for Nakama sessions/sockets.
- `mobile/src/screens/`: UI screens (Lobby, Game, Leaderboard, etc.).
- `docker-compose.yml`: Local infrastructure orchestration.
