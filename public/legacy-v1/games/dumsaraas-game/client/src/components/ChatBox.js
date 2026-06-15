import React, { useState, useEffect } from "react";
import { socket } from "../socket";

const ChatBox = ({ roomCode, playerName, isDrawer }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    socket.on("chat-message", ({ playerName, message }) => {
      setMessages((prev) => [...prev, { type: "normal", playerName, message }]);
    });

    socket.on("correct-guess", ({ playerName }) => {
      setMessages((prev) => [
        ...prev,
        { type: "correct", playerName, message: "guessed the word!" },
      ]);
    });

    return () => {
      socket.off("chat-message");
      socket.off("correct-guess");
    };
  }, []);

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim() === "") return;

    socket.emit("chat-message", {
      roomCode,
      playerName,
      message: input,
    });

    setInput("");
  };

  return (
    <div style={{ border: "1px solid #999", padding: "10px", height: "300px", overflowY: "scroll" }}>
      {messages.map((msg, i) =>
        msg.type === "correct" ? (
          <p key={i} style={{ color: "green" }}>
            ✅ {msg.playerName} {msg.message}
          </p>
        ) : (
          <p key={i}>
            <strong>{msg.playerName}:</strong> {msg.message}
          </p>
        )
      )}

      {!isDrawer && (
        <form onSubmit={handleSend} style={{ marginTop: "10px" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your guess..."
            style={{ width: "80%" }}
          />
          <button type="submit">Send</button>
        </form>
      )}
    </div>
  );
};

export default ChatBox;