import React, { useState, useEffect } from "react";
import { socket } from "../socket";

const WordSelector = ({ roomCode, setWordChosen }) => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    socket.on("choose-word", (words) => {
      setOptions(words);
    });

    return () => {
      socket.off("choose-word");
    };
  }, []);

  const chooseWord = (word) => {
    socket.emit("word-chosen", { roomCode, word });
    setWordChosen(true);
  };

  return (
    <div>
      <h3>Choose a word to draw:</h3>
      {options.map((word) => (
        <button key={word} onClick={() => chooseWord(word)} style={{ margin: "10px" }}>
          {word}
        </button>
      ))}
    </div>
  );
};

export default WordSelector;
