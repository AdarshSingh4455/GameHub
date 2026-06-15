import React, { useRef, useEffect, useState } from "react";
import CanvasDraw from "react-canvas-draw";
import { socket } from "../socket";

const DrawBoard = ({ isDrawer, roomCode }) => {
  const canvasRef = useRef();
  const [data, setData] = useState("");

  // Emit drawing data
  const sendDrawing = () => {
    if (isDrawer && canvasRef.current) {
      const drawing = canvasRef.current.getSaveData();
      socket.emit("drawing-data", { roomCode, drawing });
    }
  };

  // Receive and load drawing data
  useEffect(() => {
    socket.on("receive-drawing", ({ drawing }) => {
      if (!isDrawer && canvasRef.current) {
        canvasRef.current.loadSaveData(drawing, false);
      }
    });

    return () => {
      socket.off("receive-drawing");
    };
  }, [isDrawer]);

  // Emit every 500ms to keep performance light
  useEffect(() => {
    let interval;
    if (isDrawer) {
      interval = setInterval(sendDrawing, 500);
    }
    return () => clearInterval(interval);
  }, [isDrawer]);

  return (
    <div>
      <CanvasDraw
        ref={canvasRef}
        disabled={!isDrawer}
        brushColor="#000"
        brushRadius={2}
        canvasWidth={600}
        canvasHeight={400}
      />
    </div>
  );
};

export default DrawBoard;
