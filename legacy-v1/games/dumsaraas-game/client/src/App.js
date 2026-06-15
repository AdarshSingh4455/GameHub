import ChatBox from "./components/ChatBox";
import { socket } from "./socket";
import React, { useState } from "react";
import WordSelector from "./components/WordSelector"; // Import the WordSelector component
import DrawBoard from "./components/DrawBoard";

function App() {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [wordChosen, setWordChosen] = useState(false);
  const [displayWord, setDisplayWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(null); // Timer state
  const [hintWord, setHintWord] = useState(""); // Hint state
  const [scores, setScores] = useState({});
  
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

  useEffect(() => {
    // Listen for the start-round event to display the word
    socket.on("start-round", ({ displayWord }) => {
      setDisplayWord(displayWord);
    });

    return () => {
      socket.off("start-round");
    };
  }, []);

  useEffect(() => {
    // Listen for timer and hint updates
    socket.on("timer-update", (time) => {
      setTimeLeft(time);
    });

    socket.on("hint-reveal", (hint) => {
      setHintWord(hint);
    });

    socket.on("turn-ended", () => {
      alert("Turn ended!"); // You can later add full round system
      setHintWord("");
      setTimeLeft(null);
    });

    return () => {
      socket.off("timer-update");
      socket.off("hint-reveal");
      socket.off("turn-ended");
    };
  }, []);

  useEffect(() => {
    socket.on("update-scores", (updatedScores) => {
      setScores(updatedScores);
    });
  
    return () => {
      socket.off("update-scores");
    };
  }, []);


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
        {/* Show Timer */}
        {timeLeft !== null && <h3>⏳ Time Left: {timeLeft}s</h3>}
        {/* Show Hint */}
        {hintWord && <h2>Hint: {hintWord}</h2>}
        {/* Show WordSelector for the drawer */}
        {isDrawer && !wordChosen && <WordSelector roomCode={roomCode} setWordChosen={setWordChosen} />}
        {/* Display the word for guessing */}
        {displayWord && <h2>Guess Word: {displayWord}</h2>}
        {/* Add the DrawBoard component */}
        <DrawBoard isDrawer={isDrawer} roomCode={roomCode} />
        {/* Add the ChatBox component */}
        <ChatBox roomCode={roomCode} playerName={username} isDrawer={isDrawer} />
        <div style={{ border: "1px solid #ccc", padding: "10px", marginTop: "10px" }}>
          <h3>🏆 Scoreboard</h3>
          {Object.entries(scores).map(([name, score]) => (
            <p key={name}>
              <strong>{name}:</strong> {score} points
            </p>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

export default App;
