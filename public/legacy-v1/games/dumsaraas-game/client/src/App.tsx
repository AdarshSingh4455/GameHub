import React, { useState } from "react";
import { socket } from "./socket";

function App() {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joined, setJoined] = useState(false);

  const createRoom = () => {
    socket.emit("create-room", { username, settings: { rounds: 3, time: 60 } }, (code) => {
      setRoomCode(code);
      setJoined(true);
    });
  };

  const joinRoom = () => {
    socket.emit("join-room", { username, roomCode }, (res) => {
      if (res.success) {
        setJoined(true);
      } else {
        alert(res.error);
      }
    });
  };

  return (
    <div>
      {!joined ? (
        <div>
          <input placeholder="Enter your name" value={username} onChange={(e) => setUsername(e.target.value)} />
          <br />
          <button onClick={createRoom}>Create Room</button>
          <br />
          <input placeholder="Enter Room Code" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <div>
          <h2>Welcome to Room {roomCode}</h2>
        </div>
      )}
    </div>
  );
}

export default App;
